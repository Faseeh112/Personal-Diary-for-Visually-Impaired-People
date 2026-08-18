"""Smart Diary — Voice CLI Demo & Test Harness (v2.0)

Full voice pipeline parity with demo_text_loop.py.
Records audio → STT → NER → CRUD → TTS spoken response.
Also supports text input fallback for testing without mic.
"""
import sys, os, re, traceback, tempfile
from datetime import datetime, date, timedelta
from pprint import pprint
import bcrypt

# ── Voice / Audio Imports ────────────────────────────────────────
try:
    import sounddevice as sd
    import soundfile as sf
    _HAS_AUDIO = True
except ImportError:
    print("[WARN] sounddevice/soundfile not installed — voice recording disabled.")
    print("       Install: pip install sounddevice soundfile numpy")
    _HAS_AUDIO = False

try:
    import pyttsx3
    tts_engine = pyttsx3.init()
except (ImportError, Exception) as e:
    print(f"[WARN] pyttsx3 unavailable ({e}) — TTS disabled, will print instead.")
    tts_engine = None


def speak(text):
    """Speak text aloud via TTS, or print if TTS unavailable."""
    if tts_engine and text:
        print(f"\n  [SPOKEN] {text}")
        tts_engine.say(text)
        tts_engine.runAndWait()
    else:
        print(f"\n  [RESPONSE] {text}")


def record_audio(duration=6, fs=16000):
    """Record from microphone, return path to WAV file."""
    if not _HAS_AUDIO:
        raise RuntimeError("Audio recording not available (sounddevice not installed).")
    print(f"\n  [Recording for {duration}s... Speak now!]")
    recording = sd.rec(int(duration * fs), samplerate=fs, channels=1)
    sd.wait()
    print("  [Recording finished.]")
    file_path = os.path.join(tempfile.gettempdir(), "demo_voice_loop.wav")
    sf.write(file_path, recording, fs)
    return file_path


# ── Backend imports ──────────────────────────────────────────────
from app import create_app
from app.extensions import db
from app.models import (
    Note, NoteTransaction, Asset, Person, StoredItem, AppUser,
    Reminder, AudioAction, EventInstance, Category, Currency,
    ZakatNisab,
)
from app.ai.ner import SmartDiaryExtractor
from app.ai.query_parser import parse_query, QueryType
from app.ai.rag_answerer import answer as generate_answer
from app.services.fact_retriever import fetch_facts
from app.services._persist_helpers import persist_extraction
from app.services import query_service
from app.ai.stt import transcribe

# ── App bootstrap ────────────────────────────────────────────────
app = create_app()
app.app_context().push()

if "sqlite" in str(app.config.get("SQLALCHEMY_DATABASE_URI", "")).lower():
    db.create_all()

# ── Seed test user ───────────────────────────────────────────────
test_user = AppUser.query.filter_by(email="demo@test.com").first()
if not test_user:
    test_user = AppUser(
        name="demo",
        email="demo@test.com",
        language="en",
        password_hash=bcrypt.hashpw(b"password", bcrypt.gensalt()),
    )
    db.session.add(test_user)
    db.session.commit()

if not Currency.query.filter_by(code="PKR").first():
    db.session.add(Currency(code="PKR", name="Pakistani Rupee"))
    db.session.commit()

_DEFAULT_CATS = [
    ("General", False), ("Expense", False), ("Income", False),
    ("Function", False), ("Gift", False), ("Gold", True),
    ("Cash", True), ("Investment", True), ("Vehicle", False),
    ("Property", False), ("Health", False), ("Education", False),
]
for cname, zakat in _DEFAULT_CATS:
    if not Category.query.filter_by(name=cname, user_id=None).first():
        db.session.add(Category(name=cname, is_zakatable=zakat, user_id=None))
db.session.commit()

_year = date.today().year
if not ZakatNisab.query.filter_by(year=_year, currency="PKR").first():
    db.session.add(ZakatNisab(
        year=_year, currency="PKR", nisab_amount=280_000,
        gold_price_per_gram=18000, notes="Approximate",
    ))
    db.session.commit()

USER_ID = test_user.user_id
ner = SmartDiaryExtractor()

# ── Output helpers ───────────────────────────────────────────────
def section(title, content=None):
    print(f"\n  [{title}]")
    if content is None:
        return
    if isinstance(content, dict):
        for k, v in content.items():
            print(f"    {k}: {v}")
    elif isinstance(content, list):
        for i in content:
            print(f"    {i}" if isinstance(i, dict) else f"    - {i}")
    else:
        print(f"    {content}")


