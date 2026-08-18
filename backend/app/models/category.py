"""category table."""
from sqlalchemy import Column, Integer, String, Boolean, Numeric, ForeignKey, UniqueConstraint
from ..extensions import db
from ._mixins import TimestampMixin, SerializerMixin


class Category(db.Model, TimestampMixin, SerializerMixin):
    __tablename__ = "category"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_category_scope"),)

    category_id       = Column(Integer, primary_key=True, autoincrement=True)
    user_id           = Column(Integer, ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=True)
    name              = Column(String(100), nullable=False)
    description       = Column(String(300), nullable=True)
    is_zakatable      = Column(Boolean, default=False)
    default_depr_rate = Column(Numeric(5, 4), default=0)
    tax_relevant      = Column(Boolean, default=False)
    icon              = Column(String(50), nullable=True)
    color             = Column(String(10), nullable=True)
    sort_order        = Column(Integer, default=0)
    is_active         = Column(Boolean, default=True)

    user = db.relationship("AppUser", back_populates="categories")

    SERIALIZE_FIELDS = (
        "category_id", "user_id", "name", "description", "is_zakatable",
        "default_depr_rate", "tax_relevant", "icon", "color", "sort_order",
        "is_active", "created_at",
    )
