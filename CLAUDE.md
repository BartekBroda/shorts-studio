# Shorts Studio

macOS desktop app replacing `make_short.py` CLI for assembling YouTube Shorts.

- **Spec:** `docs/superpowers/specs/2026-05-08-shorts-studio-design.md`
- **Changelog:** `CHANGELOG.md`

## Stack

| layer | choice |
|-------|--------|
| window | PyWebView ≥5 |
| frontend | React 18 + TypeScript + Vite |
| package manager (frontend) | bun (`~/.bun/bin/bun`) |
| package manager (Python) | uv |
| UI font | Geist (shadcn default) |
| brand font | Nohemi — subtitles in video only |
| subtitles | Pillow ImageDraw → ProRes 4444 .mov with alpha |
| audiogram | numpy FFT → Pillow bar chart → MP4 |
| packaging | PyInstaller 6 (`make build` → `dist/Shorts Studio.app`) |
| tests | pytest |

## Project structure

```
shorts-studio/
  pyproject.toml
  main.py                ← PyWebView entry point; --dev flag for Vite hot reload
  Makefile               ← make icon / make build / make install-cli
  CHANGELOG.md
  assets/
    generate_icon.py     ← Pillow icon generator (yellow bars on dark bg)
    icon.png             ← generated 1024×1024
    icon.icns            ← generated macOS icon
  scripts/
    shorts-studio        ← CLI launcher (prefers .app, falls back to uv run)
    dev                  ← dev launcher: starts Vite + PyWebView together (used by make dev)
  backend/
    config.py            ← ~/.config/shorts-studio/config.json
    probe.py             ← ffprobe duration
    matcher.py           ← WAV→BG auto-matching
    processor.py         ← transcribe + audiogram via helpers/
    subtitle_renderer.py ← Pillow → ProRes 4444 .mov
    composer.py          ← ffmpeg compose (eof_action=repeat on overlays)
    api.py               ← pywebview.api (includes get_changelog(), get_version(), get_logo_data_url())
    helpers/
      transcribe_local.py ← whisper-cli → word-level JSON
      audiogram.py        ← numpy FFT spectrum analyzer → MP4 (black bg, yellow bars)
  frontend/              ← Vite React TS (bun)
    src/
      api.ts             ← window.pywebview.api wrapper (waitForBridge, tailPath)
      types.ts
      components/        ← Sidebar.tsx, PhaseBar.tsx, AboutModal.tsx, ChangelogModal.tsx
        ui/              ← shadcn components: slider.tsx, scroll-area.tsx (@radix-ui)
      phases/            ← Setup.tsx, MatchProcess.tsx, Transcripts.tsx, Render.tsx
      transcript/        ← WordChip.tsx, WordGroup.tsx, TimelineBar.tsx
  www/                   ← (gitignored) bun run build output
  dist/                  ← (gitignored) PyInstaller .app output
  tests/                 ← pytest
```

## External dependencies

Transcription and audiogram are self-contained in `backend/helpers/`.

**whisper-cli:** configurable in Settings; defaults to `/opt/homebrew/bin/whisper-cli`
**Model:** configurable in Settings; defaults to `~/Library/Application Support/com.bradenwong.whispering/models/whisper/ggml-large-v3-turbo.bin`
**ffmpeg / ffprobe:** `ffmpeg-full` (homebrew), requires libass. Resolved via `backend/helpers/_paths.py` — tries absolute Homebrew paths so `.app` bundle works without shell `PATH`.

## Global config

`~/.config/shorts-studio/config.json`:
```json
{"bg_library": "/path/to/bg/", "whisper_cli": "", "whisper_model": "", "recent_projects": ["/path/to/episode1", ...]}
```

`whisper_cli` and `whisper_model` are empty by default — `transcribe_local.py` falls back to Homebrew paths. Configured via Settings modal (Cmd+,).

Projects are opened per-folder (not `episodes_root`). Recent projects stored in `recent_projects`.

## Episode metadata

`<episode>/metadata.json` — wav_source, logo, WAV→BG pairings, subtitle settings.

## Transcription

`backend/helpers/transcribe_local.py` calls `whisper-cli` with:
- `-ojf` (full JSON with tokens and timestamps)
- `-of <tmp>` (output file without extension)
- `-l <language>` (default `pl`)

BPE tokens merged into whole words: token starting with space = new word, no space = continuation.

Output JSON: `{"words": [{"word", "start", "end", "probability", "speaker_id"}], "groups": []}`

## Audiogram

