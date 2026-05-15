import pytest
from unittest.mock import patch
from backend.probe import probe_duration, list_video_files, list_wav_files


def test_probe_duration_parses_ffprobe_output():
    fake_output = '{"format": {"duration": "27.413000"}}'
    with patch("backend.probe._run_ffprobe", return_value=fake_output):
        assert probe_duration("/fake/clip.wav") == pytest.approx(27.413, abs=0.001)


def test_list_video_files_returns_mp4_mov(tmp_path):
    (tmp_path / "a.mp4").touch()
    (tmp_path / "b.mov").touch()
    (tmp_path / "ignore.txt").touch()
    result = list_video_files(str(tmp_path))
    names = [r["name"] for r in result]
    assert "a.mp4" in names
    assert "b.mov" in names
    assert "ignore.txt" not in names


def test_list_wav_files(tmp_path):
    (tmp_path / "clip1.wav").touch()
    (tmp_path / "clip2.wav").touch()
    (tmp_path / "other.mp3").touch()
    result = list_wav_files(str(tmp_path))
    assert len(result) == 2
    assert all(r["name"].endswith(".wav") for r in result)
