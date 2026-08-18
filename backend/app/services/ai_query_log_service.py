"""AI query log service — read-only history."""
from ..extensions import db
from ..models import AIQueryLog
from ..utils.errors import HTTPError


def list_for_user(user_id: int, limit: int = 50):
    return (AIQueryLog.query.filter_by(user_id=user_id)
            .order_by(AIQueryLog.created_at.desc()).limit(limit).all())


def get(user_id: int, query_id: int) -> AIQueryLog:
    q = AIQueryLog.query.filter_by(query_id=query_id, user_id=user_id).first()
    if not q:
        raise HTTPError("Query log not found", 404)
    return q


def record(user_id: int, question: str, answer: str,
           input_source: str = "text", confidence=None,
           session_id=None, parent_query_id=None) -> AIQueryLog:
    q = AIQueryLog(
        user_id=user_id, question=question, answer=answer,
        input_source=input_source, confidence=confidence,
        parent_query_id=parent_query_id,
    )
    if session_id:
        q.session_id = session_id
    db.session.add(q)
    db.session.commit()
    return q