def banner(text):
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}")


# ── Intent detection (same as text loop) ─────────────────────────
_QUERY_STARTS = {"how", "what", "where", "when", "which", "show",
                 "find", "tell", "list", "calculate"}
_UPDATE_RE = re.compile(
    r"\b(change|update|move|modify|rename|set|reschedule|edit)\b", re.I)
_DELETE_RE = re.compile(
    r"\b(delete|remove|cancel|drop|erase|forget)\b", re.I)


def detect_intent(text: str) -> str:
    tl = text.lower().strip()
    if _DELETE_RE.search(tl):
        return "delete"
    if _UPDATE_RE.search(tl):
        return "update"
    first_word = tl.split()[0] if tl.split() else ""
    if "?" in text or first_word in _QUERY_STARTS:
        return "query"
    return "store"


# ══════════════════════════════════════════════════════════════════
# CRUD HANDLERS — identical logic to demo_text_loop.py
# ══════════════════════════════════════════════════════════════════

def handle_store(text, extraction):
    result = persist_extraction(USER_ID, text, extraction)
    section("PERSIST", result)
    return f"Stored → {result['target_entity']} (ID: {result['primary_id']})"


def handle_query(text):
    resp = query_service.ask(USER_ID, text, input_source="voice")
    section("QUERY PLAN", resp.get("plan"))
    section("FACTS", resp.get("facts"))
    return resp["answer"]


def handle_update(text, extraction):
    tl = text.lower()

    if "reminder" in tl or "remind" in tl:
        kw = re.sub(r"\b(change|update|move|modify|set|reschedule|edit|reminder|to|the|at|from)\b",
                     "", tl, flags=re.I).strip()
        words = [w for w in kw.split() if len(w) > 2]
        for r in Reminder.query.filter_by(user_id=USER_ID, is_active=True).all():
            if words and any(w.lower() in r.title.lower() for w in words):
                if extraction.time:
                    hh, mm = extraction.time.split(":")
                    r.reminder_datetime = r.reminder_datetime.replace(hour=int(hh), minute=int(mm))
                    db.session.commit()
                    return f"Updated reminder '{r.title}' → {r.reminder_datetime}"
        return "No matching reminder found."

    if extraction.item and extraction.location:
        item = StoredItem.query.filter(
            StoredItem.user_id == USER_ID, StoredItem.is_active == True,
            StoredItem.item_name.ilike(f"%{extraction.item}%"),
        ).first()
        if item:
            item.location_text = extraction.location
            db.session.commit()
            return f"Updated '{item.item_name}' → {extraction.location}"
        return handle_store(text, extraction)

    if extraction.person and extraction.amount:
        person = Person.query.filter(
            Person.user_id == USER_ID, Person.name.ilike(f"%{extraction.person}%"),
            Person.is_active == True,
        ).first()
        if person:
            txn = (NoteTransaction.query.join(Note)
                   .filter(Note.user_id == USER_ID, NoteTransaction.is_active == True,
                           db.or_(NoteTransaction.sender_person_id == person.person_id,
                                  NoteTransaction.receiver_person_id == person.person_id))
                   .order_by(NoteTransaction.created_at.desc()).first())
            if txn:
                old = float(txn.amount)
                txn.amount = extraction.amount
                db.session.commit()
                return f"Updated txn with {extraction.person}: {old} → {extraction.amount}"

    if extraction.asset:
        asset = Asset.query.filter(
            Asset.user_id == USER_ID, Asset.is_active == True,
            Asset.name.ilike(f"%{extraction.asset}%"),
        ).first()
        if asset and extraction.amount:
            old = float(asset.current_value or 0)
            asset.current_value = extraction.amount
            db.session.commit()
            return f"Updated asset '{asset.name}': {old} → {extraction.amount}"

    if "audio" in tl or "play" in tl:
        actions = AudioAction.query.filter_by(user_id=USER_ID, is_active=True).all()
        if actions and extraction.time:
            hh, mm = extraction.time.split(":")
            for a in actions:
                if a.play_datetime:
                    a.play_datetime = a.play_datetime.replace(hour=int(hh), minute=int(mm))
            db.session.commit()
            return f"Updated audio schedule → {extraction.time}"

    return "Could not determine what to update."


