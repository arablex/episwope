"""
climate_signals.py — Climate → biological leading-indicator.

Spec: docs/specs/2026-05-17-predictive-risk-intelligence.md §1.

Pulls recent daily climate (Open-Meteo, free, no key) for priority
countries, computes standardised anomalies vs a persisted rolling
baseline (same pattern as opensky/ncbi baselines), and derives a
per-country hazard suitability for vector/water-borne pathogens
7–14 days BEFORE clinical reports.

HONEST framing: S is a *model-derived leading hazard signal*, not a
case forecast. Confidence is low until the baseline matures
("seeding"), exactly like the momentum/baseline logic elsewhere.

Outputs:
  public/climate_risk.json      — { iso: {dengue,cholera,...}, meta }
  public/climate_baseline.json  — rolling per-iso climate history
"""
from __future__ import annotations

import json
import math
import sys
import time
import urllib.request
from pathlib import Path
from datetime import datetime, timezone

OUT_DIR  = Path(__file__).parent.parent / "public"
RISK_OUT = OUT_DIR / "climate_risk.json"
BASE_OUT = OUT_DIR / "climate_baseline.json"

RECENT_DAYS   = 14     # "now" window
BASELINE_KEEP = 120    # days of history retained per country
MIN_BASE_DAYS = 35     # need this much history before z is trustworthy

# Priority countries (dengue / cholera / malaria belt + contrast set),
# representative centroid lat/lng.
COORDS = {
    "TH": (15.0, 101.0), "IN": (22.0, 79.0),  "ID": (-2.5, 118.0),
    "PH": (12.8, 121.8), "VN": (16.0, 108.0), "BD": (23.7, 90.4),
    "BR": (-10.0, -52.0),"MX": (23.0, -102.0),"CO": (4.0, -73.0),
    "PE": (-10.0, -76.0),"NG": (9.1, 8.7),    "CD": (-4.0, 21.7),
    "KE": (-1.3, 36.8),  "ET": (9.1, 40.5),   "TZ": (-6.4, 35.0),
    "MZ": (-18.0, 35.0), "PK": (30.0, 69.0),  "EG": (26.8, 30.8),
    "YE": (15.5, 48.0),  "HT": (19.0, -72.3), "SD": (15.5, 30.2),
    "MM": (21.0, 96.0),  "KH": (12.5, 104.9), "LK": (7.9, 80.7),
    "AO": (-12.5, 18.5), "TR": (39.0, 35.0),  "AE": (24.0, 54.0),
    "FR": (46.5, 2.5),   "DE": (51.0, 10.0),  "JP": (36.0, 138.0),
}

# Cholera-endemic / recurrent set (WHO) — static, defensible.
CHOLERA_ENDEMIC = {"CD","NG","ET","KE","TZ","MZ","YE","HT","SD","BD","SO","ZM","MW","HN"}


def _log(m): print(f"[{datetime.now(timezone.utc):%H:%M:%S}] [climate] {m}", flush=True)


def _fetch(iso, lat, lng):
    url = ("https://api.open-meteo.com/v1/forecast"
           f"?latitude={lat}&longitude={lng}"
           "&daily=temperature_2m_mean,precipitation_sum"
           "&past_days=92&forecast_days=1&timezone=UTC")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "vigilo-climate/1.0"})
        with urllib.request.urlopen(req, timeout=25) as r:
            d = json.loads(r.read())
        days = d.get("daily", {})
        t = days.get("temperature_2m_mean") or []
        p = days.get("precipitation_sum") or []
        dts = days.get("time") or []
        out = []
        for i, dt in enumerate(dts):
            if i < len(t) and i < len(p) and t[i] is not None and p[i] is not None:
                out.append({"d": dt, "t": float(t[i]), "p": float(p[i])})
        return out
    except Exception as e:
        _log(f"  {iso} fetch error: {e}")
        return []


