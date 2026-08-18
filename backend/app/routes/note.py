"""Note routes — supports nested transactions."""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from ..services import note_service
from ..utils.responses import ok, created, no_content
from ..utils.jwt_helpers import current_user_id

bp = Blueprint("note", __name__, url_prefix="/notes")


@bp.get("")
@jwt_required()
def list_notes():
    return ok([n.to_dict() for n in note_service.list_for_user(current_user_id())])


@bp.get("/<int:note_id>")
@jwt_required()
def get_note(note_id: int):
    return ok(note_service.get(current_user_id(), note_id).to_dict_full())


@bp.post("")
@jwt_required()
def create_note():
    n = note_service.create(current_user_id(), request.get_json(silent=True) or {})
    return created(n.to_dict_full())


@bp.put("/<int:note_id>")
@jwt_required()
def update_note(note_id: int):
    n = note_service.update(current_user_id(), note_id, request.get_json(silent=True) or {})
    return ok(n.to_dict_full())


@bp.delete("/<int:note_id>")
@jwt_required()
def delete_note(note_id: int):
    note_service.delete(current_user_id(), note_id)
    return no_content()


@bp.get("/<int:note_id>/transactions")
@jwt_required()
def list_transactions(note_id: int):
    txns = note_service.list_transactions(current_user_id(), note_id)
    return ok([t.to_dict() for t in txns])


@bp.post("/<int:note_id>/transactions")
@jwt_required()
def add_transaction(note_id: int):
    t = note_service.add_transaction(current_user_id(), note_id, request.get_json(silent=True) or {})
    return created(t.to_dict())
