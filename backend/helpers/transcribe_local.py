#!/usr/bin/env python3
"""
Transcribe a WAV using whisper-cli and write word-level JSON.
Usage: python3 transcribe_local.py <wav> --output <json_path> [--language pl]
         [--whisper-cli /path/to/whisper-cli] [--model /path/to/model.bin]
"""
import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

# Fallback search order when no path is configured.
_WHISPER_CANDIDATES = [
    "/opt/homebrew/bin/whisper-cli",
    "/usr/local/bin/whisper-cli",
]
_MODEL_CANDIDATES = [
    str(Path.home() / "Library/Application Support/com.bradenwong.whispering/models/whisper/ggml-large-v3-turbo.bin"),
    str(Path.home() / ".local/share/whisper/models/ggml-large-v3-turbo.bin"),
]


def _resolve(configured: str, candidates: list[str], label: str) -> str:
    if configured and Path(configured).exists():
        return configured
    for p in candidates:
        if Path(p).exists():
            return p
    raise FileNotFoundError(
        f"{label} not found. Configure it in Settings → Whisper."
    )


def transcribe(
    wav_path: str,
    output: str,
    language: str = "pl",
    whisper_cli: str = "",
    model: str = "",
) -> None:
    cli = _resolve(whisper_cli, _WHISPER_CANDIDATES, "whisper-cli")
    mdl = _resolve(model, _MODEL_CANDIDATES, "Whisper model")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_out = Path(tmp) / "out"
        cmd = [
            cli,
            "-m", mdl,
            "-l", language,
            "-ojf",
            "-of", str(tmp_out),
            "--word-thold", "0.01",
            wav_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(result.stderr or result.stdout, file=sys.stderr)
            sys.exit(result.returncode)

        json_file = Path(str(tmp_out) + ".json")
        if not json_file.exists():
            print("No JSON output produced by whisper-cli", file=sys.stderr)
            sys.exit(1)

        with open(json_file) as f:
            raw = json.load(f)

        raw_tokens = []
        for segment in raw.get("transcription", []):
            for token in segment.get("tokens", []):
                text = token.get("text", "")
                if not text.strip() or text.strip().startswith("["):
                    continue
                offsets = token.get("offsets", {})
                raw_tokens.append({
                    "text": text,
                    "t0": offsets.get("from", 0) / 1000.0,
                    "t1": offsets.get("to", 0) / 1000.0,
                    "p": float(token.get("p", 1.0)),
                })

        # Merge BPE sub-tokens: leading space = new word, no space = continuation.
        words = []
        current = None
        for tok in raw_tokens:
            if tok["text"].startswith(" ") or current is None:
                if current:
                    words.append(current)
                current = {
                    "word": tok["text"].strip(),
                    "start": round(tok["t0"], 3),
                    "end": round(tok["t1"], 3),
                    "probability": tok["p"],
                    "speaker_id": None,
                }
            else:
                current["word"] += tok["text"]
                current["end"] = round(tok["t1"], 3)
                current["probability"] = min(current["probability"], tok["p"])
        if current:
            words.append(current)
        for w in words:
            w["probability"] = round(w["probability"], 4)

        out = {"words": words, "groups": []}
        Path(output).parent.mkdir(parents=True, exist_ok=True)
        with open(output, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
        print(f"transcribed {len(words)} words → {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("wav")
    parser.add_argument("--output", required=True)
    parser.add_argument("--language", default="pl")
    parser.add_argument("--whisper-cli", default="")
    parser.add_argument("--model", default="")
    args = parser.parse_args()
    transcribe(args.wav, args.output, args.language, args.whisper_cli, args.model)
