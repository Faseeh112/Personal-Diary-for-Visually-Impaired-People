"""Fact retriever: translates a parsed QueryPlan into real DB rows.

Multi-party transaction semantics:
  * sender_person_id   IS NULL    → User gave that person
  * receiver_person_id IS NULL    → That person gave User
  * BOTH non-NULL                 → third-party (User is observer)

User-centric aggregations (default) require ONE side to be NULL — they must
NOT include third-party rows, which would inflate "you spent X" totals
with money the user never spent.

Resolvers respect plan.direction:
  * "given"        → sender IS NULL
  * "received"     → receiver IS NULL
  * unset/None     → User-centric (one side IS NULL) — excludes third-party

If a future query type wants third-party totals, it can set
plan.include_third_party=True; resolvers detect and skip the User filter.
"""
from __future__ import annotations

from datetime import date as _date, datetime, timedelta
from typing import Optional

from sqlalchemy import func, and_, or_, case

from ..extensions import db
from ..models import (Note, NoteTransaction, Person, Category, Asset,
                      StoredItem, EventInstance, Reminder, ZakatNisab,
                      AudioAction)
from ..ai.query_parser import QueryType, QueryPlan


# ════════════════════════════════════════════════════════════════════
# HELPERS
# ════════════════════════════════════════════════════════════════════

def _parse_iso(s: Optional[str]) -> Optional[_date]:
    if not s:
        return None
    try:
        return _date.fromisoformat(s)
    except (ValueError, TypeError):
        return None


def _apply_date_filter(query, date_col, plan: QueryPlan):
    df = _parse_iso(plan.date_from)
    dt = _parse_iso(plan.date_to)
    if df:
        query = query.filter(date_col >= df)
    if dt:
        query = query.filter(date_col <= dt)
    return query


def _user_involved_filter():
    """SQL predicate: at least one party is the App User (NULL)."""
    return or_(NoteTransaction.sender_person_id.is_(None),
               NoteTransaction.receiver_person_id.is_(None))


def _wants_third_party(plan: QueryPlan) -> bool:
    return getattr(plan, "include_third_party", False) is True


# ════════════════════════════════════════════════════════════════════
# RESOLVERS
# ════════════════════════════════════════════════════════════════════

def _resolve_aggregate_by_person(user_id: int, plan: QueryPlan) -> list[dict]:
    """How much did I give/receive (with) a specific person?

    User-centric only: only counts transactions where User is one party
    and the named person is the other.
    """
    if not plan.person:
        return []

    matched = (Person.query
               .filter(Person.user_id == user_id,
                       Person.is_active == True,                # noqa: E712
                       Person.name.ilike(f"%{plan.person}%"))
               .all())
    if not matched:
        return []
    pids = [p.person_id for p in matched]

    base = (db.session.query(
                func.sum(NoteTransaction.amount).label("total"),
                func.count(NoteTransaction.txn_id).label("count"),
                NoteTransaction.currency,
            )
            .join(Note, Note.note_id == NoteTransaction.note_id)
            .filter(Note.user_id == user_id,
                    Note.is_active == True,                      # noqa: E712
                    NoteTransaction.is_active == True))          # noqa: E712

    if plan.direction == "given":
        # User → person
        q = base.filter(NoteTransaction.sender_person_id.is_(None),
                        NoteTransaction.receiver_person_id.in_(pids))
    elif plan.direction == "received":
        # Person → User
        q = base.filter(NoteTransaction.sender_person_id.in_(pids),
                        NoteTransaction.receiver_person_id.is_(None))
    else:
        # User-centric (one side User, other side this person)
        q = base.filter(or_(
            and_(NoteTransaction.sender_person_id.is_(None),
                 NoteTransaction.receiver_person_id.in_(pids)),
            and_(NoteTransaction.sender_person_id.in_(pids),
                 NoteTransaction.receiver_person_id.is_(None)),
        ))

    q = _apply_date_filter(q, Note.note_date, plan)
    q = q.group_by(NoteTransaction.currency)

    print(q.statement.compile(compile_kwargs={"literal_binds": True}))
    return [{"total": float(r.total or 0), "count": int(r.count or 0),
             "currency": r.currency, "person": plan.person}
            for r in q.all()]


