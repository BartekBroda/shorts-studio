# Shorts Studio

macOS desktop app for assembling YouTube Shorts. Pairs WAV audio clips with background videos, transcribes speech, lets you edit subtitle groupings, then renders final MP4s with subtitles and an audiogram overlay.

## What it does

1. **Match & Process** — pair WAV clips to background videos; auto-transcribe via whisper-cli; generate audiogram (FFT spectrum bars)
2. **Edit transcripts** — word-chip editor with drag & drop grouping, timestamp editing, playback, undo/redo (Cmd+Z / Shift+Cmd+Z)
3. **Render** — compose final 1080×1920 MP4s with subtitles (ProRes 4444 overlay), audiogram, logo

## Requirements

- macOS (Apple Silicon or Intel)
- [Homebrew](https://brew.sh)
- Python 3.11+ via [uv](https://docs.astral.sh/uv/)
- [Bun](https://bun.sh) (frontend)
- ffmpeg with libass: `brew install ffmpeg`
- whisper-cli: `brew install whisper-cpp` (or any whisper-cli compatible binary)

## Setup

```bash
# Install Python dependencies
uv sync

# Install frontend dependencies
cd frontend && ~/.bun/bin/bun install && cd ..
```

Configure whisper-cli and model path in **Settings** (Cmd+,) on first launch, or let it auto-detect from Homebrew defaults.

## Running

```bash
# Development (Vite hot reload + PyWebView)
make dev

# Production (requires built frontend)
cd frontend && ~/.bun/bin/bun run build && cd ..
uv run python main.py
```

## Building the app

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
  api.py               — PyWebView JS API
  config.py            — ~/.config/shorts-studio/config.json
  processor.py         — transcribe + audiogram pipeline
  composer.py          — ffmpeg final render
  subtitle_renderer.py — Pillow → ProRes 4444 .mov
  helpers/
    transcribe_local.py — whisper-cli wrapper
    audiogram.py        — numpy FFT spectrum → MP4
    _paths.py           — ffmpeg/ffprobe path resolution for .app bundle
frontend/src/
  phases/              — Setup, MatchProcess, Transcripts, Render
  transcript/          — WordChip, WordGroup editors
  components/          — Sidebar, AboutModal, ChangelogModal
```

## Settings

Open with **Cmd+,** or **Shorts Studio → Settings…**

| Setting | Default |
|---|---|
| BG Library | — (required on first launch) |
| Whisper CLI | `/opt/homebrew/bin/whisper-cli` |
| Whisper Model | `~/Library/Application Support/com.bradenwong.whispering/…/ggml-large-v3-turbo.bin` |

## License

© 2026 Bartek Jagniątkowski
