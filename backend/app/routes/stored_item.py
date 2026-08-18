"""Stored item routes."""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from ..services import stored_item_service
from ..utils.responses import ok, created, no_content
from ..utils.jwt_helpers import current_user_id

bp = Blueprint("stored_item", __name__, url_prefix="/stored-items")


@bp.get("")
@jwt_required()
def list_items():
    q = request.args.get("q")
    items = (stored_item_service.search(current_user_id(), q) if q
             else stored_item_service.list_for_user(current_user_id()))
    return ok([s.to_dict() for s in items])


@bp.get("/<int:stored_item_id>")
@jwt_required()
def get_item(stored_item_id: int):
    return ok(stored_item_service.get(current_user_id(), stored_item_id).to_dict())


@bp.post("")
@jwt_required()
def create_item():
    s = stored_item_service.create(current_user_id(), request.get_json(silent=True) or {})
    return created(s.to_dict())


@bp.put("/<int:stored_item_id>")
@jwt_required()
def update_item(stored_item_id: int):
    s = stored_item_service.update(current_user_id(), stored_item_id, request.get_json(silent=True) or {})
    return ok(s.to_dict())


@bp.delete("/<int:stored_item_id>")
@jwt_required()
def delete_item(stored_item_id: int):
    stored_item_service.delete(current_user_id(), stored_item_id)
    return no_content()
