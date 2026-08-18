"""Rule-based entity extraction for Smart Diary.

Takes a transcript + intent and produces a structured ExtractionResult
that downstream code can persist. Domain-tuned for Pakistani-English
diary phrasings (lakh/crore multipliers, relation-based names like
"Uncle Ahmed", PKR currency).

Why rule-based and not ML:
  - Domain is highly structured (amounts, persons, locations, items)
  - Custom multipliers (lakh, crore) absent from generic NER models
  - Direction (gave vs received) is a domain concept, not a generic NE label
  - Runs in <10 ms per utterance with zero memory footprint
  - Every decision is explainable (regex matched X)

Known limitations (accepted Phase 3 scope):
  - Two 'Uncle' references collide → resolved via person table at Phase 4
  - Case-sensitive proper-noun detection (Whisper outputs capitalized
    names reliably for English so this is acceptable)

CLI:
    python -m app.ai.ner "I gave 5000 to Ali at Shahid's wedding"
"""
from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime, date, timedelta
from enum import Enum
from typing import Optional

# ═══════════════════════════════════════════════════════════════════
# DATA MODELS
# ═══════════════════════════════════════════════════════════════════

class Direction(str, Enum):
    GIVEN = "given"
    RECEIVED = "received"



@dataclass
class Transaction:
    amount: float
    direction: str           # "given" | "received" | "third_party"
    currency: str = "PKR"
    person: Optional[str] = None
    sender_name:   Optional[str] = None  # NEW — explicit sender (None=User)
    receiver_name: Optional[str] = None  # NEW — explicit receiver (None=User)
    event_context: Optional[str] = None
    confidence: float = 0.0


@dataclass
class ExtractionResult:
    raw_text: str = ""
    intent: str = ""

    # Plural fields
    persons: list[str] = field(default_factory=list)
    transactions: list[Transaction] = field(default_factory=list)

    # Singular convenience (= first of each list)
    person: Optional[str] = None
    amount: Optional[float] = None
    currency: str = "PKR"
    direction: Optional[str] = None

    # Time / date
    date: Optional[str] = None
    time: Optional[str] = None
    datetime_raw: Optional[str] = None

    # Asset / item / location
    asset: Optional[str] = None
    asset_category: Optional[str] = None
    location: Optional[str] = None
    item: Optional[str] = None

    # Classification
    category: Optional[str] = None
    target_entity: Optional[str] = None        # note | asset | stored_item | reminder
    note_type: str = "general"                 # event | memory | asset | gift_received | general
    event_context: Optional[str] = None
    has_transaction: bool = False

    # Reminder-specific (when intent=reminder)
    reminder_title: Optional[str] = None

    # Audio action fields (when target_entity=audio_action)
    audio_name: Optional[str] = None
    audio_repeat_type: Optional[str] = None   # None|Daily|Weekly|Monthly

    confidence: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        d = asdict(self)
        # Drop empty values for compactness
        return {k: v for k, v in d.items() if v not in (None, "", [], {})}


# ═══════════════════════════════════════════════════════════════════
# TIME (extracted FIRST — so "5pm" doesn't bleed into amount)
# ═══════════════════════════════════════════════════════════════════

_TIME_PATTERN = re.compile(
    r"\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)\b"
    r"|\b(?:at\s+)?(\d{1,2}):(\d{2})\b",
)


def _extract_time(text: str):
    m = _TIME_PATTERN.search(text)
    if not m:
        return None, None, None
    if m.group(1) is not None:                  # 12-hour with am/pm
        hour = int(m.group(1))
        minute = int(m.group(2) or 0)
        ampm = (m.group(3) or "").lower()
        if ampm == "pm" and hour < 12:
            hour += 12
        elif ampm == "am" and hour == 12:
            hour = 0
    else:                                        # 24-hour
        hour = int(m.group(4))
        minute = int(m.group(5))
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        return None, None, None
    return f"{hour:02d}:{minute:02d}", m.group(0), m.span()


