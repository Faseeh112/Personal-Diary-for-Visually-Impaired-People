"""tag + note_tag tables. No timestamps on either by design."""
from sqlalchemy import Column, Integer, String, ForeignKey
from ..extensions import db
from ._mixins import SerializerMixin


class Tag(db.Model, SerializerMixin):
    __tablename__ = "tag"

    tag_id = Column(Integer, primary_key=True, autoincrement=True)
    name   = Column(String(50), nullable=False, unique=True)

    notes = db.relationship("Note", secondary="note_tag", back_populates="tags")

    SERIALIZE_FIELDS = ("tag_id", "name")


class NoteTag(db.Model):
    __tablename__ = "note_tag"

    note_id = Column(Integer, ForeignKey("note.note_id", ondelete="CASCADE"), primary_key=True)
    tag_id  = Column(Integer, ForeignKey("tag.tag_id",  ondelete="CASCADE"), primary_key=True)
