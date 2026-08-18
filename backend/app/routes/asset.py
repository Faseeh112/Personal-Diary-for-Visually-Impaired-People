"""Asset routes."""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from ..services import asset_service
from ..utils.responses import ok, created, no_content
from ..utils.jwt_helpers import current_user_id

bp = Blueprint("asset", __name__, url_prefix="/assets")


@bp.get("")
@jwt_required()
def list_assets():
    return ok([a.to_dict() for a in asset_service.list_for_user(current_user_id())])


@bp.get("/<int:asset_id>")
@jwt_required()
def get_asset(asset_id: int):
    return ok(asset_service.get(current_user_id(), asset_id).to_dict())


@bp.post("")
@jwt_required()
def create_asset():
    a = asset_service.create(current_user_id(), request.get_json(silent=True) or {})
    return created(a.to_dict())


@bp.put("/<int:asset_id>")
@jwt_required()
def update_asset(asset_id: int):
    a = asset_service.update(current_user_id(), asset_id, request.get_json(silent=True) or {})
    return ok(a.to_dict())


@bp.delete("/<int:asset_id>")
@jwt_required()
def delete_asset(asset_id: int):
    asset_service.delete(current_user_id(), asset_id)
    return no_content()