def _strip_span(text: str, span):
    """Replace span with spaces so positions stay aligned."""
    return text[:span[0]] + " " * (span[1] - span[0]) + text[span[1]:]


# ═══════════════════════════════════════════════════════════════════
# AMOUNT + CURRENCY
# ═══════════════════════════════════════════════════════════════════

_CURRENCY_MAP: dict[str, str] = {
    "rs": "PKR", "rs.": "PKR", "pkr": "PKR", "rupee": "PKR", "rupees": "PKR",
    "$": "USD", "usd": "USD", "dollar": "USD", "dollars": "USD",
    "£": "GBP", "gbp": "GBP", "pound": "GBP", "pounds": "GBP",
    "€": "EUR", "eur": "EUR", "euro": "EUR", "euros": "EUR",
    "sar": "SAR", "riyal": "SAR", "riyals": "SAR",
    "aed": "AED", "dirham": "AED", "dirhams": "AED",
}

_MULTIPLIERS: dict[str, float] = {
    "hundred": 100, "thousand": 1_000, "k": 1_000,
    "lakh": 100_000, "lac": 100_000, "lakhs": 100_000,
    "crore": 10_000_000, "crores": 10_000_000,
    "million": 1_000_000, "billion": 1_000_000_000,
}

_AMOUNT_PATTERN = re.compile(
    r"""
    (?:(?P<cur_prefix>[Rr][Ss]\.?|PKR|pkr|\$|£|€|USD|GBP|EUR|SAR|AED)\s*)?
    (?P<number>\d+(?:,\d{3})*(?:\.\d+)?)
    \s*
    (?P<multiplier>hundred|thousand|k|lakh|lac|lakhs|crore|crores|million|billion)?
    (?:\s*(?P<cur_suffix>rupees?|dollars?|pounds?|riyals?|dirhams?))?
    """,
    re.IGNORECASE | re.VERBOSE,
)


def _extract_amount_from(text: str):
    """Extracts the largest plausible amount in `text`. Currency from prefix or suffix."""
    best_value = 0.0
    best_match = None
    currency = "PKR"
    conf = 0.0
    for m in _AMOUNT_PATTERN.finditer(text):
        try:
            value = float(m.group("number").replace(",", ""))
        except ValueError:
            continue
        mult_str = (m.group("multiplier") or "").lower()
        if mult_str in _MULTIPLIERS:
            value *= _MULTIPLIERS[mult_str]
        cur_prefix = (m.group("cur_prefix") or "").lower().rstrip(".")
        cur_suffix = (m.group("cur_suffix") or "").lower()
        cur_key = cur_prefix or cur_suffix
        if cur_key and cur_key in _CURRENCY_MAP:
            currency = _CURRENCY_MAP[cur_key]
        if value > best_value:
            best_value = value
            best_match = m
            conf = 0.95 if cur_key else 0.75
    if best_match and best_value > 0:
        return best_value, currency, conf
    return None, "PKR", 0.0


# ═══════════════════════════════════════════════════════════════════
# DIRECTION (Relationship-based engine)
# ═══════════════════════════════════════════════════════════════════

def _normalize_pronouns(text: str) -> str:
    """Normalize user pronouns to 'user' for relationship mapping."""
    return re.sub(r'\b(me|i|my|mine)\b', 'user', text, flags=re.IGNORECASE)

