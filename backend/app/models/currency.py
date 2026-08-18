"""currency reference table. No timestamps by design."""
from sqlalchemy import Column, String
from ..extensions import db
from ._mixins import SerializerMixin


class Currency(db.Model, SerializerMixin):
    __tablename__ = "currency"

    code = Column(String(3), primary_key=True)
    name = Column(String(100), nullable=False)

    SERIALIZE_FIELDS = ("code", "name")
