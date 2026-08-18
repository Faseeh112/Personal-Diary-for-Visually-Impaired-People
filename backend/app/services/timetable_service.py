"""Timetable service — structural daily slots."""
from ..extensions import db
from ..models import Timetable
from ..utils.errors import HTTPError
from ..utils.validators import require, parse_time, enum_in

ACTIVITY_TYPES = {"prayer", "study", "work", "rest", "exercise", "meal", "religious", "other"}
RECURRENCE     = {"Daily", "Weekly", "Weekdays", "Weekends", "Custom"}


def list_for_user(user_id: int):
    return (Timetable.query.filter_by(user_id=user_id, is_active=True)
            .order_by(Timetable.start_time).all())


def get(user_id: int, timetable_id: int) -> Timetable:
    t = Timetable.query.filter_by(timetable_id=timetable_id, user_id=user_id).first()
    if not t or not t.is_active:
        raise HTTPError("Timetable slot not found", 404)
    return t


def create(user_id: int, payload: dict) -> Timetable:
    title = require(payload, "title")
    activity_type = enum_in(require(payload, "activity_type"), ACTIVITY_TYPES, "activity_type")
    start_t = parse_time(require(payload, "start_time"), "start_time")
    end_t   = parse_time(require(payload, "end_time"), "end_time")
    if end_t <= start_t:
        raise HTTPError("end_time must be after start_time", 400)
    recurrence = enum_in(payload.get("recurrence", "Daily"), RECURRENCE, "recurrence")
    t = Timetable(
        user_id=user_id, title=title, activity_type=activity_type,
        start_time=start_t, end_time=end_t,
        recurrence=recurrence,
        days_of_week=payload.get("days_of_week"),
        priority=int(payload.get("priority", 2)),
        notes=payload.get("notes"),
    )
    db.session.add(t)
    db.session.commit()
    return t


def update(user_id: int, timetable_id: int, payload: dict) -> Timetable:
    t = get(user_id, timetable_id)
    for f in ("title", "days_of_week", "priority", "notes"):
        if f in payload:
            setattr(t, f, payload[f])
    if "activity_type" in payload:
        t.activity_type = enum_in(payload["activity_type"], ACTIVITY_TYPES, "activity_type")
    if "start_time" in payload:
        t.start_time = parse_time(payload["start_time"], "start_time")
    if "end_time" in payload:
        t.end_time = parse_time(payload["end_time"], "end_time")
    if "recurrence" in payload:
        t.recurrence = enum_in(payload["recurrence"], RECURRENCE, "recurrence")
    if t.end_time <= t.start_time:
        raise HTTPError("end_time must be after start_time", 400)
    db.session.commit()
    return t


def delete(user_id: int, timetable_id: int) -> None:
    t = get(user_id, timetable_id)
    t.is_active = False
    db.session.commit()