def _extract_direction_and_persons(text: str) -> tuple[Optional[str], Optional[str], float]:
    """Infers direction by identifying giver and receiver relationships."""
    tl = text.lower()
    giver = None
    receiver = None

    # 1. X gave Y (e.g. Ali gave user)
    m = re.search(r'\b(\w+)\s+(?:money\s+)?(?:gave|sent|paid|transferred|handed|gifted)\s+(\w+)\b', tl)
    if m:
        giver, receiver = m.group(1), m.group(2)

    # 2. X received from Y
    if not giver and not receiver:
        m = re.search(r'\b(\w+)\s+(?:received|got|took|earned|borrowed|collected)\s+(?:money\s+)?(?:from|by)\s+(\w+)\b', tl)
        if m:
            receiver, giver = m.group(1), m.group(2)

    # 3. from X to Y
    if not giver and not receiver:
        m = re.search(r'\b(?:from|by)\s+(\w+)\s+to\s+(\w+)\b', tl)
        if m:
            giver, receiver = m.group(1), m.group(2)

    # 4. to Y from X
    if not giver and not receiver:
        m = re.search(r'\bto\s+(\w+)\s+(?:from|by)\s+(\w+)\b', tl)
        if m:
            receiver, giver = m.group(1), m.group(2)

    # 5. Broken grammar: X Y gave (Ali user gave)
    if not giver and not receiver:
        m = re.search(r'\b(\w+)\s+(\w+)\s+(?:money\s+)?(?:gave|sent|paid)\b', tl)
        if m:
            giver, receiver = m.group(1), m.group(2)

    direction = None
    other_person = None

    if receiver == 'user':
        direction = 'received'
        other_person = giver if giver != 'user' else None
    elif giver == 'user':
        direction = 'given'
        other_person = receiver if receiver != 'user' else None
    
    # Fallback to keywords if relation fails
    if not direction:
        give = bool(re.search(r'\b(gave|given|paid|sent|lent|donated|spent|give|bought|purchased|acquired)\b', tl))
        recv = bool(re.search(r'\b(received|got|took|earned|collected|borrowed|accepted)\b', tl))
        if give and not recv:
            direction = 'given'
        elif recv and not give:
            direction = 'received'
        elif give and recv:
            direction = 'received'

    # Filter out non-persons
    stop_words = {'money', 'rupees', 'dollars', 'the', 'a', 'an', 'some', 'is', 'was', 'in'}
    if other_person and other_person not in stop_words and not other_person.isdigit():
        other_person = other_person.title()
    else:
        other_person = None

    return direction, other_person, 0.9 if direction else 0.0

# Exported for backward compatibility with triple_gen.py
_RECEIVE_PATTERN = re.compile(
    r"\b(received|got|took|earned|collected|borrowed|accepted|gifted\s+(?:by|from))\b",
    re.I,
)


# ═══════════════════════════════════════════════════════════════════
# DATE
# ═══════════════════════════════════════════════════════════════════

_RELATIVE_DATE_MAP: dict[str, int] = {
    "today": 0, "yesterday": -1, "day before yesterday": -2,
    "tomorrow": 1, "day after tomorrow": 2,
}
_DATE_KEYWORDS = re.compile(
    r"\b(today|yesterday|tomorrow|day before yesterday|day after tomorrow|"
    r"last\s+\w+day|next\s+\w+day|last\s+week|last\s+month|"
    r"\d{1,2}[\/\-]\d{1,2}[\/\-]?\d{0,4}|"
    r"\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*"
    r"(?:\s+\d{2,4})?)\b",
    re.I,
)


def _extract_date(text: str, intent: str = ""):
    tl = text.lower()
    for phrase, delta in _RELATIVE_DATE_MAP.items():
        if phrase in tl:
            d = date.today() + timedelta(days=delta)
            return d.isoformat(), phrase, 0.95
    m = _DATE_KEYWORDS.search(text)
    if m:
        raw = m.group(0)
        try:
            import dateparser
            pref = "future" if intent == "reminder" else "past"
            parsed = dateparser.parse(
                raw,
                settings={"PREFER_DATES_FROM": pref,
                          "RELATIVE_BASE": datetime.now(),
                          "DATE_ORDER": "DMY"},
            )
            if parsed:
                return parsed.date().isoformat(), raw, 0.85
        except ImportError:
            pass
    
    # If reminder and no keyword matched, try searching the whole text with dateparser
    if intent == "reminder":
        try:
            import dateparser.search
            pref = "future"
            found = dateparser.search.search_dates(
                text,
                settings={"PREFER_DATES_FROM": pref, "RELATIVE_BASE": datetime.now()}
            )
            if found:
                # Return the first found date string
                return found[0][1].date().isoformat(), found[0][0], 0.85
        except ImportError:
            pass
            
    return None, None, 0.0


