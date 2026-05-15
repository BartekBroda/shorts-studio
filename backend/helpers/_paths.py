"""Resolve tool paths, preferring Homebrew when running as a .app bundle."""
from pathlib import Path


def _find(name: str, candidates: list[str]) -> str:
    for p in candidates:
        if Path(p).exists():
            return p
    return name  # fallback: hope it's on PATH


FFMPEG = _find("ffmpeg", ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"])
FFPROBE = _find("ffprobe", ["/opt/homebrew/bin/ffprobe", "/usr/local/bin/ffprobe"])
