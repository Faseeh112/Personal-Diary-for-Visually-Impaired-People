"""attachment — uploaded documents with text extraction state."""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, LargeBinary, Text, ForeignKey
from datetime import datetime
from ..extensions import db
from ._mixins import SerializerMixin


class Attachment(db.Model, SerializerMixin):
    __tablename__ = "attachment"

    attachment_id     = Column(Integer, primary_key=True, autoincrement=True)
    user_id           = Column(Integer, ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False, index=True)
    note_id           = Column(Integer, ForeignKey("note.note_id"), nullable=True)
    original_filename = Column(String(300), nullable=False)
    file_type         = Column(String(10), nullable=False)  # pdf|docx|xlsx|csv|txt|jpg|png|mp3|other
    file_path         = Column(String(500), nullable=False)
    file_size_kb      = Column(Integer, nullable=True)
    file_hash         = Column(LargeBinary(32), nullable=True)
    mime_type         = Column(String(100), nullable=True)

    extraction_status = Column(String(20), default="pending")  # pending|processing|done|failed|skipped
    extracted_text    = Column(Text, nullable=True)
    extracted_at      = Column(DateTime, nullable=True)
    extraction_error  = Column(String(500), nullable=True)
    summary           = Column(String(1000), nullable=True)
    page_count        = Column(Integer, nullable=True)
    word_count        = Column(Integer, nullable=True)

    action_type       = Column(String(20), nullable=True)  # extract|calculate|listen|other

    uploaded_at       = Column(DateTime, default=datetime.utcnow)
    updated_at        = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
    is_active         = Column(Boolean, default=True)

    user = db.relationship("AppUser", back_populates="attachments")
    note = db.relationship("Note")

    SERIALIZE_FIELDS = (
        "attachment_id", "user_id", "note_id", "original_filename", "file_type",
        "file_path", "file_size_kb", "mime_type", "extraction_status",
        "summary", "page_count", "word_count", "action_type",
        "uploaded_at", "updated_at", "is_active",
    )
