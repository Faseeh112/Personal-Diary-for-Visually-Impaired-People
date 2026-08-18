"""Smart Diary — Text CLI Demo & Test Harness (v2.0)

Supports all intents: store, query, update, delete + audio actions.
Uses persist_extraction() for consistent storage, query_service.ask() for queries.
Comprehensive grouped test sections for manual validation.
"""
import sys, os, re, traceback
from datetime import datetime, date, timedelta
from pprint import pprint
import bcrypt

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

# Seed PKR currency if missing
if not Currency.query.filter_by(code="PKR").first():
    db.session.add(Currency(code="PKR", name="Pakistani Rupee"))
    db.session.commit()

# Seed default categories
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

# Seed zakat nisab for current year
_year = date.today().year
if not ZakatNisab.query.filter_by(year=_year, currency="PKR").first():
    db.session.add(ZakatNisab(
        year=_year, currency="PKR",
        nisab_amount=280_000,
        gold_price_per_gram=18000,
        notes="Approximate",
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
            if isinstance(i, dict):
                print(f"    {i}")
            else:
                print(f"    - {i}")
    else:
        print(f"    {content}")


def banner(text):
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}")


# ── Intent detection ─────────────────────────────────────────────
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


# ── CRUD handlers ────────────────────────────────────────────────

def handle_store(text: str, extraction):
    """Persist via persist_extraction (unified path)."""
    result = persist_extraction(USER_ID, text, extraction)
    section("PERSIST RESULT", result)
    return f"Stored → {result['target_entity']} (ID: {result['primary_id']})"


def handle_query(text: str):
    """Use query_service.ask() for full pipeline."""
    resp = query_service.ask(USER_ID, text, input_source="text")
    section("QUERY PLAN", resp.get("plan"))
    section("FACTS", resp.get("facts"))
    return resp["answer"]


def handle_update(text: str, extraction):
    """Handle update commands for notes, reminders, stored items, assets, audio."""
    tl = text.lower()

    # --- Reminder update ---
    if "reminder" in tl or "remind" in tl:
        kw = re.sub(r"\b(change|update|move|modify|set|reschedule|edit)\b", "", tl, flags=re.I).strip()
        kw = re.sub(r"\b(reminder|to|the|at|from)\b", "", kw, flags=re.I).strip()
        words = [w for w in kw.split() if len(w) > 2]
        if words:
            reminders = Reminder.query.filter(
                Reminder.user_id == USER_ID, Reminder.is_active == True
            ).all()
            for r in reminders:
                if any(w.lower() in r.title.lower() for w in words):
                    if extraction.time:
                        hh, mm = extraction.time.split(":")
                        r.reminder_datetime = r.reminder_datetime.replace(hour=int(hh), minute=int(mm))
                        db.session.commit()
                        return f"Updated reminder '{r.title}' → {r.reminder_datetime}"
                    if extraction.date:
                        d = date.fromisoformat(extraction.date)
                        r.reminder_datetime = r.reminder_datetime.replace(year=d.year, month=d.month, day=d.day)
                        db.session.commit()
                        return f"Updated reminder '{r.title}' → {r.reminder_datetime}"
        return "No matching reminder found to update."

    # --- Stored item location update ---
    if extraction.item and extraction.location:
        items = StoredItem.query.filter(
            StoredItem.user_id == USER_ID, StoredItem.is_active == True,
            StoredItem.item_name.ilike(f"%{extraction.item}%"),
        ).all()
        if items:
            items[0].location_text = extraction.location
            db.session.commit()
            return f"Updated '{items[0].item_name}' location → {extraction.location}"
        return handle_store(text, extraction)

    # --- Transaction amount update ---
    if extraction.person and extraction.amount:
        person = Person.query.filter(
            Person.user_id == USER_ID, Person.name.ilike(f"%{extraction.person}%"),
            Person.is_active == True,
        ).first()
        if person:
            txn = (NoteTransaction.query.join(Note)
                   .filter(Note.user_id == USER_ID, NoteTransaction.is_active == True)
                   .filter(db.or_(
                       NoteTransaction.sender_person_id == person.person_id,
                       NoteTransaction.receiver_person_id == person.person_id,
                   ))
                   .order_by(NoteTransaction.created_at.desc()).first())
            if txn:
                old = float(txn.amount)
                txn.amount = extraction.amount
                db.session.commit()
                return f"Updated txn with {extraction.person}: {old} → {extraction.amount}"
        return f"No transaction found with {extraction.person}."

    # --- Asset value update ---
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

    # --- Audio time update ---
    if "audio" in tl or "play" in tl:
        actions = AudioAction.query.filter(
            AudioAction.user_id == USER_ID, AudioAction.is_active == True
        ).all()
        if actions and extraction.time:
            hh, mm = extraction.time.split(":")
            for a in actions:
                if a.play_datetime:
                    a.play_datetime = a.play_datetime.replace(hour=int(hh), minute=int(mm))
            db.session.commit()
            return f"Updated audio schedule → {extraction.time}"

    # --- Event date update ---
    if extraction.person and extraction.date:
        notes = Note.query.filter(
            Note.user_id == USER_ID, Note.is_active == True,
            db.or_(Note.title.ilike(f"%{extraction.person}%"),
                   Note.description.ilike(f"%{extraction.person}%")),
        ).all()
        if notes:
            d = date.fromisoformat(extraction.date)
            notes[0].note_date = d
            db.session.commit()
            return f"Updated note '{notes[0].title}' date → {d}"

    return "Could not determine what to update."


def handle_delete(text: str, extraction):
    """Handle delete commands."""
    tl = text.lower()

    # Delete reminder
    if "reminder" in tl or "remind" in tl:
        kw = re.sub(r"\b(delete|remove|cancel|drop|erase|forget)\b", "", tl, flags=re.I).strip()
        kw = re.sub(r"\b(reminder|the|my)\b", "", kw, flags=re.I).strip()
        words = [w for w in kw.split() if len(w) > 2]
        for r in Reminder.query.filter_by(user_id=USER_ID, is_active=True).all():
            if words and any(w.lower() in r.title.lower() for w in words):
                r.is_active = False
                db.session.commit()
                return f"Deleted reminder: '{r.title}'"
        return "No matching reminder found."

    # Delete stored item
    if extraction.item:
        item = StoredItem.query.filter(
            StoredItem.user_id == USER_ID, StoredItem.is_active == True,
            StoredItem.item_name.ilike(f"%{extraction.item}%"),
        ).first()
        if item:
            item.is_active = False
            db.session.commit()
            return f"Deleted item: '{item.item_name}'"
        return f"No item '{extraction.item}' found."

    # Delete transaction by person (optionally filtered by date/event)
    if extraction.person:
        person = Person.query.filter(
            Person.user_id == USER_ID, Person.name.ilike(f"%{extraction.person}%"),
            Person.is_active == True,
        ).first()
        if person:
            q = (NoteTransaction.query.join(Note)
                 .filter(Note.user_id == USER_ID, NoteTransaction.is_active == True)
                 .filter(db.or_(
                     NoteTransaction.sender_person_id == person.person_id,
                     NoteTransaction.receiver_person_id == person.person_id,
                 )))
            if extraction.date:
                q = q.filter(Note.note_date == date.fromisoformat(extraction.date))
            if extraction.event_context:
                q = q.filter(NoteTransaction.event_context.ilike(f"%{extraction.event_context}%"))
            txn = q.order_by(NoteTransaction.created_at.desc()).first()
            if txn:
                txn.is_active = False
                db.session.commit()
                return f"Deleted txn with {extraction.person} (ID: {txn.txn_id})"
        return f"No transaction with {extraction.person} found."

    # Delete asset
    if extraction.asset:
        asset = Asset.query.filter(
            Asset.user_id == USER_ID, Asset.is_active == True,
            Asset.name.ilike(f"%{extraction.asset}%"),
        ).first()
        if asset:
            asset.is_active = False
            db.session.commit()
            return f"Deleted asset: '{asset.name}'"

    # Delete audio
    if any(w in tl for w in ("audio", "play", "surah", "playlist")):
        for a in AudioAction.query.filter_by(user_id=USER_ID, is_active=True).all():
            if a.audio_name.lower() in tl or any(w in a.audio_name.lower() for w in tl.split()):
                a.is_active = False
                db.session.commit()
                return f"Deleted audio: '{a.audio_name}'"
        return "No matching audio routine found."

    return "Could not determine what to delete."


# ── Main pipeline ────────────────────────────────────────────────

def process(text: str):
    if len(text.split()) < 2:
        section("RESPONSE", "Please provide more detail.")
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

        section("RESPONSE", answer)
        show_db()

    except Exception as e:
        section("ERROR", f"{type(e).__name__}: {e}")
        traceback.print_exc()


# ── Debug DB viewer ──────────────────────────────────────────────

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


# ══════════════════════════════════════════════════════════════════
# GROUPED TEST HARNESS
# ══════════════════════════════════════════════════════════════════

def run_tests():
    """Comprehensive grouped tests for all 7 features + CRUD."""

    # ── 1. EVENT MEMORY ─────────────────────────────────────────
    banner("TEST 1: EVENT MEMORY — Store, Query, Update, Delete")
    for c in [
        # STORE
        "Today I met Ahmad at the office",
        "Ali wedding is on 12 June",
        "Doctor appointment next Friday",
        "I visited the bank today",
        "Had a meeting with the client yesterday",
        # QUERY
        "What happened today?",
        "Show all my events",
        "When is Ali wedding?",
        # UPDATE
        "Change Ali wedding date to 15 June",
        # DELETE
        "Delete doctor appointment",
    ]:
        process(c)

    # ── 2. FINANCIAL TRANSACTIONS ────────────────────────────────
    banner("TEST 2: FINANCIAL TRANSACTIONS — Single, Multi, Aggregation, CRUD")
    for c in [
        "I gave Ali 500",
        "Ahmed gave me 1200",
        "I lent 50000 to Ali on 2 May 2023",
        "I gave Shahid 1000 on his daughter wedding",
        "I gave Ali 500, Ahmed 300, and Sara 700",
        # QUERY
        "How much did I give Ali?",
        "What did Ahmed give me?",
        "How much did I give Shahid on his daughter wedding?",
        "How much total did I give?",
        # UPDATE
        "Change Ali amount to 700",
        # DELETE
        "Delete Sara transaction",
    ]:
        process(c)

    # ── 3. ITEM LOCATION ─────────────────────────────────────────
    banner("TEST 3: STORED ITEM LOCATION — Store, Query, Update, Delete")
    for c in [
        "My passport is in the top drawer",
        "I kept my charger in bedroom cabinet",
        "Laptop is in office cupboard",
        "Where is my passport?",
        "Find my charger",
        "Where did I put my laptop?",
        # UPDATE
        "Passport is now in locker",
        # DELETE
        "Remove passport location",
    ]:
        process(c)

    # ── 4. ASSET MANAGEMENT ──────────────────────────────────────
    banner("TEST 4: ASSETS — Store, List, Update, Delete")
    for c in [
        "I have 5 tola gold",
        "Cash 500000",
        "Savings account has 200000",
        "I bought a car worth 2 million",
        "Show all my assets",
        "What assets do I have?",
        # UPDATE
        "Change car value to 2500000",
        # DELETE
        "Delete cash asset",
    ]:
        process(c)

    # ── 5. ZAKAT ─────────────────────────────────────────────────
    banner("TEST 5: ZAKAT CALCULATION")
    for c in [
        "Calculate zakat",
        "How much zakat on my assets?",
    ]:
        process(c)

    # ── 6. REMINDERS ─────────────────────────────────────────────
    banner("TEST 6: REMINDERS — One-time, Repeating, CRUD")
    for c in [
        "Remind me tomorrow at 5pm to call mom",
        "Set reminder every Monday at 9am for standup",
        "Remind me daily at 7am to take medicine",
        "Remind me on 25 Dec at 7pm for dinner party",
        "What are my reminders?",
        "Move call mom reminder to 6pm",
        "Cancel dentist reminder",
    ]:
        process(c)

    # ── 7. AUDIO ROUTINES ────────────────────────────────────────
    banner("TEST 7: AUDIO ROUTINES — Schedule, Query, Update, Delete")
    for c in [
        "Play Surah Yaseen every day at 6am",
        "Play workout playlist every Monday at 7am",
        "Show my audio routines",
        "Change audio time to 8am",
        "Stop morning audio routine",
    ]:
        process(c)

    banner("ALL TESTS COMPLETE — Check DB state above for validation")


# ── Interactive CLI ──────────────────────────────────────────────

def cli_loop():
    print("\n" + "="*60)
    print("  Smart Diary Text CLI v2.0")
    print("  Commands:  :test  :show  :reset  exit")
    print("="*60)
    while True:
        try:
            cmd = input("\n> ").strip()
            if not cmd:
                continue
            if cmd.lower() == "exit":
                break
            elif cmd.lower() == ":test":
                run_tests()
            elif cmd.lower() == ":show":
                show_db()
            elif cmd.lower() == ":reset":
                for model in [Note, StoredItem, Reminder, Asset, AudioAction, EventInstance]:
                    model.query.filter_by(user_id=USER_ID).update({"is_active": False})
                NoteTransaction.query.filter(
                    NoteTransaction.note_id.in_(
                        db.session.query(Note.note_id).filter_by(user_id=USER_ID)
                    )
                ).update({"is_active": False}, synchronize_session="fetch")
                db.session.commit()
                print("  All user data soft-deleted for clean re-test.")
            else:
                process(cmd)
        except KeyboardInterrupt:
            print("\nExiting.")
            break
        except Exception as e:
            print(f"\n  [ERROR] {e}")
            traceback.print_exc()


if __name__ == "__main__":
    cli_loop()
