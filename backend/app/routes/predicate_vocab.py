"""Predicate vocabulary routes."""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from ..services import predicate_vocab_service
from ..utils.responses import ok, created

bp = Blueprint("predicate_vocab", __name__, url_prefix="/predicates")


@bp.get("")
@jwt_required()
def list_predicates():
    return ok([p.to_dict() for p in predicate_vocab_service.list_all()])


@bp.post("")
@jwt_required()
def create_predicate():
    p = predicate_vocab_service.create(request.get_json(silent=True) or {})
    return created(p.to_dict())