def handle_delete(text, extraction):
    tl = text.lower()

    if "reminder" in tl or "remind" in tl:
        kw = re.sub(r"\b(delete|remove|cancel|drop|erase|forget|reminder|the|my)\b",
                     "", tl, flags=re.I).strip()
        words = [w for w in kw.split() if len(w) > 2]
        for r in Reminder.query.filter_by(user_id=USER_ID, is_active=True).all():
            if words and any(w.lower() in r.title.lower() for w in words):
                r.is_active = False
                db.session.commit()
                return f"Deleted reminder: '{r.title}'"
        return "No matching reminder."

    if extraction.item:
        item = StoredItem.query.filter(
            StoredItem.user_id == USER_ID, StoredItem.is_active == True,
            StoredItem.item_name.ilike(f"%{extraction.item}%"),
        ).first()
        if item:
            item.is_active = False
            db.session.commit()
            return f"Deleted item: '{item.item_name}'"

    if extraction.person:
        person = Person.query.filter(
            Person.user_id == USER_ID, Person.name.ilike(f"%{extraction.person}%"),
            Person.is_active == True,
        ).first()
        if person:
            q = (NoteTransaction.query.join(Note)
                 .filter(Note.user_id == USER_ID, NoteTransaction.is_active == True,
                         db.or_(NoteTransaction.sender_person_id == person.person_id,
                                NoteTransaction.receiver_person_id == person.person_id)))
            if extraction.event_context:
                q = q.filter(NoteTransaction.event_context.ilike(f"%{extraction.event_context}%"))
            txn = q.order_by(NoteTransaction.created_at.desc()).first()
            if txn:
                txn.is_active = False
                db.session.commit()
                return f"Deleted txn with {extraction.person} (ID: {txn.txn_id})"

    if extraction.asset:
        asset = Asset.query.filter(
            Asset.user_id == USER_ID, Asset.is_active == True,
            Asset.name.ilike(f"%{extraction.asset}%"),
        ).first()
        if asset:
            asset.is_active = False
            db.session.commit()
            return f"Deleted asset: '{asset.name}'"

    if any(w in tl for w in ("audio", "play", "surah", "playlist")):
        for a in AudioAction.query.filter_by(user_id=USER_ID, is_active=True).all():
            if a.audio_name.lower() in tl:
                a.is_active = False
                db.session.commit()
                return f"Deleted audio: '{a.audio_name}'"

    return "Could not determine what to delete."


# ── Main pipeline ────────────────────────────────────────────────

def process(text: str, voice_mode: bool = False):
    """Process text through full pipeline. Speaks response if voice_mode."""
    if len(text.split()) < 2:
        speak("Please provide more detail.") if voice_mode else section("RESPONSE", "Please provide more detail.")
        return

    banner(f"INPUT: {text}")
    try:
        intent = detect_intent(text)
        section("INTENT", intent)

        extraction = ner.extract(text, intent=intent)
        ner_out = {k: v for k, v in extraction.to_dict().items()
                   if k not in ("raw_text", "confidence") and v not in (None, "", [], {})}
        section("NER", ner_out)

        if intent == "query":
            answer = handle_query(text)
        elif intent == "store":
            answer = handle_store(text, extraction)
        elif intent == "update":
            answer = handle_update(text, extraction)
        elif intent == "delete":
            answer = handle_delete(text, extraction)
        else:
            answer = "Unknown intent."

        if voice_mode:
            speak(answer)
        else:
            section("RESPONSE", answer)

    except Exception as e:
        section("ERROR", f"{type(e).__name__}: {e}")
        traceback.print_exc()
        if voice_mode:
            speak("An error occurred processing your request.")


# ── DB viewer ────────────────────────────────────────────────────

