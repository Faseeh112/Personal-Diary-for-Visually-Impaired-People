"""Tag routes."""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from ..services import tag_service
from ..utils.responses import ok, created, no_content

bp = Blueprint("tag", __name__, url_prefix="/tags")


@bp.get("")
@jwt_required()
def list_tags():
    return ok([t.to_dict() for t in tag_service.list_all()])


@bp.post("")
@jwt_required()
def create_tag():
    t = tag_service.create(request.get_json(silent=True) or {})
    return created(t.to_dict())


@bp.delete("/<int:tag_id>")
@jwt_required()
def delete_tag(tag_id: int):
    tag_service.delete(tag_id)
    return no_content()
