"""Zakat nisab service + zakat summary computation."""
from datetime import date, timedelta
from ..extensions import db
from ..models import ZakatNisab, Asset
from ..utils.errors import HTTPError
from ..utils.validators import require, positive_number


def list_all():
    return ZakatNisab.query.order_by(ZakatNisab.year.desc(), ZakatNisab.currency).all()


def get_for_year(year: int, currency: str = "PKR") -> ZakatNisab:
    n = ZakatNisab.query.filter_by(year=year, currency=currency).first()
    if not n:
        raise HTTPError(f"Nisab for {year} {currency} not found", 404)
    return n


def upsert(payload: dict) -> ZakatNisab:
    year     = int(require(payload, "year"))
    currency = (payload.get("currency") or "PKR").upper()
    nisab    = positive_number(require(payload, "nisab_amount"), "nisab_amount", allow_zero=False)

    existing = ZakatNisab.query.filter_by(year=year, currency=currency).first()
    if existing:
        existing.nisab_amount = nisab
        existing.gold_price_per_gram = payload.get("gold_price_per_gram")
        existing.notes = payload.get("notes")
        db.session.commit()
        return existing

    n = ZakatNisab(
        year=year, currency=currency, nisab_amount=nisab,
        gold_price_per_gram=payload.get("gold_price_per_gram"),
        notes=payload.get("notes"),
    )
    db.session.add(n)
    db.session.commit()
    return n


def summary_for_user(user_id: int, currency: str = "PKR") -> dict:
    """Compute zakat summary: total zakatable assets held ≥ 354 days,
    vs this year's nisab threshold."""
    today = date.today()
    threshold_date = today - timedelta(days=354)

    assets = (Asset.query.filter(
        Asset.user_id == user_id,
        Asset.is_active == True,        # noqa: E712
        Asset.is_zakatable == True,     # noqa: E712
        Asset.currency == currency,
        Asset.current_value.isnot(None),
        Asset.acquired_date.isnot(None),
        Asset.acquired_date <= threshold_date,
    ).all())

    total_zakatable = float(sum((a.current_value or 0) for a in assets))

    nisab = ZakatNisab.query.filter_by(year=today.year, currency=currency).first()
    nisab_amount = float(nisab.nisab_amount) if nisab else 0.0

    zakat_due = round(total_zakatable * 0.025, 2) if total_zakatable >= nisab_amount else 0.0

    return {
        "user_id": user_id,
        "currency": currency,
        "year": today.year,
        "nisab_amount": nisab_amount,
        "total_zakatable": total_zakatable,
        "meets_nisab": total_zakatable >= nisab_amount,
        "zakat_due": zakat_due,
        "asset_count": len(assets),
    }
