"""Natural-language query parser.

Converts a user's question into a structured QueryPlan that the Phase 4
service layer turns into actual DB queries.

Design
------
Structured Query Pipeline:
1. Detect intent (strict priority)
2. Extract entities
3. Build SQL from template

CLI:
    python -m app.ai.query_parser "how much did I give to Ali"
"""
from __future__ import annotations

import sys
import json
import re
from dataclasses import dataclass, field, asdict
from datetime import date, timedelta
from enum import Enum
from typing import Optional

from .ner import _extract_persons, _extract_date


# ════════════════════════════════════════════════════════════════════
# DATA MODEL
# ════════════════════════════════════════════════════════════════════

class QueryType(str, Enum):
    AGGREGATE_BY_PERSON   = "aggregate_by_person"
    AGGREGATE_BY_EVENT    = "aggregate_by_event"
    AGGREGATE_BY_PERSON_EVENT = "aggregate_by_person_event"
    AGGREGATE_BY_CATEGORY = "aggregate_by_category"
    AGGREGATE_TOTAL       = "aggregate_total"
    ZAKAT                 = "zakat"
    TAX                   = "tax"
    GIFTS_LIST            = "gifts_list"
    REMINDERS_LIST        = "reminders_list"
    ASSETS_LIST           = "assets_list"
    EVENTS_LIST           = "events_list"
    AUDIO_LIST            = "audio_list"
    ITEM_LOCATION         = "item_location"
    DATE_LOOKUP           = "date_lookup"
    KEYWORD_FALLBACK      = "keyword_fallback"
    ERROR                 = "error"


@dataclass
class QueryPlan:
    """Structured plan derived from a natural-language question."""
    raw_question: str = ""
    query_type: str   = QueryType.KEYWORD_FALLBACK.value

    # Filters
    person: Optional[str]   = None
    persons: list[str]      = field(default_factory=list)
    event_keywords: list[str] = field(default_factory=list)
    event_context: str      = ""
    category: Optional[str] = None
    item: Optional[str]     = None
    direction: Optional[str] = None     # "given" | "received"
    threshold: Optional[float] = None    # for "expensive" queries

    # Time range
    date_from: Optional[str] = None      # ISO date
    date_to: Optional[str]   = None
    year: Optional[int]      = None

    # Keywords for free-text fallback
    keywords: list[str] = field(default_factory=list)

    confidence: float = 0.0

    # Fail-fast error reporting
    status: str = "success"
    reason: Optional[str] = None
    suggestion: Optional[str] = None

    def to_dict(self) -> dict:
        d = asdict(self)
        return {k: v for k, v in d.items() if v not in (None, "", [], 0.0)}


# ════════════════════════════════════════════════════════════════════
# CLASSIFIER PATTERNS
# ════════════════════════════════════════════════════════════════════

_ZAKAT_RE     = re.compile(r"\bzakat\b",                                      re.I)
_TAX_RE       = re.compile(r"\btax(?:es)?\b",                                 re.I)
_LOCATION_RE  = re.compile(r"^\s*where\s+(?:did\s+i\s+(?:put|store|keep)|is|are)\b\s+(.+)", re.I)
_DATE_LOOKUP_RE = re.compile(r"^\s*(?:when\s+is|what(?:'s| is)?\s+the\s+date\s+of)\b", re.I)
_GIFTS_RE     = re.compile(r"\bgifts?\b",                                     re.I)
_REMINDERS_RE = re.compile(r"\breminders?\b",                                 re.I)
_ASSETS_RE    = re.compile(r"\bassets?\b|\blist\s+(?:my\s+)?(?:assets|property|gold|investments)\b", re.I)
_EVENTS_RE    = re.compile(r"\bevents?\b|\bwhat\s+happened\b|\bshow\s+(?:all\s+)?(?:my\s+)?(?:events|notes)\b", re.I)
_AUDIO_RE     = re.compile(r"\baudio\s+(?:routine|schedule|action)s?\b",       re.I)

# Intent triggers
_HOW_MUCH_RE  = re.compile(r"\b(?:how\s+much|total|sum|what\s+did\s+i\s+(?:spend|pay|give|receive)|payments?|money|amount)\b", re.I)

# Direction extraction
_GIVEN_RE     = re.compile(r"\bgive|gave|paid|sent|spent|spend|lent|payments?|pay\b",       re.I)
_RECEIVED_RE  = re.compile(r"\breceive|received|got|earned|borrowed|income\b",       re.I)

# Time / range
_THIS_YEAR  = re.compile(r"\bthis\s+year\b",        re.I)
_LAST_YEAR  = re.compile(r"\blast\s+year\b",        re.I)
_THIS_MONTH = re.compile(r"\bthis\s+month\b",       re.I)
_LAST_MONTH = re.compile(r"\blast\s+month\b",       re.I)
_THIS_WEEK  = re.compile(r"\bthis\s+week\b",        re.I)
_LAST_WEEK  = re.compile(r"\blast\s+week\b",        re.I)
_TODAY      = re.compile(r"\btoday\b",              re.I)
_YESTERDAY  = re.compile(r"\byesterday\b",          re.I)
_RECENTLY   = re.compile(r"\brecent(?:ly)?\b",      re.I)

