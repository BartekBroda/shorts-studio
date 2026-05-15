import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from backend.helpers._paths import FFMPEG

FRAME_W, FRAME_H = 1080, 1920
FPS = 30
NOHEMI = Path.home() / "Library/Fonts/Nohemi-VF.ttf"
YELLOW = (254, 185, 2, 255)
BLACK  = (0, 0, 0, 255)
WHITE  = (255, 255, 255, 255)
TRANSPARENT = (0, 0, 0, 0)
PILL_PAD_X, PILL_PAD_Y = 18, 8
WORD_GAP = 10
LINE_GAP = 14


# ── data helpers ─────────────────────────────────────────────────────────────

def build_subtitle_lines(words: list[dict], groups: list[list[int]], max_words: int) -> list[list[dict]]:
    """
    Groups is a list of index lists. Indexed words form one subtitle line.
    Remaining words are auto-chunked by max_words.
    Returns list of lines ordered by each group's minimum word index.
    """
    grouped_indices: set[int] = set(i for grp in groups for i in grp)
    group_map: dict[int, list[dict]] = {}
    for grp in groups:
        if not grp:
            continue
        first = min(grp)
        valid = [words[i] for i in grp if i < len(words)]
        group_map[first] = sorted(valid, key=lambda w: w["start"])
        grouped_indices.update(grp)

    lines: list[list[dict]] = []
    chunk: list[dict] = []
    for i in range(len(words)):
        if i in group_map:
            if chunk:
                for j in range(0, len(chunk), max_words):
                    lines.append(chunk[j:j+max_words])
                chunk = []
            lines.append(group_map[i])
        elif i not in grouped_indices:
            chunk.append(words[i])

    if chunk:
        for j in range(0, len(chunk), max_words):
            lines.append(chunk[j:j+max_words])

    return lines


def get_active_word_idx(words: list[dict], t: float) -> int:
    """Return index of word active at time t, or -1."""
    for i, w in enumerate(words):
        if w["start"] <= t < w["end"]:
            return i
    return -1


# ── rendering ─────────────────────────────────────────────────────────────────

def _load_font(size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(str(NOHEMI), size)
    except Exception:
        return ImageFont.load_default()


def _word_width(word_text: str, font: ImageFont.FreeTypeFont) -> int:
    bb = font.getbbox(word_text)
    return bb[2] - bb[0]


def _render_row(
    draw: ImageDraw.ImageDraw,
    row_words: list[dict],
    active_word_text: str | None,
    font: ImageFont.FreeTypeFont,
    y: int,
    highlight_color: tuple = YELLOW,
) -> None:
    """Draw one row centred horizontally. Pill is a background; doesn't shift word positions."""
    text_h = font.getbbox("Ay")[3]
    n = len(row_words)
    # layout uses raw word widths — pill padding does NOT affect spacing
    widths = [_word_width(w["word"], font) for w in row_words]
    total = sum(widths) + WORD_GAP * (n - 1)
    x = (FRAME_W - total) // 2

    for i, w in enumerate(row_words):
        word_text = w["word"]
        is_active = (active_word_text is not None and word_text == active_word_text)
        word_w = widths[i]

        if is_active:
            # pill drawn behind text; expands inward only, not into adjacent words
            draw.rounded_rectangle(
                [x - PILL_PAD_X, y - PILL_PAD_Y, x + word_w + PILL_PAD_X, y + text_h + PILL_PAD_Y],
                radius=12, fill=highlight_color,
            )
            draw.text((x, y), word_text, font=font, fill=BLACK)
        else:
            draw.text((x, y), word_text, font=font, fill=WHITE)

        x += word_w
        if i < n - 1:
            x += WORD_GAP


def _render_frame(
    draw: ImageDraw.ImageDraw,
    line_words: list[dict],
    active_word_text: str | None,
    font: ImageFont.FreeTypeFont,
    subtitle_y: int,
    highlight_color: tuple = YELLOW,
) -> None:
    """Draw one subtitle group, wrapping into multiple rows if too wide."""
    MAX_W = 960
    text_h = font.getbbox("Ay")[3]
    row_h = text_h + PILL_PAD_Y * 2 + LINE_GAP

    # split words into rows using raw word widths (no pill inflation)
    rows: list[list[dict]] = []
    row: list[dict] = []
    row_w = 0
    for w in line_words:
        word_w = _word_width(w["word"], font)
        gap = WORD_GAP if row else 0
        if row and row_w + gap + word_w > MAX_W:
            rows.append(row)
            row = [w]
            row_w = word_w
        else:
            row.append(w)
            row_w += gap + word_w
    if row:
        rows.append(row)

    total_h = len(rows) * row_h - LINE_GAP
    y = subtitle_y - total_h // 2
    for rw in rows:
        _render_row(draw, rw, active_word_text, font, y, highlight_color)
        y += row_h


def render_subtitle_track(
    words: list[dict],
    groups: list[list[int]],
    duration: float,
    subtitle_y: int,
    out_path: str,
    font_size: int = 72,
    max_words: int = 3,
    on_progress=None,
    highlight_color: tuple = YELLOW,
) -> None:
    """
    Render transparent ProRes 4444 subtitle overlay to out_path.
    subtitle_y: top of text baseline in 1080×1920 frame pixels.
    """
    font = _load_font(font_size)
    lines = build_subtitle_lines(words, groups, max_words)

    # build line spans: (start_t, end_t) covering first→last word in each line
    line_spans: list[tuple[float, float]] = []
    for line in lines:
        if line:
            line_spans.append((min(w["start"] for w in line), max(w["end"] for w in line)))
        else:
            line_spans.append((0.0, 0.0))

    # build word→line index lookup
    word_to_line: dict[int, int] = {}
    for li, line in enumerate(lines):
        for w in line:
            for wi, orig in enumerate(words):
                if orig is w:
                    word_to_line[wi] = li

    n_frames = int(duration * FPS) + 1

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        for fi in range(n_frames):
            if on_progress and fi % 30 == 0:
                on_progress(f"subtitles {fi}/{n_frames}")
            t = fi / FPS
            img = Image.new("RGBA", (FRAME_W, FRAME_H), TRANSPARENT)
            draw = ImageDraw.Draw(img)

            # find which line's span covers t — eliminates between-word flicker
            active_line_idx = -1
            for li, (ls, le) in enumerate(line_spans):
                if ls <= t < le:
                    active_line_idx = li
                    break

            if active_line_idx >= 0:
                line = lines[active_line_idx]
                active_idx = get_active_word_idx(words, t)
                active_word = words[active_idx]["word"] if active_idx >= 0 and word_to_line.get(active_idx) == active_line_idx else None
                _render_frame(draw, line, active_word, font, subtitle_y, highlight_color)

            img.save(tmp / f"frame_{fi:06d}.png")

        # encode frames → ProRes 4444 MOV
        result = subprocess.run([
            FFMPEG, "-y", "-loglevel", "error",
            "-framerate", str(FPS),
            "-i", str(tmp / "frame_%06d.png"),
            "-c:v", "prores_ks",
            "-profile:v", "4444",
            "-pix_fmt", "yuva444p10le",
            out_path,
        ], capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(result.stderr[-2000:] if result.stderr else "ffmpeg subtitle encode failed")
