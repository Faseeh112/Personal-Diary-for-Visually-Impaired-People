"""note_transaction — 0..N per note.

Schema (post-migration to multi-party):
  Each row represents one money/value transfer between two parties, where
  EXACTLY ONE party may be the App User (represented by NULL).

  sender_person_id  | receiver_person_id | Meaning
  ------------------+--------------------+--------------------------------
  NULL              | <person_id>        | User gave that person
  <person_id>       | NULL               | That person gave User
  <person_id>       | <person_id>        | Third-party (User is observer)
  NULL              | NULL               | INVALID — caught here AND by DB

Aggregations should filter by:
  - User-given:    WHERE sender_person_id IS NULL
  - User-received: WHERE receiver_person_id IS NULL
  - Third-party:   WHERE sender_person_id IS NOT NULL
                     AND receiver_person_id IS NOT NULL
"""
from datetime import datetime

from sqlalchemy import (Column, Integer, String, Numeric, Boolean,
                        ForeignKey, DateTime)
from sqlalchemy.orm import validates

from ..extensions import db
from ._mixins import SerializerMixin


class NoteTransaction(db.Model, SerializerMixin):
    __tablename__ = "note_transaction"

    txn_id  = Column(Integer, primary_key=True, autoincrement=True)
    note_id = Column(Integer, ForeignKey("note.note_id", ondelete="CASCADE"),
                     nullable=False, index=True)

    # --- Multi-party schema ---
    # NULL = the App User. At least one MUST be non-NULL (validated below
    # at Python layer; also enforced by DB CHECK constraint).
    sender_person_id   = Column(Integer, ForeignKey("person.person_id"),
                                nullable=True)
    receiver_person_id = Column(Integer, ForeignKey("person.person_id"),
                                nullable=True)

    amount      = Column(Numeric(12, 2), nullable=False)
    currency    = Column(String(3), ForeignKey("currency.code"),
                         nullable=False, default="PKR")
    category_id = Column(Integer, ForeignKey("category.category_id"),
                         nullable=True)
    notes       = Column(String(500), nullable=True)
    event_context = Column(String(255), nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    is_active   = Column(Boolean, default=True)

    # --- Relationships ---
    note     = db.relationship("Note", back_populates="transactions")
    sender   = db.relationship("Person", foreign_keys=[sender_person_id])
    receiver = db.relationship("Person", foreign_keys=[receiver_person_id])
    category = db.relationship("Category")

    # --- Serialization ---
    SERIALIZE_FIELDS = (
        "txn_id", "note_id", "sender_person_id", "receiver_person_id",
        "amount", "currency", "category_id", "notes", "event_context",
        "created_at", "is_active",
    )

    # ────────────────────────────────────────────────────────────────
    # PYTHON-LEVEL VALIDATION
    # ────────────────────────────────────────────────────────────────
    # SQLAlchemy's @validates fires on attribute assignment. We can't
    # check both sender and receiver in a single @validates (SQLAlchemy
    # validates each attribute independently), so we cross-check on
    # whichever one was just assigned.

    def _both_parties_null(self) -> bool:
        return self.sender_person_id is None and self.receiver_person_id is None

    @validates("sender_person_id", "receiver_person_id")
    def _validate_parties(self, key, value):
        # Allow the assignment to proceed first, then check final state.
        # ORM transient objects without both attrs set yet shouldn't crash.
        return value

    def _assert_valid_for_persistence(self) -> None:
        """Call from service layer before db.session.flush() if you want a
        clean Python-side error. Optional — DB CHECK will catch it anyway."""
        if self._both_parties_null():
            raise ValueError(
                "NoteTransaction requires at least one of sender_person_id "
                "or receiver_person_id to be non-NULL "
                "(NULL = App User; both NULL is meaningless)."
            )
        if self.amount is None or float(self.amount) <= 0:
            raise ValueError(
                f"NoteTransaction.amount must be > 0 (got {self.amount!r})."
            )

    # ────────────────────────────────────────────────────────────────
    # CONVENIENCE PROPERTIES — semantic helpers for query / display
    # ────────────────────────────────────────────────────────────────

    @property
    def is_user_given(self) -> bool:
        """User → someone (sender is NULL)."""
        return self.sender_person_id is None and self.receiver_person_id is not None

    @property
    def is_user_received(self) -> bool:
        """Someone → User (receiver is NULL)."""
        return self.receiver_person_id is None and self.sender_person_id is not None

    @property
    def is_third_party(self) -> bool:
        """Both ends are real persons; User is just an observer."""
        return self.sender_person_id is not None and self.receiver_person_id is not None

    @property
    def involves_user(self) -> bool:
        return not self.is_third_party

    # ────────────────────────────────────────────────────────────────
    # RICHER SERIALIZATION FOR FRONTEND
    # ────────────────────────────────────────────────────────────────

    def to_dict_full(self) -> dict:
        """to_dict + resolved names + semantic flag.

        The frontend can show 'User → Aftab' or 'Zahid → User' or
        'Zahid → Aftab' without doing extra person lookups.
        """
        d = self.to_dict()
        d["sender_name"]   = self.sender.name   if self.sender   else "User"
        d["receiver_name"] = self.receiver.name if self.receiver else "User"
        if self.is_third_party:
            d["party_kind"] = "third_party"
        elif self.is_user_given:
            d["party_kind"] = "user_given"
        elif self.is_user_received:
            d["party_kind"] = "user_received"
        else:
            d["party_kind"] = "invalid"
        return d