`backend/helpers/audiogram.py` generates 1080×512 video with frequency spectrum:
- Black background, yellow bars (`#FEB902`)
- numpy `rfft` with Hanning window, 72 log-spaced frequency bands (60 Hz – 8 kHz)
- Per-bar attack/release smoothing: `ATTACK=0.42`, `RELEASE=0.51`
- Pillow renders each frame; ffmpeg encodes to MP4 with no audio stream (`-an`)
- Composer overlays via `colorkey=0x000000` (black → transparent), `eof_action=repeat`
- Position: bottom of frame (`overlay=0:H-h`)

## Processing actions

`process_clip(force, force_audiogram)` in `api.py`:
- `force=True` — wipes transcript only, re-runs whisper
- `force_audiogram=True` — wipes audiogram only, re-runs FFT viz
- Both can be combined

In the UI:
- **Step ②** (MatchProcess): per-clip "↺ Re-transcribe" and "🎵 Re-audiogram" buttons (shown when clip is done)
- **Step ③** (Transcripts): "↺ Re-transcribe" button in top bar only

## Clip status

`_scan_clips` in `api.py` assigns status based on file presence:
- `untouched` — no transcript
- `processed` — transcript exists, no groups
- `edited` — transcript with groups
- `rendered` — `.mp4` file in episode directory

## Important rules

- WAV source: project folder (episode.id) — Setup shows read-only, no selection needed
- BG Library: global, configured once
- Auto-match: WAVs longest→shortest, BG with duration ≥ WAV; fallback = longest (will loop)
- Loop badge: red row background + `↺ loops` when BG shorter than WAV; in dropdown shorter BGs shown red with `↺`
- BG dropdown: closes on outside click or ESC
- BG start: `from 0:00` field per clip, yellow when != 0:00
- Progress: text only — no progress bar
- Subtitles: Pillow → ProRes 4444 .mov with alpha, ffmpeg overlay (not ASS)
- Render: sequential (one clip at a time), not parallel
- UI zoom: `transform: scale(1.1)` on App wrapper div

## Single-instance enforcement (`main.py`)

`_acquire_single_instance()` runs at module load before any webview/API init:
- Opens lock file with `'a+'` (not `'w'` — avoids truncating the incumbent PID before `flock` runs)
- Tries `fcntl.flock(LOCK_EX | LOCK_NB)` on `~/.config/shorts-studio/instance.lock`
- **First instance**: lock acquired → `seek(0)` + `truncate()` + write own PID; file handle held in `_lock_fh` for process lifetime
- **Second instance**: lock fails → reads PID from file (guarded against empty string) → `NSRunningApplication.activateWithOptions_` brings first window to front → `sys.exit(0)`
- Lock auto-released by OS on process death; no stale lock files

## Timeline bar (TimelineBar.tsx)

Full-width bar always showing the complete audio duration. Components:
- **Progress fill** — `rgba(254,185,2,0.15)` from 0 to playhead
- **Hovered group strip** — yellow strip at hovered group's time range; 0.1 s CSS transition; driven by `hoveredRange` prop from Transcripts
- **Viewport indicator** — translucent rectangle showing which time range is visible in the groups scroll area; computed via `groupElsRef` DOM positions against container bounds on each groups `onScroll`; reads `wordsRef`/`groupsRef`/`durationRef` to avoid stale closure
- **Word ticks** — 1 px lines at each word's `start` time
- **Playhead** — 2 px yellow line at `currentTime`
- Click-to-seek maps click X to time

`viewportStart` / `viewportEnd` props are fractions (0–1) of total duration. Updated in `updateViewport()` in `Transcripts.tsx`.

## Transcript editor (Transcripts.tsx)

Groups flow left-to-right, wrap to next row (`flexWrap: wrap`), scroll vertically. Each group: time-range header (clickable → seek) + word chips + `+` button. Hovering a group doubles background opacity and adds a box-shadow ring; timeline shows matching yellow strip.

### Subtitle vertical position
`subtitle_y_pct` in `EpisodeMeta` (0–1 fraction of 1920 px, default 59%). `api.py` converts to pixel: `int(subtitle_y_pct * 1920)` — this is the **center** of the full subtitle block. `subtitle_renderer.py` computes `total_h = len(rows) * row_h - LINE_GAP` then `y = subtitle_y - total_h // 2` so multi-row subtitles stay centered on the same axis as single-row ones. Falls back to computed logo/audiogram midpoint when absent. `logo_size` and `logo_gap` always assigned before the branch since `compose()` uses them regardless.

Set via the **frame preview** in Setup.tsx (not a slider): a 130×231 px draggable 9:16 miniature showing logo, subtitle block, and audiogram in real proportional positions. Drag is constrained between the logo's rendered bottom (computed from `img.onLoad` → `realLogoH = img.naturalHeight * (LOGO_W_PX / img.naturalWidth)`; `logoBottomPct = (LOGO_GAP_PX + realLogoH) / 1920`) and the audiogram top (73.3% = `(1920−512)/1920`). Logo loaded via `api.get_logo_data_url(path)` → base64 data URL (works in both dev and production).

