import re
from datetime import date
from ..extensions import db
from ..models import (
    Note, NoteTransaction, Asset, Person, StoredItem,
    Reminder, AudioAction
)

def handle_update(user_id: int, text: str, extraction) -> str:
    tl = text.lower()

    if "reminder" in tl or "remind" in tl:
        kw = re.sub(r"\b(change|update|move|modify|set|reschedule|edit|reminder|to|the|at|from)\b",
                     "", tl, flags=re.I).strip()
        words = [w for w in kw.split() if len(w) > 2]
        for r in Reminder.query.filter_by(user_id=user_id, is_active=True).all():
            if words and any(w.lower() in r.title.lower() for w in words):
                if extraction.time:
                    hh, mm = extraction.time.split(":")
                    r.reminder_datetime = r.reminder_datetime.replace(hour=int(hh), minute=int(mm))
                    db.session.commit()
                    return f"Updated reminder '{r.title}' to {r.reminder_datetime}"
                if extraction.date:
                    d = date.fromisoformat(extraction.date)
                    r.reminder_datetime = r.reminder_datetime.replace(year=d.year, month=d.month, day=d.day)
                    db.session.commit()
                    return f"Updated reminder '{r.title}' to {r.reminder_datetime}"
        return "No matching reminder found."

    if extraction.item and extraction.location:
        item = StoredItem.query.filter(
            StoredItem.user_id == user_id, StoredItem.is_active == True,
            StoredItem.item_name.ilike(f"%{extraction.item}%"),
        ).first()
        if item:
            item.location_text = extraction.location
            db.session.commit()
            return f"Updated '{item.item_name}' to {extraction.location}"
        # We don't call persist_extraction here directly because it's messy, just say not found.
        return f"No stored item '{extraction.item}' found to update."

    if extraction.person and extraction.amount:
        person = Person.query.filter(
            Person.user_id == user_id, Person.name.ilike(f"%{extraction.person}%"),
            Person.is_active == True,
        ).first()
        if person:
            txn = (NoteTransaction.query.join(Note)
                   .filter(Note.user_id == user_id, NoteTransaction.is_active == True,
                           db.or_(NoteTransaction.sender_person_id == person.person_id,
                                  NoteTransaction.receiver_person_id == person.person_id))
                   .order_by(NoteTransaction.created_at.desc()).first())
            if txn:
                old = float(txn.amount)
                txn.amount = extraction.amount
                db.session.commit()
                return f"Updated txn with {extraction.person}: {old} -> {extraction.amount}"

    if extraction.asset:
        asset = Asset.query.filter(
            Asset.user_id == user_id, Asset.is_active == True,
            Asset.name.ilike(f"%{extraction.asset}%"),
        ).first()
        if asset and extraction.amount:
            old = float(asset.current_value or 0)
            asset.current_value = extraction.amount
            db.session.commit()
            return f"Updated asset '{asset.name}': {old} -> {extraction.amount}"

    if "audio" in tl or "play" in tl:
        actions = AudioAction.query.filter_by(user_id=user_id, is_active=True).all()
        if actions and extraction.time:
            hh, mm = extraction.time.split(":")
            for a in actions:
                if a.play_datetime:
                    a.play_datetime = a.play_datetime.replace(hour=int(hh), minute=int(mm))
            db.session.commit()
            return f"Updated audio schedule to {extraction.time}"

    if extraction.person and extraction.date:
        notes = Note.query.filter(
            Note.user_id == user_id, Note.is_active == True,
            db.or_(Note.title.ilike(f"%{extraction.person}%"),
                   Note.description.ilike(f"%{extraction.person}%")),
        ).all()
        if notes:
            d = date.fromisoformat(extraction.date)
            notes[0].note_date = d
            db.session.commit()
            return f"Updated note '{notes[0].title}' date to {d}"

    return "Could not determine what to update."


def handle_delete(user_id: int, text: str, extraction) -> str:
    tl = text.lower()

    if "reminder" in tl or "remind" in tl:
        kw = re.sub(r"\b(delete|remove|cancel|drop|erase|forget|reminder|the|my)\b",
                     "", tl, flags=re.I).strip()
        words = [w for w in kw.split() if len(w) > 2]
        for r in Reminder.query.filter_by(user_id=user_id, is_active=True).all():
            if words and any(w.lower() in r.title.lower() for w in words):
                r.is_active = False
                db.session.commit()
                return f"Deleted reminder: '{r.title}'"
        return "No matching reminder."

    if extraction.item:
        item = StoredItem.query.filter(
            StoredItem.user_id == user_id, StoredItem.is_active == True,
            StoredItem.item_name.ilike(f"%{extraction.item}%"),
        ).first()
        if item:
            item.is_active = False
            db.session.commit()
            return f"Deleted item: '{item.item_name}'"

    if extraction.person:
        person = Person.query.filter(
            Person.user_id == user_id, Person.name.ilike(f"%{extraction.person}%"),
            Person.is_active == True,
        ).first()
        if person:
            q = (NoteTransaction.query.join(Note)
                 .filter(Note.user_id == user_id, NoteTransaction.is_active == True,
                         db.or_(NoteTransaction.sender_person_id == person.person_id,
                                NoteTransaction.receiver_person_id == person.person_id)))
            if extraction.event_context:
                q = q.filter(NoteTransaction.event_context.ilike(f"%{extraction.event_context}%"))
            txn = q.order_by(NoteTransaction.created_at.desc()).first()
            if txn:
                txn.is_active = False
                db.session.commit()
                return f"Deleted txn with {extraction.person} (ID: {txn.txn_id})"

    if extraction.asset:
        asset = Asset.query.filter(
            Asset.user_id == user_id, Asset.is_active == True,
            Asset.name.ilike(f"%{extraction.asset}%"),
        ).first()
        if asset:
            asset.is_active = False
            db.session.commit()
            return f"Deleted asset: '{asset.name}'"

    if any(w in tl for w in ("audio", "play", "surah", "playlist")):
        for a in AudioAction.query.filter_by(user_id=user_id, is_active=True).all():
            if a.audio_name.lower() in tl:
                a.is_active = False
                db.session.commit()
                return f"Deleted audio: '{a.audio_name}'"

    return "Could not determine what to delete."
