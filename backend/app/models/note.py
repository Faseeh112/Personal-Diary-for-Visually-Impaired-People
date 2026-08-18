"""note table — central content."""
from sqlalchemy import Column, Integer, String, Date, Boolean, ForeignKey
from ..extensions import db
from ._mixins import TimestampMixin, SerializerMixin


class Note(db.Model, TimestampMixin, SerializerMixin):
    __tablename__ = "note"

    note_id           = Column(Integer, primary_key=True, autoincrement=True)
    user_id           = Column(Integer, ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False, index=True)
    title             = Column(String(200), nullable=True)
    description       = Column(String(4000), nullable=True)
    note_type         = Column(String(20), default="general")  # event|memory|asset|gift_received|general
    category_id       = Column(Integer, ForeignKey("category.category_id"), nullable=True)
    person_id         = Column(Integer, ForeignKey("person.person_id"), nullable=True)
    location_id       = Column(Integer, ForeignKey("location.location_id"), nullable=True)
    note_date         = Column(Date, nullable=True)
    event_instance_id = Column(Integer, ForeignKey("event_instance.event_instance_id"), nullable=True)
    input_source      = Column(String(10), default="manual")   # voice|manual
    sentiment         = Column(String(20), nullable=True)
    is_processed      = Column(Boolean, default=False)
    is_active         = Column(Boolean, default=True)

    user           = db.relationship("AppUser", back_populates="notes")
    category       = db.relationship("Category")
    person         = db.relationship("Person")
    location       = db.relationship("Location")
    event_instance = db.relationship("EventInstance", back_populates="notes")
    transactions   = db.relationship(
        "NoteTransaction", back_populates="note", cascade="all, delete-orphan"
    )
    tags           = db.relationship("Tag", secondary="note_tag", back_populates="notes")

    SERIALIZE_FIELDS = (
        "note_id", "user_id", "title", "description", "note_type",
        "category_id", "person_id", "location_id", "note_date",
        "event_instance_id", "input_source", "sentiment", "is_processed",
        "is_active", "created_at", "updated_at",
    )

    def to_dict_full(self) -> dict:
        """Note + nested transactions + tag names."""
        d = self.to_dict()
        d["transactions"] = [t.to_dict() for t in (self.transactions or [])]
        d["tags"] = [t.name for t in (self.tags or [])]
        return d
