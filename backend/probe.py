import json
import subprocess
from pathlib import Path

from backend.helpers._paths import FFPROBE

VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".mxf"}
AUDIO_EXTS = {".wav"}


def _run_ffprobe(path: str) -> str:
    try:
        result = subprocess.run(
            [
                FFPROBE, "-v", "quiet", "-print_format", "json",
                "-show_format", path,
            ],
            capture_output=True, text=True, check=True,
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        raise RuntimeError(
            f"ffprobe failed on '{path}' (exit {e.returncode}): {e.stderr.strip()}"
        ) from e


def probe_duration(path: str) -> float:
    data = json.loads(_run_ffprobe(path))
    return float(data["format"]["duration"])


def _probe_entry(path: Path) -> dict:
    try:
        duration = probe_duration(str(path))
    except Exception:
        duration = 0.0
    return {"name": path.name, "path": str(path), "duration": duration}


def list_video_files(folder: str | None) -> list[dict]:
    if not folder:
        return []
    p = Path(folder)
    if not p.is_dir():
        return []
    files = sorted(f for f in p.iterdir() if f.suffix.lower() in VIDEO_EXTS)
    return [_probe_entry(f) for f in files]


def list_wav_files(folder: str | None) -> list[dict]:
    if not folder:
        return []
    p = Path(folder)
    if not p.is_dir():
        return []
    files = sorted(f for f in p.iterdir() if f.suffix.lower() in AUDIO_EXTS)
    return [_probe_entry(f) for f in files]
