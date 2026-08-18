"""Category service. Lists both system (user_id NULL) and user-custom."""
from sqlalchemy import or_
from ..extensions import db
from ..models import Category
from ..utils.errors import HTTPError
from ..utils.validators import require


def list_for_user(user_id: int):
    return Category.query.filter(
        or_(Category.user_id == user_id, Category.user_id.is_(None)),
        Category.is_active == True,  # noqa: E712
    ).order_by(Category.sort_order, Category.name).all()


def get(user_id: int, category_id: int) -> Category:
    c = db.session.get(Category, category_id)
    if not c or not c.is_active:
        raise HTTPError("Category not found", 404)
    if c.user_id is not None and c.user_id != user_id:
        raise HTTPError("Category not found", 404)
    return c


def create(user_id: int, payload: dict) -> Category:
    name = require(payload, "name")
    if Category.query.filter_by(user_id=user_id, name=name).first():
        raise HTTPError("Category name already exists for this user", 409)
    c = Category(
        user_id=user_id, name=name,
        description=payload.get("description"),
        is_zakatable=bool(payload.get("is_zakatable", False)),
        default_depr_rate=payload.get("default_depr_rate", 0),
        tax_relevant=bool(payload.get("tax_relevant", False)),
        icon=payload.get("icon"),
        color=payload.get("color"),
        sort_order=int(payload.get("sort_order", 0)),
    )
    db.session.add(c)
    db.session.commit()
    return c


def update(user_id: int, category_id: int, payload: dict) -> Category:
    c = get(user_id, category_id)
    if c.user_id is None:
        raise HTTPError("System categories cannot be modified", 403)
    for f in ("name", "description", "is_zakatable", "default_depr_rate",
              "tax_relevant", "icon", "color", "sort_order"):
        if f in payload:
            setattr(c, f, payload[f])
    db.session.commit()
    return c


def delete(user_id: int, category_id: int) -> None:
    c = get(user_id, category_id)
    if c.user_id is None:
        raise HTTPError("System categories cannot be deleted", 403)
    c.is_active = False
    db.session.commit()
