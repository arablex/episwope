import json, os, sys, tempfile
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import inform

def test_loads_map_and_clips():
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "inform_risk.json")
        json.dump({"SO": 0.85, "DE": 0.12, "XX": 5.0, "YY": -1.0}, open(p, "w"))
        m = inform.load_fragility(p)
        assert m["SO"] == 0.85
        assert m["DE"] == 0.12
        assert m["XX"] == 1.0      # clipped to [0,1]
        assert m["YY"] == 0.0

def test_missing_file_returns_empty():
    assert inform.load_fragility("/no/such/file.json") == {}
