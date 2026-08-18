"""Generic file upload routes.

Right now: only /uploads/audio. Future: /uploads/image, /uploads/document.
Saved files live under <UPLOAD_FOLDER>/<kind>/ with a UUID-prefixed filename.
The returned `file_path` is what the caller stores in audio_action.file_path,
attachment.file_path, etc.
"""
import uuid
from pathlib import Path

from flask import Blueprint, current_app, request
from flask_jwt_extended import jwt_required
from werkzeug.utils import secure_filename

from ..utils.responses import created
from ..utils.errors import HTTPError

bp = Blueprint("upload", __name__, url_prefix="/uploads")

_AUDIO_EXTS = {".wav", ".webm", ".ogg", ".mp3", ".m4a", ".flac", ".aac"}


def _save(file_storage, kind: str, allowed_exts: set[str]) -> dict:
    if not file_storage or file_storage.filename == "":
        raise HTTPError("No file provided (expected field 'file')", 400)

    ext = Path(secure_filename(file_storage.filename)).suffix.lower()
    if ext not in allowed_exts:
        raise HTTPError(
            f"Unsupported extension '{ext}'. Allowed: {sorted(allowed_exts)}",
            415,
        )

    upload_root = Path(current_app.config["UPLOAD_FOLDER"]) / kind
    upload_root.mkdir(parents=True, exist_ok=True)

    fname = f"{uuid.uuid4().hex}{ext}"
    fpath = upload_root / fname
    file_storage.save(fpath)

    size_bytes = fpath.stat().st_size
    return {
        "file_path": str(fpath.resolve()),
        "file_name": file_storage.filename,
        "file_size_kb": round(size_bytes / 1024, 2),
        "mime_type": file_storage.mimetype,
        "kind": kind,
    }


@bp.post("/audio")
@jwt_required()
def upload_audio():
    info = _save(request.files.get("file"), kind="audio", allowed_exts=_AUDIO_EXTS)
    return created(info, "Audio uploaded")
