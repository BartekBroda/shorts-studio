from backend.subtitle_renderer import build_subtitle_lines, get_active_word_idx

WORDS = [
    {"word": "Hello", "start": 0.0, "end": 0.5, "probability": 0.9},
    {"word": "world", "start": 0.5, "end": 1.0, "probability": 0.9},
    {"word": "foo",   "start": 1.0, "end": 1.5, "probability": 0.9},
    {"word": "bar",   "start": 1.5, "end": 2.0, "probability": 0.9},
]

def test_build_lines_with_no_groups_uses_max_words():
    lines = build_subtitle_lines(WORDS, groups=[], max_words=2)
    assert len(lines) == 2
    assert [w["word"] for w in lines[0]] == ["Hello", "world"]
    assert [w["word"] for w in lines[1]] == ["foo", "bar"]

def test_build_lines_with_manual_group():
    # group indices 0,1,2 together; word 3 auto-chunked alone
    groups = [[0, 1, 2]]
    lines = build_subtitle_lines(WORDS, groups=groups, max_words=2)
    assert [w["word"] for w in lines[0]] == ["Hello", "world", "foo"]
    assert [w["word"] for w in lines[1]] == ["bar"]

def test_get_active_word_idx_returns_correct_index():
    assert get_active_word_idx(WORDS, 0.3) == 0
    assert get_active_word_idx(WORDS, 0.7) == 1
    assert get_active_word_idx(WORDS, 5.0) == -1  # past end

def test_get_active_word_idx_before_start():
    assert get_active_word_idx(WORDS, -0.1) == -1

def test_boundary_no_double_activation():
    """At exact word boundary t=1.0, only the second line should be active, not both."""
    words = [
        {"word": "Hello", "start": 0.0, "end": 1.0, "probability": 0.9},
        {"word": "world", "start": 1.0, "end": 2.0, "probability": 0.9},
    ]
    groups = [[0], [1]]
    lines = build_subtitle_lines(words, groups=groups, max_words=2)
    line_spans = [(line[0]["start"], line[-1]["end"]) for line in lines]
    t = 1.0
    # With < on right end, only second span matches at t=1.0 — correct
    active = [i for i, (ls, le) in enumerate(line_spans) if ls <= t < le]
    assert active == [1], f"Expected only line 1 active at t=1.0, got {active}"