_EVENT_KEYWORDS = re.compile(
    r"\b(wedding|marriage|nikah|walima|mehndi|birthday|funeral|"
    r"anniversary|aqiqa|ceremony|party|function|eid|ramadan|"
    r"shopping|groceries?|car|business)\b",
    re.I,
)

_CATEGORY_HINTS = {
    "health": "Health", "shopping": "Shopping", "education": "Education",
    "travel": "Travel", "bills": "Bills", "function": "Function",
    "vehicle": "Vehicle", "gold": "Gold", "silver": "Silver",
    "investment": "Investment", "gift": "Gift", "income": "Income",
    "expense": "Expense", "property": "Property", "cash": "Cash",
}

_ITEM_HINTS = re.compile(
    r"\b(cnic|passport|id\s*card|file|papers?|keys|wallet|certificate|"
    r"document|deed|will|driving\s*license|atm\s*card|chequebook)\b",
    re.I,
)


def _resolve_time_range(text: str, plan: QueryPlan) -> None:
    today = date.today()
    if _THIS_YEAR.search(text):
        plan.year = today.year
        plan.date_from = date(today.year, 1, 1).isoformat()
        plan.date_to   = date(today.year, 12, 31).isoformat()
    elif _LAST_YEAR.search(text):
        y = today.year - 1
        plan.year = y
        plan.date_from = date(y, 1, 1).isoformat()
        plan.date_to   = date(y, 12, 31).isoformat()
    elif _THIS_MONTH.search(text):
        plan.date_from = date(today.year, today.month, 1).isoformat()
        plan.date_to   = today.isoformat()
    elif _LAST_MONTH.search(text):
        first_of_this = date(today.year, today.month, 1)
        last_of_last  = first_of_this - timedelta(days=1)
        first_of_last = date(last_of_last.year, last_of_last.month, 1)
        plan.date_from = first_of_last.isoformat()
        plan.date_to   = last_of_last.isoformat()
    elif _THIS_WEEK.search(text):
        plan.date_from = (today - timedelta(days=today.weekday())).isoformat()
        plan.date_to   = today.isoformat()
    elif _LAST_WEEK.search(text):
        start_this = today - timedelta(days=today.weekday())
        start_last = start_this - timedelta(days=7)
        end_last   = start_this - timedelta(days=1)
        plan.date_from = start_last.isoformat()
        plan.date_to   = end_last.isoformat()
    elif _TODAY.search(text):
        plan.date_from = today.isoformat()
        plan.date_to   = today.isoformat()
    elif _YESTERDAY.search(text):
        y = today - timedelta(days=1)
        plan.date_from = y.isoformat()
        plan.date_to   = y.isoformat()
    elif _RECENTLY.search(text):
        plan.date_from = (today - timedelta(days=30)).isoformat()
        plan.date_to   = today.isoformat()


