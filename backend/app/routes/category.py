"""Category routes."""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from ..services import category_service
from ..utils.responses import ok, created, no_content
from ..utils.jwt_helpers import current_user_id

bp = Blueprint("category", __name__, url_prefix="/categories")


@bp.get("")
@jwt_required()
def list_categories():
    items = category_service.list_for_user(current_user_id())
    return ok([c.to_dict() for c in items])


@bp.get("/<int:category_id>")
@jwt_required()
def get_category(category_id: int):
    return ok(category_service.get(current_user_id(), category_id).to_dict())


@bp.post("")
@jwt_required()
def create_category():
    c = category_service.create(current_user_id(), request.get_json(silent=True) or {})
    return created(c.to_dict())


@bp.put("/<int:category_id>")
@jwt_required()
def update_category(category_id: int):
    c = category_service.update(current_user_id(), category_id, request.get_json(silent=True) or {})
    return ok(c.to_dict())


@bp.delete("/<int:category_id>")
@jwt_required()
def delete_category(category_id: int):
    category_service.delete(current_user_id(), category_id)
    return no_content()
