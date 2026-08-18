"""Shared model mixins.

- TimestampMixin: opt-in created_at/updated_at. Uses declared_attr so each
  subclass gets its own Column object (prevents SQLAlchemy duplicate-column
  errors). Only applied to tables that have these columns in the schema.
- SerializerMixin: uniform to_dict() for routes. Subclass lists field names in
  SERIALIZE_FIELDS; special types (Decimal, datetime, date, time, bytes) are
  converted to JSON-safe values automatically.
"""
from datetime import datetime, date, time
from decimal import Decimal
from sqlalchemy import Column, DateTime
from sqlalchemy.orm import declared_attr


class TimestampMixin:
    @declared_attr
    def created_at(cls):
        return Column(DateTime, default=datetime.utcnow)

    @declared_attr
    def updated_at(cls):
        return Column(DateTime, nullable=True, onupdate=datetime.utcnow)


class SerializerMixin:
    SERIALIZE_FIELDS: tuple = ()

    @staticmethod
    def _serialize_value(v):
        if v is None:
            return None
        if isinstance(v, Decimal):
            return float(v)
        if isinstance(v, datetime):
            return v.isoformat()
        if isinstance(v, date):
            return v.isoformat()
        if isinstance(v, time):
            return v.strftime("%H:%M:%S")
        if isinstance(v, (bytes, bytearray)):
            return None  # never serialize binary (password_hash etc)
        return v

    def to_dict(self) -> dict:
        return {f: self._serialize_value(getattr(self, f, None))
                for f in self.SERIALIZE_FIELDS}
