"""Voice entry routes (read + confirmation)."""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from ..services import voice_entry_service
from ..utils.responses import ok
from ..utils.jwt_helpers import current_user_id

bp = Blueprint("voice_entry", __name__, url_prefix="/voice-entries")


@bp.get("")
@jwt_required()
def list_voice():
    limit = int(request.args.get("limit", 50))
    return ok([v.to_dict() for v in voice_entry_service.list_for_user(current_user_id(), limit)])


@bp.get("/pending-confirm")
@jwt_required()
def list_pending():
    return ok([v.to_dict() for v in voice_entry_service.list_pending_confirm(current_user_id())])


@bp.get("/<int:voice_entry_id>")
@jwt_required()
def get_voice(voice_entry_id: int):
    return ok(voice_entry_service.get(current_user_id(), voice_entry_id).to_dict())


@bp.post("/<int:voice_entry_id>/confirm")
@jwt_required()
def confirm_voice(voice_entry_id: int):
    data = request.get_json(silent=True) or {}
    confirmed = bool(data.get("confirmed", True))
    v = voice_entry_service.confirm(current_user_id(), voice_entry_id, confirmed)
    return ok(v.to_dict())
