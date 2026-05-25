import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import risk_scoring as rs

def test_score_geo_passes_fragility():
    # No events + fragility -> composite gets the floor
    out = rs.score_geo([], fragility=1.0)
    assert out["composite_risk"]["live_score"] == 0.0
    assert abs(out["composite_risk"]["score"] - rs.FLOOR_MAX) < 1e-9
