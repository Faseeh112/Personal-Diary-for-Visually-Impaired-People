"""Speech-to-text using faster-whisper small.en (offline).

The backend takes an audio FILE as input. Recording from a microphone
belongs on the client (mobile app, web app), not the backend. This module
exposes only one public function: transcribe(audio_path) -> str.

For local dev/demo recording, see record_demo.py.

CLI:
    python -m app.ai.stt path/to/audio.wav
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional

from .loader import get_whisper


def transcribe(audio_path: str | Path) -> str:
    """Transcribe an audio file to text.

    Args:
        audio_path: path to wav/mp3/flac/etc. Anything ffmpeg can read.

    Returns:
        The transcribed text, stripped of leading/trailing whitespace.

    Raises:
        FileNotFoundError if the audio file does not exist.
        RuntimeError if Whisper fails to process the file.
    """
    p = Path(audio_path)
    if not p.exists():
        raise FileNotFoundError(f"Audio file not found: {p}")
    if not p.is_file():
        raise FileNotFoundError(f"Not a file: {p}")

    model = get_whisper()
    try:
        segments, _info = model.transcribe(str(p))
        text = " ".join(seg.text for seg in segments).strip()
        return text
    except Exception as e:
        raise RuntimeError(f"Whisper transcription failed: {e}") from e


def transcribe_with_metadata(audio_path: str | Path) -> dict:
    """Transcribe and return text + metadata (language, duration, segments).

    Returns:
        {
          "text": str,
          "language": str,
          "duration": float,
          "segment_count": int,
        }
    """
    p = Path(audio_path)
    if not p.exists():
        raise FileNotFoundError(f"Audio file not found: {p}")

    model = get_whisper()
    segments, info = model.transcribe(str(p))
    seg_list = list(segments)
    return {
        "text":          " ".join(s.text for s in seg_list).strip(),
        "language":      info.language,
        "duration":      info.duration,
        "segment_count": len(seg_list),
    }


def _cli(argv: list[str]) -> int:
    if len(argv) < 1:
        print("usage: python -m app.ai.stt <audio_file>", file=sys.stderr)
        return 2
    audio_path = argv[0]
    try:
        result = transcribe_with_metadata(audio_path)
    except FileNotFoundError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    print(f"language: {result['language']}")
    print(f"duration: {result['duration']:.2f}s")
    print(f"segments: {result['segment_count']}")
    print()
    print(result["text"])
    return 0


if __name__ == "__main__":
    sys.exit(_cli(sys.argv[1:]))
