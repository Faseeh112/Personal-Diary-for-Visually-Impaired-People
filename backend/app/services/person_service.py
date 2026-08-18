"""Person service."""
from ..extensions import db
from ..models import Person
from ..utils.errors import HTTPError
from ..utils.validators import require, parse_date


def list_for_user(user_id: int):
    return Person.query.filter_by(user_id=user_id, is_active=True).order_by(Person.name).all()


def get(user_id: int, person_id: int) -> Person:
    p = Person.query.filter_by(person_id=person_id, user_id=user_id).first()
    if not p or not p.is_active:
        raise HTTPError("Person not found", 404)
    return p


def get_or_create_by_name(user_id: int, name: str) -> Person:
    name = (name or "").strip()
    if not name:
        raise HTTPError("Person name required", 400)
    existing = Person.query.filter_by(user_id=user_id, name=name).first()
    if existing:
        if not existing.is_active:
            existing.is_active = True
            db.session.commit()
        return existing
    p = Person(user_id=user_id, name=name)
    db.session.add(p)
    db.session.commit()
    return p


def create(user_id: int, payload: dict) -> Person:
    name = require(payload, "name")
    if Person.query.filter_by(user_id=user_id, name=name).first():
        raise HTTPError("Person with this name already exists", 409)
    p = Person(
        user_id=user_id,
        name=name,
        relation=payload.get("relation"),
        phone=payload.get("phone"),
        notes=payload.get("notes"),
        birth_date=parse_date(payload.get("birth_date"), "birth_date"),
    )
    db.session.add(p)
    db.session.commit()
    return p


def update(user_id: int, person_id: int, payload: dict) -> Person:
    p = get(user_id, person_id)
    for f in ("name", "relation", "phone", "notes"):
        if f in payload:
            setattr(p, f, payload[f])
    if "birth_date" in payload:
        p.birth_date = parse_date(payload["birth_date"], "birth_date")
    db.session.commit()
    return p


def delete(user_id: int, person_id: int) -> None:
    p = get(user_id, person_id)
    p.is_active = False
    db.session.commit()
