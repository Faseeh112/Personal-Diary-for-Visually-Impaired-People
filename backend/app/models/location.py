"""location table (self-referential tree)."""
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from ..extensions import db
from ._mixins import TimestampMixin, SerializerMixin


class Location(db.Model, TimestampMixin, SerializerMixin):
    __tablename__ = "location"

    location_id        = Column(Integer, primary_key=True, autoincrement=True)
    user_id            = Column(Integer, ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False, index=True)
    name               = Column(String(100), nullable=False)
    parent_location_id = Column(Integer, ForeignKey("location.location_id"), nullable=True)
    full_path          = Column(String(500), nullable=True)
    depth              = Column(Integer, default=0)
    additional_info    = Column(String(300), nullable=True)
    is_active          = Column(Boolean, default=True)

    user     = db.relationship("AppUser", back_populates="locations")
    parent   = db.relationship("Location", remote_side=[location_id], backref="children")

    SERIALIZE_FIELDS = (
        "location_id", "user_id", "name", "parent_location_id", "full_path",
        "depth", "additional_info", "is_active", "created_at", "updated_at",
    )
