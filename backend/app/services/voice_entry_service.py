"""Voice entry service — read-only log + confirmation-loop state changes."""
from ..extensions import db
from ..models import VoiceEntry
from ..utils.errors import HTTPError
from ..utils.validators import enum_in

INTENTS  = {"store", "query", "update", "delete", "reminder", "unknown"}
TARGETS  = {"note", "reminder", "asset", "stored_item", "audio_action",
            "event_instance", "timetable", "query"}


def list_for_user(user_id: int, limit: int = 50):
    return (VoiceEntry.query.filter_by(user_id=user_id, is_active=True)
            .order_by(VoiceEntry.created_at.desc()).limit(limit).all())


def get(user_id: int, voice_entry_id: int) -> VoiceEntry:
    v = VoiceEntry.query.filter_by(voice_entry_id=voice_entry_id, user_id=user_id).first()
    if not v or not v.is_active:
        raise HTTPError("Voice entry not found", 404)
    return v


def list_pending_confirm(user_id: int):
    return (VoiceEntry.query.filter_by(user_id=user_id, awaiting_confirm=True, is_active=True)
            .order_by(VoiceEntry.created_at.desc()).all())


def confirm(user_id: int, voice_entry_id: int, confirmed: bool) -> VoiceEntry:
    v = get(user_id, voice_entry_id)
    if not v.awaiting_confirm:
        raise HTTPError("Voice entry is not awaiting confirmation", 400)
    v.confirmed = bool(confirmed)
    v.awaiting_confirm = False
    db.session.commit()
    return v
