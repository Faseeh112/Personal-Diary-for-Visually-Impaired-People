"""predicate_vocab — controlled predicate vocabulary for triples."""
from sqlalchemy import Column, Integer, String, Boolean, UniqueConstraint
from ..extensions import db
from ._mixins import SerializerMixin


class PredicateVocab(db.Model, SerializerMixin):
    __tablename__ = "predicate_vocab"
    __table_args__ = (UniqueConstraint("predicate_text", name="uq_predicate_text"),)

    predicate_id       = Column(Integer, primary_key=True, autoincrement=True)
    predicate_text     = Column(String(100), nullable=False)
    predicate_alias    = Column(String(500), nullable=True)
    predicate_category = Column(String(50), nullable=True)  # transaction|relation|event|location|ownership|other
    is_active          = Column(Boolean, default=True)

    SERIALIZE_FIELDS = ("predicate_id", "predicate_text", "predicate_alias",
                        "predicate_category", "is_active")
