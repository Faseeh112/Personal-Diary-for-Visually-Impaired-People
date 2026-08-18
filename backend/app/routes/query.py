"""Query routes (Phase 4b — real implementation).

POST /query/ask  →  parse → fetch DB facts → RAG answer → log
"""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from ..services import query_service
from ..utils.responses import ok
from ..utils.errors import HTTPError
from ..utils.jwt_helpers import current_user_id

bp = Blueprint("query", __name__, url_prefix="/query")


@bp.post("/ask")
@jwt_required()
def ask():
    """Answer a natural-language question.

    Payload:
      {
        "question": "How much did I give to Ali?",
        "input_source": "voice" | "text",   (optional, default "text")
        "use_llm": true | false             (optional, default true)
      }
    """
    data = request.get_json(silent=True) or {}
    question = (data.get("question") or "").strip()
    if not question:
        raise HTTPError("Field 'question' is required", 400)

    input_source = data.get("input_source", "text")
    use_llm = data.get("use_llm", True)

    result = query_service.ask(
        user_id=current_user_id(),
        question=question,
        input_source=input_source,
        use_llm=bool(use_llm),
    )
    return ok(result)
