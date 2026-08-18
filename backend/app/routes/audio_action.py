"""Audio action routes."""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from ..services import audio_action_service
from ..utils.responses import ok, created, no_content
from ..utils.jwt_helpers import current_user_id

bp = Blueprint("audio_action", __name__, url_prefix="/audio-actions")


@bp.get("")
@jwt_required()
def list_actions():
    return ok([a.to_dict() for a in audio_action_service.list_for_user(current_user_id())])


@bp.get("/<int:audio_action_id>")
@jwt_required()
def get_action(audio_action_id: int):
    return ok(audio_action_service.get(current_user_id(), audio_action_id).to_dict())


@bp.post("")
@jwt_required()
def create_action():
    a = audio_action_service.create(current_user_id(), request.get_json(silent=True) or {})
    return created(a.to_dict())


@bp.put("/<int:audio_action_id>")
@jwt_required()
def update_action(audio_action_id: int):
    a = audio_action_service.update(current_user_id(), audio_action_id, request.get_json(silent=True) or {})
    return ok(a.to_dict())


@bp.delete("/<int:audio_action_id>")
@jwt_required()
def delete_action(audio_action_id: int):
    audio_action_service.delete(current_user_id(), audio_action_id)
    return no_content()
