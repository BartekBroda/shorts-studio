import json
import os
import threading
from pathlib import Path

from backend.config import load_config, save_config
from backend.probe import list_video_files, list_wav_files, probe_duration
from backend.matcher import match_assets
from backend.processor import process_clip_async
from backend.subtitle_renderer import render_subtitle_track
from backend.composer import compose

_MAX_AUDIO_BYTES = 200 * 1024 * 1024  # 200 MB


class API:
    # ── config ───────────────────────────────────────────────────────────────

    def get_config(self) -> dict:
        return load_config()

    def set_bg_library(self, path: str) -> dict:
        cfg = load_config()
        cfg["bg_library"] = path
        save_config(cfg)
        return {"ok": True}

    def set_whisper_config(self, whisper_cli: str, whisper_model: str) -> dict:
        cfg = load_config()
        cfg["whisper_cli"] = whisper_cli
        cfg["whisper_model"] = whisper_model
        save_config(cfg)
        return {"ok": True}

    # ── BG library ───────────────────────────────────────────────────────────

    def list_bg_library(self) -> list:
        cfg = load_config()
        return list_video_files(cfg.get("bg_library") or "")

    # ── projects ──────────────────────────────────────────────────────────────

    def open_project(self, folder_path: str) -> dict:
        """Open or create a project from a folder. Auto-detects name, logo, WAVs."""
        folder = Path(folder_path)
        if not folder.is_dir():
            return {"error": "not a directory"}

        meta_path = folder / "metadata.json"
        if meta_path.exists():
            with open(meta_path) as f:
                meta = json.load(f)
            if "pairings" in meta:
                meta["pairings"] = [_normalize_pairing(p) for p in meta["pairings"]]
        else:
            # auto-detect logo: first PNG in folder
            logo = ""
            try:
                for f in sorted(folder.iterdir()):
                    if f.suffix.lower() == ".png":
                        logo = str(f)
                        break
            except PermissionError:
                pass
            meta = {
                "name": folder.name,
                "wav_source": str(folder),
                "logo": logo,
                "font_size": 72,
                "highlight_color": "#FEB902",
                "max_words": 3,
                "pairings": [],
            }
            with open(meta_path, "w") as f:
                json.dump(meta, f, indent=2, ensure_ascii=False)

        # auto-fill logo if missing
        if not meta.get("logo"):
            try:
                for f in sorted(folder.iterdir()):
                    if f.suffix.lower() == ".png":
                        meta["logo"] = str(f)
                        break
            except PermissionError:
                pass

        # add to recent projects (most recent first)
        cfg = load_config()
        recent = [p for p in cfg.get("recent_projects", []) if p != folder_path]
        recent.insert(0, folder_path)
        cfg["recent_projects"] = recent[:20]
        save_config(cfg)

        _reset_running_statuses(folder)
        clips = _scan_clips(folder, meta)
        return {"id": folder_path, "path": folder_path, "meta": meta, "clips": clips}

    def list_episodes(self) -> list:
        cfg = load_config()
        episodes = []
        for path_str in cfg.get("recent_projects", []):
            folder = Path(path_str)
            if not folder.is_dir():
                continue
            meta_path = folder / "metadata.json"
            if not meta_path.exists():
                continue
            with open(meta_path) as f:
                meta = json.load(f)
            if "pairings" in meta:
                meta["pairings"] = [_normalize_pairing(p) for p in meta["pairings"]]
            clips = _scan_clips(folder, meta)
            episodes.append({"id": path_str, "path": path_str, "meta": meta, "clips": clips})
        return episodes

    def save_episode_meta(self, episode_id: str, meta: dict) -> dict:
        ep_dir = Path(episode_id)
        _save_meta(ep_dir, meta)
        return {"ok": True}

    def remove_project(self, episode_id: str) -> dict:
        """Remove from recent list without deleting files."""
        cfg = load_config()
        cfg["recent_projects"] = [p for p in cfg.get("recent_projects", []) if p != episode_id]
        save_config(cfg)
        return {"ok": True}

    # ── WAV source ───────────────────────────────────────────────────────────

    def list_wav_source(self, episode_id: str) -> list:
        """WAVs live directly in the project folder."""
        return list_wav_files(episode_id)

    # ── matching ─────────────────────────────────────────────────────────────

    def match_assets(self, wavs: list, bgs: list) -> list:
        raw = match_assets(wavs, bgs)
        result = []
        for p in raw:
            wav = p["wav"]
            bg = p["bg"] or {}
            result.append({
                "wav_name": wav["name"],
                "wav_path": wav["path"],
                "wav_duration": wav["duration"],
                "bg_name": bg.get("name", ""),
                "bg_path": bg.get("path", ""),
                "bg_duration": bg.get("duration", 0),
                "bg_start": p["bg_start"],
                "loops": p["loops"],
            })
        return result

    # ── processing ───────────────────────────────────────────────────────────

    def process_clip(self, episode_id: str, clip_name: str, force: bool = False, force_audiogram: bool = False) -> dict:
        ep_dir = Path(episode_id)
        meta = _load_meta(ep_dir)

        pairing = next((p for p in meta.get("pairings", []) if p["wav_name"] == clip_name), None)
        if pairing is None:
            return {"error": "clip not found in pairings"}

        wav_path = pairing["wav_path"]
        edit_dir = ep_dir / "edit" / _clip_slot(clip_name)
        edit_dir.mkdir(parents=True, exist_ok=True)

        if force:
            # Re-transcribe: wipe transcript only, keep audiogram unless also forced
            for f in list((edit_dir / "transcripts").glob("*.json") if (edit_dir / "transcripts").exists() else []):
                f.unlink()
        if force or force_audiogram:
            ag = edit_dir / "audiogram.mp4"
            if ag.exists():
                ag.unlink()

        status_path = edit_dir / "status.json"
        _write_status(status_path, {"state": "running", "progress": ""})

        def on_progress(line):
            _write_status(status_path, {"state": "running", "progress": line})

        def on_done(err):
            if err:
                _write_status(status_path, {"state": "error", "progress": err})
            else:
                _write_status(status_path, {"state": "done", "progress": ""})

        process_clip_async(wav_path, str(edit_dir), on_progress=on_progress, on_done=on_done)
        return {"ok": True}

    def get_clip_status(self, episode_id: str, clip_name: str) -> dict:
        ep_dir = Path(episode_id)
        edit_dir = ep_dir / "edit" / _clip_slot(clip_name)
        status_path = edit_dir / "status.json"
        if not status_path.exists():
            return {"state": "idle", "progress": ""}
        try:
            with open(status_path) as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return {"state": "idle", "progress": ""}

    # ── transcripts ──────────────────────────────────────────────────────────

    def load_transcript(self, episode_id: str, clip_name: str) -> dict:
        ep_dir = Path(episode_id)
        edit_dir = ep_dir / "edit" / _clip_slot(clip_name)
        stem = Path(clip_name).stem
        json_path = edit_dir / "transcripts" / f"{stem}.json"
        if not json_path.exists():
            return {"words": [], "groups": []}
        with open(json_path) as f:
            data = json.load(f)
        return {"words": data.get("words", []), "groups": data.get("groups", [])}

    def save_transcript(self, episode_id: str, clip_name: str, words: list, groups: list) -> dict:
        ep_dir = Path(episode_id)
        edit_dir = ep_dir / "edit" / _clip_slot(clip_name)
        stem = Path(clip_name).stem
        json_path = edit_dir / "transcripts" / f"{stem}.json"
        json_path.parent.mkdir(parents=True, exist_ok=True)
        with open(json_path, "w") as f:
            json.dump({"words": words, "groups": groups}, f, indent=2, ensure_ascii=False)
        return {"ok": True}

    # ── render ───────────────────────────────────────────────────────────────

    def render_clip(self, episode_id: str, clip_name: str) -> dict:
        """Start async render. Poll get_render_status for progress."""
        ep_dir = Path(episode_id)
        meta = _load_meta(ep_dir)
        pairing = next((p for p in meta.get("pairings", []) if p["wav_name"] == clip_name), None)
        if not pairing:
            return {"error": "pairing not found"}

        edit_dir = ep_dir / "edit" / _clip_slot(clip_name)
        stem = Path(clip_name).stem
        status_path = edit_dir / "render_status.json"

        transcript_path = edit_dir / "transcripts" / f"{stem}.json"
        if not transcript_path.exists():
            return {"error": "transcript not found — process clip first"}

        _write_status(status_path, {"state": "running", "progress": "starting…"})

        def _work():
            try:
                with open(transcript_path) as f:
                    tdata = json.load(f)
                words = tdata.get("words", [])
                groups = tdata.get("groups", [])
                duration = probe_duration(pairing["wav_path"])
                total_frames = int(duration * 30)

                font_size = meta.get("font_size", 72)
                logo_size = meta.get("logo_size", 833)
                logo_gap  = meta.get("logo_gap", 140)
                if "subtitle_y_pct" in meta:
                    subtitle_y = int(meta["subtitle_y_pct"] * 1920)
                else:
                    logo_bottom = logo_gap + logo_size
                    audiogram_top = 1920 - 512
                    row_h_approx = font_size + 30
                    midpoint = logo_bottom + (audiogram_top - logo_bottom) // 2
                    subtitle_y = midpoint - row_h_approx // 2

                subs_path = str(edit_dir / "subtitle_frames.mov")
                highlight_color = _hex_to_rgba(meta.get("highlight_color", "#FEB902"))

                def on_sub_progress(msg):
                    _write_status(status_path, {"state": "running", "progress": msg})

                render_subtitle_track(
                    words=words, groups=groups, duration=duration,
                    subtitle_y=subtitle_y, out_path=subs_path,
                    font_size=font_size, max_words=meta.get("max_words", 3),
                    on_progress=on_sub_progress,
                    highlight_color=highlight_color,
                )

                out_path = str(ep_dir / f"{stem}.mp4")

                def on_compose_progress(msg):
                    _write_status(status_path, {"state": "running", "progress": f"compose {msg}"})

                compose(
                    bg_path=pairing["bg_path"],
                    audio_path=pairing["wav_path"],
                    logo_path=meta.get("logo", ""),
                    audiogram_path=str(edit_dir / "audiogram.mp4"),
                    subtitle_frames_path=subs_path,
                    out_path=out_path,
                    bg_start=pairing.get("bg_start", "0:00"),
                    logo_size=logo_size,
                    logo_gap=logo_gap,
                    total_frames=total_frames,
                    on_progress=on_compose_progress,
                )
                _write_status(status_path, {"state": "done", "progress": "100%", "out_path": out_path})
            except Exception as e:
                _write_status(status_path, {"state": "error", "progress": str(e)[:500]})

        threading.Thread(target=_work, daemon=True).start()
        return {"ok": True}

    def get_render_status(self, episode_id: str, clip_name: str) -> dict:
        ep_dir = Path(episode_id)
        edit_dir = ep_dir / "edit" / _clip_slot(clip_name)
        status_path = edit_dir / "render_status.json"
        if not status_path.exists():
            return {"state": "idle", "progress": ""}
        try:
            with open(status_path) as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return {"state": "idle", "progress": ""}

    # ── audio ────────────────────────────────────────────────────────────────

    def get_audio_b64(self, path: str) -> str:
        import base64
        size = Path(path).stat().st_size
        if size > _MAX_AUDIO_BYTES:
            raise RuntimeError(
                f"WAV file too large to load in browser "
                f"({size // 1024 // 1024} MB > 200 MB limit). "
                f"Use a shorter clip."
            )
        with open(path, "rb") as f:
            data = f.read()
        return f"data:audio/wav;base64,{base64.b64encode(data).decode()}"

    # ── dialogs ───────────────────────────────────────────────────────────────

    def show_folder_dialog(self) -> list:
        import webview
        dialog_type = getattr(webview, 'FileDialog', None)
        folder_type = dialog_type.FOLDER if dialog_type else webview.FOLDER_DIALOG
        dirs = webview.windows[0].create_file_dialog(folder_type)
        return list(dirs) if dirs else []

    def show_file_dialog(self, file_types: list = None) -> list:
        import webview
        dialog_type = getattr(webview, 'FileDialog', None)
        open_type = dialog_type.OPEN if dialog_type else webview.OPEN_DIALOG
        files = webview.windows[0].create_file_dialog(open_type, file_types=tuple(file_types or []))
        return list(files) if files else []

    def open_in_finder(self, path: str) -> None:
        import subprocess
        subprocess.run(["open", "-R", path])

    def get_logo_data_url(self, path: str) -> str:
        """Read a local image and return as base64 data URL (works in both dev and prod)."""
        import base64, mimetypes
        if not path or not Path(path).exists():
            return ""
        mime = mimetypes.guess_type(path)[0] or "image/png"
        data = base64.b64encode(Path(path).read_bytes()).decode()
        return f"data:{mime};base64,{data}"

    def get_changelog(self) -> str:
        here = Path(__file__).parent.parent
        p = here / "CHANGELOG.md"
        if p.exists():
            return p.read_text(encoding="utf-8")
        return ""

    def set_undo_state(self, can_undo: bool, can_redo: bool) -> None:
        try:
            import main as _main
            _main._can_undo = bool(can_undo)
            _main._can_redo = bool(can_redo)
        except Exception:
            pass

    def get_version(self) -> str:
        try:
            import tomllib
            # In dev: two levels up from backend/api.py → repo root.
            # In bundle: PyInstaller places pyproject.toml at sys._MEIPASS root,
            #            which is also two levels up from backend/api.pyc.
            p = Path(__file__).parent.parent / "pyproject.toml"
            if p.exists():
                with open(p, "rb") as f:
                    data = tomllib.load(f)
                return data.get("project", {}).get("version", "")
        except Exception:
            pass
        return ""


