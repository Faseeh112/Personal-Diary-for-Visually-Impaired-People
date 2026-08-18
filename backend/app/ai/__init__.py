"""Smart Diary AI modules.

Each module is independently runnable for development:
  python -m app.ai.stt path/to/audio.wav
  python -m app.ai.intent "I gave 500 to Ali"

Models are lazy-loaded on first use to keep app startup fast.
"""
