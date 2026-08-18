"""Currency routes (read-only reference)."""
from flask import Blueprint
from flask_jwt_extended import jwt_required

from ..models import Currency
from ..utils.responses import ok

bp = Blueprint("currency", __name__, url_prefix="/currencies")


@bp.get("")
@jwt_required()
def list_currencies():
    return ok([c.to_dict() for c in Currency.query.order_by(Currency.code).all()])
