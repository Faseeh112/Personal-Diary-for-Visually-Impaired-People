"""Note service — supports nested transactions and tag-by-name on create.

Multi-party transaction contract (request payload):
  Each transaction in `payload["transactions"]` may specify any of:
    sender_person_id   : int (existing person row)  OR
    sender_name        : str (resolved or auto-created)
    receiver_person_id : int (existing person row)  OR
    receiver_name      : str (resolved or auto-created)

  NULL on either side means "the App User". Self-references like "me",
  "myself", "I", "user" in *_name fields are normalized to NULL.

  At least one party must be non-NULL (User cannot be both sender AND
  receiver — meaningless self-transfer).
"""
from ..extensions import db
from ..models import Note, NoteTransaction
from ..utils.errors import HTTPError
from ..utils.validators import parse_date, enum_in, positive_number
from . import tag_service, person_service

NOTE_TYPES    = {"event", "memory", "asset", "gift_received", "general"}
INPUT_SOURCES = {"voice", "manual"}

# Tokens treated as the App User in *_name fields
_USER_ALIASES = {"me", "myself", "i", "user", "the user", "app user"}


def list_for_user(user_id: int):
    return (Note.query.filter_by(user_id=user_id, is_active=True)
            .order_by(Note.created_at.desc()).all())


def get(user_id: int, note_id: int) -> Note:
    n = Note.query.filter_by(note_id=note_id, user_id=user_id).first()
    if not n or not n.is_active:
        raise HTTPError("Note not found", 404)
    return n


def create(user_id: int, payload: dict) -> Note:
    if not payload.get("title") and not payload.get("description"):
        raise HTTPError("Note requires title or description", 400)

    note_type = payload.get("note_type", "general")
    enum_in(note_type, NOTE_TYPES, "note_type")
    input_source = payload.get("input_source", "manual")
    enum_in(input_source, INPUT_SOURCES, "input_source")

    n = Note(
        user_id=user_id,
        title=payload.get("title"),
        description=payload.get("description"),
        note_type=note_type,
        category_id=payload.get("category_id"),
        person_id=payload.get("person_id"),
        location_id=payload.get("location_id"),
        event_instance_id=payload.get("event_instance_id"),
        note_date=parse_date(payload.get("note_date"), "note_date"),
        input_source=input_source,
        sentiment=payload.get("sentiment"),
    )

    db.session.add(n)

    for tag_name in (payload.get("tags") or []):
        n.tags.append(tag_service.get_or_create(tag_name))

    db.session.flush()  # get note_id for transactions

    for txn in (payload.get("transactions") or []):
        _attach_transaction(user_id, n, txn)

    db.session.commit()
    return n


def update(user_id: int, note_id: int, payload: dict) -> Note:
    n = get(user_id, note_id)
    for f in ("title", "description", "sentiment"):
        if f in payload:
            setattr(n, f, payload[f])
    if "note_type" in payload:
        enum_in(payload["note_type"], NOTE_TYPES, "note_type")
        n.note_type = payload["note_type"]
    if "note_date" in payload:
        n.note_date = parse_date(payload["note_date"], "note_date")
    for f in ("category_id", "person_id", "location_id", "event_instance_id"):
        if f in payload:
            setattr(n, f, payload[f])
    if "tags" in payload:
        n.tags = [tag_service.get_or_create(t) for t in (payload["tags"] or [])]
    db.session.commit()
    return n


def delete(user_id: int, note_id: int) -> None:
    n = get(user_id, note_id)
    n.is_active = False
    db.session.commit()


# ════════════════════════════════════════════════════════════════════
# TRANSACTION HELPERS
# ════════════════════════════════════════════════════════════════════

def _resolve_party(user_id: int, p_id, p_name):
    """Translate a (id_or_None, name_or_None) pair into a person_id or None.

    Returns:
        int   if the party is a real person row (existing or auto-created)
        None  if the party refers to the App User
    """
    # Explicit ID wins
    if p_id:
        return p_id

    # No name → User
    if not p_name:
        return None

    cleaned = p_name.strip()
    if not cleaned or cleaned.lower() in _USER_ALIASES:
        return None

    # Auto-fetch or create the third party
    return person_service.get_or_create_by_name(user_id, cleaned).person_id


def _attach_transaction(user_id: int, note: Note, txn: dict) -> NoteTransaction:
    amount = positive_number(txn.get("amount"), "amount", allow_zero=False)

    sender_id   = _resolve_party(user_id,
                                 txn.get("sender_person_id"),
                                 txn.get("sender_name"))
    receiver_id = _resolve_party(user_id,
                                 txn.get("receiver_person_id"),
                                 txn.get("receiver_name"))

    # Validation: at least one party non-NULL, and they must differ
    if sender_id is None and receiver_id is None:
        raise HTTPError(
            "Transaction must specify at least one party "
            "(sender or receiver). NULL on both sides is meaningless.",
            400,
        )
    if sender_id is not None and receiver_id is not None and sender_id == receiver_id:
        raise HTTPError(
            "Sender and receiver cannot be the same person.",
            400,
        )

    t = NoteTransaction(
        note_id=note.note_id,
        sender_person_id=sender_id,
        receiver_person_id=receiver_id,
        amount=amount,
        currency=(txn.get("currency") or "PKR").upper(),
        category_id=txn.get("category_id"),
        notes=txn.get("notes"),
    )
    db.session.add(t)
    return t


def add_transaction(user_id: int, note_id: int, txn: dict) -> NoteTransaction:
    n = get(user_id, note_id)
    t = _attach_transaction(user_id, n, txn)
    db.session.commit()
    return t


def list_transactions(user_id: int, note_id: int):
    n = get(user_id, note_id)
    return [t for t in n.transactions if t.is_active]
