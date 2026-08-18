"""Knowledge triple service."""
from ..extensions import db
from ..models import KnowledgeTriple, PredicateVocab
from ..utils.errors import HTTPError
from ..utils.validators import require


def list_for_user(user_id: int, subject: str = None, predicate: str = None,
                  obj: str = None, limit: int = 100):
    q = KnowledgeTriple.query.filter_by(user_id=user_id, is_active=True)
    if subject:
        q = q.filter(KnowledgeTriple.subject_text.ilike(f"%{subject}%"))
    if predicate:
        q = q.filter(KnowledgeTriple.predicate == predicate)
    if obj:
        q = q.filter(KnowledgeTriple.object_text.ilike(f"%{obj}%"))
    return q.order_by(KnowledgeTriple.created_at.desc()).limit(limit).all()


def get(user_id: int, triple_id: int) -> KnowledgeTriple:
    t = KnowledgeTriple.query.filter_by(triple_id=triple_id, user_id=user_id).first()
    if not t or not t.is_active:
        raise HTTPError("Triple not found", 404)
    return t


def create(user_id: int, payload: dict) -> KnowledgeTriple:
    subject_text = require(payload, "subject_text")
    predicate    = require(payload, "predicate")
    object_text  = require(payload, "object_text")

    # Resolve predicate_id from vocab if possible
    predicate_id = payload.get("predicate_id")
    if predicate_id is None:
        pv = PredicateVocab.query.filter_by(predicate_text=predicate).first()
        predicate_id = pv.predicate_id if pv else None

    # Check uniqueness
    existing = KnowledgeTriple.query.filter_by(
        user_id=user_id, subject_text=subject_text,
        predicate=predicate, object_text=object_text,
    ).first()
    if existing:
        return existing

    t = KnowledgeTriple(
        user_id=user_id,
        subject_text=subject_text,
        subject_type=payload.get("subject_type"),
        subject_id=payload.get("subject_id"),
        predicate=predicate,
        predicate_id=predicate_id,
        object_text=object_text,
        object_type=payload.get("object_type"),
        object_id=payload.get("object_id"),
        confidence=payload.get("confidence"),
        context_group=payload.get("context_group"),
        extraction_model=payload.get("extraction_model"),
        source_note_id=payload.get("source_note_id"),
        source_voice_id=payload.get("source_voice_id"),
        source_attachment_id=payload.get("source_attachment_id"),
        source_event_instance_id=payload.get("source_event_instance_id"),
    )
    db.session.add(t)
    db.session.commit()
    return t


def verify(user_id: int, triple_id: int) -> KnowledgeTriple:
    from datetime import datetime
    t = get(user_id, triple_id)
    t.is_verified = True
    t.verified_at = datetime.utcnow()
    db.session.commit()
    return t


def delete(user_id: int, triple_id: int) -> None:
    t = get(user_id, triple_id)
    t.is_active = False
    db.session.commit()
