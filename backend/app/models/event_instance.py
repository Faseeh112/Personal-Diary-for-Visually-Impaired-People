"""event_instance table — life events that drive cascade reminders."""
from sqlalchemy import Column, Integer, String, Date, Boolean, ForeignKey
from ..extensions import db
from ._mixins import TimestampMixin, SerializerMixin


class EventInstance(db.Model, TimestampMixin, SerializerMixin):
    __tablename__ = "event_instance"

    event_instance_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id           = Column(Integer, ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False, index=True)
    event_type        = Column(String(30), nullable=False)  # birth|wedding|death|anniversary|other
    title             = Column(String(200), nullable=False)
    description       = Column(String(500), nullable=True)
    event_date        = Column(Date, nullable=False)
    subject_person_id = Column(Integer, ForeignKey("person.person_id"), nullable=True)
    is_active         = Column(Boolean, default=True)

    user           = db.relationship("AppUser", back_populates="event_instances")
    subject_person = db.relationship("Person", foreign_keys=[subject_person_id])
    reminders      = db.relationship("Reminder", back_populates="parent_event")
    notes          = db.relationship("Note", back_populates="event_instance")

    SERIALIZE_FIELDS = (
        "event_instance_id", "user_id", "event_type", "title", "description",
        "event_date", "subject_person_id", "is_active", "created_at", "updated_at",
    )
