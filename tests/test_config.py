import json
import os
import tempfile

import pytest

from backend.config import load_config, save_config, CONFIG_PATH


def test_load_config_returns_defaults_when_missing(tmp_path, monkeypatch):
    monkeypatch.setattr("backend.config.CONFIG_PATH", str(tmp_path / "config.json"))
    cfg = load_config()
    assert cfg == {"bg_library": "", "whisper_cli": "", "whisper_model": "", "recent_projects": []}


def test_save_and_load_roundtrip(tmp_path, monkeypatch):
    path = str(tmp_path / "config.json")
    monkeypatch.setattr("backend.config.CONFIG_PATH", path)
    save_config({"bg_library": "/bgs", "recent_projects": ["/eps"]})
    assert load_config() == {"bg_library": "/bgs", "whisper_cli": "", "whisper_model": "", "recent_projects": ["/eps"]}