def _resolve_aggregate_by_person_event(user_id: int, plan: QueryPlan) -> list[dict]:
    """Match notes by both person and event context."""
    if not plan.person or not plan.event_context:
        return []

    matched = (Person.query
               .filter(Person.user_id == user_id,
                       Person.is_active == True,
                       Person.name.ilike(f"%{plan.person}%"))
               .all())
    if not matched:
        return []
    pids = [p.person_id for p in matched]

    base = (db.session.query(
                func.sum(NoteTransaction.amount).label("total"),
                func.count(NoteTransaction.txn_id).label("count"),
                NoteTransaction.currency,
            )
            .select_from(NoteTransaction)
            .join(Note, Note.note_id == NoteTransaction.note_id)
            .filter(
                Note.user_id == user_id,
                Note.is_active == True,
                NoteTransaction.is_active == True,
                NoteTransaction.event_context.ilike(f"%{plan.event_context}%")
            ))

    if plan.direction == "given":
        q = base.filter(NoteTransaction.sender_person_id.is_(None),
                        NoteTransaction.receiver_person_id.in_(pids))
    elif plan.direction == "received":
        q = base.filter(NoteTransaction.sender_person_id.in_(pids),
                        NoteTransaction.receiver_person_id.is_(None))
    else:
        q = base.filter(or_(
            and_(NoteTransaction.sender_person_id.is_(None),
                 NoteTransaction.receiver_person_id.in_(pids)),
            and_(NoteTransaction.sender_person_id.in_(pids),
                 NoteTransaction.receiver_person_id.is_(None)),
        ))

    q = _apply_date_filter(q, Note.note_date, plan)
    q = q.group_by(NoteTransaction.currency)

    print(q.statement.compile(compile_kwargs={"literal_binds": True}))
    return [{"total": float(r.total or 0), "count": int(r.count or 0),
             "currency": r.currency, "person": plan.person}
            for r in q.all()]


def _resolve_aggregate_by_event(user_id: int, plan: QueryPlan) -> list[dict]:
    """Match notes by event keyword + optional person.

    User-centric by default. Set plan.include_third_party=True to include
    everyone's transactions at the event.
    """
    if not plan.event_keywords:
        return []
    kw = plan.event_keywords[0]

    title_like = Note.title.ilike(f"%{kw}%")
    desc_like  = Note.description.ilike(f"%{kw}%")

    q = (db.session.query(
            func.sum(NoteTransaction.amount).label("total"),
            func.count(NoteTransaction.txn_id).label("count"),
            NoteTransaction.currency,
        )
        .join(Note, Note.note_id == NoteTransaction.note_id)
        .filter(Note.user_id == user_id,
                Note.is_active == True,                          # noqa: E712
                NoteTransaction.is_active == True,               # noqa: E712
                or_(title_like, desc_like)))

    if plan.direction == "given":
        q = q.filter(NoteTransaction.sender_person_id.is_(None))
    elif plan.direction == "received":
        q = q.filter(NoteTransaction.receiver_person_id.is_(None))
    elif not _wants_third_party(plan):
        q = q.filter(_user_involved_filter())

    if plan.person:
        q = q.filter(or_(Note.title.ilike(f"%{plan.person}%"),
                         Note.description.ilike(f"%{plan.person}%")))
    q = _apply_date_filter(q, Note.note_date, plan)
    q = q.group_by(NoteTransaction.currency)

    print(q.statement.compile(compile_kwargs={"literal_binds": True}))
    return [{"total": float(r.total or 0), "count": int(r.count or 0),
             "currency": r.currency}
            for r in q.all()]


def _resolve_aggregate_by_category(user_id: int, plan: QueryPlan) -> list[dict]:
    if not plan.category:
        return []
    cat_row = Category.query.filter(
        Category.name == plan.category,
        or_(Category.user_id == user_id, Category.user_id.is_(None)),
        Category.is_active == True,                              # noqa: E712
    ).first()
    if not cat_row:
        return []

    q = (db.session.query(
            func.sum(NoteTransaction.amount).label("total"),
            func.count(NoteTransaction.txn_id).label("count"),
            NoteTransaction.currency,
        )
        .join(Note, Note.note_id == NoteTransaction.note_id)
        .filter(Note.user_id == user_id,
                Note.is_active == True,                          # noqa: E712
                NoteTransaction.is_active == True,               # noqa: E712
                or_(NoteTransaction.category_id == cat_row.category_id,
                    Note.category_id == cat_row.category_id)))

    if plan.direction == "given":
        q = q.filter(NoteTransaction.sender_person_id.is_(None))
    elif plan.direction == "received":
        q = q.filter(NoteTransaction.receiver_person_id.is_(None))
    elif not _wants_third_party(plan):
        q = q.filter(_user_involved_filter())

    q = _apply_date_filter(q, Note.note_date, plan)
    q = q.group_by(NoteTransaction.currency)

    print(q.statement.compile(compile_kwargs={"literal_binds": True}))
    return [{"total": float(r.total or 0), "count": int(r.count or 0),
             "currency": r.currency}
            for r in q.all()]


