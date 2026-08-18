"""zakat_nisab — yearly threshold per currency."""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, UniqueConstraint
from datetime import datetime
from ..extensions import db
from ._mixins import SerializerMixin


class ZakatNisab(db.Model, SerializerMixin):
    __tablename__ = "zakat_nisab"
    __table_args__ = (UniqueConstraint("year", "currency", name="uq_nisab_year_currency"),)

    zakat_nisab_id      = Column(Integer, primary_key=True, autoincrement=True)
    year                = Column(Integer, nullable=False)
    currency            = Column(String(3), ForeignKey("currency.code"), nullable=False, default="PKR")
    nisab_amount        = Column(Numeric(14, 2), nullable=False)
    gold_price_per_gram = Column(Numeric(10, 2), nullable=True)
    notes               = Column(String(300), nullable=True)
    created_at          = Column(DateTime, default=datetime.utcnow)

    SERIALIZE_FIELDS = (
        "zakat_nisab_id", "year", "currency", "nisab_amount",
        "gold_price_per_gram", "notes", "created_at",
    )
