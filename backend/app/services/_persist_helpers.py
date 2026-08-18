

"""Shared persistence helpers used by voice + cascade services.

Translates Phase 3 AI output (ExtractionResult, KnowledgeTripleDTO) into rows
in the multi-party note_transaction schema.

Transaction interpretation contract (what the NLP extractor must obey):
  * direction == "given"        → User → person   (sender=NULL,    receiver=person)
  * direction == "received"     → person → User   (sender=person,  receiver=NULL)
  * direction == "third_party"  → sender → receiver (both names required)
  * If sender_name and/or receiver_name are present on the Transaction
    dataclass, they take precedence over the direction-based interpretation.
"""
from __future__ import annotations

from datetime import date as _date
from typing import Optional, Tuple

from sqlalchemy import or_

from ..extensions import db
from ..models import (Person, Category, Note, NoteTransaction, Asset,
                      StoredItem, Reminder, KnowledgeTriple, PredicateVocab,
                      Location, AudioAction)


# ════════════════════════════════════════════════════════════════════
# REFERENCE LOOKUPS
# ════════════════════════════════════════════════════════════════════

def find_or_create_person(user_id: int, name: str) -> Person:
    """Resolve a person name to a row, creating it if missing."""
    p = Person.query.filter(
        Person.user_id == user_id,
        db.func.lower(Person.name) == name.lower(),
        Person.is_active == True
    ).first()
    if p:
        return p
    p = Person(user_id=user_id, name=name, is_active=True)
    db.session.add(p)
    db.session.flush()
    return p


def find_category(user_id: int, name: Optional[str]) -> Optional[Category]:
    if not name:
        return None
    return Category.query.filter(
        Category.name == name,
        or_(Category.user_id == user_id, Category.user_id.is_(None)),
        Category.is_active == True,   # noqa: E712
    ).first()


def find_or_create_location(user_id: int, location_text: str) -> Optional[Location]:
    if not location_text:
        return None
    loc = Location.query.filter_by(user_id=user_id, name=location_text,
                                   is_active=True).first()
    if loc:
        return loc
    loc = Location.query.filter_by(user_id=user_id, full_path=location_text,
                                   is_active=True).first()
    if loc:
        return loc
    loc = Location(user_id=user_id, name=location_text, full_path=location_text,
                   depth=0, is_active=True)
    db.session.add(loc)
    db.session.flush()
    return loc


# ════════════════════════════════════════════════════════════════════
# TRANSACTION TRANSLATION (extractor output → sender/receiver IDs)
# ════════════════════════════════════════════════════════════════════

_USER_ALIASES = {"me", "myself", "i", "user", "the user", "app user", ""}


def _is_user_token(name: Optional[str]) -> bool:
    """Recognize user self-reference tokens emitted by NLP/LLM extractors."""
    return name is None or name.strip().lower() in _USER_ALIASES


def _resolve_party(user_id: int, name: Optional[str]) -> Optional[int]:
    """Convert a name string into a person_id, or None if it refers to User."""
    if _is_user_token(name):
        return None
    return find_or_create_person(user_id, name.strip()).person_id


def _translate_to_sender_receiver(
    user_id: int,
    txn,
) -> Tuple[Optional[int], Optional[int]]:
    """Return (sender_person_id, receiver_person_id) for a Transaction dataclass.

    Priority order:
      1. Explicit sender_name / receiver_name → use them as-is.
      2. direction == "third_party" with no names → degraded best-effort.
      3. direction == "received"  → (person, NULL)
      4. direction == "given" / default → (NULL, person)
    """
    sender_name   = getattr(txn, "sender_name",   None)
    receiver_name = getattr(txn, "receiver_name", None)
    direction     = getattr(txn, "direction",     None)
    primary_name  = getattr(txn, "person",        None)

    # Path 1: explicit sender/receiver from the extractor wins
    if sender_name is not None or receiver_name is not None:
        sender_id   = _resolve_party(user_id, sender_name)
        receiver_id = _resolve_party(user_id, receiver_name)
        return sender_id, receiver_id

    # Path 2: third_party but no names → fall through to legacy default
    if direction == "third_party" and primary_name and not _is_user_token(primary_name):
        # Best-effort: log primary as receiver, User as sender
        return None, find_or_create_person(user_id, primary_name).person_id

    # Path 3: legacy "received"
    if direction == "received":
        if primary_name and not _is_user_token(primary_name):
            return find_or_create_person(user_id, primary_name).person_id, None
        return None, None  # malformed; will be filtered by validator

    # Path 4: legacy "given" / default
    if primary_name and not _is_user_token(primary_name):
        return None, find_or_create_person(user_id, primary_name).person_id
    return None, None  # malformed; will be filtered by validator