def _resolve_aggregate_total(user_id: int, plan: QueryPlan) -> list[dict]:
    """Total user spending/receiving — User-centric only."""
    q = (db.session.query(
            func.sum(NoteTransaction.amount).label("total"),
            func.count(NoteTransaction.txn_id).label("count"),
            NoteTransaction.currency,
        )
        .join(Note, Note.note_id == NoteTransaction.note_id)
        .filter(Note.user_id == user_id,
                Note.is_active == True,                          # noqa: E712
                NoteTransaction.is_active == True))              # noqa: E712

    if plan.direction == "given":
        q = q.filter(NoteTransaction.sender_person_id.is_(None))
    elif plan.direction == "received":
        q = q.filter(NoteTransaction.receiver_person_id.is_(None))
    else:
        # "Total" without direction → still User-centric (excludes third-party)
        q = q.filter(_user_involved_filter())

    q = _apply_date_filter(q, Note.note_date, plan)
    q = q.group_by(NoteTransaction.currency)

    print(q.statement.compile(compile_kwargs={"literal_binds": True}))
    return [{"total": float(r.total or 0), "count": int(r.count or 0),
             "currency": r.currency}
            for r in q.all()]


def _resolve_zakat(user_id: int, plan: QueryPlan) -> list[dict]:
    today = _date.today()
    threshold_date = today - timedelta(days=354)
    year = plan.year or today.year
    currency = "PKR"

    assets = (Asset.query
              .filter(Asset.user_id == user_id,
                      Asset.is_active == True,                   # noqa: E712
                      Asset.is_zakatable == True,                # noqa: E712
                      Asset.currency == currency,
                      Asset.acquired_date.isnot(None),
                      Asset.acquired_date <= threshold_date)
              .all())

    total_zakatable = float(sum(
        float(a.current_value if a.current_value is not None else (a.purchase_value or 0))
        for a in assets
    ))

    nisab = ZakatNisab.query.filter_by(year=year, currency=currency).first()
    nisab_amount = float(nisab.nisab_amount) if nisab else 0.0

    meets = total_zakatable >= nisab_amount and nisab_amount > 0
    zakat_due = round(total_zakatable * 0.025, 2) if meets else 0.0

    return [{
        "year": year,
        "currency": currency,
        "nisab_amount": nisab_amount,
        "total_zakatable": total_zakatable,
        "meets_nisab": meets,
        "zakat_due": zakat_due,
        "asset_count": len(assets),
    }]


def _resolve_tax(user_id: int, plan: QueryPlan) -> list[dict]:
    currency = "PKR"
    rows = (Asset.query
            .filter(Asset.user_id == user_id,
                    Asset.is_active == True,                     # noqa: E712
                    Asset.is_tax_asset == True,                  # noqa: E712
                    Asset.currency == currency)
            .all())
    total = float(sum(
        float(a.current_value if a.current_value is not None else (a.purchase_value or 0))
        for a in rows
    ))
    return [{"total_value": total, "count": len(rows), "currency": currency}]


