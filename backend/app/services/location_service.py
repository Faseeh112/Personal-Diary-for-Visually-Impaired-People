"""Location service — hierarchical with auto full_path/depth."""
from ..extensions import db
from ..models import Location
from ..utils.errors import HTTPError
from ..utils.validators import require


def list_for_user(user_id: int):
    return Location.query.filter_by(user_id=user_id, is_active=True).order_by(Location.full_path).all()


def get(user_id: int, location_id: int) -> Location:
    l = Location.query.filter_by(location_id=location_id, user_id=user_id).first()
    if not l or not l.is_active:
        raise HTTPError("Location not found", 404)
    return l


def create(user_id: int, payload: dict) -> Location:
    name = require(payload, "name")
    parent_id = payload.get("parent_location_id")
    depth, path = 0, name
    if parent_id:
        parent = get(user_id, parent_id)
        depth = (parent.depth or 0) + 1
        path = f"{parent.full_path} > {name}" if parent.full_path else name
    l = Location(
        user_id=user_id, name=name,
        parent_location_id=parent_id,
        full_path=path, depth=depth,
        additional_info=payload.get("additional_info"),
    )
    db.session.add(l)
    db.session.commit()
    return l


def update(user_id: int, location_id: int, payload: dict) -> Location:
    l = get(user_id, location_id)
    if "name" in payload:
        l.name = payload["name"]
        # refresh full_path for this node (children paths intentionally not recursed — FYP scope)
        if l.parent_location_id:
            parent = db.session.get(Location, l.parent_location_id)
            l.full_path = f"{parent.full_path} > {l.name}" if parent and parent.full_path else l.name
        else:
            l.full_path = l.name
    if "additional_info" in payload:
        l.additional_info = payload["additional_info"]
    db.session.commit()
    return l


def delete(user_id: int, location_id: int) -> None:
    l = get(user_id, location_id)
    l.is_active = False
    db.session.commit()
