"""Activity log service."""
from datetime import datetime, date
from ..extensions import db
from ..models import ActivityLog, Timetable, Reminder
from ..utils.errors import HTTPError
from ..utils.validators import require, parse_date, parse_time, enum_in

STATUSES = {"pending", "done", "missed", "partial", "skipped"}


def list_for_user(user_id: int, from_date=None, to_date=None):
    q = ActivityLog.query.filter_by(user_id=user_id)
    if from_date:
        q = q.filter(ActivityLog.scheduled_date >= from_date)
    if to_date:
        q = q.filter(ActivityLog.scheduled_date <= to_date)
    return q.order_by(ActivityLog.scheduled_date.desc(), ActivityLog.scheduled_start).all()


def get(user_id: int, activity_log_id: int) -> ActivityLog:
    a = ActivityLog.query.filter_by(activity_log_id=activity_log_id, user_id=user_id).first()
    if not a:
        raise HTTPError("Activity log not found", 404)
    return a


def create(user_id: int, payload: dict) -> ActivityLog:
    timetable_id = payload.get("timetable_id")
    reminder_id  = payload.get("reminder_id")
    if bool(timetable_id) == bool(reminder_id):
        raise HTTPError("Must reference exactly one of timetable_id or reminder_id", 400)

    if timetable_id:
        t = Timetable.query.filter_by(timetable_id=timetable_id, user_id=user_id).first()
        if not t:
            raise HTTPError("Timetable slot not found", 404)
    else:
        r = Reminder.query.filter_by(reminder_id=reminder_id, user_id=user_id).first()
        if not r:
            raise HTTPError("Reminder not found", 404)

    status = enum_in(payload.get("status", "pending"), STATUSES, "status")
    completed_at = None
    if status == "done":
        completed_at = datetime.utcnow()

    a = ActivityLog(
        user_id=user_id,
        timetable_id=timetable_id,
        reminder_id=reminder_id,
        scheduled_date=parse_date(require(payload, "scheduled_date"), "scheduled_date"),
        scheduled_start=parse_time(payload.get("scheduled_start"), "scheduled_start"),
        status=status,
        completed_at=completed_at,
        duration_minutes=payload.get("duration_minutes"),
        notes=payload.get("notes"),
    )
    db.session.add(a)
    db.session.commit()
    return a


def update(user_id: int, activity_log_id: int, payload: dict) -> ActivityLog:
    a = get(user_id, activity_log_id)
    if "status" in payload:
        a.status = enum_in(payload["status"], STATUSES, "status")
        if a.status == "done" and a.completed_at is None:
            a.completed_at = datetime.utcnow()
    if "duration_minutes" in payload:
        a.duration_minutes = payload["duration_minutes"]
    if "notes" in payload:
        a.notes = payload["notes"]
    db.session.commit()
    return a


def completion_ratio(user_id: int, day: date) -> dict:
    logs = ActivityLog.query.filter_by(user_id=user_id, scheduled_date=day).all()
    total = len(logs)
    done = sum(1 for l in logs if l.status == "done")
    missed = sum(1 for l in logs if l.status == "missed")
    return {
        "date": day.isoformat(),
        "total": total,
        "done": done,
        "missed": missed,
        "ratio": (done / total) if total else 0.0,
    }
