"""Voice processing service.

Two-step flow:
  1. /voice/process: STT → intent → NER → create voice_entry row with
     entities_json populated. Decide whether to auto-save (low-risk
     general note) or require confirmation (anything financial).
  2. /voice/<id>/confirm: on yes, persist to DB using the cached
     extraction. On no, mark voice_entry as rejected.

The extraction is re-derived on confirm rather than cached as JSON, because
we don't want to write a JSON-deserialization layer for the dataclass.
The transcript is stable so re-extracting is deterministic.
"""
from __future__ import annotations

import json
from typing import Optional

from ..extensions import db
from ..models import VoiceEntry
from ..utils.errors import HTTPError
from ..ai.ner          import SmartDiaryExtractor, ExtractionResult
from ..ai.intent       import classify
from ..ai.stt          import transcribe
from ..ai.triple_gen   import generate_triples
from ._persist_helpers import persist_extraction, persist_triples


# Note types where we auto-save without confirmation. Anything financial
# or destructive requires a yes/no.
_AUTO_SAVE_NOTE_TYPES = {"general"}
_AUTO_SAVE_TARGETS    = {"note"}  # but only for note_type=="general"


def _needs_confirmation(extraction: ExtractionResult, intent: str) -> bool:
    """Hybrid confirmation rule. Financial = confirm. Plain note = direct save."""
    # All financial flows need confirmation
    if extraction.has_transaction:
        return True
    if extraction.target_entity in ("asset", "stored_item", "reminder"):
        return True
    # Update / delete are destructive
    if intent in ("update", "delete"):
        return True
    # Plain general notes auto-save
    if (extraction.target_entity in _AUTO_SAVE_TARGETS
            and extraction.note_type in _AUTO_SAVE_NOTE_TYPES):
        return False
    # Default: ask
    return True


_USER_ALIASES_FOR_PROMPT = {"me", "myself", "i", "user", "the user", "app user", ""}


def _is_user_for_prompt(name) -> bool:
    """Match the same user-recognition logic the persist layer uses."""
    if name is None:
        return True
    return str(name).strip().lower() in _USER_ALIASES_FOR_PROMPT

def _format_one_transaction(t) -> str:
    """Produce a clean human-readable phrase for one Transaction dataclass.

    Recognizes three shapes:
      * User → person      → "given 5000 PKR to Aftab"
      * person → User      → "received 5000 PKR from Aftab"
      * person → person    → "Zahid gave 5000 PKR to Aftab"
    """
    amount_str = f"{t.amount:g} {t.currency}"

    sender   = getattr(t, "sender_name",   None)
    receiver = getattr(t, "receiver_name", None)

    # If the extractor populated sender/receiver explicitly, use them
    if sender is not None or receiver is not None:
        sender_is_user   = _is_user_for_prompt(sender)
        receiver_is_user = _is_user_for_prompt(receiver)

        if sender_is_user and not receiver_is_user:
            return f"given {amount_str} to {receiver}"
        if receiver_is_user and not sender_is_user:
            return f"received {amount_str} from {sender}"
        if not sender_is_user and not receiver_is_user:
            return f"{sender} gave {amount_str} to {receiver}"
        # Both User — handled by validator elsewhere; format defensively
        return f"transferred {amount_str}"

    # Fallback: legacy direction + person interpretation
    direction = getattr(t, "direction", None)
    person    = getattr(t, "person",    None)

    if direction == "third_party":
        # Best-effort: we have one name but not both
        if person:
            return f"third-party transfer of {amount_str} involving {person}"
        return f"third-party transfer of {amount_str}"

    if direction == "received":
        return f"received {amount_str}" + (f" from {person}" if person else "")

    # Default: "given"
    return f"given {amount_str}" + (f" to {person}" if person else "")

def _build_confirmation_prompt(extraction, transcript: str) -> str:
    """Human-readable summary of what would be saved."""
    if extraction.has_transaction and extraction.transactions:
        parts = [_format_one_transaction(t) for t in extraction.transactions]
        body = "; ".join(parts)
        date_str = f" on {extraction.date}" if extraction.date else ""
        return f"I heard: {body}{date_str}. Save it? Say yes or no."

    if extraction.target_entity == "asset":
        return f"I heard: bought asset '{extraction.asset}'. Save it?"
    if extraction.target_entity == "stored_item":
        return f"I heard: '{extraction.item}' is in '{extraction.location}'. Save it?"
    if extraction.target_entity == "reminder":
        when = (f"{extraction.date} {extraction.time}"
                if extraction.date and extraction.time
                else extraction.date or extraction.time or "")
        return f"I heard: reminder for '{transcript}' at {when}. Save it?"

    return f"I heard: '{transcript}'. Save it?"


# ════════════════════════════════════════════════════════════════════
# PUBLIC API
# ════════════════════════════════════════════════════════════════════

