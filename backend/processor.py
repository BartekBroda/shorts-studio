import threading
from pathlib import Path


def _progress_wrap(fn, on_progress):
    """Run fn(), capturing print() output and forwarding to on_progress."""
    import io, sys
    buf = io.StringIO()
    old = sys.stdout
    sys.stdout = buf
    try:
        fn()
    finally:
        sys.stdout = old
    if on_progress:
        for line in buf.getvalue().splitlines():
            if line.strip():
                on_progress(line.strip())


def transcribe(wav_path: str, out_dir: str, language: str = "pl", on_progress=None) -> str:
    from backend.helpers.transcribe_local import transcribe as _transcribe
    from backend.config import load_config
    cfg = load_config()
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    stem = Path(wav_path).stem
    json_path = out / f"{stem}.json"
    if json_path.exists():
        return str(json_path)
    try:
        _progress_wrap(
            lambda: _transcribe(
                wav_path, str(json_path), language,
                whisper_cli=cfg.get("whisper_cli", ""),
                model=cfg.get("whisper_model", ""),
            ),
            on_progress,
        )
    except SystemExit as e:
        raise RuntimeError(f"transcribe_local exited with code {e.code}")
    return str(json_path)


def audiogram(wav_path: str, out_dir: str, on_progress=None) -> str:
    from backend.helpers.audiogram import audiogram as _audiogram
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    mp4_path = out / "audiogram.mp4"
    if mp4_path.exists():
        return str(mp4_path)
    _audiogram(wav_path, str(mp4_path), on_progress=on_progress)
    return str(mp4_path)


def process_clip_async(wav_path: str, edit_dir: str, on_progress=None, on_done=None) -> None:
    def _work():
        try:
            transcribe(wav_path, str(Path(edit_dir) / "transcripts"), on_progress=on_progress)
            audiogram(wav_path, edit_dir, on_progress=on_progress)
            if on_done:
                on_done(None)
        except Exception as e:
            import traceback
            traceback.print_exc()
            if on_done:
                try:
                    on_done(str(e))
                except Exception:
                    traceback.print_exc()
    threading.Thread(target=_work, daemon=True).start()