### WordChip modes
- **normal** — word + `start` timestamp below; low confidence → red border
- **edit** — 3 fields: text, start (s), end (s); container-level onBlur closes only when focus leaves the card

### Keyboard shortcuts
- **single click** — seek to word
- **double click** — open word edit
- **Tab** (in text or end field) — commit and advance to next word
- **Enter / Escape** (in edit) — commit and exit
- **Space** (outside input) — play/pause
- **Cmd+Z** (outside input) — undo
- **Shift+Cmd+Z** (outside input) — redo

### Undo/redo
Snapshot-based: `pushUndo()` called before every mutation (edit, delete, add, move, merge, sort, auto-group). Two `useRef` stacks (`undoStack`, `redoStack`). Stacks cleared on clip change. Also wired to macOS Edit menu via `_UndoTarget` / `_RedoTarget` NSObject classes that dispatch `shorts-studio:undo` / `shorts-studio:redo` custom events. `validateMenuItem_` on both targets reads `_can_undo` / `_can_redo` globals updated via `api.set_undo_state()`.

### Drag & drop
- **word → group** — move word into group; ghost chip shows at START of target group when dragging forward in timeline, at END when dragging backward
- **word → canvas** — new single-element group; ghost dashed box shows at cursor insert position
- **group header drag → another group** — merge groups

### Adding words
- `+` on each group — adds word after group's last end time, opens in edit mode

### Timestamp validation
- start > end → swapped on commit
- `onEditDone` callback clears `editingIdx` in parent after edit closes (prevents re-open via useEffect)

## About modal and Changelog

Two separate modals in `frontend/src/components/`:

**`AboutModal.tsx`** — native macOS-style About window. Opened via:
- "ℹ About" in sidebar bottom
- "About Shorts Studio" in the macOS app menu (intercepted via PyObjC in `main.py`)

Shows: app icon SVG, app name, version (from `api.get_version()` → `pyproject.toml` via `tomllib`), copyright, "View Changelog →" link.

**`ChangelogModal.tsx`** — opened via "≡ Changelog" in sidebar bottom or "View Changelog →" in About.
Calls `api.get_changelog()` (reads `CHANGELOG.md` from repo root / `sys._MEIPASS` in bundle).
Custom line-by-line markdown renderer — no external library.

### Native menu interception (`main.py`)

`_AboutTarget`, `_SettingsTarget`, `_UndoTarget`, `_RedoTarget`, and `_Interceptor` are module-level NSObject subclasses (must be at module level for PyObjC ObjC runtime registration). `_setup_menu(win)` is passed as `func` to `webview.start()` — PyWebView calls it from a background thread, so menu changes are dispatched to the main thread via `performSelectorOnMainThread_withObject_waitUntilDone_`. `evaluate_js` inside action handlers runs in a `threading.Thread` to avoid deadlocking the main thread.

`_Interceptor.run_()` patches four items:
1. Renames "About python" → "About Shorts Studio", wires to `_AboutTarget` → fires `shorts-studio:open-about`
2. Removes any existing Preferences/Settings item, inserts "Settings…" with Cmd+, key equivalent, wires to `_SettingsTarget` → fires `shorts-studio:open-settings`
3. Finds Edit menu Undo item (keyEquivalent "z", no shift), wires to `_UndoTarget` → fires `shorts-studio:undo`
4. Finds Edit menu Redo item (keyEquivalent "z" + shift), wires to `_RedoTarget` → fires `shorts-studio:redo`

`App.tsx` / `Transcripts.tsx` listens for all four events via `window.addEventListener`.

## Running (dev)

```bash
make dev
# starts Vite + PyWebView together; Ctrl+C kills both
```

Or manually in two terminals:
```bash
# Terminal 1 — Vite hot reload
cd frontend && ~/.bun/bin/bun run dev

# Terminal 2 — PyWebView pointing at Vite
uv run python main.py --dev
```

Backend changes: restart PyWebView process. Frontend changes: Vite reloads automatically.

## Running (production, no build)

```bash
uv run python main.py
# loads www/index.html (requires bun run build first)
```

## Building distributable app

```bash
make build
# 1. generates assets/icon.icns
# 2. bun run build → www/
# 3. pyinstaller → dist/Shorts Studio.app
```

```bash
# Install CLI launcher
make install-cli
# copies scripts/shorts-studio → /usr/local/bin/shorts-studio
```

## Frontend build only

```bash
cd frontend && ~/.bun/bin/bun run build
# output → www/
```
