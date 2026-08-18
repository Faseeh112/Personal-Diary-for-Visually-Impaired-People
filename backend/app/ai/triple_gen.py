"""Triple generator: ExtractionResult → list of (subject, predicate, object) DTOs.

These triples populate the knowledge_triple table. The query engine in
batch 3 reads them to answer questions.

Design:
  - Event-centric: each transaction creates ONE event node and several
    triples that describe it (actor, action, target, amount, currency, date).
  - Asset cost stored as separate triple ("Gold ring" cost "50000")
  - Stored items get a single "stored_in" triple
  - Pure-receive without amount (gift only) still emits an event

CLI:
    python -m app.ai.triple_gen "I gave 5000 to Ali at Shahid's wedding"
"""
from __future__ import annotations

import sys
from dataclasses import dataclass
from typing import Optional
from uuid import uuid4

from .ner import SmartDiaryExtractor, ExtractionResult, _RECEIVE_PATTERN


@dataclass
class KnowledgeTripleDTO:
    subject_text: str
    subject_type: Optional[str]
    predicate: str
    object_text: str
    object_type: Optional[str]
    confidence: float = 0.0
    context_group: Optional[str] = None  # so all triples from one event share a key

    def to_dict(self) -> dict:
        return {
            "subject_text": self.subject_text,
            "subject_type": self.subject_type,
            "predicate":    self.predicate,
            "object_text":  self.object_text,
            "object_type":  self.object_type,
            "confidence":   self.confidence,
            "context_group": self.context_group,
        }


def generate_triples(result: ExtractionResult) -> list[KnowledgeTripleDTO]:
    """Build the full triple list for an extraction result."""
    triples: list[KnowledgeTripleDTO] = []

    # ── Per-transaction events ───────────────────────────────────
    for txn in result.transactions:
        ev_id = f"event_{uuid4().hex[:8]}"
        ctx = ev_id

        triples.append(KnowledgeTripleDTO(ev_id, "event", "actor", "User", "user", 1.0, ctx))
        action = "gave" if txn.direction == "given" else "received"
        triples.append(KnowledgeTripleDTO(ev_id, "event", "action", action, "action", txn.confidence, ctx))

        if txn.person:
            triples.append(KnowledgeTripleDTO(ev_id, "event", "target", txn.person, "person", 0.85, ctx))

        triples.append(KnowledgeTripleDTO(
            ev_id, "event", "amount", str(txn.amount), "amount", txn.confidence, ctx,
        ))
        triples.append(KnowledgeTripleDTO(
            ev_id, "event", "currency", txn.currency, "currency", 0.9, ctx,
        ))

        if result.date:
            triples.append(KnowledgeTripleDTO(
                ev_id, "event", "date", result.date, "date",
                result.confidence.get("date", 0.0), ctx,
            ))

        if result.asset:
            predicate = "received_gift" if txn.direction == "received" else "bought"
            triples.append(KnowledgeTripleDTO(
                ev_id, "event", predicate, result.asset, "asset",
                result.confidence.get("asset", 0.0), ctx,
            ))

        if result.category:
            triples.append(KnowledgeTripleDTO(
                ev_id, "event", "category", result.category, "category",
                result.confidence.get("category", 0.0), ctx,
            ))

    # ── Asset cost (linked to first 'given' txn) ─────────────────
    if result.asset and result.transactions:
        given = [t for t in result.transactions if t.direction == "given"]
        if given:
            triples.append(KnowledgeTripleDTO(
                result.asset, "asset", "cost", str(given[0].amount), "amount",
                given[0].confidence,
            ))

    # ── Stored item → location ───────────────────────────────────
    if result.item and result.location:
        triples.append(KnowledgeTripleDTO(
            result.item, "stored_item", "stored_in", result.location, "location",
            result.confidence.get("location", 0.0),
        ))

    # ── Pure gift: asset received with no amount ─────────────────
    if result.asset and not result.transactions:
        if _RECEIVE_PATTERN.search(result.raw_text) or result.persons:
            ev_id = f"event_{uuid4().hex[:8]}"
            ctx = ev_id
            triples.append(KnowledgeTripleDTO(ev_id, "event", "actor", "User", "user", 1.0, ctx))
            triples.append(KnowledgeTripleDTO(
                ev_id, "event", "received_gift", result.asset, "asset",
                result.confidence.get("asset", 0.0), ctx,
            ))
            if result.persons:
                triples.append(KnowledgeTripleDTO(
                    ev_id, "event", "target", result.persons[0], "person", 0.8, ctx,
                ))
            if result.date:
                triples.append(KnowledgeTripleDTO(
                    ev_id, "event", "date", result.date, "date",
                    result.confidence.get("date", 0.0), ctx,
                ))

    return triples


def _cli(argv: list[str]) -> int:
    if not argv:
        print('usage: python -m app.ai.triple_gen "<text>" [intent]', file=sys.stderr)
        return 2
    text = argv[0]
    intent = argv[1] if len(argv) > 1 else "store"

    ex = SmartDiaryExtractor()
    result = ex.extract(text, intent=intent)
    triples = generate_triples(result)

    print(f"text: {text!r}")
    print(f"target_entity: {result.target_entity}  note_type: {result.note_type}")
    print(f"\n{len(triples)} triples generated:\n")
    for i, t in enumerate(triples, 1):
        ctx_short = (t.context_group[:14] + "..") if t.context_group and len(t.context_group) > 14 else (t.context_group or "")
        print(f"  {i:2d}. {t.subject_text:25s} -[{t.predicate:15s}]-> {t.object_text:30s}  ({t.subject_type or '?':>10s} → {t.object_type or '?':<8s})  ctx={ctx_short}  conf={t.confidence:.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(_cli(sys.argv[1:]))