# ═══════════════════════════════════════════════════════════════════
# PERSONS (multi, with relation prefix + bare-relation fallback)
# ═══════════════════════════════════════════════════════════════════

_STOP_NAMES: set[str] = {
    "i", "me", "my", "we", "he", "she", "they", "it", "the", "a", "an",
    "today", "yesterday", "tomorrow", "home", "office", "school", "bank",
    "gold", "silver", "cash", "car", "bike", "phone", "ring", "passport",
    "cnic", "rupees", "dollars", "none", "some", "money",
    "rs", "pkr", "usd", "gbp", "eur", "sar", "aed",
    "bought", "purchased", "received", "gave", "paid", "sent", "got",
    "invested", "spent", "earned", "collected", "donated",
    "remind", "meeting", "went", "visited", "had",
    "for", "from", "with", "about", "his", "her", "their", "its",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
    "wedding", "gift", "daughter", "son", "birthday", "ammi", "abbu",
    "client", "friend", "manager", "license", "meeting", "renew", "driving",
    "laptop", "computer", "tv", "ac", "fridge", "property", "land", "plot",
    "flat", "apartment", "building", "stocks", "shares", "bond", "mutual", "fund",
}

_RELATION_WORDS = {
    "uncle", "aunt", "bhai", "bhabhi", "chacha", "mama", "khala", "phupho",
    "cousin", "brother", "sister", "father", "mother", "dad", "mom",
    "papa", "ammi", "abbu", "abu", "nana", "nani", "dada", "dadi",
}

# "uncle Ahmed" / "mom Fatima" — relation + capitalized name
_RELATION_PREFIX = re.compile(
    r"\b(" + "|".join(_RELATION_WORDS) + r")\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b",
    re.I,
)
# "from uncle" / "to mom" — bare relation after preposition
_BARE_RELATION = re.compile(
    r"\b(?:to|from|with|for|by)\s+(" + "|".join(_RELATION_WORDS) + r")\b",
    re.I,
)
# "to Ali" / "from Shahid" — preposition + proper name (case insensitive)
_PERSON_PREPS = re.compile(
    r"\b(?:to|from|with|for|by)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+){0,2})\b",
    re.I
)


