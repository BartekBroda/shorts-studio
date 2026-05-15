import subprocess
import threading
from pathlib import Path
from typing import Callable

from backend.helpers._paths import FFMPEG


def compose(
    bg_path: str,
    audio_path: str,
    logo_path: str,
    audiogram_path: str,
    subtitle_frames_path: str,
    out_path: str,
    bg_start: str = "0:00",
    logo_size: int = 833,
    logo_gap: int = 140,
    total_frames: int = 0,
    on_progress: Callable[[str], None] | None = None,
) -> None:
    parts = bg_start.strip().split(":")
    bg_start_sec = int(parts[0]) * 60 + float(parts[1]) if len(parts) == 2 else float(parts[0])

    has_logo = bool(logo_path) and Path(logo_path).exists()

    if has_logo:
        logo_filter = (
            f"[2:v]scale={logo_size}:-2[logo];"
            f"[base][logo]overlay=(W-w)/2:{logo_gap}[with_logo]"
        )
        audiogram_filter = (
            "[3:v]colorkey=0x000000:0.1:0.1[ag];"
            "[with_logo][ag]overlay=0:H-h:eof_action=repeat[with_ag]"
        )
        subtitle_filter = "[with_ag][4:v]overlay=0:0:eof_action=repeat[out]"
        full_filter = (
            "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,"
            "crop=1080:1920[base];"
            + logo_filter + ";"
            + audiogram_filter + ";"
            + subtitle_filter
        )
        inputs = [
            "-ss", str(bg_start_sec), "-stream_loop", "-1", "-i", bg_path,
            "-i", audio_path,
            "-i", logo_path,
            "-i", audiogram_path,
            "-i", subtitle_frames_path,
        ]
    else:
        audiogram_filter = (
            "[2:v]colorkey=0x000000:0.1:0.1[ag];"
            "[base][ag]overlay=0:H-h:eof_action=repeat[with_ag]"
        )
        subtitle_filter = "[with_ag][3:v]overlay=0:0:eof_action=repeat[out]"
        full_filter = (
            "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,"
            "crop=1080:1920[base];"
            + audiogram_filter + ";"
            + subtitle_filter
        )
        inputs = [
            "-ss", str(bg_start_sec), "-stream_loop", "-1", "-i", bg_path,
            "-i", audio_path,
            "-i", audiogram_path,
            "-i", subtitle_frames_path,
        ]

    cmd = [
        FFMPEG, "-y", "-loglevel", "error",
        *inputs,
        "-filter_complex", full_filter,
        "-map", "[out]", "-map", "1:a",
        "-c:v", "hevc_videotoolbox", "-q:v", "60", "-tag:v", "hvc1",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        "-progress", "pipe:1",
        "-nostats",
        out_path,
    ]

    stderr_lines: list[str] = []

    def _drain_stderr() -> None:
        if proc.stderr:
            for line in proc.stderr:
                stderr_lines.append(line)

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    drain = threading.Thread(target=_drain_stderr, daemon=True)
    drain.start()

    for line in proc.stdout:
        line = line.strip()
        if line.startswith("frame=") and on_progress and total_frames > 0:
            try:
                frame = int(line.split("=", 1)[1])
                pct = min(99, int(frame / total_frames * 100))
                on_progress(f"{pct}%")
            except (ValueError, IndexError):
                pass

    proc.wait()
    drain.join(timeout=5)

    if proc.returncode != 0:
        err = "".join(stderr_lines)
        raise RuntimeError(err[-2000:] if err else "ffmpeg failed")
