"""user_settings table."""
from sqlalchemy import Column, Integer, String, Boolean, Numeric, ForeignKey
from ..extensions import db
from ._mixins import SerializerMixin
from datetime import datetime
from sqlalchemy import DateTime


class UserSettings(db.Model, SerializerMixin):
    __tablename__ = "user_settings"

    user_id               = Column(Integer, ForeignKey("app_user.user_id", ondelete="CASCADE"), primary_key=True)
    font_size             = Column(Integer, default=14)
    audio_speed           = Column(Numeric(3, 1), default=1.0)
    theme                 = Column(String(20), default="light")
    tts_enabled           = Column(Boolean, default=True)
    tts_voice             = Column(String(50), nullable=True)
    tts_language          = Column(String(10), default="en")
    notifications_enabled = Column(Boolean, default=True)
    confirm_financial     = Column(Boolean, default=True)
    updated_at            = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship("AppUser", back_populates="settings")

    SERIALIZE_FIELDS = (
        "user_id", "font_size", "audio_speed", "theme", "tts_enabled",
        "tts_voice", "tts_language", "notifications_enabled",
        "confirm_financial", "updated_at",
    )
