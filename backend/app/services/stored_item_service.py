"""Stored item service."""
from ..extensions import db
from ..models import StoredItem
from ..utils.errors import HTTPError
from ..utils.validators import require, enum_in

CATEGORIES = {"document", "electronics", "personal", "clothing",
              "kitchen", "medical", "jewellery", "other"}


def list_for_user(user_id: int):
    return (StoredItem.query.filter_by(user_id=user_id, is_active=True)
            .order_by(StoredItem.item_name).all())


def search(user_id: int, q: str):
    like = f"%{q}%"
    return (StoredItem.query.filter(
        StoredItem.user_id == user_id,
        StoredItem.is_active == True,   # noqa: E712
        StoredItem.item_name.ilike(like),
    ).all())


def get(user_id: int, stored_item_id: int) -> StoredItem:
    s = StoredItem.query.filter_by(stored_item_id=stored_item_id, user_id=user_id).first()
    if not s or not s.is_active:
        raise HTTPError("Stored item not found", 404)
    return s


def create(user_id: int, payload: dict) -> StoredItem:
    item_name = require(payload, "item_name")
    if not payload.get("location_id") and not payload.get("location_text"):
        raise HTTPError("Must provide location_id or location_text", 400)
    category = payload.get("category")
    if category:
        enum_in(category, CATEGORIES, "category")
    s = StoredItem(
        user_id=user_id,
        item_name=item_name,
        category=category,
        location_id=payload.get("location_id"),
        location_text=payload.get("location_text"),
        description=payload.get("description"),
        input_source=payload.get("input_source", "manual"),
    )
    db.session.add(s)
    db.session.commit()
    return s


def update(user_id: int, stored_item_id: int, payload: dict) -> StoredItem:
    s = get(user_id, stored_item_id)
    for f in ("item_name", "location_id", "location_text", "description"):
        if f in payload:
            setattr(s, f, payload[f])
    if "category" in payload and payload["category"]:
        s.category = enum_in(payload["category"], CATEGORIES, "category")
    db.session.commit()
    return s


def delete(user_id: int, stored_item_id: int) -> None:
    s = get(user_id, stored_item_id)
    s.is_active = False
    db.session.commit()
