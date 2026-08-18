# # """Reminder service."""
# # from datetime import datetime
# # from ..extensions import db
# # from ..models import Reminder
# # from ..utils.errors import HTTPError
# # from ..utils.validators import require, parse_datetime, parse_date, enum_in

# # REPEAT_TYPES = {"None", "Daily", "Weekly", "Monthly", "Yearly"}


# # def list_for_user(user_id: int):
# #     return (Reminder.query.filter_by(user_id=user_id, is_active=True)
# #             .order_by(Reminder.reminder_datetime).all())


# # def list_upcoming(user_id: int, days: int = 7):
# #     from datetime import timedelta
# #     now = datetime.utcnow()
# #     horizon = now + timedelta(days=days)
# #     return (Reminder.query
# #             .filter(Reminder.user_id == user_id,
# #                     Reminder.is_active.is_(True),
# #                     Reminder.is_done.is_(False),
# #                     Reminder.reminder_datetime >= now,
# #                     Reminder.reminder_datetime <= horizon)
# #             .order_by(Reminder.reminder_datetime).all())


# # def get(user_id: int, reminder_id: int) -> Reminder:
# #     r = Reminder.query.filter_by(reminder_id=reminder_id, user_id=user_id).first()
# #     if not r or not r.is_active:
# #         raise HTTPError("Reminder not found", 404)
# #     return r


# # def create(user_id: int, payload: dict) -> Reminder:
# #     title = require(payload, "title")
# #     dt = parse_datetime(require(payload, "reminder_datetime"), "reminder_datetime")
# #     repeat = enum_in(payload.get("repeat_type", "None"), REPEAT_TYPES, "repeat_type")
# #     r = Reminder(
# #         user_id=user_id, title=title,
# #         description=payload.get("description"),
# #         reminder_datetime=dt,
# #         end_date=parse_date(payload.get("end_date"), "end_date"),
# #         repeat_type=repeat,
# #         person_id=payload.get("person_id"),
# #         parent_event_instance_id=payload.get("parent_event_instance_id"),
# #         is_auto_generated=bool(payload.get("is_auto_generated", False)),
# #         input_source=payload.get("input_source", "manual"),
# #     )
# #     db.session.add(r)
# #     db.session.commit()
# #     return r


# # def update(user_id: int, reminder_id: int, payload: dict) -> Reminder:
# #     r = get(user_id, reminder_id)
# #     for f in ("title", "description", "person_id", "is_done"):
# #         if f in payload:
# #             setattr(r, f, payload[f])
# #     if "reminder_datetime" in payload:
# #         r.reminder_datetime = parse_datetime(payload["reminder_datetime"], "reminder_datetime")
# #     if "end_date" in payload:
# #         r.end_date = parse_date(payload["end_date"], "end_date")
# #     if "repeat_type" in payload:
# #         r.repeat_type = enum_in(payload["repeat_type"], REPEAT_TYPES, "repeat_type")
# #     db.session.commit()
# #     return r


# # def mark_done(user_id: int, reminder_id: int) -> Reminder:
# #     r = get(user_id, reminder_id)
# #     r.is_done = True
# #     db.session.commit()
# #     return r


# # def delete(user_id: int, reminder_id: int) -> None:
# #     r = get(user_id, reminder_id)
# #     r.is_active = False
# #     db.session.commit()
# """Reminder service."""
# from datetime import timedelta

# from datetime import datetime
# from ..extensions import db
# from ..models import Reminder
# from ..utils.errors import HTTPError
# from ..utils.validators import require, parse_datetime, parse_date, enum_in

# REPEAT_TYPES = {"None", "Daily", "Weekly", "Monthly", "Yearly"}

# def list_due(user_id: int):
#     now = datetime.utcnow()

#     return (Reminder.query
#             .filter(Reminder.user_id == user_id,
#                     Reminder.is_active == True,   # noqa: E712
#                     Reminder.is_done == False,    # noqa: E712
#                     Reminder.reminder_datetime <= now)
#             .order_by(Reminder.reminder_datetime).all())

# def list_for_user(user_id: int):
#     return (Reminder.query.filter_by(user_id=user_id, is_active=True)
#             .order_by(Reminder.reminder_datetime).all())


# def list_upcoming(user_id: int, days: int = 7):
#     from datetime import timedelta
#     now = datetime.utcnow()
#     horizon = now + timedelta(days=days)
#     return (Reminder.query
#             .filter(Reminder.user_id == user_id,
#                     Reminder.is_active == True,   # noqa: E712  MSSQL needs = 1 not IS TRUE
#                     Reminder.is_done == False,    # noqa: E712
#                     Reminder.reminder_datetime >= now,
#                     Reminder.reminder_datetime <= horizon)
#             .order_by(Reminder.reminder_datetime).all())


# def get(user_id: int, reminder_id: int) -> Reminder:
#     r = Reminder.query.filter_by(reminder_id=reminder_id, user_id=user_id).first()
#     if not r or not r.is_active:
#         raise HTTPError("Reminder not found", 404)
#     return r


