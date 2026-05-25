"""Runtime loader for the INFORM structural-fragility map (stdlib only).
Returns {ISO2: F in [0,1]}. Missing/corrupt file -> {} (fragility simply off)."""
import json
from pathlib import Path

DEFAULT_PATH = Path(__file__).resolve().parent.parent / "public" / "inform_risk.json"

def load_fragility(path=DEFAULT_PATH) -> dict:
    try:
        raw = json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return {}
    out = {}
    for iso, v in (raw or {}).items():
        try:
            out[str(iso).upper()] = max(0.0, min(1.0, float(v)))
        except (TypeError, ValueError):
            continue
    return out
