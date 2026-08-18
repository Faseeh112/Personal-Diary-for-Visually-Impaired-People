"""Auth routes: register, login, refresh."""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from ..services import auth_service
from ..utils.responses import ok, created
from ..utils.jwt_helpers import current_user_id

bp = Blueprint("auth", __name__, url_prefix="/auth")


@bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    payload = auth_service.register(
        name=data.get("name", ""),
        email=data.get("email", ""),
        password=data.get("password", ""),
    )
    return created(payload, "Registered")


@bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    payload = auth_service.authenticate(data.get("email", ""), data.get("password", ""))
    return ok(payload, "Logged in")


@bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    return ok(auth_service.refresh(current_user_id()))
