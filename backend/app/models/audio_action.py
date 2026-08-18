"""audio_action — scheduled audio playback (custom file or auto_summary TTS)."""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, CheckConstraint
from ..extensions import db
from ._mixins import TimestampMixin, SerializerMixin


class AudioAction(db.Model, TimestampMixin, SerializerMixin):
    __tablename__ = "audio_action"
    __table_args__ = (
        CheckConstraint(
            "playback_mode <> 'custom' OR file_path IS NOT NULL",
            name="ck_audio_custom_has_file",
        ),
        CheckConstraint(
            "ayat_from IS NULL OR ayat_to IS NULL OR ayat_from <= ayat_to",
            name="ck_audio_ayat_range",
        ),
    )

    audio_action_id    = Column(Integer, primary_key=True, autoincrement=True)
    user_id            = Column(Integer, ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False, index=True)
    audio_name         = Column(String(200), nullable=False)
    playback_mode      = Column(String(20), nullable=False, default="custom")  # custom|auto_summary
    file_path          = Column(String(500), nullable=True)
    file_size_kb       = Column(Integer, nullable=True)
    duration_sec       = Column(Integer, nullable=True)
    surah_name         = Column(String(100), nullable=True)
    ayat_from          = Column(Integer, nullable=True)
    ayat_to            = Column(Integer, nullable=True)
    play_datetime      = Column(DateTime, nullable=True)
    repeat_type        = Column(String(20), default="None")  # None|Daily|Weekly|Monthly
    is_active_schedule = Column(Boolean, default=True)
    is_active          = Column(Boolean, default=True)

    user = db.relationship("AppUser", back_populates="audio_actions")

    SERIALIZE_FIELDS = (
        "audio_action_id", "user_id", "audio_name", "playback_mode",
        "file_path", "file_size_kb", "duration_sec", "surah_name",
        "ayat_from", "ayat_to", "play_datetime", "repeat_type",
        "is_active_schedule", "is_active", "created_at", "updated_at",
    )
