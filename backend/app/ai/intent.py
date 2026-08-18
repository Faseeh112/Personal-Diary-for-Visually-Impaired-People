"""Intent classification using fine-tuned DistilBERT.

Labels: store | query | update | delete | reminder

CLI:
    python -m app.ai.intent "I gave 500 to Ali"
    python -m app.ai.intent "how much did I spend on shahid wedding"
"""
from __future__ import annotations

import sys
from typing import Optional

from .config import INTENT_LABELS
from .loader import get_intent_model


def classify(text: str) -> dict:
    """Classify intent of a text utterance.

    Args:
        text: the user's spoken or typed sentence.

    Returns:
        {
          "intent": "store" | "query" | "update" | "delete" | "reminder",
          "confidence": float in [0.0, 1.0],
          "all_scores": {label: float, ...}  -- soft probabilities per label
        }

    Raises:
        ValueError on empty input.
    """
    import torch  # local import: keeps module import light

    if not text or not text.strip():
        raise ValueError("Empty text passed to classify()")

    tokenizer, model = get_intent_model()
    inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True)

    with torch.no_grad():
        outputs = model(**inputs)
        probs = torch.softmax(outputs.logits, dim=1)[0]
        confidence, pred_id = torch.max(probs, dim=0)

    return {
        "intent":     INTENT_LABELS[pred_id.item()],
        "confidence": round(confidence.item(), 4),
        "all_scores": {
            INTENT_LABELS[i]: round(probs[i].item(), 4)
            for i in range(len(INTENT_LABELS))
        },
    }


def classify_batch(texts: list[str]) -> list[dict]:
    """Classify multiple texts in one forward pass. Faster for tests."""
    import torch
    if not texts:
        return []
    cleaned = [t for t in texts if t and t.strip()]
    if not cleaned:
        return []

    tokenizer, model = get_intent_model()
    inputs = tokenizer(cleaned, return_tensors="pt", truncation=True, padding=True)

    with torch.no_grad():
        outputs = model(**inputs)
        probs = torch.softmax(outputs.logits, dim=1)
        confidences, pred_ids = torch.max(probs, dim=1)

    return [
        {
            "intent":     INTENT_LABELS[pred_ids[i].item()],
            "confidence": round(confidences[i].item(), 4),
            "all_scores": {
                INTENT_LABELS[j]: round(probs[i][j].item(), 4)
                for j in range(len(INTENT_LABELS))
            },
        }
        for i in range(len(cleaned))
    ]


def _cli(argv: list[str]) -> int:
    if not argv:
        print("usage: python -m app.ai.intent <text>", file=sys.stderr)
        return 2
    text = " ".join(argv)
    result = classify(text)
    print(f"text:       {text}")
    print(f"intent:     {result['intent']}")
    print(f"confidence: {result['confidence']:.4f}")
    print("scores:")
    for label, score in sorted(result["all_scores"].items(),
                               key=lambda kv: -kv[1]):
        bar = "#" * int(score * 30)
        print(f"  {label:10s} {score:.4f}  {bar}")
    return 0


if __name__ == "__main__":
    sys.exit(_cli(sys.argv[1:]))
