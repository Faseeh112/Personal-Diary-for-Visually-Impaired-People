"""AI module configuration. All paths can be overridden via environment vars.

Defaults are anchored to this file's own directory (app/ai/) so the project
works on any machine without manual path edits:
  - Intent model:  app/ai/intent_model/      (DistilBERT, local fine-tuned)
  - Whisper model: 'small.en'                (downloaded into HF cache on first use)
  - Ollama:        http://localhost:11434

To override any path, set the matching env var in `.env`.
"""
import os

# Absolute directory of this config.py — anchor for all relative paths.
_AI_DIR = os.path.dirname(os.path.abspath(__file__))


# ── DistilBERT intent classifier ─────────────────────────────────
INTENT_MODEL_PATH = os.getenv(
    "INTENT_MODEL_PATH",
    os.path.join(_AI_DIR, "intent_model"),
)
INTENT_LABELS = {0: "store", 1: "query", 2: "update", 3: "delete", 4: "reminder"}


# ── Whisper STT ──────────────────────────────────────────────────
WHISPER_MODEL_NAME = os.getenv("WHISPER_MODEL_NAME", "small.en")
WHISPER_DEVICE     = os.getenv("WHISPER_DEVICE",     "cpu")
WHISPER_COMPUTE    = os.getenv("WHISPER_COMPUTE",    "float32")


# ── Ollama (Phase 3 batch 3 will use this) ──────────────────────
OLLAMA_HOST  = os.getenv("OLLAMA_HOST",  "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "phi3:mini")


# ── Audio recording (used by record_demo.py only) ────────────────
AUDIO_RATE         = 16000
AUDIO_CHANNELS     = 1
AUDIO_DEVICE_INDEX = int(os.getenv("AUDIO_DEVICE_INDEX", "1"))