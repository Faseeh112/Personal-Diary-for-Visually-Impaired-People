"""voice_entry — log of every voice command with confirmation state."""
from sqlalchemy import Column, Integer, String, Boolean, Numeric, DateTime, Text, ForeignKey
from datetime import datetime
from ..extensions import db
from ._mixins import SerializerMixin


class VoiceEntry(db.Model, SerializerMixin):
    __tablename__ = "voice_entry"

    voice_entry_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id        = Column(Integer, ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False, index=True)
    audio_path     = Column(String(500), nullable=True)
    transcript     = Column(Text, nullable=True)
    intent         = Column(String(20), nullable=True)  # store|query|update|delete|reminder|unknown
    target_entity  = Column(String(20), nullable=True)
    entities_json  = Column(Text, nullable=True)
    confidence     = Column(Numeric(5, 2), nullable=True)
    duration_sec   = Column(Integer, nullable=True)
    model_used     = Column(String(50), nullable=True)

    awaiting_confirm = Column(Boolean, default=False)
    confirmed        = Column(Boolean, nullable=True)

    created_note_id           = Column(Integer, ForeignKey("note.note_id"), nullable=True)
    created_reminder_id       = Column(Integer, ForeignKey("reminder.reminder_id"), nullable=True)
    created_asset_id          = Column(Integer, ForeignKey("asset.asset_id"), nullable=True)
    created_stored_item_id    = Column(Integer, ForeignKey("stored_item.stored_item_id"), nullable=True)
    created_event_instance_id = Column(Integer, ForeignKey("event_instance.event_instance_id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    is_active  = Column(Boolean, default=True)

    user = db.relationship("AppUser", back_populates="voice_entries")

    SERIALIZE_FIELDS = (
        "voice_entry_id", "user_id", "audio_path", "transcript", "intent",
        "target_entity", "entities_json", "confidence", "duration_sec",
        "model_used", "awaiting_confirm", "confirmed", "created_note_id",
        "created_reminder_id", "created_asset_id", "created_stored_item_id",
        "created_event_instance_id", "created_at", "is_active",
    )
