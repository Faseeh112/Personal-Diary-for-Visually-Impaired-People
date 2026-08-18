# """Voice routes (Phase 4 — real implementation).

# POST /voice/process            → STT → intent → NER → save or pending-confirm
# POST /voice/<id>/confirm       → resolve pending entry (yes saves, no rejects)

# The pending-confirm hybrid model:
#   - Plain general notes ("today I went for a walk")     → auto-save
#   - Anything financial / asset / reminder / destructive → confirm first
# """
# from flask import Blueprint, request
# from flask_jwt_extended import jwt_required

# from ..services import voice_service
# from ..utils.responses import ok, created
# from ..utils.errors import HTTPError
# from ..utils.jwt_helpers import current_user_id

# bp = Blueprint("voice", __name__, url_prefix="/voice")


# @bp.post("/process")
# @jwt_required()
# def process_voice():
#     """Process voice input (audio file path or pre-transcribed text).

#     Payload:
#       { "transcript": "..." }
#       OR
#       { "audio_path": "/path/to/file.wav" }
#     """
#     data = request.get_json(silent=True) or {}
#     transcript = data.get("transcript")
#     audio_path = data.get("audio_path")
#     result = voice_service.process(current_user_id(), transcript=transcript,
#                                    audio_path=audio_path)
#     return (created(result) if result.get("auto_saved")
#             else ok(result, "Voice entry pending confirmation"))


# @bp.post("/<int:voice_entry_id>/confirm")
# @jwt_required()
# def confirm_voice(voice_entry_id: int):
#     """Resolve a pending voice entry. Payload: { "confirmed": true|false }."""
#     data = request.get_json(silent=True) or {}
#     if "confirmed" not in data:
#         raise HTTPError("Field 'confirmed' is required (true|false)", 400)
#     result = voice_service.confirm(current_user_id(), voice_entry_id,
#                                    bool(data["confirmed"]))
#     return ok(result, "Voice entry confirmed" if result["confirmed"]
#               else "Voice entry rejected")
"""Voice routes (Phase 4 — multipart-capable).

POST /voice/process
  - JSON:      { "transcript": "..." } | { "audio_path": "..." }
  - multipart: audio=<file>            (browser MediaRecorder)
POST /voice/<id>/confirm     { "confirmed": true|false }
"""
import os
import uuid
from pathlib import Path

from flask import Blueprint, current_app, request
from flask_jwt_extended import jwt_required
from werkzeug.utils import secure_filename

from ..services import voice_service
from ..utils.responses import ok, created
from ..utils.errors import HTTPError
from ..utils.jwt_helpers import current_user_id

bp = Blueprint("voice", __name__, url_prefix="/voice")

_ALLOWED_AUDIO_EXT = {".wav", ".webm", ".ogg", ".mp3", ".m4a", ".flac"}


def _save_upload(file_storage) -> str:
    """Persist an uploaded audio blob to UPLOAD_FOLDER. Returns absolute path."""
    if not file_storage or file_storage.filename == "":
        raise HTTPError("Empty audio upload", 400)

    ext = Path(secure_filename(file_storage.filename)).suffix.lower()
    if ext not in _ALLOWED_AUDIO_EXT:
        raise HTTPError(f"Unsupported audio extension '{ext}'", 415)

    upload_dir = Path(current_app.config["UPLOAD_FOLDER"]) / "voice"
    upload_dir.mkdir(parents=True, exist_ok=True)

    fname = f"{uuid.uuid4().hex}{ext}"
    fpath = upload_dir / fname
    file_storage.save(fpath)
    return str(fpath.resolve())


@bp.post("/process")
@jwt_required()
def process_voice():
    transcript: str | None = None
    audio_path: str | None = None

    ctype = (request.content_type or "").lower()
    if ctype.startswith("multipart/form-data"):
        # Browser MediaRecorder upload
        audio_path = _save_upload(request.files.get("audio"))
        transcript = (request.form.get("transcript") or "").strip() or None
    else:
        data = request.get_json(silent=True) or {}
        transcript = data.get("transcript")
        audio_path = data.get("audio_path")

    result = voice_service.process(
        current_user_id(), transcript=transcript, audio_path=audio_path
    )
    return (created(result) if result.get("auto_saved")
            else ok(result, "Voice entry pending confirmation"))


@bp.post("/<int:voice_entry_id>/confirm")
@jwt_required()
def confirm_voice(voice_entry_id: int):
    data = request.get_json(silent=True) or {}
    if "confirmed" not in data:
        raise HTTPError("Field 'confirmed' is required (true|false)", 400)
    result = voice_service.confirm(
        current_user_id(), voice_entry_id, bool(data["confirmed"])
    )
    return ok(result, "Voice entry confirmed" if result["confirmed"]
              else "Voice entry rejected")
