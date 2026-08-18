"""Zakat routes: nisab config + zakat summary."""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from ..services import zakat_nisab_service
from ..utils.responses import ok, created
from ..utils.jwt_helpers import current_user_id

bp = Blueprint("zakat", __name__, url_prefix="/zakat")


@bp.get("/nisab")
@jwt_required()
def list_nisab():
    return ok([n.to_dict() for n in zakat_nisab_service.list_all()])


@bp.post("/nisab")
@jwt_required()
def upsert_nisab():
    n = zakat_nisab_service.upsert(request.get_json(silent=True) or {})
    return created(n.to_dict())


@bp.get("/summary")
@jwt_required()
def zakat_summary():
    currency = (request.args.get("currency") or "PKR").upper()
    return ok(zakat_nisab_service.summary_for_user(current_user_id(), currency))
