"""Query service: parses a natural-language question, fetches facts,
produces an answer, logs the interaction.

End-to-end pipeline:
  question (text or voice transcript) →
    query_parser.parse_query()       → QueryPlan
    fact_retriever.fetch_facts()     → list[dict] from real DB
    rag_answerer.answer()            → natural-language answer (template)
    ai_query_log_service.record()    → audit row in ai_query_log

The Phase 4b /query/ask endpoint is a thin wrapper around `ask()`.
"""
from __future__ import annotations

from typing import Optional

from ..ai.query_parser import parse_query
from ..ai.rag_answerer import answer as rag_answer
from . import ai_query_log_service
from .fact_retriever import fetch_facts


def ask(user_id: int, question: str, input_source: str = "text") -> dict:
    """Run the full query pipeline.

    Args:
        user_id: caller
        question: natural-language question
        input_source: "voice" | "text"

    Returns:
        Response dict for the /query/ask endpoint:
          {
            "query_id":   int,
            "question":   str,
            "answer":     str,
            "method":     "template",
            "query_type": str,
            "fact_count": int,
            "confidence": float,
            "plan":       dict (parsed plan; useful for debugging),
            "facts":      list[dict],
          }
    """
    if not question or not question.strip():
        return {
            "answer": "Please ask a question.",
            "method": "template",
            "query_type": None,
            "fact_count": 0,
            "confidence": 0.0,
        }

    # 1. Parse natural language → structured plan
    plan = parse_query(question)

    # 2. Fetch real facts from DB
    facts = fetch_facts(user_id, plan)

    # 3. Generate answer (template)
    answer_result = rag_answer(plan, facts)

    # 4. Log to ai_query_log
    log = ai_query_log_service.record(
        user_id=user_id,
        question=question,
        answer=answer_result["answer"],
        input_source=input_source if input_source in ("voice", "text") else "text",
        confidence=answer_result["confidence"],
    )

    return {
        "query_id":   log.query_id,
        "question":   question,
        "answer":     answer_result["answer"],
        "method":     answer_result["method"],
        "llm_status": answer_result.get("llm_status"),
        "query_type": plan.query_type,
        "fact_count": len(facts),
        "confidence": answer_result["confidence"],
        "plan":       plan.to_dict(),
        "facts":      facts,
    }