def _load(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default
    except Exception:
        return default


def _mean_sd(xs):
    if not xs:
        return 0.0, 1.0
    m = sum(xs) / len(xs)
    sd = (sum((x - m) ** 2 for x in xs) / len(xs)) ** 0.5
    return m, (sd if sd > 1e-6 else 1.0)


# Aedes aegypti → DENV transmission thermal response.
# Validated trait-based Briére fit (Mordecai et al. 2017, eLife
# "Detecting the impact of temperature on transmission of Zika,
# dengue and chikungunya"): T_min≈17.8°C, T_opt≈29.1°C, T_max≈34.6°C,
# left-skewed. Relative suitability normalised to peak=1 (the constant
# c folds out — we only need 0–1). Citable, zero-training.
_AE_TMIN, _AE_TMAX = 17.8, 34.6
def _briere(t, t0=_AE_TMIN, tm=_AE_TMAX):
    return 0.0 if (t <= t0 or t >= tm) else t * (t - t0) * math.sqrt(tm - t)
_AE_PEAK = max(_briere(x / 10.0) for x in range(int(_AE_TMIN * 10),
                                                int(_AE_TMAX * 10)))
def _thermal_aedes(t):
    """Normalised Mordecai-2017 Aedes/DENV thermal suitability (0–1)."""
    return max(0.0, min(1.0, _briere(t) / _AE_PEAK))


def _clip(v, lo=0.0, hi=1.0):
    return max(lo, min(hi, v))


def _band(s):  # 0–1 suitability → 0–5-style band label
    return ("critical" if s >= 0.8 else "severe" if s >= 0.65 else
            "elevated" if s >= 0.5 else "moderate" if s >= 0.35 else
            "low" if s >= 0.2 else "minimal")


def main() -> int:
    _log("start")
    base = _load(BASE_OUT, {})
    now_iso = datetime.now(timezone.utc).isoformat()
    today = datetime.now(timezone.utc).date().isoformat()
    risk = {}

    for iso, (lat, lng) in COORDS.items():
        series = _fetch(iso, lat, lng)
        time.sleep(0.25)  # courtesy
        if not series:
            continue

        # merge into rolling baseline (dedupe by date), keep last N
        hist = {h["d"]: h for h in base.get(iso, [])}
        for s in series:
            hist[s["d"]] = {"d": s["d"], "t": s["t"], "p": s["p"]}
        merged = sorted(hist.values(), key=lambda x: x["d"])[-BASELINE_KEEP:]
        base[iso] = merged

        recent = merged[-RECENT_DAYS:]
        older  = merged[:-RECENT_DAYS]
        if len(recent) < 7:
            continue
        seeding = len(older) < MIN_BASE_DAYS
        ref = older if older else merged

        tm, tsd = _mean_sd([x["t"] for x in ref])
        pm, psd = _mean_sd([x["p"] for x in ref])
        t_recent = sum(x["t"] for x in recent) / len(recent)
        p_recent = sum(x["p"] for x in recent) / len(recent)
        zT = (t_recent - tm) / tsd
        zP = (p_recent - pm) / psd

        g = _thermal_aedes(t_recent)
        # S_dengue = thermal suitability + lagged precip/temp anomaly push
        S_d = _clip(0.55 * g + 0.30 * _clip(zP / 2.0) + 0.15 * _clip(zT / 2.0))
        # S_cholera = warm + heavy-rain flush + endemic prior
        endemic = 1.0 if iso in CHOLERA_ENDEMIC else 0.0
        S_c = _clip(0.40 * _clip(zT / 2.0) + 0.40 * _clip(zP / 1.5)
                    + 0.20 * endemic)

        conf = "low" if seeding else "model"
        risk[iso] = {
            "dengue":  {"S": round(S_d, 3), "band": _band(S_d),
                        "lead_days": 10, "confidence": conf},
            "cholera": {"S": round(S_c, 3), "band": _band(S_c),
                        "lead_days": 14, "confidence": conf},
            "drivers": {"t_recent": round(t_recent, 1), "zT": round(zT, 2),
                        "p_recent": round(p_recent, 2), "zP": round(zP, 2),
                        "thermal": round(g, 2)},
            "asof": today,
        }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    BASE_OUT.write_text(json.dumps(base, ensure_ascii=False), encoding="utf-8")
    RISK_OUT.write_text(json.dumps({
        "meta": {"generated_at": now_iso, "countries": len(risk),
                 "model": "open-meteo climate anomaly → pathogen suitability",
                 "note": "Model-derived leading hazard signal, not a case forecast."},
        "risk": risk,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    _log(f"wrote {len(risk)} countries → {RISK_OUT.name}")
    # quick visibility: top dengue/cholera suitability
    for k in ("dengue", "cholera"):
        top = sorted(risk.items(), key=lambda kv: kv[1][k]["S"], reverse=True)[:5]
        _log(f"top {k}: " + ", ".join(f"{i}={v[k]['S']}({v[k]['band']})" for i, v in top))
    _log("done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
