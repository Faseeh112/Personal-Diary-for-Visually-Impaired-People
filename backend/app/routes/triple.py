"""Knowledge triple routes."""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from ..services import knowledge_triple_service
from ..utils.responses import ok, created, no_content
from ..utils.jwt_helpers import current_user_id

bp = Blueprint("triple", __name__, url_prefix="/triples")


@bp.get("")
@jwt_required()
def list_triples():
    subject   = request.args.get("subject")
    predicate = request.args.get("predicate")
    obj       = request.args.get("object")
    limit     = int(request.args.get("limit", 100))
    items = knowledge_triple_service.list_for_user(
        current_user_id(), subject=subject, predicate=predicate, obj=obj, limit=limit
    )
    return ok([t.to_dict() for t in items])


@bp.get("/<int:triple_id>")
@jwt_required()
def get_triple(triple_id: int):
    return ok(knowledge_triple_service.get(current_user_id(), triple_id).to_dict())


@bp.post("")
@jwt_required()
def create_triple():
    t = knowledge_triple_service.create(current_user_id(), request.get_json(silent=True) or {})
    return created(t.to_dict())


@bp.post("/<int:triple_id>/verify")
@jwt_required()
def verify_triple(triple_id: int):
    return ok(knowledge_triple_service.verify(current_user_id(), triple_id).to_dict())


@bp.delete("/<int:triple_id>")
@jwt_required()
def delete_triple(triple_id: int):
    knowledge_triple_service.delete(current_user_id(), triple_id)
    return no_content()