def _extract_persons(text: str) -> list[tuple[str, float]]:
    seen: set[str] = set()
    out: list[tuple[str, float]] = []

    def add(name: str, conf: float) -> None:
        key = name.lower()
        if key in seen:
            return
        seen.add(key)
        out.append((name, conf))

    # 1. Relation + name (highest)
    for m in _RELATION_PREFIX.finditer(text):
        add(f"{m.group(1).title()} {m.group(2)}", 0.92)
    # 2. Bare relation (medium)
    for m in _BARE_RELATION.finditer(text):
        add(m.group(1).title(), 0.75)
    for m in _PERSON_PREPS.finditer(text):
        name = m.group(1)
        
        if not name.istitle():
            continue
            
        # Truncate at first stop word
        clean_words = []
        for w in name.split():
            if w.lower() in _STOP_NAMES:
                break
            clean_words.append(w)
            
        if not clean_words:
            continue
            
        name = " ".join(clean_words)
        
        if name.lower() in _STOP_NAMES:
            continue
        if any(name in existing for existing, _ in out):
            continue
        add(name, 0.85)
    # 3b. Bare capitalized name anywhere (fallback)
    for m in re.finditer(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b", text):
        name = m.group(1)
        if name.lower() in _STOP_NAMES:
            continue
        if any(name in existing for existing, _ in out):
            continue
        # Also check it's not a known location or start of sentence
        if name.lower() in {"how", "what", "where", "when", "why", "who", "money", "payments", "total", "sum"}:
            continue
        add(name, 0.6)
    # 4. Possessive: "Shahid's wedding"
    for m in re.finditer(r"\b([A-Z][a-z]+)(?:'s|s')\b", text):
        name = m.group(1)
        if name.lower() not in _STOP_NAMES:
            add(name, 0.7)
    return out


# ═══════════════════════════════════════════════════════════════════
# SEGMENT SPLITTER (multi-transaction support)
# ═══════════════════════════════════════════════════════════════════

_SEGMENT_SPLIT = re.compile(r"\s*(?:,\s*and\s+|;\s*|\s+and\s+|,\s+)", re.I)
_VERB_OR_AMOUNT = re.compile(
    r"\b(gave|given|paid|sent|lent|spent|received|got|took|earned|borrowed|"
    r"bought|purchased|gifted|donated|\d+)\b",
    re.I,
)


def _split_segments(text: str) -> list[str]:
    """Split on coordinators, keep clauses with at least one verb-or-digit token."""
    if not text:
        return []
    parts = _SEGMENT_SPLIT.split(text)
    kept = [p.strip() for p in parts if _VERB_OR_AMOUNT.search(p)]
    return kept if kept else [text.strip()]


# ═══════════════════════════════════════════════════════════════════
# ASSET (dictionary-first, then "bought X" pattern with whitelist)
# ═══════════════════════════════════════════════════════════════════

_ASSET_KEYWORDS: dict[str, str] = {
    "gold ring": "Gold", "gold chain": "Gold", "gold bracelet": "Gold",
    "gold necklace": "Gold", "gold bangle": "Gold",
    "silver ring": "Silver",
    "gold": "Gold", "silver": "Silver",
    "cash": "Cash", "savings": "Cash",
    "car": "Vehicle", "bike": "Vehicle", "motorcycle": "Vehicle",
    "scooter": "Vehicle", "truck": "Vehicle",
    "house": "Property", "land": "Property", "plot": "Property",
    "flat": "Property", "apartment": "Property", "building": "Property",
    "phone": "General", "laptop": "General", "computer": "General",
    "tv": "General", "ac": "General", "fridge": "General",
    "stocks": "Investment", "shares": "Investment", "investment": "Investment",
    "bond": "Investment", "mutual fund": "Investment",
}

_ASSET_VERB_PATTERN = re.compile(
    r"\b(?:bought|purchased|acquired|got|received)\s+(?:a\s+)?(.+?)(?:\s+(?:for|from|at|worth|of|in)|\s*$)",
    re.I,
)


def _extract_asset(text: str):
    tl = text.lower()
    for kw in sorted(_ASSET_KEYWORDS.keys(), key=len, reverse=True):
        if kw in tl:
            return kw.title(), _ASSET_KEYWORDS[kw], 0.90
    # Fallback: "bought X" only if X contains a known asset word
    m = _ASSET_VERB_PATTERN.search(text)
    if m:
        asset_name = m.group(1).strip()
        for kw, cat in _ASSET_KEYWORDS.items():
            if kw in asset_name.lower():
                return asset_name, cat, 0.80
    return None, None, 0.0


# ═══════════════════════════════════════════════════════════════════
# LOCATION + ITEM (storage memory)
# ═══════════════════════════════════════════════════════════════════

_STORAGE_LOCATIONS = re.compile(
    r"\b(home|bedroom|kitchen|bathroom|living\s*room|office|garage|store\s*room|"
    r"cupboard|drawer|shelf|cabinet|almari|wardrobe|locker|box|bag|"
    r"drawer\s*\d+|shelf\s*\d+|room\s*\d+)\b",
    re.I,
)
_STORED_ITEM_PATTERN = re.compile(
    r"(?:(?:user|my|the)\s+(.+?)\s+(?:is|are|was|were|kept|put|stored)\s+(?:in|at|inside|on)\s+(.+))|"
    r"(?:(?:kept|put|stored|left)\s+(?:user|my|the|a|an)?\s*(.+?)\s+(?:in|at|inside|on)\s+(.+))",
    re.I,
)


def _extract_location_item(text: str):
    m = _STORED_ITEM_PATTERN.search(text)
    if m:
        item = (m.group(1) or m.group(3)).strip()
        location = (m.group(2) or m.group(4)).strip().rstrip(".")
        return location.title(), item.title(), 0.90
    loc_matches = _STORAGE_LOCATIONS.findall(text)
    if loc_matches:
        return " > ".join(p.strip().title() for p in loc_matches), None, 0.65
    return None, None, 0.0


# ═══════════════════════════════════════════════════════════════════
# CATEGORY
# ═══════════════════════════════════════════════════════════════════

_CATEGORY_RULES: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\bzakat\b", re.I), "Zakat"),
    (re.compile(r"\bgold|silver|jewel", re.I), "Gold"),
    (re.compile(r"\bcar|bike|vehicle|motorcycle", re.I), "Vehicle"),
    (re.compile(r"\bhouse|land|plot|property|flat|apartment", re.I), "Property"),
    (re.compile(r"\bstocks?|shares?|invest|mutual fund|bond", re.I), "Investment"),
    (re.compile(r"\bdoctor|hospital|medicine|medical|health|clinic", re.I), "Health"),
    (re.compile(r"\bschool|university|college|tuition|education|exam", re.I), "Education"),
    (re.compile(r"\blawyer|court|legal|case\b", re.I), "Legal"),
    (re.compile(r"\bgift|present\b", re.I), "Gift"),
    (re.compile(r"\btravel|trip|flight|hotel|visa", re.I), "Travel"),
    (re.compile(r"\bwedding|party|ceremony|function|mehndi|nikah|walima", re.I), "Function"),
    (re.compile(r"\bmeeting|appointment\b", re.I), "Meeting"),
    (re.compile(r"\bshopping|mall|store|market|bazaar", re.I), "Shopping"),
    (re.compile(r"\bbill|electric|gas|water|internet|utility|rent\b", re.I), "Bills"),
    (re.compile(r"\bincome|salary|earning|freelance|payment\s+received", re.I), "Income"),
    (re.compile(r"\bexpense|spent|paid|cost\b", re.I), "Expense"),
    (re.compile(r"\bcash|money|saving", re.I), "Cash"),
]


