from backend.matcher import match_assets


def _wav(name, dur):
    return {"name": name, "path": f"/{name}", "duration": dur}


def _bg(name, dur):
    return {"name": name, "path": f"/{name}", "duration": dur}


def test_exact_fit_assigned():
    wavs = [_wav("a.wav", 30)]
    bgs = [_bg("bg1.mp4", 30), _bg("bg2.mp4", 60)]
    pairs = match_assets(wavs, bgs)
    assert pairs[0]["wav"]["name"] == "a.wav"
    assert pairs[0]["bg"]["name"] == "bg1.mp4"
    assert pairs[0]["loops"] is False


def test_shortest_qualifying_bg_wins():
    wavs = [_wav("a.wav", 25)]
    bgs = [_bg("short.mp4", 20), _bg("just.mp4", 30), _bg("long.mp4", 60)]
    pairs = match_assets(wavs, bgs)
    assert pairs[0]["bg"]["name"] == "just.mp4"


def test_loops_flag_when_no_bg_long_enough():
    wavs = [_wav("a.wav", 60)]
    bgs = [_bg("bg1.mp4", 30), _bg("bg2.mp4", 45)]
    pairs = match_assets(wavs, bgs)
    assert pairs[0]["bg"]["name"] == "bg2.mp4"
    assert pairs[0]["loops"] is True


def test_each_bg_used_once():
    wavs = [_wav("a.wav", 30), _wav("b.wav", 30)]
    bgs = [_bg("bg1.mp4", 35), _bg("bg2.mp4", 35)]
    pairs = match_assets(wavs, bgs)
    used = {p["bg"]["name"] for p in pairs}
    assert len(used) == 2


def test_output_sorted_alphabetically_by_wav():
    wavs = [_wav("c.wav", 10), _wav("a.wav", 10), _wav("b.wav", 10)]
    bgs = [_bg(f"bg{i}.mp4", 20) for i in range(3)]
    pairs = match_assets(wavs, bgs)
    assert [p["wav"]["name"] for p in pairs] == ["a.wav", "b.wav", "c.wav"]
