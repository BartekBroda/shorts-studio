# Changelog

All notable changes to Shorts Studio are documented here.

---

## [2.6.1] — 2026-05-15

### Fixed
- **Logo drag constraint uses intrinsic dimensions** — `onLogoLoad` now computes `realLogoH = img.naturalHeight * (LOGO_W_PX / img.naturalWidth)` instead of `getBoundingClientRect().height`; CSS constraints no longer cap the computed drag boundary, so the subtitle can never overlap the logo
- **Logo renders at natural aspect ratio** — removed `maxHeight: 22%` / `objectFit: contain` from preview img; logo now fills its proportional width and scales height from intrinsic aspect ratio
- **Setup scroll uses shadcn ScrollArea** — native `overflowY: auto` div replaced by `<ScrollArea>` wrapper for consistent scrollbar styling

### Changed
- `pyproject.toml` version bumped to `2.6.1`

---

## [2.6.0] — 2026-05-15

### Added
- **Frame preview in Setup** — 130×231 px draggable 9:16 miniature in the subtitle position field shows logo, audiogram, and subtitle block in their real proportional positions; drag subtitle block up/down to set position; drag is constrained between logo bottom (computed from loaded image height) and audiogram top
- **`api.get_logo_data_url(path)`** — reads logo from disk and returns a base64 data URL; used by the frame preview so the actual logo renders in both dev (localhost) and production (file://) contexts
- **shadcn/ui Slider and ScrollArea** — `@radix-ui/react-slider` and `@radix-ui/react-scroll-area` installed; `src/components/ui/slider.tsx` and `src/components/ui/scroll-area.tsx` created; ScrollArea with custom `viewportRef` prop wired into Transcripts groups container

### Fixed
- **Subtitle centering** — `subtitle_y` is now the vertical CENTER of the entire subtitle block, not the top of the first row; multi-row subtitles shift up so their center stays on the configured axis (`total_h = len(rows) * row_h - LINE_GAP; y = subtitle_y - total_h // 2`)
- **Single-instance lock race** — `open('w')` truncated the lock file before `flock`, so a second instance would empty the file then read back nothing; fixed by using `open('a+')` (preserves existing PID), then `seek(0)` + `truncate()` + write only after lock is won; `_activate_existing_instance()` also guards against empty string before `int()`
- **`make dev` port conflict** — `scripts/dev` now kills any stale process on port 5173 via `lsof` before starting Vite; Vite binary run directly from `node_modules/.bin/vite` (not via `bun run dev`) to suppress bun's SIGTERM exit-code error on cleanup
- **Vite dep-scan race (Radix packages)** — added `@radix-ui/react-scroll-area` and `@radix-ui/react-slider` to `optimizeDeps.include` in `vite.config.ts` so Vite pre-bundles them on startup rather than scanning at request time

### Changed
- Subtitle position field in Setup replaced: slider removed, draggable frame preview is the only control; percentage shown as label below preview; hint text lists logo zone and audiogram zone boundaries
- `subtitle_y_pct` semantic updated: value is now the center of the subtitle block (was top of first row); default 59% unchanged
- `pyproject.toml` version bumped to `2.6.0`

---

## [2.5.0] — 2026-05-15

### Added
- **Single-instance enforcement** — launching a second copy brings the first window to front (via `NSRunningApplication.activateWithOptions_`) then exits; lock held via `fcntl.flock` on `~/.config/shorts-studio/instance.lock`, auto-released on crash/force-quit
- **Subtitle vertical position** — slider in Setup (0–100% of 1920 px frame height, default 59%); saved as `subtitle_y_pct` in `metadata.json`; used in render instead of the previously hardcoded midpoint calculation
- **Group hover highlight** — hovering a word group doubles background opacity and adds a matching box-shadow ring; timeline shows a yellow strip at the group's exact time range with 0.1 s CSS transition
- **Word groups wrap to fill 2D space** — groups flow left-to-right and wrap to the next row when the window is too narrow; container scrolls vertically; each group keeps natural (content) width

### Fixed
- `UnboundLocalError: logo_size` when `subtitle_y_pct` present in metadata — `logo_size` and `logo_gap` are now assigned unconditionally before the `if` branch since `compose()` needs them regardless

### Changed
- `pyproject.toml` version bumped to `2.5.0`

---

## [2.4.0] — 2026-05-15

### Added
- **Timeline viewport indicator** — translucent rectangle in the timeline bar tracks which time range is currently visible in the word groups scroll area; computed from actual group element positions so it reflects accurate min/max word times

### Fixed
- **Edit → Undo / Redo always enabled** — `validateMenuItem_` added to `_UndoTarget` / `_RedoTarget`; frontend calls `api.set_undo_state(canUndo, canRedo)` after every stack mutation and on clip change; items gray out when stack is empty
- **Undo/Redo missing from Edit menu** — replaced fragile key-equivalent search with explicit item insertion; removes any existing Cmd+Z items then inserts Undo and Redo at top of Edit menu; creates Edit menu if absent

### Changed
- `pyproject.toml` version bumped to `2.4.0`

---

## [2.3.0] — 2026-05-15

### Added
- **Undo/redo in transcript editor** — Cmd+Z / Shift+Cmd+Z (keyboard) and Edit → Undo / Redo (macOS app menu); snapshot-based, covers all mutations: word edit, delete, add, move, merge, sort, auto-group; stacks cleared on clip change
- **Ghost position follows timeline order** — when dragging a word into an existing group, ghost chip appears at the start of the target group if dragging forward in time, at the end if dragging backward; matches actual drop behaviour

### Changed
- `pyproject.toml` version bumped to `2.3.0`

---

## [2.2.0] — 2026-05-15

### Added
- **Settings in macOS app menu** — "Settings…" item inserted after About with Cmd+, keyboard shortcut; fires JS event via PyObjC same as About
- **ESC closes Settings modal**
- **Configurable whisper-cli and model paths** — Settings modal now has fields for Whisper CLI binary and model file; saved to `~/.config/shorts-studio/config.json`; `transcribe_local.py` resolves configured paths with fallback to Homebrew defaults
- **Full error panel in Step ②** — errors shown in a scrollable panel at the bottom of Match & Process with full text; no longer truncated to an inline badge

### Fixed
- `ffmpeg` / `ffprobe` not found in `.app` bundle — `backend/helpers/_paths.py` resolves absolute Homebrew paths; imported as `FFMPEG`/`FFPROBE` constants in `probe.py`, `composer.py`, `subtitle_renderer.py`, `audiogram.py`
- `python3 transcribe_local.py` subprocess failed in bundle — `processor.py` now calls helper functions in-process (no subprocess)
- `whisper-cli` not found in `.app` bundle — `_resolve()` in `transcribe_local.py` tries absolute Homebrew paths before falling back to `$PATH`

### Changed
- `pyproject.toml` version bumped to `2.2.0`

---

## [2.1.0] — 2026-05-15

### Added
- **Native About window** — "About Shorts Studio" in the macOS app menu opens a native-style modal: app icon, version number, copyright, and "View Changelog →" link
- **Changelog modal** — separate view (sidebar "≡ Changelog") renders `CHANGELOG.md`; no longer mixed with About
- **`api.get_version()`** — reads version from `pyproject.toml` via `tomllib`; displayed in About modal
- **`make dev` script** — `scripts/dev` starts Vite + PyWebView together; Ctrl+C cleans up both; no two-terminal setup needed

### Changed
- Sidebar bottom links split into "ℹ About" and "≡ Changelog" (was single "ℹ About / Changelog")
- Native "About python" menu item renamed to "About Shorts Studio" at runtime via PyObjC
- `pyproject.toml` version bumped to `2.0.0` → `2.1.0`

### Fixed
- Native About menu action deadlocked app — `evaluate_js` now called from background thread
- PyObjC menu interception failed silently — `_AboutTarget` and `_Interceptor` classes moved to module level; menu patched via `performSelectorOnMainThread_withObject_waitUntilDone_`
- `scripts/dev` exit code 143 on normal quit — `wait "$APP_PID" || true`
- `scripts/dev` port check failing on IPv6 — replaced `nc -z 127.0.0.1` with `curl localhost`

---

## [2.0.0] — 2026-05-15

### Added
- **App icon** — yellow audiogram bars on dark background, generated via Pillow (`assets/generate_icon.py`), bundled as `.icns`
- **Standalone macOS app** — `make build` produces `dist/Shorts Studio.app` via PyInstaller; double-click to launch, no terminal required
- **CLI launcher** — `scripts/shorts-studio` shell script; prefers installed `.app`, falls back to `uv run python main.py`
- **Makefile** — `make icon`, `make frontend`, `make build`, `make install-cli` targets

### Changed
- **Re-audiogram moved to Step ②** — button now lives in Match & Process (where audiogram is generated), not in Transcripts
- **Re-process split into two actions** — per-clip row in Match & Process now shows "↺ Re-transcribe" and "🎵 Re-audiogram" separately; each triggers only what it says

### Removed
- Global "＋ word" button at end of Transcripts scroll — redundant since every group has its own ＋ button
- `setup.py` — replaced by PyInstaller (py2app incompatible with Python 3.14)

---

## [1.2.0] — 2026-05-14 / 2026-05-15

### Added
- **FFT spectrum analyzer audiogram** — replaces ffmpeg `showwaves` with numpy `rfft`; 72 log-spaced frequency bars, Hanning window, per-bar attack/release smoothing (ATTACK=0.42, RELEASE=0.51)
- **Separate force_audiogram flag** — `process_clip(force, force_audiogram)` wipes only what's needed; Re-audiogram button triggers audiogram-only re-render

### Fixed
- Audiogram rendered as green instead of yellow — stereo WAV channel 2 got ffmpeg's default green colour; fixed by mono downmix
- Audiogram colours dim — `draw=scale` scaled colour by amplitude; switched to `draw=full`
- Audiogram animated as sliding left-to-right time window — replaced with frequency-domain spectrum that pulses in place
- `build_subtitle_lines` skipping words when a group contained an out-of-order high index — replaced `while` loop with sequential `for` scan
- Subtitle line spans using wrong timestamps when group words were not sorted by time — words now sorted by `start` before span calculation

---

## [1.1.0] — 2026-05-13 / 2026-05-14

### Added
- **TimelineBar** — seekable progress bar with per-word tick marks and auto-scroll toggle
- **Horizontal group scroll** in Transcripts — all groups visible in a single scrollable row
- **Auto-scroll to active group** during playback
- **Auto-save** — transcript saved 800 ms after any edit, no manual save required
- **Tab key navigation** — Tab from word text or end timestamp commits and advances to next word
- **Space bar** play/pause (when no input focused)
- **Per-group ＋ button** — adds a new word to that group at the group's end time, opens in edit mode
- **Drag & drop** — word → group, word → canvas (new group), group header drag → merge groups
- **Float timestamps** in WordChip expanded edit mode — start/end fields in seconds

### Fixed
- WordChip edit mode collapsing when clicking the start/end timestamp inputs — fixed with `relatedTarget` check on container `onBlur`
- Cannot exit edit mode after adding a new word — `onEditDone` callback now clears `editingIdx` in parent
- Clip-change scroll reset not firing
- `editingIdx` remap on word delete

---

## [1.0.0] — 2026-05-09 / 2026-05-13

### Added
- **Phase ① Setup** — open project folder, configure WAV source
- **Phase ② Match & Process** — pair WAV clips to background videos, per-clip processing with progress, BG dropdown with loop warning, `bg_start` offset field
- **Phase ③ Transcripts** — word chip editor, word grouping for subtitle lines, clip selector, playback
- **Phase ④ Render** — sequential render queue, per-clip render button, Show in Finder
- **Auto-match** — WAVs paired to BGs longest-first; BGs shorter than WAV marked as looping (red row + `↺ loops` badge)
- **Re-match button** — re-runs WAV→BG matching without wiping existing transcripts
- **Diagnostic bar** in Step ② — shows WAV count, BG count, wav_source path
- **Settings modal** — BG Library path configuration

### Fixed
- ffmpeg deadlock when stderr not drained — stderr now consumed in background thread
- Subtitle boundary double-activation at exact word end — span uses exclusive end
- `PermissionError` on WAV files — guarded with size limit and better error context
- PyWebView `FOLDER_DIALOG` deprecation warning
- `None` paths in `probe.py` and `api.py` crashing on missing files
- Match result flattening — legacy nested pairing format normalised on load
- Python 3 path (`python3` not `python`) on macOS
- UI zoom — `zoom: 1.1` on `html` element so `100vh` layout stays correct

---

## [0.2.0] — 2026-05-09

### Added
- Vite + React 18 + TypeScript frontend scaffold
- shadcn/ui component library, Geist font, design tokens (`--yellow`, `--mint`, `--red`, CSS variables)
- Shared TypeScript types (`Episode`, `Pairing`, `WordEntry`, `FileEntry`)
- PyWebView wired to built frontend; `--dev` flag for Vite hot reload

---

## [0.1.0] — 2026-05-09

### Added
- Project scaffold (`pyproject.toml`, `uv`, directory structure)
- `config.py` — read/write `~/.config/shorts-studio/config.json`; `recent_projects` list
- `probe.py` — `ffprobe` duration and file listing wrappers
- `matcher.py` — WAV→BG auto-matching (longest WAV first, BG duration ≥ WAV preferred)
- `processor.py` — async transcribe + audiogram via subprocess; clip status tracking
- `subtitle_renderer.py` — Pillow `ImageDraw` → ProRes 4444 `.mov` with alpha channel
- `composer.py` — ffmpeg final MP4 assembly; `eof_action=repeat` on overlay loops
- `helpers/transcribe_local.py` — `whisper-cli` wrapper; BPE tokens merged into whole words
- `helpers/audiogram.py` — ffmpeg `showwaves` → MP4 (yellow bars, black background, no audio stream)
- `api.py` — `pywebview.api` class exposing all backend methods to the frontend