def _infer_category(text, direction, asset_cat):
    if asset_cat:
        return asset_cat, 0.85
    for pattern, name in _CATEGORY_RULES:
        if pattern.search(text):
            return name, 0.80
    if direction == "given":
        return "Expense", 0.50
    if direction == "received":
        return "Income", 0.50
    return "General", 0.30


# ═══════════════════════════════════════════════════════════════════
# REMINDER TITLE EXTRACTION
# ═══════════════════════════════════════════════════════════════════

_REMINDER_PREFIX = re.compile(
    r"^\s*(?:please\s+)?(?:remind\s+me|set\s+reminder|remember\s+to)",
    re.I,
)


def _extract_reminder_title(text: str) -> Optional[str]:
    m = _REMINDER_PREFIX.search(text)
    if not m:
        return None
    rest = text[m.end():]
    # Remove dates/times from the rest using a regex that matches common patterns
    rest = re.sub(
        r"\b(?:tomorrow|today|tonight|next\s+\w+|on\s+\d{1,2}\s+\w+|for\s+\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}|at\s+\d{1,2}(?::\d{2})?(?:am|pm)?)\b", 
        "", rest, flags=re.I
    )
    # Strip lingering prepositions
    rest = re.sub(r"^(?:to|about|for)\s+", "", rest.strip(), flags=re.I)
    return rest.strip().rstrip(".") or None


# ═══════════════════════════════════════════════════════════════════
# AUDIO ACTION DETECTION
# ═══════════════════════════════════════════════════════════════════

