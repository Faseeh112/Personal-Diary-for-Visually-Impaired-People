"""timetable table — structural daily slots."""
from sqlalchemy import Column, Integer, String, Time, Boolean, ForeignKey
from ..extensions import db
from ._mixins import TimestampMixin, SerializerMixin


class Timetable(db.Model, TimestampMixin, SerializerMixin):
    __tablename__ = "timetable"

    timetable_id  = Column(Integer, primary_key=True, autoincrement=True)
    user_id       = Column(Integer, ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False, index=True)
    title         = Column(String(200), nullable=False)
    activity_type = Column(String(30), nullable=False)  # prayer|study|work|rest|exercise|meal|religious|other
    start_time    = Column(Time, nullable=False)
    end_time      = Column(Time, nullable=False)
    recurrence    = Column(String(20), default="Daily")  # Daily|Weekly|Weekdays|Weekends|Custom
    days_of_week  = Column(String(20), nullable=True)
    priority      = Column(Integer, default=2)
    notes         = Column(String(500), nullable=True)
    is_active     = Column(Boolean, default=True)

    user          = db.relationship("AppUser", back_populates="timetables")
    activity_logs = db.relationship("ActivityLog", back_populates="timetable")

    SERIALIZE_FIELDS = (
        "timetable_id", "user_id", "title", "activity_type", "start_time",
        "end_time", "recurrence", "days_of_week", "priority", "notes",
        "is_active", "created_at", "updated_at",
    )
