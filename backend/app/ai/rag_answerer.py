"""RAG answerer: produces natural-language answers from query plans + DB rows.

This is entirely deterministic (template-based) to comply with offline and no-LLM requirements.
"""
from __future__ import annotations

import json
import sys
from typing import Optional

from .query_parser import QueryPlan, QueryType, parse_query


def _format_currency(amount: float, currency: str = "PKR") -> str:
    if amount >= 100_000:
        return f"{currency} {amount:,.0f}"
    return f"{currency} {amount:,.2f}".rstrip("0").rstrip(".")


def _no_data_response(plan: QueryPlan) -> str:
    if plan.query_type == QueryType.ITEM_LOCATION.value:
        return f"I don't have a record of where your {plan.item or 'item'} is stored."
    if plan.query_type == QueryType.DATE_LOOKUP.value:
        return "I don't have a date recorded for that yet."
    if plan.query_type == QueryType.GIFTS_LIST.value:
        return "I don't have any gifts recorded for that."
    return "I don't have enough information to answer that yet."


def template_answer(plan: QueryPlan, facts: list[dict]) -> str:
    """Format facts deterministically. Always succeeds, never calls a model."""
    if not facts:
        return _no_data_response(plan)

    qt = plan.query_type
    direction_word = "gave" if plan.direction == "given" else (
        "received" if plan.direction == "received" else "logged")

    if qt == QueryType.AGGREGATE_BY_PERSON.value:
        f = facts[0]
        total = f.get("total", 0)
        count = f.get("count", 0)
        currency = f.get("currency", "PKR")
        person = plan.person or f.get("person", "them")
        return (f"You {direction_word} {_format_currency(total, currency)} "
                f"to {person} across {count} transaction(s).")

    if qt == QueryType.AGGREGATE_BY_PERSON_EVENT.value:
        f = facts[0]
        total = f.get("total", 0)
        currency = f.get("currency", "PKR")
        person = plan.person or f.get("person", "them")
        ev = plan.event_context or "that event"
        return f"You {direction_word} {_format_currency(total, currency)} to {person} for {ev}."

    if qt == QueryType.AGGREGATE_BY_EVENT.value:
        f = facts[0]
        total = f.get("total", 0)
        currency = f.get("currency", "PKR")
        ev = " ".join(plan.event_keywords) if plan.event_keywords else "that event"
        return f"You {direction_word} {_format_currency(total, currency)} on {ev}."

    if qt == QueryType.AGGREGATE_BY_CATEGORY.value:
        f = facts[0]
        total = f.get("total", 0)
        count = f.get("count", 0)
        currency = f.get("currency", "PKR")
        cat = plan.category or "that category"
        return (f"You spent {_format_currency(total, currency)} on {cat} "
                f"across {count} transaction(s).")

    if qt == QueryType.AGGREGATE_TOTAL.value:
        f = facts[0]
        total = f.get("total", 0)
        count = f.get("count", 0)
        currency = f.get("currency", "PKR")
        return (f"Total: {_format_currency(total, currency)} "
                f"across {count} transaction(s).")

    if qt == QueryType.ZAKAT.value:
        f = facts[0]
        zakat_due  = f.get("zakat_due", 0)
        total_z    = f.get("total_zakatable", 0)
        nisab      = f.get("nisab_amount", 0)
        currency   = f.get("currency", "PKR")
        meets      = f.get("meets_nisab", False)
        if not meets:
            return (f"Your zakatable assets total {_format_currency(total_z, currency)}, "
                    f"which is below the nisab threshold of "
                    f"{_format_currency(nisab, currency)}. No zakat is due this year.")
        return (f"Your zakat for this year is {_format_currency(zakat_due, currency)} "
                f"(2.5% of {_format_currency(total_z, currency)} in zakatable assets, "
                f"above the nisab of {_format_currency(nisab, currency)}).")

    if qt == QueryType.TAX.value:
        f = facts[0]
        total = f.get("total_value", 0)
        count = f.get("count", 0)
        currency = f.get("currency", "PKR")
        return (f"You have {count} tax-relevant asset(s) worth "
                f"{_format_currency(total, currency)}.")

    if qt == QueryType.GIFTS_LIST.value:
        names = [f.get("name", "unknown") for f in facts]
        if len(names) == 1:
            return f"Recorded gift: {names[0]}."
        return "Recorded gifts: " + ", ".join(names) + "."

    if qt == QueryType.ITEM_LOCATION.value:
        f = facts[0]
        name = f.get("item_name", plan.item or "the item")
        loc  = f.get("location_text") or f.get("location", "an unspecified location")
        return f"Your {name} is in {loc}."

    if qt == QueryType.DATE_LOOKUP.value:
        f = facts[0]
        title = f.get("title", "the event")
        d = f.get("event_date") or f.get("date")
        return f"{title} is on {d}."

    if qt == QueryType.KEYWORD_FALLBACK.value:
        items = [f.get("title") or f.get("description", "(untitled)")
                 for f in facts[:3]]
        return ("I found the following matching notes: " + "; ".join(items) +
                ("." if facts else ""))

    if qt == QueryType.REMINDERS_LIST.value:
        lines = []
        for f in facts:
            status = "✓ Done" if f.get("is_done") else f.get("repeat_type", "One-time")
            lines.append(f"{f.get('title', '(untitled)')} — {f.get('reminder_datetime', 'no time')} ({status})")
        if not lines:
            return "You have no active reminders."
        return "Your reminders:\n" + "\n".join(f"  • {l}" for l in lines)

    if qt == QueryType.ASSETS_LIST.value:
        lines = []
        for f in facts:
            val = f.get("current_value") or f.get("purchase_value") or 0
            cur = f.get("currency", "PKR")
            zakat = " [zakatable]" if f.get("is_zakatable") else ""
            lines.append(f"{f.get('name', '(unnamed)')} — {_format_currency(val, cur)}{zakat}")
        if not lines:
            return "You have no recorded assets."
        return "Your assets:\n" + "\n".join(f"  • {l}" for l in lines)

    if qt == QueryType.EVENTS_LIST.value:
        lines = []
        for f in facts:
            dt = f.get("date") or "no date"
            lines.append(f"{f.get('title', '(untitled)')} — {dt} [{f.get('note_type', 'general')}]")
        if not lines:
            return "No events found for that period."
        return "Your events/notes:\n" + "\n".join(f"  • {l}" for l in lines)

    if qt == QueryType.AUDIO_LIST.value:
        lines = []
        for f in facts:
            sched = f.get("repeat_type", "None")
            active = "active" if f.get("is_active_schedule") else "paused"
            lines.append(f"{f.get('audio_name', '(unnamed)')} — {sched} ({active})")
        if not lines:
            return "You have no audio routines scheduled."
        return "Your audio routines:\n" + "\n".join(f"  • {l}" for l in lines)

    return _no_data_response(plan)


