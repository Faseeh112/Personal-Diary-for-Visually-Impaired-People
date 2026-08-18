"""Timetable routes."""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from ..services import timetable_service
from ..utils.responses import ok, created, no_content
from ..utils.jwt_helpers import current_user_id

bp = Blueprint("timetable", __name__, url_prefix="/timetable")


@bp.get("")
@jwt_required()
def list_slots():
    return ok([t.to_dict() for t in timetable_service.list_for_user(current_user_id())])


@bp.get("/<int:timetable_id>")
@jwt_required()
def get_slot(timetable_id: int):
    return ok(timetable_service.get(current_user_id(), timetable_id).to_dict())


@bp.post("")
@jwt_required()
def create_slot():
    t = timetable_service.create(current_user_id(), request.get_json(silent=True) or {})
    return created(t.to_dict())


@bp.put("/<int:timetable_id>")
@jwt_required()
def update_slot(timetable_id: int):
    t = timetable_service.update(current_user_id(), timetable_id, request.get_json(silent=True) or {})
    return ok(t.to_dict())


@bp.delete("/<int:timetable_id>")
@jwt_required()
def delete_slot(timetable_id: int):
    timetable_service.delete(current_user_id(), timetable_id)
    return no_content()
