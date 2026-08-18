"""User profile + settings routes."""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from ..services import user_service
from ..utils.responses import ok
from ..utils.jwt_helpers import current_user_id

bp = Blueprint("user", __name__, url_prefix="/user")


@bp.get("/me")
@jwt_required()
def get_me():
    return ok(user_service.get_profile(current_user_id()))


@bp.put("/me")
@jwt_required()
def update_me():
    return ok(user_service.update_profile(current_user_id(), request.get_json(silent=True) or {}))


@bp.get("/settings")
@jwt_required()
def get_settings():
    return ok(user_service.get_settings(current_user_id()))


@bp.put("/settings")
@jwt_required()
def update_settings():
    return ok(user_service.update_settings(current_user_id(), request.get_json(silent=True) or {}))
