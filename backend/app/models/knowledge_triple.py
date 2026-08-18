"""knowledge_triple — the semantic memory layer."""
from sqlalchemy import (Column, Integer, BigInteger, String, Boolean, Numeric,
                        DateTime, ForeignKey, UniqueConstraint)
from datetime import datetime
from ..extensions import db
from ._mixins import SerializerMixin


class KnowledgeTriple(db.Model, SerializerMixin):
    __tablename__ = "knowledge_triple"
    __table_args__ = (
        UniqueConstraint("user_id", "subject_text", "predicate", "object_text",
                         name="uq_triple"),
    )

    # BigInteger on MSSQL; tests may patch this to Integer for SQLite autoincrement
    triple_id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id   = Column(Integer, ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False, index=True)

    source_note_id           = Column(Integer, ForeignKey("note.note_id"),                         nullable=True)
    source_voice_id          = Column(Integer, ForeignKey("voice_entry.voice_entry_id"),           nullable=True)
    source_attachment_id     = Column(Integer, ForeignKey("attachment.attachment_id"),             nullable=True)
    source_event_instance_id = Column(Integer, ForeignKey("event_instance.event_instance_id"),     nullable=True)

    subject_text = Column(String(200), nullable=False)
    subject_type = Column(String(50),  nullable=True)
    subject_id   = Column(Integer,     nullable=True)

    predicate_id = Column(Integer, ForeignKey("predicate_vocab.predicate_id"), nullable=True)
    predicate    = Column(String(100), nullable=False)

    object_text = Column(String(500), nullable=False)
    object_type = Column(String(50),  nullable=True)
    object_id   = Column(Integer,     nullable=True)

    confidence       = Column(Numeric(5, 4), nullable=True)
    context_group    = Column(String(100),   nullable=True)
    extraction_model = Column(String(50),    nullable=True)
    is_verified      = Column(Boolean, default=False)
    verified_at      = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
    is_active  = Column(Boolean, default=True)

    user           = db.relationship("AppUser", back_populates="triples")
    predicate_ref  = db.relationship("PredicateVocab")

    SERIALIZE_FIELDS = (
        "triple_id", "user_id", "source_note_id", "source_voice_id",
        "source_attachment_id", "source_event_instance_id",
        "subject_text", "subject_type", "subject_id",
        "predicate_id", "predicate",
        "object_text", "object_type", "object_id",
        "confidence", "context_group", "extraction_model", "is_verified",
        "verified_at", "created_at", "updated_at", "is_active",
    )
