# Shorts Studio

macOS desktop app for assembling YouTube Shorts. Pairs WAV audio clips with background videos, transcribes speech, lets you edit subtitle groupings, then renders final MP4s with subtitles and an audiogram overlay.

## What it does

1. **Setup** — open a project folder (WAV clips + logo PNG); configure subtitle style and position
2. **Match & Process** — pair WAV clips to background videos; auto-transcribe via whisper-cli; generate FFT audiogram
3. **Edit transcripts** — word-chip editor with drag & drop grouping, timestamp editing, playback, undo/redo (Cmd+Z / Shift+Cmd+Z)
4. **Render** — compose final 1080×1920 MP4s with subtitles (ProRes 4444 overlay), audiogram, logo

## Requirements

- macOS (Apple Silicon or Intel)
- [Homebrew](https://brew.sh)
- [uv](https://docs.astral.sh/uv/) — Python package manager
- [Bun](https://bun.sh) — frontend package manager
- ffmpeg: `brew install ffmpeg`
- whisper-cli: `brew install whisper-cpp`
- A GGML whisper model file (see Setup below)

## Setup

### 1. Install Python and frontend dependencies

```bash
uv sync
cd frontend && ~/.bun/bin/bun install && cd ..
```

### 2. Download a Whisper model

`whisper-cpp` does not bundle a model. Download one from Hugging Face:

```bash
# ~1.6 GB — good balance of speed and accuracy
curl -L -o ~/whisper-large-v3-turbo.bin \
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin"
```

Other available models (smaller = faster, less accurate):
- `ggml-base.bin` (~150 MB)
- `ggml-small.bin` (~490 MB)
- `ggml-medium.bin` (~1.5 GB)

### 3. Configure on first launch

Open **Settings** (Cmd+,) and set:

| Setting | Value |
|---|---|
| BG Library | Path to your folder of background video files |
| Whisper CLI | `/opt/homebrew/bin/whisper-cli` (auto-detected) |
| Whisper Model | Path to the `.bin` file you downloaded |

## Running

```bash
# Development (Vite hot reload + PyWebView)
make dev

# Production (requires built frontend)
cd frontend && ~/.bun/bin/bun run build && cd ..
uv run python main.py
```

## Building the .app

```bash
make build
# → dist/Shorts Studio.app
```

```bash
# Optional: install CLI launcher
make install-cli
# → /usr/local/bin/shorts-studio
```

## Project structure

```
backend/
  api.py               — PyWebView JS↔Python bridge
  config.py            — ~/.config/shorts-studio/config.json
  processor.py         — transcribe + audiogram pipeline
  composer.py          — ffmpeg final render
  subtitle_renderer.py — Pillow → ProRes 4444 .mov subtitle track
  helpers/
    transcribe_local.py — whisper-cli wrapper (word-level timestamps)
    audiogram.py        — numpy FFT spectrum bars → MP4
    _paths.py           — ffmpeg/ffprobe path resolution for .app bundle
frontend/src/
  phases/              — Setup, MatchProcess, Transcripts, Render
  transcript/          — WordChip, WordGroup, TimelineBar editors
  components/          — Sidebar, AboutModal, ChangelogModal
```

## License

© 2026 Bartek Jagniątkowski
