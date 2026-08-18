"""Predicate vocabulary service — read-mostly reference."""
from ..extensions import db
from ..models import PredicateVocab
from ..utils.errors import HTTPError
from ..utils.validators import require, enum_in

CATEGORIES = {"transaction", "relation", "event", "location", "ownership", "other"}


def list_all():
    return (PredicateVocab.query.filter_by(is_active=True)
            .order_by(PredicateVocab.predicate_category, PredicateVocab.predicate_text).all())


def get(predicate_id: int) -> PredicateVocab:
    p = db.session.get(PredicateVocab, predicate_id)
    if not p:
        raise HTTPError("Predicate not found", 404)
    return p


def create(payload: dict) -> PredicateVocab:
    text = require(payload, "predicate_text")
    if PredicateVocab.query.filter_by(predicate_text=text).first():
        raise HTTPError("Predicate already exists", 409)
    category = payload.get("predicate_category")
    if category:
        enum_in(category, CATEGORIES, "predicate_category")
    p = PredicateVocab(
        predicate_text=text,
        predicate_alias=payload.get("predicate_alias"),
        predicate_category=category,
    )
    db.session.add(p)
    db.session.commit()
    return p