_AUDIO_ACTION_PREFIX = re.compile(
    r"^\s*(?:play|schedule|start)\s+",
    re.I,
)
_AUDIO_REPEAT_MAP = {
    "every day": "Daily", "daily": "Daily", "everyday": "Daily",
    "every monday": "Weekly", "every tuesday": "Weekly", "every wednesday": "Weekly",
    "every thursday": "Weekly", "every friday": "Weekly", "every saturday": "Weekly",
    "every sunday": "Weekly", "weekly": "Weekly",
    "every month": "Monthly", "monthly": "Monthly",
}
_AUDIO_STOP = re.compile(r"\b(?:stop|cancel|disable|pause)\b.*\b(?:audio|playlist|surah|quran)\b", re.I)


def _extract_audio_action(text: str):
    """Detect audio scheduling commands. Returns (audio_name, repeat_type, conf)."""
    if not _AUDIO_ACTION_PREFIX.search(text) and not _AUDIO_STOP.search(text):
        return None, None, 0.0
    tl = text.lower()
    # Must mention audio-related content
    if not re.search(r"\b(surah|quran|playlist|music|audio|nasheed|podcast|tilawat)\b", tl):
        return None, None, 0.0
    # Extract name
    m = re.search(r"(?:play|schedule|start)\s+(.+?)(?:\s+every|\s+daily|\s+at\s+\d|\s*$)", text, re.I)
    audio_name = m.group(1).strip() if m else text.strip()
    # Extract repeat
    repeat_type = "None"
    for key, val in _AUDIO_REPEAT_MAP.items():
        if key in tl:
            repeat_type = val
            break
    return audio_name, repeat_type, 0.88


# ═══════════════════════════════════════════════════════════════════
# ORCHESTRATOR
# ═══════════════════════════════════════════════════════════════════

