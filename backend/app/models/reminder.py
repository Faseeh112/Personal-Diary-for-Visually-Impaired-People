"""reminder table."""
from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, ForeignKey
from ..extensions import db
from ._mixins import TimestampMixin, SerializerMixin


class Reminder(db.Model, TimestampMixin, SerializerMixin):
    __tablename__ = "reminder"

    reminder_id              = Column(Integer, primary_key=True, autoincrement=True)
    user_id                  = Column(Integer, ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False, index=True)
    person_id                = Column(Integer, ForeignKey("person.person_id"), nullable=True)
    parent_event_instance_id = Column(Integer, ForeignKey("event_instance.event_instance_id"), nullable=True)
    title                    = Column(String(200), nullable=False)
    description              = Column(String(500), nullable=True)
    reminder_datetime        = Column(DateTime, nullable=False)
    end_date                 = Column(Date, nullable=True)
    repeat_type              = Column(String(20), default="None")  # None|Daily|Weekly|Monthly|Yearly
    is_done                  = Column(Boolean, default=False)
    is_auto_generated        = Column(Boolean, default=False)
    input_source             = Column(String(10), default="manual")
    is_active                = Column(Boolean, default=True)

    user         = db.relationship("AppUser", back_populates="reminders")
    person       = db.relationship("Person")
    parent_event = db.relationship("EventInstance", back_populates="reminders")

    SERIALIZE_FIELDS = (
        "reminder_id", "user_id", "person_id", "parent_event_instance_id",
        "title", "description", "reminder_datetime", "end_date",
        "repeat_type", "is_done", "is_auto_generated", "input_source",
        "is_active", "created_at", "updated_at",
    )
