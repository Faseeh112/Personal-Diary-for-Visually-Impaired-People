"""asset table."""
from sqlalchemy import Column, Integer, String, Date, Boolean, Numeric, ForeignKey
from ..extensions import db
from ._mixins import TimestampMixin, SerializerMixin


class Asset(db.Model, TimestampMixin, SerializerMixin):
    __tablename__ = "asset"

    asset_id            = Column(Integer, primary_key=True, autoincrement=True)
    user_id             = Column(Integer, ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False, index=True)
    note_id             = Column(Integer, ForeignKey("note.note_id"), nullable=True)
    category_id         = Column(Integer, ForeignKey("category.category_id"), nullable=True)
    name                = Column(String(200), nullable=False)
    acquired_from       = Column(String(200), nullable=True)
    acquired_date       = Column(Date, nullable=True)
    acquisition_type    = Column(String(20), default="purchased")  # purchased|gift_received|inherited|other
    weight_grams        = Column(Numeric(10, 2), nullable=True)
    purchase_value      = Column(Numeric(12, 2), nullable=True)
    current_value       = Column(Numeric(12, 2), nullable=True)
    currency            = Column(String(3), ForeignKey("currency.code"), default="PKR")
    is_zakatable        = Column(Boolean, default=False)
    purpose             = Column(String(20), default="personal")   # personal|business|resale
    is_tax_asset        = Column(Boolean, default=True)
    depreciation_rate   = Column(Numeric(5, 4), default=0)
    location_id         = Column(Integer, ForeignKey("location.location_id"), nullable=True)
    notes               = Column(String(500), nullable=True)
    last_valuation_date = Column(Date, nullable=True)
    valuation_source    = Column(String(50), nullable=True)
    is_active           = Column(Boolean, default=True)

    user     = db.relationship("AppUser", back_populates="assets")
    note     = db.relationship("Note")
    category = db.relationship("Category")
    location = db.relationship("Location")

    SERIALIZE_FIELDS = (
        "asset_id", "user_id", "note_id", "category_id", "name",
        "acquired_from", "acquired_date", "acquisition_type", "weight_grams",
        "purchase_value", "current_value", "currency", "is_zakatable",
        "purpose", "is_tax_asset", "depreciation_rate", "location_id",
        "notes", "last_valuation_date", "valuation_source", "is_active",
        "created_at", "updated_at",
    )
