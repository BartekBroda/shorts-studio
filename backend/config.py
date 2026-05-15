import json
import os
from pathlib import Path

CONFIG_PATH = os.path.expanduser("~/.config/shorts-studio/config.json")
_DEFAULTS = {
    "bg_library": "",
    "whisper_cli": "",
    "whisper_model": "",
    "recent_projects": [],
}


def load_config() -> dict:
    path = Path(CONFIG_PATH)
    if not path.exists():
        return dict(_DEFAULTS)
    with open(path) as f:
        data = json.load(f)
    return {**_DEFAULTS, **data}


def save_config(cfg: dict) -> None:
    path = Path(CONFIG_PATH)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(cfg, f, indent=2)
