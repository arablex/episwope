import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import risk_scoring as rs

def test_quiet_fragile_gets_low_floor():
    r = rs.composite_score({c: 0.0 for c in rs.CATEGORIES}, fragility=1.0)
    assert r["live_score"] == 0.0
    assert abs(r["score"] - rs.FLOOR_MAX) < 1e-9
    assert r["band"] == "low"
    assert r["fragility"] == 1.0

def test_quiet_stable_stays_zero():
    r = rs.composite_score({c: 0.0 for c in rs.CATEGORIES}, fragility=0.0)
    assert r["score"] == 0.0 and r["band"] == "minimal"

def test_amplifier_bounded_and_live_preserved():
    cats = {c: 0.0 for c in rs.CATEGORIES}; cats["conflict"] = 3.0
    base = rs.composite_score(cats, fragility=0.0)
    amp  = rs.composite_score(cats, fragility=1.0)
    assert amp["live_score"] == base["score"]
    assert amp["score"] > base["score"]
    assert amp["score"] <= round(base["score"] * 1.20 + 1e-9, 2)

def test_flag_off_is_passthrough(monkeypatch):
    monkeypatch.setattr(rs, "USE_FRAGILITY", False)
    cats = {c: 0.0 for c in rs.CATEGORIES}; cats["conflict"] = 2.0
    r = rs.composite_score(cats, fragility=1.0)
    assert r["score"] == r["live_score"]

def test_score_never_exceeds_5():
    cats = {c: 5.0 for c in rs.CATEGORIES}
    r = rs.composite_score(cats, fragility=1.0)
    assert r["score"] <= 5.0