# def create(user_id: int, payload: dict) -> Reminder:
#     title = require(payload, "title")
#     dt = parse_datetime(require(payload, "reminder_datetime"), "reminder_datetime")
#     repeat = enum_in(payload.get("repeat_type", "None"), REPEAT_TYPES, "repeat_type")
#     r = Reminder(
#         user_id=user_id, title=title,
#         description=payload.get("description"),
#         reminder_datetime=dt,
#         end_date=parse_date(payload.get("end_date"), "end_date"),
#         repeat_type=repeat,
#         person_id=payload.get("person_id"),
#         parent_event_instance_id=payload.get("parent_event_instance_id"),
#         is_auto_generated=bool(payload.get("is_auto_generated", False)),
#         input_source=payload.get("input_source", "manual"),
#     )
#     db.session.add(r)
#     db.session.commit()
#     return r


# def update(user_id: int, reminder_id: int, payload: dict) -> Reminder:
#     r = get(user_id, reminder_id)
#     for f in ("title", "description", "person_id", "is_done"):
#         if f in payload:
#             setattr(r, f, payload[f])
#     if "reminder_datetime" in payload:
#         r.reminder_datetime = parse_datetime(payload["reminder_datetime"], "reminder_datetime")
#     if "end_date" in payload:
#         r.end_date = parse_date(payload["end_date"], "end_date")
#     if "repeat_type" in payload:
#         r.repeat_type = enum_in(payload["repeat_type"], REPEAT_TYPES, "repeat_type")
#     db.session.commit()
#     return r


# def mark_done(user_id: int, reminder_id: int) -> Reminder:
#     r = get(user_id, reminder_id)
#     r.is_done = True
#     db.session.commit()
#     return r


# def delete(user_id: int, reminder_id: int) -> None:
#     r = get(user_id, reminder_id)
#     r.is_active = False
#     db.session.commit()
"""Reminder service."""
from datetime import datetime, timedelta
from ..extensions import db
from ..models import Reminder
from ..utils.errors import HTTPError
from ..utils.validators import require, parse_datetime, parse_date, enum_in

REPEAT_TYPES = {"None", "Daily", "Weekly", "Monthly", "Yearly"}


def list_due(user_id: int):
    """All active, undone reminders whose datetime has already passed."""
    now = datetime.utcnow()
    return (Reminder.query
            .filter(
                Reminder.user_id == user_id,
                Reminder.is_active == True,   # noqa: E712
                Reminder.is_done == False,    # noqa: E712
                Reminder.reminder_datetime <= now,
            )
            .order_by(Reminder.reminder_datetime).all())


def list_for_user(user_id: int):
    """All active reminders for a user, ordered by datetime."""
    return (Reminder.query
            .filter_by(user_id=user_id, is_active=True)
            .order_by(Reminder.reminder_datetime).all())


def list_upcoming(user_id: int, days: int = 7):
    """Active, undone reminders due within the next `days` days."""
    now = datetime.utcnow()
    horizon = now + timedelta(days=days)
    return (Reminder.query
            .filter(
                Reminder.user_id == user_id,
                Reminder.is_active == True,   # noqa: E712
                Reminder.is_done == False,    # noqa: E712
                Reminder.reminder_datetime >= now,
                Reminder.reminder_datetime <= horizon,
            )
            .order_by(Reminder.reminder_datetime).all())


def get(user_id: int, reminder_id: int) -> Reminder:
    r = Reminder.query.filter_by(reminder_id=reminder_id, user_id=user_id).first()
    if not r or not r.is_active:
        raise HTTPError("Reminder not found", 404)
    return r


def create(user_id: int, payload: dict) -> Reminder:
    title = require(payload, "title")
    dt    = parse_datetime(require(payload, "reminder_datetime"), "reminder_datetime")
    repeat = enum_in(payload.get("repeat_type", "None"), REPEAT_TYPES, "repeat_type")

    r = Reminder(
        user_id=user_id,
        title=title,
        description=payload.get("description"),
        reminder_datetime=dt,
        end_date=parse_date(payload.get("end_date"), "end_date"),
        repeat_type=repeat,
        person_id=payload.get("person_id"),
        parent_event_instance_id=payload.get("parent_event_instance_id"),
        is_auto_generated=bool(payload.get("is_auto_generated", False)),
        input_source=payload.get("input_source", "manual"),
    )
    db.session.add(r)
    db.session.commit()
    return r


def update(user_id: int, reminder_id: int, payload: dict) -> Reminder:
    r = get(user_id, reminder_id)

    for field in ("title", "description", "person_id", "is_done"):
        if field in payload:
            setattr(r, field, payload[field])

    if "reminder_datetime" in payload:
        r.reminder_datetime = parse_datetime(payload["reminder_datetime"], "reminder_datetime")
    if "end_date" in payload:
        r.end_date = parse_date(payload["end_date"], "end_date")
    if "repeat_type" in payload:
        r.repeat_type = enum_in(payload["repeat_type"], REPEAT_TYPES, "repeat_type")

    db.session.commit()
    return r


def mark_done(user_id: int, reminder_id: int) -> Reminder:
    r = get(user_id, reminder_id)
    r.is_done = True
    db.session.commit()
    return r


def delete(user_id: int, reminder_id: int) -> None:
    r = get(user_id, reminder_id)
    r.is_active = False
    db.session.commit()