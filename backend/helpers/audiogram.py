#!/usr/bin/env python3
"""
Audiogram: animated yellow spectrum bars on black background.
Each bar covers a log-spaced frequency band; height = current magnitude.
Composer keys out black (colorkey=0x000000) for transparent overlay.
Usage: python3 audiogram.py --audio <wav> --output <mp4>
"""
import argparse
import struct
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from ._paths import FFMPEG, FFPROBE

W, H         = 1080, 512
BAR_COUNT    = 72
GAP          = 3
YELLOW       = (254, 185, 2)
FPS          = 30
SAMPLE_RATE  = 16000   # Hz — enough for voice/music up to 8 kHz
FFT_SIZE     = 2048    # samples per FFT window (~128 ms at 16 kHz)
FREQ_MIN     = 60.0    # Hz — lowest bar
FREQ_MAX     = 8000.0  # Hz — highest bar (= Nyquist at 16 kHz)
ATTACK       = 0.42    # smoothing when bar rises  (lower = faster attack)
RELEASE      = 0.51    # smoothing when bar falls  (lower = faster falloff)


def _decode(audio: str) -> np.ndarray:
    """Decode audio → mono float32 at SAMPLE_RATE."""
    cmd = [
        FFMPEG, "-i", audio,
        "-f", "f32le", "-ac", "1", "-ar", str(SAMPLE_RATE),
        "-loglevel", "error", "-",
    ]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def _duration(audio: str) -> float:
    out = subprocess.run(
        [FFPROBE, "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", audio],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    return float(out)


def _build_band_bins() -> list[tuple[int, int]]:
    """Log-spaced frequency band edges as FFT bin ranges for each bar."""
    freqs = np.logspace(np.log10(FREQ_MIN), np.log10(FREQ_MAX), BAR_COUNT + 1)
    bin_edges = np.round(freqs / SAMPLE_RATE * FFT_SIZE).astype(int)
    bin_edges = np.clip(bin_edges, 1, FFT_SIZE // 2)
    bands = []
    for i in range(BAR_COUNT):
        lo, hi = bin_edges[i], bin_edges[i + 1]
        if hi <= lo:
            hi = lo + 1
        bands.append((lo, hi))
    return bands


_WINDOW = np.hanning(FFT_SIZE)
_BANDS  = _build_band_bins()


def _spectrum(samples: np.ndarray, centre: int) -> np.ndarray:
    """Magnitude spectrum → one value per bar (0.0–1.0 before normalisation)."""
    half = FFT_SIZE // 2
    lo, hi = centre - half, centre + half
    # zero-pad edges
    seg = np.zeros(FFT_SIZE, dtype=np.float32)
    src_lo = max(0, lo)
    src_hi = min(len(samples), hi)
    dst_lo = src_lo - lo
    dst_hi = dst_lo + (src_hi - src_lo)
    seg[dst_lo:dst_hi] = samples[src_lo:src_hi]
    seg *= _WINDOW

    mag = np.abs(np.fft.rfft(seg))

    values = np.array([mag[lo:hi].mean() for lo, hi in _BANDS], dtype=np.float32)
    return values


def _draw_bars(values: np.ndarray, peak: float) -> Image.Image:
    img  = Image.new("RGB", (W, H), (0, 0, 0))
    draw = ImageDraw.Draw(img)
    bar_w = (W - GAP * (BAR_COUNT - 1)) // BAR_COUNT
    pad   = (W - (bar_w * BAR_COUNT + GAP * (BAR_COUNT - 1))) // 2

    for i, v in enumerate(values):
        norm  = float(min(1.0, v / peak)) if peak > 0 else 0.0
        bar_h = max(2, int(norm * (H - 8)))
        x  = pad + i * (bar_w + GAP)
        y0 = (H - bar_h) // 2
        draw.rectangle([x, y0, x + bar_w - 1, y0 + bar_h - 1], fill=YELLOW)

    return img


def audiogram(audio: str, output: str, on_progress=None) -> None:
    if on_progress:
        on_progress("audiogram: decoding…")
    samples  = _decode(audio)
    duration = _duration(audio)
    n_frames = int(duration * FPS) + 1

    # global peak across all frames for stable normalisation
    step   = max(1, len(samples) // 200)
    all_v  = np.concatenate([_spectrum(samples, c) for c in range(0, len(samples), step)])
    peak   = float(np.percentile(all_v, 99)) or 1.0

    prev   = np.zeros(BAR_COUNT, dtype=np.float32)

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        for fi in range(n_frames):
            if on_progress and fi % FPS == 0:
                on_progress(f"audiogram {fi}/{n_frames}")
            centre = int(fi / FPS * SAMPLE_RATE)
            vals   = _spectrum(samples, centre)
            # separate attack / release smoothing per bar
            rising = vals > prev
            alpha  = np.where(rising, ATTACK, RELEASE)
            prev   = alpha * prev + (1 - alpha) * vals
            _draw_bars(prev, peak).save(tmp / f"f{fi:06d}.png")

        if on_progress:
            on_progress("audiogram: encoding…")
        subprocess.run([
            FFMPEG, "-y",
            "-framerate", str(FPS),
            "-i", str(tmp / "f%06d.png"),
            "-c:v", "libx264", "-preset", "fast", "-crf", "18",
            "-an", "-loglevel", "error",
            output,
        ], check=True)

    print(f"audiogram → {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    audiogram(args.audio, args.output)
