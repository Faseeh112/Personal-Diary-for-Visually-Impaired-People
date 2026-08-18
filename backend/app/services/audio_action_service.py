"""Audio action service — scheduled playback."""
from ..extensions import db
from ..models import AudioAction
from ..utils.errors import HTTPError
from ..utils.validators import require, parse_datetime, enum_in

MODES  = {"custom", "auto_summary"}
REPEAT = {"None", "Daily", "Weekly", "Monthly"}


def list_for_user(user_id: int):
    return (AudioAction.query.filter_by(user_id=user_id, is_active=True)
            .order_by(AudioAction.play_datetime).all())


def get(user_id: int, audio_action_id: int) -> AudioAction:
    a = AudioAction.query.filter_by(audio_action_id=audio_action_id, user_id=user_id).first()
    if not a or not a.is_active:
        raise HTTPError("Audio action not found", 404)
    return a


def create(user_id: int, payload: dict) -> AudioAction:
    audio_name = require(payload, "audio_name")
    mode = enum_in(payload.get("playback_mode", "custom"), MODES, "playback_mode")
    file_path = payload.get("file_path")
    if mode == "custom" and not file_path:
        raise HTTPError("custom mode requires file_path", 400)

    ayat_from = payload.get("ayat_from")
    ayat_to   = payload.get("ayat_to")
    if ayat_from is not None and ayat_to is not None and ayat_from > ayat_to:
        raise HTTPError("ayat_from must be <= ayat_to", 400)

    a = AudioAction(
        user_id=user_id,
        audio_name=audio_name,
        playback_mode=mode,
        file_path=file_path,
        file_size_kb=payload.get("file_size_kb"),
        duration_sec=payload.get("duration_sec"),
        surah_name=payload.get("surah_name"),
        ayat_from=ayat_from,
        ayat_to=ayat_to,
        play_datetime=parse_datetime(payload.get("play_datetime"), "play_datetime"),
        repeat_type=enum_in(payload.get("repeat_type", "None"), REPEAT, "repeat_type"),
        is_active_schedule=bool(payload.get("is_active_schedule", True)),
    )
    db.session.add(a)
    db.session.commit()
    return a


def update(user_id: int, audio_action_id: int, payload: dict) -> AudioAction:
    a = get(user_id, audio_action_id)
    simple = ("audio_name", "file_path", "file_size_kb", "duration_sec",
              "surah_name", "ayat_from", "ayat_to", "is_active_schedule")
    for f in simple:
        if f in payload:
            setattr(a, f, payload[f])
    if "playback_mode" in payload:
        a.playback_mode = enum_in(payload["playback_mode"], MODES, "playback_mode")
    if "repeat_type" in payload:
        a.repeat_type = enum_in(payload["repeat_type"], REPEAT, "repeat_type")
    if "play_datetime" in payload:
        a.play_datetime = parse_datetime(payload["play_datetime"], "play_datetime")
    if a.playback_mode == "custom" and not a.file_path:
        raise HTTPError("custom mode requires file_path", 400)
    db.session.commit()
    return a


def delete(user_id: int, audio_action_id: int) -> None:
    a = get(user_id, audio_action_id)
    a.is_active = False
    db.session.commit()