def _resolve_gifts_list(user_id: int, plan: QueryPlan) -> list[dict]:
    """Gifts the User received: assets w/ acquisition_type='gift_received',
    plus note_transactions where receiver=User (NULL) and category='Gift'."""
    out: list[dict] = []

    asset_q = (Asset.query
               .filter(Asset.user_id == user_id,
                       Asset.is_active == True,                  # noqa: E712
                       Asset.acquisition_type == "gift_received"))
    asset_q = _apply_date_filter(asset_q, Asset.acquired_date, plan)
    for a in asset_q.all():
        out.append({
            "name": a.name, "type": "asset", "from": a.acquired_from,
            "date": a.acquired_date.isoformat() if a.acquired_date else None,
        })

    gift_cat = Category.query.filter(
        Category.name == "Gift",
        or_(Category.user_id == user_id, Category.user_id.is_(None)),
    ).first()
    if gift_cat:
        q = (db.session.query(NoteTransaction, Note)
             .join(Note, Note.note_id == NoteTransaction.note_id)
             .filter(Note.user_id == user_id,
                     NoteTransaction.is_active == True,           # noqa: E712
                     NoteTransaction.receiver_person_id.is_(None),
                     or_(NoteTransaction.category_id == gift_cat.category_id,
                         Note.category_id == gift_cat.category_id)))
        q = _apply_date_filter(q, Note.note_date, plan)
        for txn, note in q.all():
            person = (db.session.get(Person, txn.sender_person_id)
                      if txn.sender_person_id else None)
            out.append({
                "name": f"{txn.amount:g} {txn.currency}",
                "type": "money",
                "from": person.name if person else None,
                "date": note.note_date.isoformat() if note.note_date else None,
            })
    return out


def _resolve_item_location(user_id: int, plan: QueryPlan) -> list[dict]:
    if not plan.item:
        return []
    rows = (StoredItem.query
            .filter(StoredItem.user_id == user_id,
                    StoredItem.is_active == True,                # noqa: E712
                    StoredItem.item_name.ilike(f"%{plan.item}%"))
            .all())
    out = []
    for s in rows:
        loc_str = s.location_text
        if not loc_str and s.location_id:
            from ..models import Location
            loc = db.session.get(Location, s.location_id)
            if loc:
                loc_str = loc.full_path or loc.name
        out.append({
            "item_name": s.item_name, "location": loc_str or "(no location)",
            "location_text": loc_str,
        })
    return out


def _resolve_date_lookup(user_id: int, plan: QueryPlan) -> list[dict]:
    keywords = plan.event_keywords + (plan.persons or [])
    if not keywords:
        return []

    filters = []
    for kw in keywords:
        filters.append(EventInstance.title.ilike(f"%{kw}%"))
        filters.append(EventInstance.description.ilike(f"%{kw}%"))
    rows = (EventInstance.query
            .filter(EventInstance.user_id == user_id,
                    EventInstance.is_active == True,             # noqa: E712
                    or_(*filters))
            .order_by(EventInstance.event_date.desc())
            .limit(5).all())
    return [{"title": e.title, "event_date": e.event_date.isoformat(),
             "event_type": e.event_type}
            for e in rows]


def _resolve_keyword_fallback(user_id: int, plan: QueryPlan) -> list[dict]:
    if not plan.keywords:
        return []
    note_filters = []
    item_filters = []
    for kw in plan.keywords:
        like = f"%{kw}%"
        note_filters.append(Note.title.ilike(like))
        note_filters.append(Note.description.ilike(like))
        item_filters.append(StoredItem.item_name.ilike(like))

    notes = (Note.query
             .filter(Note.user_id == user_id,
                     Note.is_active == True,                     # noqa: E712
                     or_(*note_filters))
             # MSSQL doesn't support 'NULLS LAST' — use CASE-based ordering
             .order_by(case((Note.note_date.is_(None), 1), else_=0).asc(),
                       Note.note_date.desc())
             .limit(5).all())
    items = (StoredItem.query
             .filter(StoredItem.user_id == user_id,
                     StoredItem.is_active == True,               # noqa: E712
                     or_(*item_filters))
             .limit(3).all()) if item_filters else []

    out = []
    for n in notes:
        out.append({"title": n.title or "(untitled)",
                    "description": (n.description or "")[:200],
                    "date": n.note_date.isoformat() if n.note_date else None,
                    "type": "note"})
    for s in items:
        out.append({"title": s.item_name,
                    "description": s.description or "",
                    "type": "stored_item"})
    return out