def _validate_transaction_parties(sender_id: Optional[int],
                                  receiver_id: Optional[int]) -> bool:
    """Enforce: at least one non-NULL, and they must differ."""
    if sender_id is None and receiver_id is None:
        return False  # would violate DB CHECK
    if (sender_id is not None and receiver_id is not None
            and sender_id == receiver_id):
        return False  # self-transfer; meaningless
    return True


# ════════════════════════════════════════════════════════════════════
# PERSIST EXTRACTION
# ════════════════════════════════════════════════════════════════════

def persist_extraction(user_id: int, transcript: str, extraction,
                       voice_entry_id: Optional[int] = None) -> dict:
    """Persist an ExtractionResult to DB using the right target entity.

    Returns:
        {
          "target_entity": str,
          "primary_id":    int | None,
          "note_id":       int | None,
          "asset_id":      int | None,
          "stored_item_id":int | None,
          "reminder_id":   int | None,
          "skipped_txns":  int,    # transactions dropped due to validation
        }
    """
    result = {"target_entity": extraction.target_entity, "primary_id": None,
              "note_id": None, "asset_id": None, "stored_item_id": None,
              "reminder_id": None, "audio_action_id": None, "skipped_txns": 0}

    if extraction.target_entity == "stored_item":
        result["stored_item_id"] = _persist_stored_item(user_id, transcript, extraction)
        result["primary_id"] = result["stored_item_id"]

    elif extraction.target_entity == "asset":
        asset_id, note_id, skipped = _persist_asset(user_id, transcript, extraction)
        result["asset_id"]  = asset_id
        result["note_id"]   = note_id
        result["primary_id"] = asset_id
        result["skipped_txns"] = skipped

    elif extraction.target_entity == "reminder":
        result["reminder_id"] = _persist_reminder(user_id, transcript, extraction)
        result["primary_id"] = result["reminder_id"]

    elif extraction.target_entity == "audio_action":
        result["audio_action_id"] = _persist_audio_action(user_id, transcript, extraction)
        result["primary_id"] = result["audio_action_id"]

    else:  # "note"
        note_id, skipped = _persist_note(user_id, transcript, extraction)
        result["note_id"] = note_id
        result["primary_id"] = note_id
        result["skipped_txns"] = skipped

    db.session.commit()
    return result


def _persist_note(user_id: int, transcript: str, extraction) -> Tuple[int, int]:
    """Persist a note + its transactions. Returns (note_id, skipped_count)."""
    cat = find_category(user_id, extraction.category)
    note_date = _date.fromisoformat(extraction.date) if extraction.date else None

    note = Note(
        user_id=user_id,
        title=transcript[:200],
        description=transcript,
        note_type=extraction.note_type or "general",
        category_id=cat.category_id if cat else None,
        note_date=note_date,
        input_source="voice",
    )
    db.session.add(note)
    db.session.flush()

    skipped = 0
    for txn in extraction.transactions:
        sender_id, receiver_id = _translate_to_sender_receiver(user_id, txn)
        if not _validate_transaction_parties(sender_id, receiver_id):
            skipped += 1
            continue

        nt = NoteTransaction(
            note_id=note.note_id,
            sender_person_id=sender_id,
            receiver_person_id=receiver_id,
            amount=txn.amount,
            currency=txn.currency,
            category_id=cat.category_id if cat else None,
            event_context=getattr(txn, "event_context", None),
            is_active=True,
        )
        db.session.add(nt)

    db.session.flush()
    return note.note_id, skipped


def _persist_asset(user_id: int, transcript: str,
                   extraction) -> Tuple[int, Optional[int], int]:
    """Asset + companion Note. Returns (asset_id, note_id, skipped_count).

    Now correctly populates Asset.note_id for traceability.
    """
    note_id, skipped = _persist_note(user_id, transcript, extraction)

    cat = find_category(user_id, extraction.category)
    purchase_value = (extraction.transactions[0].amount
                      if extraction.transactions else None)
    currency = (extraction.transactions[0].currency
                if extraction.transactions else "PKR")
    acquired_date = _date.fromisoformat(extraction.date) if extraction.date else None

    is_gift = extraction.note_type == "gift_received"
    acquired_from = (extraction.persons[0] if extraction.persons else None)

    a = Asset(
        user_id=user_id,
        note_id=note_id,                           # FIX: link asset to note
        name=extraction.asset or transcript[:80],
        category_id=cat.category_id if cat else None,
        purchase_value=purchase_value,
        currency=currency,
        acquired_date=acquired_date,
        acquisition_type="gift_received" if is_gift else "purchased",
        acquired_from=acquired_from,
        purpose="personal",
        is_active=True,
    )
    db.session.add(a)
    db.session.flush()
    return a.asset_id, note_id, skipped


