"""Event instance service.

Stores parent life events (birth, wedding, death, anniversary).
Cascade logic (auto-generating child reminders) lives in Phase 3 — this
service just persists the parent row.
"""
from ..extensions import db
from ..models import EventInstance
from ..utils.errors import HTTPError
from ..utils.validators import require, parse_date, enum_in

EVENT_TYPES = {"birth", "wedding", "death", "anniversary", "other"}


def list_for_user(user_id: int):
    return (EventInstance.query.filter_by(user_id=user_id, is_active=True)
            .order_by(EventInstance.event_date.desc()).all())


def get(user_id: int, event_instance_id: int) -> EventInstance:
    e = EventInstance.query.filter_by(event_instance_id=event_instance_id, user_id=user_id).first()
    if not e or not e.is_active:
        raise HTTPError("Event instance not found", 404)
    return e


def create(user_id: int, payload: dict) -> EventInstance:
    event_type = enum_in(require(payload, "event_type"), EVENT_TYPES, "event_type")
    title = require(payload, "title")
    event_date = parse_date(require(payload, "event_date"), "event_date")
    e = EventInstance(
        user_id=user_id,
        event_type=event_type,
        title=title,
        description=payload.get("description"),
        event_date=event_date,
        subject_person_id=payload.get("subject_person_id"),
    )
    db.session.add(e)
    db.session.commit()
    return e


def update(user_id: int, event_instance_id: int, payload: dict) -> EventInstance:
    e = get(user_id, event_instance_id)
    for f in ("title", "description", "subject_person_id"):
        if f in payload:
            setattr(e, f, payload[f])
    if "event_type" in payload:
        e.event_type = enum_in(payload["event_type"], EVENT_TYPES, "event_type")
    if "event_date" in payload:
        e.event_date = parse_date(payload["event_date"], "event_date")
    db.session.commit()
    return e


def delete(user_id: int, event_instance_id: int) -> None:
    e = get(user_id, event_instance_id)
    e.is_active = False
    db.session.commit()