def _resolve_reminders_list(user_id: int, plan: QueryPlan) -> list[dict]:
    """List active reminders for the user."""
    q = (Reminder.query
         .filter(Reminder.user_id == user_id,
                 Reminder.is_active == True)                     # noqa: E712
         .order_by(Reminder.reminder_datetime))
    # Date filtering on datetime column — comparing date to datetime works
    # on both SQLite and MSSQL
    df = _parse_iso(plan.date_from)
    dt = _parse_iso(plan.date_to)
    if df:
        q = q.filter(Reminder.reminder_datetime >= datetime.combine(df, datetime.min.time()))
    if dt:
        q = q.filter(Reminder.reminder_datetime <= datetime.combine(dt, datetime.max.time()))
    rows = q.limit(20).all()
    return [{"reminder_id": r.reminder_id,
             "title": r.title,
             "reminder_datetime": r.reminder_datetime.isoformat() if r.reminder_datetime else None,
             "repeat_type": r.repeat_type,
             "is_done": r.is_done}
            for r in rows]


def _resolve_assets_list(user_id: int, plan: QueryPlan) -> list[dict]:
    """List active assets for the user."""
    rows = (Asset.query
            .filter(Asset.user_id == user_id,
                    Asset.is_active == True)                      # noqa: E712
            .order_by(Asset.created_at.desc())
            .limit(20).all())
    return [{"asset_id": a.asset_id,
             "name": a.name,
             "current_value": float(a.current_value) if a.current_value else None,
             "purchase_value": float(a.purchase_value) if a.purchase_value else None,
             "currency": a.currency,
             "is_zakatable": a.is_zakatable}
            for a in rows]


def _resolve_events_list(user_id: int, plan: QueryPlan) -> list[dict]:
    """List notes/events, filtered by date range if provided."""
    q = (Note.query
         .filter(Note.user_id == user_id,
                 Note.is_active == True)                          # noqa: E712
         .order_by(case((Note.note_date.is_(None), 1), else_=0).asc(),
                   Note.note_date.desc()))
    q = _apply_date_filter(q, Note.note_date, plan)
    rows = q.limit(20).all()
    return [{"note_id": n.note_id,
             "title": n.title or "(untitled)",
             "description": (n.description or "")[:200],
             "note_type": n.note_type,
             "date": n.note_date.isoformat() if n.note_date else None}
            for n in rows]


def _resolve_audio_list(user_id: int, plan: QueryPlan) -> list[dict]:
    """List audio action schedules."""
    rows = (AudioAction.query
            .filter(AudioAction.user_id == user_id,
                    AudioAction.is_active == True)                # noqa: E712
            .order_by(AudioAction.play_datetime)
            .limit(20).all())
    return [{"audio_action_id": a.audio_action_id,
             "audio_name": a.audio_name,
             "play_datetime": a.play_datetime.isoformat() if a.play_datetime else None,
             "repeat_type": a.repeat_type,
             "is_active_schedule": a.is_active_schedule}
            for a in rows]


# ════════════════════════════════════════════════════════════════════
# DISPATCH
# ════════════════════════════════════════════════════════════════════

_RESOLVERS = {
    QueryType.AGGREGATE_BY_PERSON.value:   _resolve_aggregate_by_person,
    QueryType.AGGREGATE_BY_PERSON_EVENT.value: _resolve_aggregate_by_person_event,
    QueryType.AGGREGATE_BY_EVENT.value:    _resolve_aggregate_by_event,
    QueryType.AGGREGATE_BY_CATEGORY.value: _resolve_aggregate_by_category,
    QueryType.AGGREGATE_TOTAL.value:       _resolve_aggregate_total,
    QueryType.ZAKAT.value:                 _resolve_zakat,
    QueryType.TAX.value:                   _resolve_tax,
    QueryType.GIFTS_LIST.value:            _resolve_gifts_list,
    QueryType.REMINDERS_LIST.value:        _resolve_reminders_list,
    QueryType.ASSETS_LIST.value:           _resolve_assets_list,
    QueryType.EVENTS_LIST.value:           _resolve_events_list,
    QueryType.AUDIO_LIST.value:            _resolve_audio_list,
    QueryType.ITEM_LOCATION.value:         _resolve_item_location,
    QueryType.DATE_LOOKUP.value:           _resolve_date_lookup,
    QueryType.KEYWORD_FALLBACK.value:      _resolve_keyword_fallback,
}


def fetch_facts(user_id: int, plan: QueryPlan) -> list[dict]:
    """Public entry point. Routes plan to the right resolver."""
    resolver = _RESOLVERS.get(plan.query_type)
    if resolver is None:
        return []
    return resolver(user_id, plan)
