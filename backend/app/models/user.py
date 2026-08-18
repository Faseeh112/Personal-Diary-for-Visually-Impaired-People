"""app_user table."""
from sqlalchemy import Column, Integer, String, LargeBinary, DateTime, Boolean
from ..extensions import db
from ._mixins import TimestampMixin, SerializerMixin


class AppUser(db.Model, TimestampMixin, SerializerMixin):
    __tablename__ = "app_user"

    user_id       = Column(Integer, primary_key=True, autoincrement=True)
    name          = Column(String(100), nullable=False)
    email         = Column(String(150), nullable=False, unique=True, index=True)
    password_hash = Column(LargeBinary(256), nullable=False)
    last_login    = Column(DateTime, nullable=True)
    is_active     = Column(Boolean, default=True)
    language      = Column(String(10), default="en")
    timezone      = Column(String(50), default="Asia/Karachi")
    profile_notes = Column(String(500), nullable=True)

    # Relationships
    settings       = db.relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    persons        = db.relationship("Person", back_populates="user", cascade="all, delete-orphan")
    locations      = db.relationship("Location", back_populates="user", cascade="all, delete-orphan")
    categories     = db.relationship("Category", back_populates="user", cascade="all, delete-orphan")
    notes          = db.relationship("Note", back_populates="user", cascade="all, delete-orphan")
    assets         = db.relationship("Asset", back_populates="user", cascade="all, delete-orphan")
    reminders      = db.relationship("Reminder", back_populates="user", cascade="all, delete-orphan")
    timetables     = db.relationship("Timetable", back_populates="user", cascade="all, delete-orphan")
    activity_logs  = db.relationship("ActivityLog", back_populates="user", cascade="all, delete-orphan")
    stored_items   = db.relationship("StoredItem", back_populates="user", cascade="all, delete-orphan")
    event_instances= db.relationship("EventInstance", back_populates="user", cascade="all, delete-orphan")
    audio_actions  = db.relationship("AudioAction", back_populates="user", cascade="all, delete-orphan")
    attachments    = db.relationship("Attachment", back_populates="user", cascade="all, delete-orphan")
    voice_entries  = db.relationship("VoiceEntry", back_populates="user", cascade="all, delete-orphan")
    query_logs     = db.relationship("AIQueryLog", back_populates="user", cascade="all, delete-orphan")
    triples        = db.relationship("KnowledgeTriple", back_populates="user", cascade="all, delete-orphan")

    SERIALIZE_FIELDS = (
        "user_id", "name", "email", "created_at", "last_login", "is_active",
        "language", "timezone", "profile_notes",
    )
