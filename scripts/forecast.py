"""
forecast.py — 7-day Composite Risk projection (CDO spec block ②).

HONEST DESIGN (Data-Scientist call): a supervised LightGBM 7-day model
needs X_t → Composite_{t+7} pairs over many weeks. That history does
not exist yet, so shipping a "trained forecast" now would be fabricated.

Instead this module:
  1. ACCRUES the training panel every run → public/risk_history.json
     (the data foundation; without it the ML model can never exist).
  2. Ships a TRANSPARENT trend + climate-exogenous projector — clearly
     labelled `model: "trend+exogenous v0"`, explainable `drivers`,
     confidence reflecting history maturity. Not a black box.
  3. Is a drop-in seam: once risk_history has enough daily points a
     train_forecast.py can fit LightGBM-quantile + SHAP and replace the
     projector behind the same forecast.json contract.

Reads: public/risk_index.json, public/climate_risk.json
Writes: public/risk_history.json, public/forecast.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from datetime import datetime, timezone

OUT = Path(__file__).parent.parent / "public"
IDX = OUT / "risk_index.json"
CLIM = OUT / "climate_risk.json"
HIST = OUT / "risk_history.json"
FC = OUT / "forecast.json"

KEEP_DAYS = 120        # rolling daily history per country
TREND_WIN = 14         # days used for slope


def _log(m): print(f"[{datetime.now(timezone.utc):%H:%M:%S}] [forecast] {m}", flush=True)
def _load(p, d):
    try: return json.loads(p.read_text(encoding="utf-8")) if p.exists() else d
    except Exception: return d
def _clip(v, lo=0.0, hi=5.0): return max(lo, min(hi, v))


def _slope(ys):
    """Least-squares slope per step over the series (0 if <3 pts)."""
    n = len(ys)
    if n < 3:
        return 0.0
    xm = (n - 1) / 2.0
    ym = sum(ys) / n
    num = sum((i - xm) * (ys[i] - ym) for i in range(n))
    den = sum((i - xm) ** 2 for i in range(n)) or 1.0
    return num / den


def _band(s):
    return ("critical" if s >= 4.5 else "severe" if s >= 3.5 else
            "elevated" if s >= 2.5 else "moderate" if s >= 1.5 else
            "low" if s >= 0.5 else "minimal")


def _trend(delta):
    if delta >= 0.4:  return "accelerating"
    if delta >= 0.15: return "rising"
    if delta > -0.15: return "stable"
    if delta > -0.4:  return "declining"
    return "easing"


def main() -> int:
    _log("start")
    idx = _load(IDX, {}).get("index", {})
    clim = _load(CLIM, {}).get("risk", {})
    hist = _load(HIST, {})
    today = datetime.now(timezone.utc).date().isoformat()
    now_iso = datetime.now(timezone.utc).isoformat()

    # 1. accrue daily-deduped training panel
    for iso, blk in idx.items():
        c = float((blk.get("composite_risk") or {}).get("score", 0))
        cb = clim.get(iso, {})
        cd = float((cb.get("dengue") or {}).get("S", 0))
        cc = float((cb.get("cholera") or {}).get("S", 0))
        rows = hist.get(iso, [])
        if rows and rows[-1].get("d") == today:
            rows[-1] = {"d": today, "c": round(c, 2), "cd": cd, "cc": cc}
        else:
            rows.append({"d": today, "c": round(c, 2), "cd": cd, "cc": cc})
        hist[iso] = rows[-KEEP_DAYS:]

    # 2. transparent projection per country
    fc = {}
    for iso, rows in hist.items():
        cur = idx.get(iso, {})
        c_now = float((cur.get("composite_risk") or {}).get("score", 0))
        dom = (cur.get("composite_risk") or {}).get("dominant_category")
        ser = [r["c"] for r in rows][-TREND_WIN:]
        n = len(ser)
        slope = _slope(ser) if n >= 3 else 0.0
        trend_term = slope * 7.0

        cb = clim.get(iso, {})
        cd = float((cb.get("dengue") or {}).get("S", 0))
        cc = float((cb.get("cholera") or {}).get("S", 0))
        push_d = 0.55 * max(0.0, cd - 0.5) * 2  # severe dengue → ~+0.5
        push_c = 0.45 * max(0.0, cc - 0.5) * 2
        clim_push = min(push_d + push_c, 0.8)

        proj = _clip(c_now + trend_term + clim_push)
        delta = round(proj - c_now, 2)

        # regime-shift novelty: latest vs prior window z
        regime = False
        if n >= 6:
            ref = ser[:-1]
            m = sum(ref) / len(ref)
            sd = (sum((x - m) ** 2 for x in ref) / len(ref)) ** 0.5 or 1.0
            if abs((ser[-1] - m) / sd) >= 2.0:
                regime = True

        conf = ("establishing" if n < 5 else
                "indicative" if n < 14 else "indicative+")

        drivers = []
        if abs(trend_term) >= 0.05:
            drivers.append({
                "factor": "trend",
                "detail": f"{'rising' if slope > 0 else 'declining'} {n}-day trend",
                "impact": round(trend_term, 2)})
        if push_d > 0.02:
            drivers.append({
                "factor": "climate",
                "detail": f"dengue suitability {(cb.get('dengue') or {}).get('band','')}",
                "impact": round(push_d, 2)})
        if push_c > 0.02:
            drivers.append({
                "factor": "climate",
                "detail": f"cholera suitability {(cb.get('cholera') or {}).get('band','')}",
                "impact": round(push_c, 2)})
        if dom and c_now >= 1.5:
            drivers.append({
                "factor": "active_risk",
                "detail": f"{dom} dominant now",
                "impact": round(min(c_now / 5, 1), 2)})
        drivers = sorted(drivers, key=lambda d: -abs(d["impact"]))[:3]

        fc[iso] = {
            "composite_now": round(c_now, 2),
            "proj_7d": round(proj, 2),
            "band_7d": _band(proj),
            "delta": delta,
            "trend": _trend(delta),
            "confidence": conf,
            "regime_shift": regime,
            "history_points": n,
            "drivers": drivers,
        }

    OUT.mkdir(parents=True, exist_ok=True)
    HIST.write_text(json.dumps(hist, ensure_ascii=False), encoding="utf-8")
    FC.write_text(json.dumps({
        "meta": {
            "generated_at": now_iso,
            "horizon_days": 7,
            "model": "trend+exogenous v0 (LightGBM-quantile upgrade pending history accrual)",
            "countries": len(fc),
            "note": "Transparent projection, not a trained ML forecast. "
                    "Confidence reflects history maturity.",
        },
        "forecast": fc,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    _log(f"history {len(hist)} countries · forecast {len(fc)} written")
    top = sorted(fc.items(), key=lambda kv: -kv[1]["delta"])[:5]
    _log("biggest projected rises: " +
         ", ".join(f"{i} {v['composite_now']}→{v['proj_7d']} ({v['delta']:+})"
                   for i, v in top))
    _log("done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