def parse_query(text: str) -> QueryPlan:
    """Convert a natural-language question into a structured QueryPlan."""
    plan = QueryPlan(raw_question=text)
    if not text or not text.strip():
        plan.status = "unresolved_intent"
        plan.reason = "empty_input"
        plan.query_type = QueryType.ERROR.value
        return plan

    tl = text.lower()

    # --- 1. Direction (given vs received) ---
    if "gave me" in tl or "paid me" in tl or "give me" in tl or "pay me" in tl:
        plan.direction = "received"
    elif "i gave" in tl or "i paid" in tl or "i give" in tl or "i pay" in tl:
        plan.direction = "given"
    elif _RECEIVED_RE.search(text) and not _GIVEN_RE.search(text):
        plan.direction = "received"
    elif _GIVEN_RE.search(text):
        plan.direction = "given"

    # Normalize pronouns implicitly using 'user' fallback for relationships if needed
    norm_text = re.sub(r'\b(me|i|my|mine)\b', 'user', text, flags=re.IGNORECASE)
    
    # Check relational directions (e.g. from Ali to user)
    if 'from' in tl and 'to user' in norm_text.lower():
        plan.direction = "received"
    elif 'to' in tl and 'from user' in norm_text.lower():
        plan.direction = "given"

    # --- 2. Persons + event keywords + items ---
    person_hits = _extract_persons(text)
    plan.persons = [n for n, _ in person_hits]
    if plan.persons:
        plan.person = plan.persons[0]

    plan.event_keywords = [m.group(0).lower() for m in _EVENT_KEYWORDS.finditer(text)]

    event_match = re.search(r"(?:on|for|at)\s+(.+)$", text, re.I)
    if event_match:
        event_ctx = event_match.group(1).strip()
        event_ctx = re.sub(r"\b(his|her|my)\b\s*", "", event_ctx, flags=re.I).strip()
        plan.event_context = event_ctx.replace("?", "")

    item_match = _ITEM_HINTS.search(text)
    if item_match:
        plan.item = item_match.group(0).lower()

    loc_match = _LOCATION_RE.search(text)
    if loc_match and not plan.item:
        item_raw = loc_match.group(1).strip().replace("?", "")
        if item_raw.lower().startswith("my "):
            item_raw = item_raw[3:]
        elif item_raw.lower().startswith("the "):
            item_raw = item_raw[4:]
        elif item_raw.lower().startswith("a "):
            item_raw = item_raw[2:]
        plan.item = item_raw.strip().lower()

    # --- 3. Category hint ---
    for hint, cat in _CATEGORY_HINTS.items():
        if hint in tl:
            plan.category = cat
            break

    # --- 4. Time range ---
    _resolve_time_range(text, plan)
    iso_date, _, _ = _extract_date(text)
    if iso_date and not plan.date_from:
        plan.date_from = iso_date
        plan.date_to   = iso_date

    # --- 5. Strict Intent Classification Pipeline ---
    if _REMINDERS_RE.search(text) and not _HOW_MUCH_RE.search(text):
        plan.query_type = QueryType.REMINDERS_LIST.value
        plan.confidence = 0.95
    elif _LOCATION_RE.search(text) or (plan.item and "where" in tl) or ("location" in tl and plan.item):
        plan.query_type = QueryType.ITEM_LOCATION.value
        plan.confidence = 0.95
    elif re.search(r"\bfind\s+(?:my\s+)?(\w+)", tl) and not plan.direction:
        # "Find my charger" / "Find my passport"
        m = re.search(r"\bfind\s+(?:my\s+)?(.+?)(?:\?|$)", tl)
        if m:
            plan.item = m.group(1).strip()
        plan.query_type = QueryType.ITEM_LOCATION.value
        plan.confidence = 0.85
    elif _ZAKAT_RE.search(text):
        plan.query_type = QueryType.ZAKAT.value
        plan.confidence = 0.95
    elif _TAX_RE.search(text):
        plan.query_type = QueryType.TAX.value
        plan.confidence = 0.95
    elif _AUDIO_RE.search(text):
        plan.query_type = QueryType.AUDIO_LIST.value
        plan.confidence = 0.90
    elif _DATE_LOOKUP_RE.search(text):
        plan.query_type = QueryType.DATE_LOOKUP.value
        plan.confidence = 0.9
    elif _GIFTS_RE.search(text):
        plan.query_type = QueryType.GIFTS_LIST.value
        plan.confidence = 0.85
    elif _ASSETS_RE.search(text) and not _HOW_MUCH_RE.search(text):
        plan.query_type = QueryType.ASSETS_LIST.value
        plan.confidence = 0.90
    elif _EVENTS_RE.search(text) and not _HOW_MUCH_RE.search(text):
        plan.query_type = QueryType.EVENTS_LIST.value
        plan.confidence = 0.85
    elif bool(_HOW_MUCH_RE.search(text)) or plan.direction is not None:
        if plan.event_context and plan.persons:
            plan.query_type = QueryType.AGGREGATE_BY_PERSON_EVENT.value
            plan.confidence = 0.95
        elif plan.event_keywords and plan.persons:
            plan.query_type = QueryType.AGGREGATE_BY_EVENT.value
            plan.confidence = 0.9
        elif plan.category:
            plan.query_type = QueryType.AGGREGATE_BY_CATEGORY.value
            plan.confidence = 0.85
        elif plan.event_keywords:
            plan.query_type = QueryType.AGGREGATE_BY_EVENT.value
            plan.confidence = 0.8
        elif plan.persons:
            plan.query_type = QueryType.AGGREGATE_BY_PERSON.value
            plan.confidence = 0.85
        else:
            plan.query_type = QueryType.AGGREGATE_TOTAL.value
            plan.confidence = 0.7
    else:
        # --- 6. Keyword Fallback ---
        # Extract meaningful words as search keywords
        stop = {"a", "an", "the", "is", "are", "was", "were", "do", "does",
                "did", "i", "my", "me", "show", "tell", "find", "get", "all",
                "of", "in", "on", "at", "to", "for", "from", "with", "about",
                "what", "when", "where", "how", "which", "please", "can", "you"}
        words = [w for w in re.findall(r"\b[a-zA-Z]{2,}\b", text.lower()) if w not in stop]
        if words:
            plan.keywords = words[:5]
            plan.query_type = QueryType.KEYWORD_FALLBACK.value
            plan.confidence = 0.4
        else:
            plan.query_type = QueryType.ERROR.value
            plan.status = "unresolved_intent"
            plan.reason = "missing_entities"
            plan.suggestion = "Please specify person or amount"
            plan.confidence = 0.0

    return plan


def _cli(argv: list[str]) -> int:
    if not argv:
        print('usage: python -m app.ai.query_parser "<question>"', file=sys.stderr)
        return 2
    plan = parse_query(" ".join(argv))
    print(json.dumps(plan.to_dict(), indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(_cli(sys.argv[1:]))

