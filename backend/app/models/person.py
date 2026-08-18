"""person table."""
from sqlalchemy import Column, Integer, String, Date, Boolean, ForeignKey, UniqueConstraint
from ..extensions import db
from ._mixins import TimestampMixin, SerializerMixin


class Person(db.Model, TimestampMixin, SerializerMixin):
    __tablename__ = "person"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_user_person"),)

    person_id   = Column(Integer, primary_key=True, autoincrement=True)
    user_id     = Column(Integer, ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False, index=True)
    name        = Column(String(100), nullable=False)
    relation    = Column(String(100), nullable=True)
    phone       = Column(String(20), nullable=True)
    notes       = Column(String(300), nullable=True)
    birth_date  = Column(Date, nullable=True)
    is_active   = Column(Boolean, default=True)

    user = db.relationship("AppUser", back_populates="persons")

    SERIALIZE_FIELDS = (
        "person_id", "user_id", "name", "relation", "phone", "notes",
        "birth_date", "is_active", "created_at", "updated_at",
    )
