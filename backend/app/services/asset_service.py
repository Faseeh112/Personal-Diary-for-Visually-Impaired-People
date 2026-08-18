"""Asset service — auto-derives zakat + depreciation defaults from category."""
from ..extensions import db
from ..models import Asset, Category
from ..utils.errors import HTTPError
from ..utils.validators import require, parse_date, enum_in, positive_number

ACQUISITION_TYPES = {"purchased", "gift_received", "inherited", "other"}
PURPOSES          = {"personal", "business", "resale"}


def list_for_user(user_id: int):
    return Asset.query.filter_by(user_id=user_id, is_active=True).order_by(Asset.created_at.desc()).all()


def get(user_id: int, asset_id: int) -> Asset:
    a = Asset.query.filter_by(asset_id=asset_id, user_id=user_id).first()
    if not a or not a.is_active:
        raise HTTPError("Asset not found", 404)
    return a


def create(user_id: int, payload: dict) -> Asset:
    name = require(payload, "name")
    acquisition_type = enum_in(
        payload.get("acquisition_type", "purchased"), ACQUISITION_TYPES, "acquisition_type"
    )
    purpose = enum_in(payload.get("purpose", "personal"), PURPOSES, "purpose")

    # Derive defaults from category
    is_zakatable = bool(payload.get("is_zakatable", False))
    depr_rate    = payload.get("depreciation_rate")
    category_id  = payload.get("category_id")
    cat_name     = None
    if category_id is not None:
        cat = db.session.get(Category, category_id)
        if not cat:
            raise HTTPError("Category not found", 404)
        cat_name = cat.name
        if "is_zakatable" not in payload:
            is_zakatable = bool(cat.is_zakatable)
        if depr_rate is None:
            depr_rate = cat.default_depr_rate

    # Business rule: resale vehicle is always zakatable
    if cat_name == "Vehicle" and purpose == "resale":
        is_zakatable = True

    purchase_value = payload.get("purchase_value")
    if purchase_value is not None:
        purchase_value = positive_number(purchase_value, "purchase_value")

    a = Asset(
        user_id=user_id,
        note_id=payload.get("note_id"),
        category_id=category_id,
        name=name,
        acquired_from=payload.get("acquired_from"),
        acquired_date=parse_date(payload.get("acquired_date"), "acquired_date"),
        acquisition_type=acquisition_type,
        weight_grams=payload.get("weight_grams"),
        purchase_value=purchase_value,
        current_value=payload.get("current_value", purchase_value),
        currency=(payload.get("currency") or "PKR").upper(),
        is_zakatable=is_zakatable,
        purpose=purpose,
        is_tax_asset=bool(payload.get("is_tax_asset", True)),
        depreciation_rate=depr_rate or 0,
        location_id=payload.get("location_id"),
        notes=payload.get("notes"),
    )
    db.session.add(a)
    db.session.commit()
    return a


def update(user_id: int, asset_id: int, payload: dict) -> Asset:
    a = get(user_id, asset_id)
    simple_fields = ("name", "acquired_from", "weight_grams", "purchase_value",
                     "current_value", "is_zakatable", "is_tax_asset",
                     "depreciation_rate", "location_id", "notes",
                     "last_valuation_date", "valuation_source", "category_id",
                     "note_id")
    for f in simple_fields:
        if f in payload:
            setattr(a, f, payload[f])
    if "acquired_date" in payload:
        a.acquired_date = parse_date(payload["acquired_date"], "acquired_date")
    if "acquisition_type" in payload:
        a.acquisition_type = enum_in(payload["acquisition_type"], ACQUISITION_TYPES, "acquisition_type")
    if "purpose" in payload:
        a.purpose = enum_in(payload["purpose"], PURPOSES, "purpose")
    if "currency" in payload:
        a.currency = payload["currency"].upper()
    db.session.commit()
    return a


def delete(user_id: int, asset_id: int) -> None:
    a = get(user_id, asset_id)
    a.is_active = False
    db.session.commit()
