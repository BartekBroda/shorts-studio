def match_assets(wavs: list[dict], bgs: list[dict]) -> list[dict]:
    """
    Pair each WAV with one BG. Each BG used at most once per episode.

    Algorithm:
    - Sort WAVs longest→shortest (longest gets first pick)
    - For each WAV, find available BG with shortest duration ≥ WAV duration
    - If no qualifying BG, use the longest available BG (will loop)
    - Return sorted alphabetically by wav name

    Returns list of dicts: [{"wav": {...}, "bg": {...}, "loops": bool, "bg_start": "0:00"}, ...]
    """
    available = list(bgs)
    # Process longest WAV first so it gets best pick
    ordered = sorted(wavs, key=lambda w: w["duration"], reverse=True)
    pairs = []

    for wav in ordered:
        dur = wav["duration"]
        # Find qualifying BGs: duration >= wav duration
        qualifying = [b for b in available if b["duration"] >= dur]

        if qualifying:
            # Choose shortest qualifying BG
            chosen = min(qualifying, key=lambda b: b["duration"])
            loops = False
        else:
            # No qualifying BG, use longest available (will loop)
            chosen = max(available, key=lambda b: b["duration"]) if available else None
            loops = True

        if chosen:
            available.remove(chosen)

        pairs.append({
            "wav": wav,
            "bg": chosen,
            "loops": loops,
            "bg_start": "0:00"
        })

    # Sort by wav name alphabetically
    pairs.sort(key=lambda p: p["wav"]["name"])

    return pairs
