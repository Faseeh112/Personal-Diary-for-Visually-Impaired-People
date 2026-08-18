"""Tag service. Tags are global (not user-scoped) per schema."""
from ..extensions import db
from ..models import Tag
from ..utils.errors import HTTPError
from ..utils.validators import require


def list_all():
    return Tag.query.order_by(Tag.name).all()


def get_or_create(name: str) -> Tag:
    name = (name or "").strip()
    if not name:
        raise HTTPError("Tag name required", 400)
    existing = Tag.query.filter_by(name=name).first()
    if existing:
        return existing
    t = Tag(name=name)
    db.session.add(t)
    db.session.commit()
    return t


def create(payload: dict) -> Tag:
    name = require(payload, "name")
    return get_or_create(name)


def delete(tag_id: int) -> None:
    t = db.session.get(Tag, tag_id)
    if not t:
        raise HTTPError("Tag not found", 404)
    db.session.delete(t)
    db.session.commit()
