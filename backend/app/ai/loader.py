"""Lazy model loaders.

Models are large (Whisper ~500MB, DistilBERT ~270MB). Loading them at
import time slows down every test, every Flask boot, every CLI invocation.
We load on first use and cache the singleton.

Each loader is independent — importing app.ai.intent does NOT trigger
Whisper to load, and vice versa.
"""
from typing import Optional, Any
from . import config


# ── Whisper ─────────────────────────────────────────────────────
_whisper_model: Optional[Any] = None


def get_whisper():
    """Returns a faster-whisper WhisperModel singleton."""
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        _whisper_model = WhisperModel(
            config.WHISPER_MODEL_NAME,
            device=config.WHISPER_DEVICE,
            compute_type=config.WHISPER_COMPUTE,
        )
    return _whisper_model


# ── DistilBERT intent classifier ────────────────────────────────
_intent_tokenizer: Optional[Any] = None
_intent_model: Optional[Any] = None


def get_intent_model():
    """Returns (tokenizer, model) singletons. Model in eval() mode."""
    global _intent_tokenizer, _intent_model
    if _intent_model is None:
        from transformers import AutoTokenizer, AutoModelForSequenceClassification
        _intent_tokenizer = AutoTokenizer.from_pretrained(config.INTENT_MODEL_PATH)
        _intent_model = AutoModelForSequenceClassification.from_pretrained(
            config.INTENT_MODEL_PATH
        )
        _intent_model.eval()
    return _intent_tokenizer, _intent_model


def reset_models() -> None:
    """Test/dev hook: forces the next get_*() call to reload from disk."""
    global _whisper_model, _intent_tokenizer, _intent_model
    _whisper_model = None
    _intent_tokenizer = None
    _intent_model = None