# ── helpers ───────────────────────────────────────────────────────────────────

def _clip_slot(clip_name: str) -> str:
    stem = Path(clip_name).stem
    digits = "".join(c for c in stem if c.isdigit())
    return digits.zfill(2) if digits else stem

def _meta_path(ep_dir: Path) -> Path:
    return ep_dir / "metadata.json"

def _normalize_pairing(p: dict) -> dict:
    if "wav_name" in p:
        return p
    wav = p.get("wav") or {}
    bg = p.get("bg") or {}
    return {
        "wav_name": wav.get("name", ""),
        "wav_path": wav.get("path", ""),
        "wav_duration": wav.get("duration", 0),
        "bg_name": bg.get("name", ""),
        "bg_path": bg.get("path", ""),
        "bg_duration": bg.get("duration", 0),
        "bg_start": p.get("bg_start", "0:00"),
        "loops": p.get("loops", False),
    }

def _load_meta(ep_dir: Path) -> dict:
    p = _meta_path(ep_dir)
    if not p.exists():
        return {}
    with open(p) as f:
        meta = json.load(f)
    if "pairings" in meta:
        meta["pairings"] = [_normalize_pairing(p) for p in meta["pairings"]]
    return meta

def _save_meta(ep_dir: Path, meta: dict) -> None:
    with open(_meta_path(ep_dir), "w") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)