def _persist_stored_item(user_id: int, transcript: str, extraction) -> int:
    loc = (find_or_create_location(user_id, extraction.location)
           if extraction.location else None)

    s = StoredItem(
        user_id=user_id,
        item_name=extraction.item or transcript[:80],
        location_id=loc.location_id if loc else None,
        location_text=extraction.location,
        description=transcript,
        input_source="voice",
        is_active=True,
    )
    db.session.add(s)
    db.session.flush()
    return s.stored_item_id


def _persist_reminder(user_id: int, transcript: str, extraction) -> int:
    from datetime import datetime, time as _time
    if extraction.date:
        d = _date.fromisoformat(extraction.date)
    else:
        from datetime import date as today_date
        d = today_date.today()

    if extraction.time:
        hh, mm = extraction.time.split(":")
        t = _time(int(hh), int(mm))
    else:
        t = _time(9, 0)

    when = datetime.combine(d, t)

    # Detect repeat type from text
    repeat_type = "None"
    tl = transcript.lower()
    if "every day" in tl or "daily" in tl:
        repeat_type = "Daily"
    elif any(day in tl for day in ["every monday", "every tuesday", "every wednesday",
                                    "every thursday", "every friday", "every saturday", "every sunday"]):
        repeat_type = "Weekly"
    elif "every month" in tl or "monthly" in tl:
        repeat_type = "Monthly"
    elif "every year" in tl or "yearly" in tl:
        repeat_type = "Yearly"

    r = Reminder(
        user_id=user_id,
        title=getattr(extraction, "reminder_title", None) or transcript[:200],
        description=transcript,
        reminder_datetime=when,
        repeat_type=repeat_type,
        input_source="voice",
        is_active=True,
    )
    db.session.add(r)
    db.session.flush()
    return r.reminder_id


def _persist_audio_action(user_id: int, transcript: str, extraction) -> int:
    from datetime import datetime, time as _time
    play_dt = None
    if extraction.date or extraction.time:
        if extraction.date:
            d = _date.fromisoformat(extraction.date)
        else:
            d = _date.today()
        if extraction.time:
            hh, mm = extraction.time.split(":")
            t = _time(int(hh), int(mm))
        else:
            t = _time(6, 0)
        play_dt = datetime.combine(d, t)

    a = AudioAction(
        user_id=user_id,
        audio_name=getattr(extraction, "audio_name", None) or transcript[:200],
        playback_mode="auto_summary",
        file_path=None,
        play_datetime=play_dt,
        repeat_type=getattr(extraction, "audio_repeat_type", None) or "None",
        is_active_schedule=True,
        is_active=True,
    )
    db.session.add(a)
    db.session.flush()
    return a.audio_action_id


# ════════════════════════════════════════════════════════════════════
# PERSIST TRIPLES
# ════════════════════════════════════════════════════════════════════

def persist_triples(user_id: int, source_note_id: Optional[int],
                    triple_dtos, extraction_model: str = "rule-based-v2") -> int:
    """Insert KnowledgeTriple rows, deduplicated by (user, s, p, o)."""
    inserted = 0
    for dto in triple_dtos:
        existing = KnowledgeTriple.query.filter_by(
            user_id=user_id,
            subject_text=dto.subject_text,
            predicate=dto.predicate,
            object_text=dto.object_text,
        ).first()
        if existing:
            continue
        pv = PredicateVocab.query.filter_by(predicate_text=dto.predicate).first()
        kt = KnowledgeTriple(
            user_id=user_id,
            source_note_id=source_note_id,
            subject_text=dto.subject_text,
            subject_type=dto.subject_type,
            predicate=dto.predicate,
            predicate_id=pv.predicate_id if pv else None,
            object_text=dto.object_text,
            object_type=dto.object_type,
            confidence=dto.confidence,
            extraction_model=extraction_model,
            is_active=True,
        )
        db.session.add(kt)
        inserted += 1
    db.session.flush()
    return inserted