def answer(plan: QueryPlan, facts: list[dict], **kwargs) -> dict:
    """Produce the final natural-language answer.

    Args:
        plan: parsed query plan
        facts: list of fact dicts retrieved from DB (Phase 4 supplies these)

    Returns:
        {
          "answer":      str,
          "method":      "template",
          "confidence":  float,
          "llm_status":  "disabled",
        }
    """
    template = template_answer(plan, facts)

    return {"answer": template, "method": "template",
            "confidence": plan.confidence,
            "llm_status": "disabled"}


def _cli(argv: list[str]) -> int:
    if not argv:
        print('usage: python -m app.ai.rag_answerer "<question>"', file=sys.stderr)
        return 2

    question = " ".join(argv)
    plan = parse_query(question)

    mock = {
        QueryType.AGGREGATE_BY_PERSON.value: [
            {"total": 5500, "count": 3, "currency": "PKR"}],
        QueryType.AGGREGATE_BY_EVENT.value: [
            {"total": 5000, "currency": "PKR"}],
        QueryType.ZAKAT.value: [
            {"zakat_due": 250000, "total_zakatable": 10000000,
             "nisab_amount": 2800000, "currency": "PKR", "meets_nisab": True}],
        QueryType.ITEM_LOCATION.value: [
            {"item_name": "CNIC", "location_text": "bedroom drawer 2"}],
    }
    facts = mock.get(plan.query_type, [])

    print(f"Question: {question}")
    print(f"Plan: {json.dumps(plan.to_dict(), indent=2)}")
    result = answer(plan, facts)
    print(f"\n=== Answer ({result['method']}) ===")
    print(result["answer"])
    return 0


if __name__ == "__main__":
    sys.exit(_cli(sys.argv[1:]))
