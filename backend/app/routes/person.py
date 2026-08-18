"""Person routes."""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from ..services import person_service
from ..utils.responses import ok, created, no_content
from ..utils.jwt_helpers import current_user_id

bp = Blueprint("person", __name__, url_prefix="/persons")


@bp.get("")
@jwt_required()
def list_persons():
    return ok([p.to_dict() for p in person_service.list_for_user(current_user_id())])


@bp.get("/<int:person_id>")
@jwt_required()
def get_person(person_id: int):
    return ok(person_service.get(current_user_id(), person_id).to_dict())


@bp.post("")
@jwt_required()
def create_person():
    p = person_service.create(current_user_id(), request.get_json(silent=True) or {})
    return created(p.to_dict())


@bp.put("/<int:person_id>")
@jwt_required()
def update_person(person_id: int):
    p = person_service.update(current_user_id(), person_id, request.get_json(silent=True) or {})
    return ok(p.to_dict())


@bp.delete("/<int:person_id>")
@jwt_required()
def delete_person(person_id: int):
    person_service.delete(current_user_id(), person_id)
    return no_content()
