"""User profile + settings service."""
from ..extensions import db
from ..models import AppUser, UserSettings
from ..utils.errors import HTTPError


def get_profile(user_id: int) -> dict:
    user = db.session.get(AppUser, user_id)
    if not user:
        raise HTTPError("User not found", 404)
    return user.to_dict()


def update_profile(user_id: int, payload: dict) -> dict:
    user = db.session.get(AppUser, user_id)
    if not user:
        raise HTTPError("User not found", 404)
    for field in ("name", "language", "timezone", "profile_notes"):
        if field in payload:
            setattr(user, field, payload[field])
    db.session.commit()
    return user.to_dict()


def get_settings(user_id: int) -> dict:
    s = db.session.get(UserSettings, user_id)
    if not s:
        s = UserSettings(user_id=user_id)
        db.session.add(s)
        db.session.commit()
    return s.to_dict()


def update_settings(user_id: int, payload: dict) -> dict:
    s = db.session.get(UserSettings, user_id)
    if not s:
        s = UserSettings(user_id=user_id)
        db.session.add(s)
    for field in ("font_size", "audio_speed", "theme", "tts_enabled", "tts_voice",
                  "tts_language", "notifications_enabled", "confirm_financial"):
        if field in payload:
            setattr(s, field, payload[field])
    db.session.commit()
    return s.to_dict()