class SmartDiaryExtractor:
    """Coordinates all sub-extractors. Public API: extract(text, intent)."""

    def extract(self, text: str, intent: str = "") -> ExtractionResult:
        if _REMINDER_PREFIX.search(text):
            intent = "reminder"

        # Early audio action detection
        audio_name, audio_repeat, audio_conf = _extract_audio_action(text)
        if audio_name and audio_conf > 0.5:
            r = ExtractionResult(raw_text=text, intent=intent)
            time_str, _, _ = _extract_time(text)
            r.time = time_str
            iso_date, date_raw, _ = _extract_date(text, intent=intent)
            r.date = iso_date
            r.datetime_raw = date_raw
            r.audio_name = audio_name
            r.audio_repeat_type = audio_repeat
            r.target_entity = "audio_action"
            r.confidence["audio"] = audio_conf
            return r

        r = ExtractionResult(raw_text=text, intent=intent)

        # 1. Normalize pronouns
        norm_text = _normalize_pronouns(text)

        # 2. Time first; strip span so digits don't leak into amount
        time_str, time_raw, time_span = _extract_time(norm_text)
        r.time = time_str
        text_no_time = _strip_span(norm_text, time_span) if time_span else norm_text

        # Extract event context if present
        event_match = re.search(r"(?:on|for|at)\s+(.+)$", text_no_time, re.I)
        if event_match:
            event_ctx = event_match.group(1).strip()
            # Normalize "his daughter wedding" -> "daughter wedding"
            event_ctx = re.sub(r"\b(his|her|my)\b\s*", "", event_ctx, flags=re.I).strip()
            if event_ctx:
                r.event_context = event_ctx

        # 3. Date
        iso_date, date_raw, date_conf = _extract_date(text_no_time, intent=intent)
        r.date = iso_date
        r.datetime_raw = time_raw or date_raw
        r.confidence["date"] = date_conf

        # 4. Document-level: location/item, asset
        location, item, loc_conf = _extract_location_item(text_no_time)
        r.location = location
        r.item = item
        r.confidence["location"] = loc_conf

        asset, asset_cat, asset_conf = _extract_asset(text_no_time)
        r.asset = asset
        r.asset_category = asset_cat
        r.confidence["asset"] = asset_conf

        # 5. Segment split → per-segment transactions
        segments = _split_segments(text_no_time)
        txns: list[Transaction] = []
        best_dir_conf = 0.0
        all_persons = []
        global_direction = None

        for seg in segments:
            direction, relational_person, dir_conf = _extract_direction_and_persons(seg)
            amount, currency, amt_conf = _extract_amount_from(seg)
            
            # Use relational person if found, else fallback to standard person extraction
            seg_persons = _extract_persons(seg)
            seg_person = relational_person if relational_person else (seg_persons[0][0] if seg_persons else None)
            
            if seg_person and seg_person not in all_persons:
                all_persons.append(seg_person)

            if direction and not global_direction:
                global_direction = direction

            effective_dir = direction or global_direction
            if amount is not None and effective_dir is not None:
                txns.append(Transaction(
                    amount=amount, direction=effective_dir, currency=currency,
                    person=seg_person, event_context=r.event_context,
                    confidence=min(dir_conf if dir_conf else amt_conf, amt_conf),
                ))
                if dir_conf:
                    best_dir_conf = max(best_dir_conf, dir_conf)

        r.persons = all_persons
        if all_persons:
            r.person = all_persons[0]
            r.confidence["person"] = 0.9
        else:
            r.confidence["person"] = 0.0

        r.transactions = txns
        r.has_transaction = bool(txns)
        if txns:
            r.amount = txns[0].amount
            r.direction = txns[0].direction
            r.currency = txns[0].currency
            r.confidence["amount"] = txns[0].confidence
            r.confidence["direction"] = best_dir_conf
        else:
            r.direction = global_direction
            r.confidence["amount"] = 0.0
            r.confidence["direction"] = 0.8 if global_direction else 0.0

        # 6. Category
        category, cat_conf = _infer_category(text, r.direction, asset_cat)
        r.category = category
        r.confidence["category"] = cat_conf

        # 7. Reminder title (only if intent=reminder)
        if intent == "reminder":
            r.reminder_title = _extract_reminder_title(text)

        # 8. Routing
        self._resolve_routing(r, intent)
        return r

    def _resolve_routing(self, r: ExtractionResult, intent: str) -> None:
        if intent == "reminder":
            r.target_entity = "reminder"
            return
        if r.item and r.location:
            r.target_entity = "stored_item"
            return

        received_in_text = bool(re.search(r'\b(received|got|took|earned|collected|borrowed|accepted)\b', r.raw_text, re.I))

        if r.asset and intent == "store":
            r.target_entity = "asset"
            if (any(t.direction == "received" for t in r.transactions)
                    or r.direction == "received"
                    or received_in_text):
                r.note_type = "gift_received"
            else:
                r.note_type = "asset"
            return
        if r.transactions:
            r.target_entity = "note"
            r.note_type = "event"
            return
        if intent == "query":
            r.target_entity = "note"
            return
        r.target_entity = "note"
        r.note_type = "general"


# ═══════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════

def _cli(argv: list[str]) -> int:
    if not argv:
        print('usage: python -m app.ai.ner "<text>" [intent]', file=sys.stderr)
        return 2
    text = argv[0]
    intent = argv[1] if len(argv) > 1 else "store"

    ex = SmartDiaryExtractor()
    result = ex.extract(text, intent=intent)
    d = result.to_dict()

    print(f"text:    {text!r}")
    print(f"intent:  {intent}")
    print(f"target:  {result.target_entity}")
    print(f"type:    {result.note_type}")
    print(f"persons: {result.persons}")
    print(f"date:    {result.date}    time: {result.time}")
    if result.asset:
        print(f"asset:   {result.asset}  ({result.asset_category})")
    if result.item or result.location:
        print(f"item:    {result.item}    location: {result.location}")
    if result.category:
        print(f"category:{result.category}")
    if result.transactions:
        print(f"transactions ({len(result.transactions)}):")
        for t in result.transactions:
            print(f"   {t.direction:8s} {t.amount} {t.currency}  person={t.person}")
    if result.reminder_title:
        print(f"reminder:{result.reminder_title}")
    return 0


if __name__ == "__main__":
    sys.exit(_cli(sys.argv[1:]))
