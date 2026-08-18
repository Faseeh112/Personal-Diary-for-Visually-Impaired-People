"""ai_query_log — every query + answer."""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
from uuid import uuid4
from ..extensions import db
from ._mixins import SerializerMixin


class AIQueryLog(db.Model, SerializerMixin):
    __tablename__ = "ai_query_log"

    query_id        = Column(Integer, primary_key=True, autoincrement=True)
    user_id         = Column(Integer, ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False, index=True)
    question        = Column(String(2000), nullable=False)
    answer          = Column(Text, nullable=True)
    input_source    = Column(String(10), default="text")  # voice|text
    confidence      = Column(Numeric(5, 2), nullable=True)
    session_id      = Column(String(36), default=lambda: str(uuid4()))
    parent_query_id = Column(Integer, ForeignKey("ai_query_log.query_id"), nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)

    user = db.relationship("AppUser", back_populates="query_logs")

    SERIALIZE_FIELDS = (
        "query_id", "user_id", "question", "answer", "input_source",
        "confidence", "session_id", "parent_query_id", "created_at",
    )
