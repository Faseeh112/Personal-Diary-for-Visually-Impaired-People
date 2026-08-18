"""AI query log routes."""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from ..services import ai_query_log_service
from ..utils.responses import ok
from ..utils.jwt_helpers import current_user_id

bp = Blueprint("query_log", __name__, url_prefix="/query-logs")


@bp.get("")
@jwt_required()
def list_query_logs():
    limit = int(request.args.get("limit", 50))
    return ok([q.to_dict() for q in ai_query_log_service.list_for_user(current_user_id(), limit)])


@bp.get("/<int:query_id>")
@jwt_required()
def get_query_log(query_id: int):
    return ok(ai_query_log_service.get(current_user_id(), query_id).to_dict())
