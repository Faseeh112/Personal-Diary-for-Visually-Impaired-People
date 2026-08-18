"""activity_log table — completion tracking, one row per occurrence."""
from sqlalchemy import Column, Integer, String, Date, Time, DateTime, ForeignKey, CheckConstraint, UniqueConstraint
from ..extensions import db
from ._mixins import TimestampMixin, SerializerMixin


class ActivityLog(db.Model, TimestampMixin, SerializerMixin):
    __tablename__ = "activity_log"
    __table_args__ = (
        CheckConstraint(
            "(timetable_id IS NOT NULL AND reminder_id IS NULL) OR "
            "(timetable_id IS NULL AND reminder_id IS NOT NULL)",
            name="ck_alog_source",
        ),
        UniqueConstraint("timetable_id", "scheduled_date", "scheduled_start", name="uq_alog_timetable"),
        UniqueConstraint("reminder_id", "scheduled_date", name="uq_alog_reminder"),
    )

    activity_log_id  = Column(Integer, primary_key=True, autoincrement=True)
    user_id          = Column(Integer, ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False, index=True)
    timetable_id     = Column(Integer, ForeignKey("timetable.timetable_id"), nullable=True)
    reminder_id      = Column(Integer, ForeignKey("reminder.reminder_id"), nullable=True)
    scheduled_date   = Column(Date, nullable=False)
    scheduled_start  = Column(Time, nullable=True)
    status           = Column(String(20), default="pending", nullable=False)  # pending|done|missed|partial|skipped
    completed_at     = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    notes            = Column(String(300), nullable=True)

    user      = db.relationship("AppUser", back_populates="activity_logs")
    timetable = db.relationship("Timetable", back_populates="activity_logs")
    reminder  = db.relationship("Reminder")

    SERIALIZE_FIELDS = (
        "activity_log_id", "user_id", "timetable_id", "reminder_id",
        "scheduled_date", "scheduled_start", "status", "completed_at",
        "duration_minutes", "notes", "created_at", "updated_at",
    )
