"""stored_item table — item location memory."""
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, CheckConstraint
from ..extensions import db
from ._mixins import TimestampMixin, SerializerMixin


class StoredItem(db.Model, TimestampMixin, SerializerMixin):
    __tablename__ = "stored_item"
    __table_args__ = (
        CheckConstraint(
            "location_id IS NOT NULL OR location_text IS NOT NULL",
            name="ck_item_has_location",
        ),
    )

    stored_item_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id        = Column(Integer, ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False, index=True)
    item_name      = Column(String(200), nullable=False)
    category       = Column(String(50), nullable=True)  # document|electronics|personal|clothing|kitchen|medical|jewellery|other
    location_id    = Column(Integer, ForeignKey("location.location_id"), nullable=True)
    location_text  = Column(String(300), nullable=True)
    description    = Column(String(500), nullable=True)
    input_source   = Column(String(10), default="manual")
    is_active      = Column(Boolean, default=True)

    user     = db.relationship("AppUser", back_populates="stored_items")
    location = db.relationship("Location")

    SERIALIZE_FIELDS = (
        "stored_item_id", "user_id", "item_name", "category", "location_id",
        "location_text", "description", "input_source", "is_active",
        "created_at", "updated_at",
    )
