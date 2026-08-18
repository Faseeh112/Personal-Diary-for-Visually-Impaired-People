"""Attachment routes."""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from ..services import attachment_service
from ..utils.responses import ok, created, no_content
from ..utils.jwt_helpers import current_user_id

bp = Blueprint("attachment", __name__, url_prefix="/attachments")


@bp.get("")
@jwt_required()
def list_attachments():
    return ok([a.to_dict() for a in attachment_service.list_for_user(current_user_id())])


@bp.get("/<int:attachment_id>")
@jwt_required()
def get_attachment(attachment_id: int):
    return ok(attachment_service.get(current_user_id(), attachment_id).to_dict())


@bp.post("")
@jwt_required()
def create_attachment():
    a = attachment_service.create(current_user_id(), request.get_json(silent=True) or {})
    return created(a.to_dict())


@bp.put("/<int:attachment_id>/extraction")
@jwt_required()
def update_extraction(attachment_id: int):
    a = attachment_service.update_extraction(current_user_id(), attachment_id,
                                             request.get_json(silent=True) or {})
    return ok(a.to_dict())


@bp.delete("/<int:attachment_id>")
@jwt_required()
def delete_attachment(attachment_id: int):
    attachment_service.delete(current_user_id(), attachment_id)
    return no_content()
