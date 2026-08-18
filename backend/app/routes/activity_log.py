"""Activity log routes."""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from ..services import activity_log_service
from ..utils.responses import ok, created
from ..utils.jwt_helpers import current_user_id
from ..utils.validators import parse_date

bp = Blueprint("activity_log", __name__, url_prefix="/activity-logs")


@bp.get("")
@jwt_required()
def list_logs():
    from_date = parse_date(request.args.get("from_date"), "from_date")
    to_date   = parse_date(request.args.get("to_date"),   "to_date")
    return ok([a.to_dict() for a in activity_log_service.list_for_user(current_user_id(), from_date, to_date)])


@bp.get("/<int:activity_log_id>")
@jwt_required()
def get_log(activity_log_id: int):
    return ok(activity_log_service.get(current_user_id(), activity_log_id).to_dict())


@bp.post("")
@jwt_required()
def create_log():
    a = activity_log_service.create(current_user_id(), request.get_json(silent=True) or {})
    return created(a.to_dict())


@bp.put("/<int:activity_log_id>")
@jwt_required()
def update_log(activity_log_id: int):
    a = activity_log_service.update(current_user_id(), activity_log_id, request.get_json(silent=True) or {})
    return ok(a.to_dict())


@bp.get("/ratio")
@jwt_required()
def completion_ratio():
    from datetime import date
    day = parse_date(request.args.get("date"), "date") or date.today()
    return ok(activity_log_service.completion_ratio(current_user_id(), day))