def _write_status(path: Path, status: dict) -> None:
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w") as f:
        json.dump(status, f)
    tmp.replace(path)

def _reset_running_statuses(ep_dir: Path) -> None:
    for pattern in ("edit/*/status.json", "edit/*/render_status.json"):
        for status_file in ep_dir.glob(pattern):
            try:
                with open(status_file) as f:
                    st = json.load(f)
                if st.get("state") == "running":
                    _write_status(status_file, {"state": "idle", "progress": ""})
            except Exception:
                pass

def _hex_to_rgba(hex_color: str) -> tuple:
    h = hex_color.lstrip('#')
    try:
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        return (r, g, b, 255)
    except Exception:
        return (254, 185, 2, 255)

def _scan_clips(ep_dir: Path, meta: dict) -> list:
    clips = []
    for p in meta.get("pairings", []):
        clip_name = p.get("wav_name", "")
        if not clip_name:
            continue
        edit_dir = ep_dir / "edit" / _clip_slot(clip_name)
        stem = Path(clip_name).stem
        transcript = edit_dir / "transcripts" / f"{stem}.json"
        status = "untouched"
        if transcript.exists():
            try:
                with open(transcript) as f:
                    tdata = json.load(f)
                if tdata.get("groups"):
                    status = "edited"
                else:
                    status = "processed"
            except Exception:
                status = "processed"
        if (ep_dir / f"{stem}.mp4").exists():
            status = "rendered"
        clips.append({"name": clip_name, "slot": _clip_slot(clip_name), "status": status})
    return clips
