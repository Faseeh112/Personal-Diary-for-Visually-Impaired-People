"""Location routes (hierarchical)."""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from ..services import location_service
from ..utils.responses import ok, created, no_content
from ..utils.jwt_helpers import current_user_id

bp = Blueprint("location", __name__, url_prefix="/locations")


@bp.get("")
@jwt_required()
def list_locations():
    return ok([l.to_dict() for l in location_service.list_for_user(current_user_id())])


@bp.get("/<int:location_id>")
@jwt_required()
def get_location(location_id: int):
    return ok(location_service.get(current_user_id(), location_id).to_dict())


@bp.post("")
@jwt_required()
def create_location():
    l = location_service.create(current_user_id(), request.get_json(silent=True) or {})
    return created(l.to_dict())


@bp.put("/<int:location_id>")
@jwt_required()
def update_location(location_id: int):
    l = location_service.update(current_user_id(), location_id, request.get_json(silent=True) or {})
    return ok(l.to_dict())


@bp.delete("/<int:location_id>")
@jwt_required()
def delete_location(location_id: int):
    location_service.delete(current_user_id(), location_id)
    return no_content()
