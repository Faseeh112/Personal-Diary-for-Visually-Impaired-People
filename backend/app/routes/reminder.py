# # """Reminder routes."""
# # from flask import Blueprint, request
# # from flask_jwt_extended import jwt_required
# # from ..services import reminder_service
# # from ..utils.responses import ok, created, no_content
# # from ..utils.jwt_helpers import current_user_id

# # bp = Blueprint("reminder", __name__, url_prefix="/reminders")



# # @bp.get("")
# # @jwt_required()
# # def list_reminders():
# #     return ok([r.to_dict() for r in reminder_service.list_for_user(current_user_id())])

# # @bp.get("/due")
# # @jwt_required()
# # def due_reminders():
# #     return ok([r.to_dict() for r in reminder_service.list_due(current_user_id())])

# # @bp.get("/upcoming")
# # @jwt_required()
# # def list_upcoming():
# #     days = int(request.args.get("days", 7))
# #     return ok([r.to_dict() for r in reminder_service.list_upcoming(current_user_id(), days)])


# # @bp.get("/<int:reminder_id>")
# # @jwt_required()
# # def get_reminder(reminder_id: int):
# #     return ok(reminder_service.get(current_user_id(), reminder_id).to_dict())


# # @bp.post("")
# # @jwt_required()
# # def create_reminder():
# #     payload = request.get_json(silent=True) or {}

# #     print("PAYLOAD RECEIVED:", payload)  # check terminal output

# #     r = reminder_service.create(current_user_id(), request.get_json(silent=True) or {})
# #     return created(r.to_dict())


# # @bp.put("/<int:reminder_id>")
# # @jwt_required()
# # def update_reminder(reminder_id: int):
# #     r = reminder_service.update(current_user_id(), reminder_id, request.get_json(silent=True) or {})
# #     return ok(r.to_dict())


# # @bp.post("/<int:reminder_id>/done")
# # @jwt_required()
# # def mark_done(reminder_id: int):
# #     return ok(reminder_service.mark_done(current_user_id(), reminder_id).to_dict())


# # @bp.delete("/<int:reminder_id>")
# # @jwt_required()
# # def delete_reminder(reminder_id: int):
# #     reminder_service.delete(current_user_id(), reminder_id)
# #     return no_content()
# """Reminder routes."""
# from flask import Blueprint, request
# from flask_jwt_extended import jwt_required
# from ..services import reminder_service
# from ..utils.responses import ok, created, no_content
# from ..utils.jwt_helpers import current_user_id

# bp = Blueprint("reminder", __name__, url_prefix="/reminders")


# @bp.get("")
# @jwt_required()
# def list_reminders():
#     return ok([r.to_dict() for r in reminder_service.list_for_user(current_user_id())])


# @bp.get("/due")
# @jwt_required()
# def due_reminders():
#     return ok([r.to_dict() for r in reminder_service.list_due(current_user_id())])


# @bp.get("/upcoming")
# @jwt_required()
# def list_upcoming():
#     days = int(request.args.get("days", 7))
#     return ok([r.to_dict() for r in reminder_service.list_upcoming(current_user_id(), days)])


# @bp.get("/<int:reminder_id>")
# @jwt_required()
# def get_reminder(reminder_id: int):
#     return ok(reminder_service.get(current_user_id(), reminder_id).to_dict())


# @bp.post("")
# @jwt_required()
# def create_reminder():
#     # Read JSON body once and pass it directly — avoids consuming the stream twice
#     payload = request.get_json(silent=True) or {}
#     r = reminder_service.create(current_user_id(), payload)
#     return created(r.to_dict())


# @bp.put("/<int:reminder_id>")
# @jwt_required()
# def update_reminder(reminder_id: int):
#     payload = request.get_json(silent=True) or {}
#     r = reminder_service.update(current_user_id(), reminder_id, payload)
#     return ok(r.to_dict())


# @bp.post("/<int:reminder_id>/done")
# @jwt_required()
# def mark_done(reminder_id: int):
#     return ok(reminder_service.mark_done(current_user_id(), reminder_id).to_dict())


# @bp.delete("/<int:reminder_id>")
# @jwt_required()
# def delete_reminder(reminder_id: int):
#     reminder_service.delete(current_user_id(), reminder_id)
#     return no_content() 
"""Reminder routes."""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from ..services import reminder_service
from ..utils.responses import ok, created, no_content
from ..utils.jwt_helpers import current_user_id

bp = Blueprint("reminder", __name__, url_prefix="/reminders")


@bp.get("")
@jwt_required()
def list_reminders():
    return ok([r.to_dict() for r in reminder_service.list_for_user(current_user_id())])


@bp.get("/due")
@jwt_required()
def due_reminders():
    return ok([r.to_dict() for r in reminder_service.list_due(current_user_id())])


@bp.get("/upcoming")
@jwt_required()
def list_upcoming():
    days = int(request.args.get("days", 7))
    return ok([r.to_dict() for r in reminder_service.list_upcoming(current_user_id(), days)])


@bp.get("/<int:reminder_id>")
@jwt_required()
def get_reminder(reminder_id: int):
    return ok(reminder_service.get(current_user_id(), reminder_id).to_dict())


@bp.post("")
@jwt_required()
def create_reminder():
    payload = request.get_json(silent=True) or {}
    r = reminder_service.create(current_user_id(), payload)
    return created(r.to_dict())


@bp.put("/<int:reminder_id>")
@jwt_required()
def update_reminder(reminder_id: int):
    payload = request.get_json(silent=True) or {}
    r = reminder_service.update(current_user_id(), reminder_id, payload)
    return ok(r.to_dict())


@bp.post("/<int:reminder_id>/done")
@jwt_required()
def mark_done(reminder_id: int):
    return ok(reminder_service.mark_done(current_user_id(), reminder_id).to_dict())


@bp.delete("/<int:reminder_id>")
@jwt_required()
def delete_reminder(reminder_id: int):
    reminder_service.delete(current_user_id(), reminder_id)
    return no_content()