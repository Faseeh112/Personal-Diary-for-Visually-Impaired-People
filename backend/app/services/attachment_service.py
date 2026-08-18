"""Attachment service.

Upload endpoints accept file metadata; actual file handling and text extraction
live in Phase 3. This service just manages metadata rows.
"""
from datetime import datetime
from ..extensions import db
from ..models import Attachment
from ..utils.errors import HTTPError
from ..utils.validators import require, enum_in

FILE_TYPES = {"pdf", "docx", "xlsx", "csv", "txt", "jpg", "png", "mp3", "other"}
STATUSES   = {"pending", "processing", "done", "failed", "skipped"}
ACTION     = {"extract", "calculate", "listen", "other"}


def list_for_user(user_id: int):
    return (Attachment.query.filter_by(user_id=user_id, is_active=True)
            .order_by(Attachment.uploaded_at.desc()).all())


def get(user_id: int, attachment_id: int) -> Attachment:
    a = Attachment.query.filter_by(attachment_id=attachment_id, user_id=user_id).first()
    if not a or not a.is_active:
        raise HTTPError("Attachment not found", 404)
    return a


def create(user_id: int, payload: dict) -> Attachment:
    filename = require(payload, "original_filename")
    file_type = enum_in(require(payload, "file_type"), FILE_TYPES, "file_type")
    file_path = require(payload, "file_path")

    action_type = payload.get("action_type")
    if action_type:
        enum_in(action_type, ACTION, "action_type")

    a = Attachment(
        user_id=user_id,
        note_id=payload.get("note_id"),
        original_filename=filename,
        file_type=file_type,
        file_path=file_path,
        file_size_kb=payload.get("file_size_kb"),
        mime_type=payload.get("mime_type"),
        extraction_status="pending",
        action_type=action_type,
    )
    db.session.add(a)
    db.session.commit()
    return a


def update_extraction(user_id: int, attachment_id: int, payload: dict) -> Attachment:
    """Called by Phase-3 extractor to record extracted text + status."""
    a = get(user_id, attachment_id)
    if "extraction_status" in payload:
        a.extraction_status = enum_in(payload["extraction_status"], STATUSES, "extraction_status")
    for f in ("extracted_text", "summary", "page_count", "word_count", "extraction_error"):
        if f in payload:
            setattr(a, f, payload[f])
    if a.extraction_status == "done" and a.extracted_at is None:
        a.extracted_at = datetime.utcnow()
    db.session.commit()
    return a


def delete(user_id: int, attachment_id: int) -> None:
    a = get(user_id, attachment_id)
    a.is_active = False
    db.session.commit()