def process(user_id: int,
            transcript: Optional[str] = None,
            audio_path: Optional[str] = None) -> dict:
    """Process voice or text input through the full pipeline.

    Args:
      user_id: caller
      transcript: optional pre-transcribed text (for /voice/process with text)
      audio_path: optional path to audio file (for actual STT)

    Returns:
      Response dict to send back to client. Includes voice_entry_id,
      transcript, intent, entities, awaiting_confirm, confirmation_prompt
      (if confirm needed), or saved IDs (if auto-saved).
    """
    if not transcript and not audio_path:
        raise HTTPError("Provide 'transcript' or 'audio_path'", 400)

    # 1. STT (skip if transcript provided)
    if not transcript:
        try:
            transcript = transcribe(audio_path)
        except FileNotFoundError as e:
            raise HTTPError(str(e), 400)
        except RuntimeError as e:
            raise HTTPError(f"Transcription failed: {e}", 500)
    if not transcript or not transcript.strip():
        raise HTTPError("Empty transcript", 400)

    # 2. Intent classification
    intent_result = classify(transcript)
    intent     = intent_result["intent"]
    confidence = intent_result["confidence"]

    # 2b. Handle queries immediately
    if intent == "query":
        from . import query_service
        resp = query_service.ask(user_id, transcript, input_source="voice")
        return {
            "transcript": transcript,
            "intent": intent,
            "intent_confidence": confidence,
            "awaiting_confirm": False,
            "answer": resp["answer"],
            "result": resp.get("facts"),
        }

    # 3. NER extraction
    extractor  = SmartDiaryExtractor()
    extraction = extractor.extract(transcript, intent=intent)

    # 4. Build voice_entry row
    entities_json = json.dumps(extraction.to_dict(), default=str)
    needs_confirm = _needs_confirmation(extraction, intent)

    v = VoiceEntry(
        user_id=user_id,
        audio_path=audio_path,
        transcript=transcript,
        intent=intent,
        target_entity=extraction.target_entity,
        entities_json=entities_json,
        confidence=confidence,
        model_used=f"whisper+distilbert+ner_v2",
        awaiting_confirm=needs_confirm,
        confirmed=None,
        is_active=True,
    )
    db.session.add(v)
    db.session.flush()

    # 5. Auto-save path
    if not needs_confirm:
        persist_result = persist_extraction(user_id, transcript, extraction,
                                            voice_entry_id=v.voice_entry_id)
        triples = generate_triples(extraction)
        triple_count = persist_triples(user_id, persist_result.get("note_id"), triples)
        v.confirmed = True
        v.awaiting_confirm = False
        db.session.commit()
        return {
            "voice_entry_id": v.voice_entry_id,
            "transcript": transcript,
            "intent": intent,
            "intent_confidence": confidence,
            "target_entity": extraction.target_entity,
            "entities": extraction.to_dict(),
            "awaiting_confirm": False,
            "auto_saved": True,
            "persisted": persist_result,
            "triple_count": triple_count,
        }

    # 6. Confirmation path — return prompt, defer persistence
    db.session.commit()
    return {
        "voice_entry_id": v.voice_entry_id,
        "transcript": transcript,
        "intent": intent,
        "intent_confidence": confidence,
        "target_entity": extraction.target_entity,
        "entities": extraction.to_dict(),
        "awaiting_confirm": True,
        "confirmation_prompt": _build_confirmation_prompt(extraction, transcript),
    }


def confirm(user_id: int, voice_entry_id: int, confirmed: bool) -> dict:
    """Resolve a pending voice_entry by saving (yes) or rejecting (no)."""
    v = VoiceEntry.query.filter_by(voice_entry_id=voice_entry_id,
                                   user_id=user_id, is_active=True).first()
    if not v:
        raise HTTPError("Voice entry not found", 404)
    if not v.awaiting_confirm:
        raise HTTPError("Voice entry is not awaiting confirmation", 400)

    if not confirmed:
        v.confirmed = False
        v.awaiting_confirm = False
        db.session.commit()
        return {
            "voice_entry_id": v.voice_entry_id,
            "confirmed": False,
            "saved": False,
        }

    # Yes → Execute action based on intent
    extractor  = SmartDiaryExtractor()
    extraction = extractor.extract(v.transcript, intent=v.intent or "")
    
    if v.intent == "update":
        from .voice_crud import handle_update
        msg = handle_update(user_id, v.transcript, extraction)
        v.confirmed = True
        v.awaiting_confirm = False
        db.session.commit()
        return {
            "voice_entry_id": v.voice_entry_id,
            "confirmed": True,
            "saved": True,
            "message": msg
        }
    elif v.intent == "delete":
        from .voice_crud import handle_delete
        msg = handle_delete(user_id, v.transcript, extraction)
        v.confirmed = True
        v.awaiting_confirm = False
        db.session.commit()
        return {
            "voice_entry_id": v.voice_entry_id,
            "confirmed": True,
            "saved": True,
            "message": msg
        }
    else:
        # Default store path
        persist_result = persist_extraction(user_id, v.transcript, extraction,
                                            voice_entry_id=v.voice_entry_id)
        triples = generate_triples(extraction)
        triple_count = persist_triples(user_id, persist_result.get("note_id"), triples)

        v.confirmed = True
        v.awaiting_confirm = False
        db.session.commit()

        return {
            "voice_entry_id": v.voice_entry_id,
            "confirmed": True,
            "saved": True,
            "persisted": persist_result,
            "triple_count": triple_count,
        }
