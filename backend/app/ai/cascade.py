"""Event cascade engine.

When a life event is recorded (birth, wedding, death), this module produces
the list of derived reminders that should be created.

Templates are hardcoded in Python per Phase 1 design decision (Decision 1
in Phase 1: only 3 event types, no user customization, no rules engine).

Cascade depth is capped at 1 — we generate direct children only, never
grandchildren. Enforced here, not in the schema.

Usage:
    from datetime import date
    from app.ai.cascade import generate_cascade

    children = generate_cascade(
        event_type="birth",
        event_date=date(2024, 1, 20),
        subject_name="Umar",
        years_to_generate=80,
    )
    # children: list of CascadeReminder dataclasses
    # Each has: title, description, reminder_datetime, repeat_type
    # Phase 4 service inserts these as Reminder rows with parent_event_instance_id
"""
from __future__ import annotations

import sys
import json
from dataclasses import dataclass, asdict
from datetime import date, datetime, timedelta
from typing import Optional


# ════════════════════════════════════════════════════════════════════
# DATA MODEL
# ════════════════════════════════════════════════════════════════════

@dataclass
class CascadeReminder:
    """A reminder produced by a cascade template.

    Phase 4 voice/event service will insert these into the `reminder` table
    with parent_event_instance_id set to the source event_instance row.
    """
    title: str
    description: Optional[str]
    reminder_datetime: datetime
    repeat_type: str             # None | Daily | Weekly | Monthly | Yearly
    end_date: Optional[date] = None

    def to_dict(self) -> dict:
        d = asdict(self)
        d["reminder_datetime"] = self.reminder_datetime.isoformat()
        d["end_date"] = self.end_date.isoformat() if self.end_date else None
        return d


# ════════════════════════════════════════════════════════════════════
# TEMPLATES
# ════════════════════════════════════════════════════════════════════

# Default reminder time-of-day for cascade-generated reminders.
# Phase 4 will let users override per-reminder.
_DEFAULT_HOUR = 9
_DEFAULT_MINUTE = 0


def _at_default_time(d: date) -> datetime:
    return datetime.combine(d, datetime.min.time()).replace(
        hour=_DEFAULT_HOUR, minute=_DEFAULT_MINUTE
    )


def _add_years(d: date, years: int) -> date:
    """Add N years to a date. Handles Feb 29 by clamping to Feb 28."""
    try:
        return d.replace(year=d.year + years)
    except ValueError:
        return d.replace(year=d.year + years, day=28)


def _birth_template(event_date: date, subject_name: str,
                    years: int) -> list[CascadeReminder]:
    """Birth → birth certificate (+30d) + aqiqa (+7d) + N yearly birthdays."""
    name = subject_name or "child"
    out: list[CascadeReminder] = []

    # +7 days: aqiqa
    out.append(CascadeReminder(
        title=f"{name}'s aqiqa ceremony",
        description=f"Aqiqa for {name} born on {event_date.isoformat()}",
        reminder_datetime=_at_default_time(event_date + timedelta(days=7)),
        repeat_type="None",
    ))

    # +30 days: birth certificate registration
    out.append(CascadeReminder(
        title=f"Register birth certificate for {name}",
        description=f"30-day registration deadline for {name}'s birth certificate",
        reminder_datetime=_at_default_time(event_date + timedelta(days=30)),
        repeat_type="None",
    ))

    # Yearly birthdays
    for y in range(1, years + 1):
        anniv = _add_years(event_date, y)
        out.append(CascadeReminder(
            title=f"{name}'s birthday",
            description=f"{name} turns {y} today",
            reminder_datetime=_at_default_time(anniv),
            repeat_type="None",   # one-off per year, not Yearly recurring
        ))
    return out


def _wedding_template(event_date: date, subject_name: str,
                      years: int) -> list[CascadeReminder]:
    """Wedding → N yearly anniversaries."""
    name = subject_name or "couple"
    out: list[CascadeReminder] = []
    for y in range(1, years + 1):
        anniv = _add_years(event_date, y)
        out.append(CascadeReminder(
            title=f"{name} anniversary",
            description=f"{y}-year wedding anniversary for {name}",
            reminder_datetime=_at_default_time(anniv),
            repeat_type="None",
        ))
    return out


def _death_template(event_date: date, subject_name: str,
                    years: int) -> list[CascadeReminder]:
    """Death → N yearly death anniversaries."""
    name = subject_name or "deceased"
    out: list[CascadeReminder] = []
    for y in range(1, years + 1):
        anniv = _add_years(event_date, y)
        out.append(CascadeReminder(
            title=f"{name} death anniversary",
            description=f"{y}-year death anniversary",
            reminder_datetime=_at_default_time(anniv),
            repeat_type="None",
        ))
    return out


_TEMPLATES = {
    "birth":   _birth_template,
    "wedding": _wedding_template,
    "death":   _death_template,
}


# ════════════════════════════════════════════════════════════════════
# PUBLIC API
# ════════════════════════════════════════════════════════════════════

SUPPORTED_EVENT_TYPES = frozenset(_TEMPLATES.keys())


def generate_cascade(
    event_type: str,
    event_date: date,
    subject_name: str = "",
    years_to_generate: int = 50,
) -> list[CascadeReminder]:
    """Generate child reminders for a parent life event.

    Args:
        event_type: 'birth' | 'wedding' | 'death'
        event_date: when the event occurred
        subject_name: person involved (e.g. 'Umar' for birth, 'Hassan' for death)
        years_to_generate: how many years of yearly reminders to produce

    Returns:
        List of CascadeReminder dataclasses ready for the Reminder service to
        persist. Empty list if event_type is unsupported (e.g. 'anniversary',
        'other' — those don't cascade).

    Raises:
        ValueError if event_date is not a date or years_to_generate is negative.
    """
    if not isinstance(event_date, date):
        raise ValueError("event_date must be a date")
    if years_to_generate < 0:
        raise ValueError("years_to_generate must be >= 0")

    template = _TEMPLATES.get(event_type)
    if template is None:
        return []

    return template(event_date, subject_name.strip(), years_to_generate)


def _cli(argv: list[str]) -> int:
    if len(argv) < 2:
        print("usage: python -m app.ai.cascade <event_type> <YYYY-MM-DD> "
              "[subject_name] [years]", file=sys.stderr)
        return 2
    event_type = argv[0]
    event_date = date.fromisoformat(argv[1])
    subject = argv[2] if len(argv) > 2 else ""
    years = int(argv[3]) if len(argv) > 3 else 5

    children = generate_cascade(event_type, event_date, subject, years)
    if not children:
        print(f"No cascade for event_type={event_type!r}")
        return 0
    print(f"Generated {len(children)} child reminders for "
          f"{event_type} on {event_date}:")
    for c in children:
        print(json.dumps(c.to_dict(), indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(_cli(sys.argv[1:]))