def show_db():
    section("DB STATE")
    for label, model, order_col in [
        ("Notes",       Note,        Note.note_id),
        ("StoredItems", StoredItem,  StoredItem.stored_item_id),
        ("Reminders",   Reminder,    Reminder.reminder_id),
        ("Assets",      Asset,       Asset.asset_id),
        ("AudioActions",AudioAction, AudioAction.audio_action_id),
    ]:
        rows = model.query.filter_by(user_id=USER_ID, is_active=True).order_by(order_col.desc()).limit(5).all()
        print(f"    {label}:")
        if not rows:
            print("      (none)")
        for r in rows:
            print(f"      {r.to_dict()}")

    txns = (NoteTransaction.query.join(Note)
            .filter(Note.user_id == USER_ID, NoteTransaction.is_active == True)
            .order_by(NoteTransaction.txn_id.desc()).limit(5).all())
    print("    Transactions:")
    if not txns:
        print("      (none)")
    for t in txns:
        s = db.session.get(Person, t.sender_person_id).name if t.sender_person_id else "User"
        r = db.session.get(Person, t.receiver_person_id).name if t.receiver_person_id else "User"
        print(f"      [{t.txn_id}] {t.amount} {t.currency}  {s}→{r}  ctx={t.event_context}")


# ── Test harness (same tests as text loop, run via text input) ──

def run_tests():
    """Same grouped tests as demo_text_loop.py — run as text, validate voice parity."""

    banner("TEST 1: EVENT MEMORY")
    for c in [
        "Today I met Ahmad at the office",
        "Ali wedding is on 12 June",
        "What happened today?",
        "Show all my events",
    ]:
        process(c)

    banner("TEST 2: FINANCIAL TRANSACTIONS")
    for c in [
        "I gave Ali 500",
        "Ahmed gave me 1200",
        "I gave Shahid 1000 on his daughter wedding",
        "How much did I give Ali?",
        "How much did I give Shahid on his daughter wedding?",
    ]:
        process(c)

    banner("TEST 3: ITEM LOCATION")
    for c in [
        "My passport is in the top drawer",
        "Where is my passport?",
        "Find my charger",
    ]:
        process(c)

    banner("TEST 4: ASSETS")
    for c in [
        "I have 5 tola gold",
        "Cash 500000",
        "Show all my assets",
    ]:
        process(c)

    banner("TEST 5: ZAKAT")
    for c in ["Calculate zakat"]:
        process(c)

    banner("TEST 6: REMINDERS")
    for c in [
        "Remind me tomorrow at 5pm to call mom",
        "Set reminder every Monday at 9am for standup",
        "What are my reminders?",
    ]:
        process(c)

    banner("TEST 7: AUDIO ROUTINES")
    for c in [
        "Play Surah Yaseen every day at 6am",
        "Show my audio routines",
    ]:
        process(c)

    banner("VOICE PIPELINE TESTS COMPLETE")
    show_db()


# ── Interactive CLI ──────────────────────────────────────────────

def cli_loop():
    print("\n" + "="*60)
    print("  Smart Diary Voice CLI v2.0")
    print("  [Enter] → record voice    't' → text input")
    print("  :test → run tests    :show → DB state    exit → quit")
    print("="*60)
    while True:
        try:
            cmd_type = input("\n[Enter=voice / t=text / :cmd] > ").strip()
            if cmd_type.lower() == "exit":
                speak("Goodbye!")
                break
            elif cmd_type.lower() == ":test":
                run_tests()
                continue
            elif cmd_type.lower() == ":show":
                show_db()
                continue
            elif cmd_type.lower() == ":reset":
                for model in [Note, StoredItem, Reminder, Asset, AudioAction, EventInstance]:
                    model.query.filter_by(user_id=USER_ID).update({"is_active": False})
                NoteTransaction.query.filter(
                    NoteTransaction.note_id.in_(
                        db.session.query(Note.note_id).filter_by(user_id=USER_ID)
                    )
                ).update({"is_active": False}, synchronize_session="fetch")
                db.session.commit()
                speak("All data reset.")
                continue
            elif cmd_type.lower() == "t":
                text = input("  Type: ").strip()
                if text:
                    process(text, voice_mode=True)
            elif cmd_type == "":
                # Voice recording
                if not _HAS_AUDIO:
                    print("  Audio not available. Use 't' for text input.")
                    continue
                audio_path = record_audio(duration=6)
                print("  [Transcribing...]")
                text = transcribe(audio_path)
                print(f"  [Transcript]: '{text}'")
                if not text or not text.strip():
                    speak("I didn't catch that. Please try again.")
                    continue
                process(text, voice_mode=True)
            else:
                # Treat as text input
                process(cmd_type, voice_mode=True)

        except KeyboardInterrupt:
            speak("Exiting.")
            break
        except Exception as e:
            print(f"\n  [ERROR] {e}")
            traceback.print_exc()
            speak("An unexpected error occurred.")


if __name__ == "__main__":
    cli_loop()
