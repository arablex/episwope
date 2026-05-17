"""
epi_analytics.py — Honest signal-derived dynamics + composite Threat Index.

IMPORTANT framing (deliberate, see product decision):
  Vigilo has NO clinical case counts. It has a time series of how many
  independent sources mention disease X in country Y per run. So we do
  NOT compute a clinical Rt. We compute "Signal Momentum" — the relative
  acceleration of attention/mentions — and we keep the literature-derived
  Rt (R0) from pathogen_params SEPARATE and clearly labelled.

  Threat Index fuses three honest components, matching the UI legend
  "нагрузка × CFR × Rt":
      load     = signal burden  (our data, normalised)
      cfr      = case fatality  (literature constant)
      momentum = signal momentum proxy for transmissibility (our data)
  plus a small intrinsic-hazard weight from the pathogen R0.

Pure standard library — no numpy — runs in bare GitHub Actions python.
"""

from __future__ import annotations

import math
import re
from datetime import datetime, timezone

from pathogen_params import get_params


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def _parse_ts(ts: str) -> datetime | None:
    try:
        dt = datetime.fromisoformat(ts)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Signal momentum  — relative acceleration of mentions over time
# ---------------------------------------------------------------------------

def signal_momentum(history: dict, iso: str, disease: str) -> dict:
    """
    Compare a recent window of mention counts against a prior window.

    Returns:
      {
        momentum: float   # recent_mean / prior_mean, clamped [0.1, 10]
        confidence: str   # 'high'|'low'|'none' — how much history backs it
        recent_mean: float
        prior_mean: float
        n_points: int
      }
    """
    key = f"{iso}_{_slug(disease)}"
    entries = history.get("baseline", {}).get(key, [])
    pts = []
    for e in entries:
        dt = _parse_ts(e.get("ts", ""))
        if dt is not None:
            pts.append((dt, float(e.get("count", 0))))
    pts.sort(key=lambda x: x[0])

    if len(pts) < 3:
        return {
            "momentum": 1.0, "confidence": "none",
            "recent_mean": pts[-1][1] if pts else 0.0,
            "prior_mean": 0.0, "n_points": len(pts),
        }

    now = pts[-1][0]
    recent, prior = [], []
    for dt, c in pts:
        age_h = (now - dt).total_seconds() / 3600.0
        if age_h <= 24:
            recent.append(c)
        elif age_h <= 96:           # 1–4 days ago = baseline window
            prior.append(c)

    # Fallbacks when the windows are sparse (e.g. history just seeded)
    if not recent:
        recent = [pts[-1][1]]
    if not prior:
        # use the older half of whatever we have
        half = max(1, len(pts) // 2)
        prior = [c for _, c in pts[:half]]

    recent_mean = sum(recent) / len(recent)
    prior_mean = sum(prior) / len(prior)

    raw = (recent_mean + 1.0) / (prior_mean + 1.0)
    momentum = max(0.1, min(10.0, raw))

    # Confidence in the momentum estimate: needs enough spread of points
    span_h = (pts[-1][0] - pts[0][0]).total_seconds() / 3600.0
    conf = "high" if (len(pts) >= 6 and span_h >= 18) else "low"

    return {
        "momentum": round(momentum, 3),
        "confidence": conf,
        "recent_mean": round(recent_mean, 2),
        "prior_mean": round(prior_mean, 2),
        "n_points": len(pts),
    }


def doubling_time_days(mom: dict, window_days: float = 2.0) -> float | None:
    """
    Estimate doubling time (days) from the momentum ratio over the
    comparison window. Returns None if not growing or estimate unreliable.
    """
    m = mom.get("momentum", 1.0)
    if mom.get("confidence") == "none" or m <= 1.05:
        return None
    try:
        # m = 2 ** (window_days / Td)  ->  Td = window_days * ln2 / ln(m)
        td = window_days * math.log(2) / math.log(m)
        if td <= 0 or td > 365:
            return None
        return round(td, 1)
    except Exception:
        return None


def trend_class(mom: dict) -> str:
    """Human-readable trend bucket from the momentum ratio."""
    if mom.get("confidence") == "none":
        return "establishing baseline"
    m = mom.get("momentum", 1.0)
    if m >= 2.5:
        return "accelerating"
    if m >= 1.3:
        return "rising"
    if m >= 0.8:
        return "plateau"
    if m >= 0.4:
        return "declining"
    return "fading"


# ---------------------------------------------------------------------------
# Threat Index  —  load × CFR × momentum  (+ intrinsic R0 weight)
# ---------------------------------------------------------------------------

# Legend tiers shown in app.html (Индекс угрозы)
THREAT_TIERS = [
    (0,   "monitoring",  "Монит."),
    (15,  "low",         "Низкий"),
    (30,  "watch",       "Внимание"),
    (50,  "alert",       "Алерт"),
    (70,  "critical",    "Критич."),
    (88,  "catastrophic","Катастрофа"),
]


def _tier(score: float) -> tuple[str, str]:
    label_en, label_ru = "monitoring", "Монит."
    for thr, en, ru in THREAT_TIERS:
        if score >= thr:
            label_en, label_ru = en, ru
    return label_en, label_ru


def compute_threat_index(
    disease: str,
    confidence: float,
    source_count: int,
    momentum: dict,
) -> dict:
    """
    Composite 0–100 hazard score fusing:
      load     = signal burden       (confidence + breadth of sourcing)
      cfr      = case fatality       (literature)
      momentum = attention velocity  (our data, proxy for transmissibility)
      r0wt     = intrinsic spreadability bonus (literature)

    All components are bounded so no single term can run away.
    """
    p = get_params(disease)
    cfr = float(p.get("cfr") or 0.01)
    r0 = p.get("r0")

    # ── load: how strong & broad is the signal right now (0–1) ──
    breadth = min(source_count / 12.0, 1.0)            # 12+ sources = saturated
    load = 0.55 * float(confidence) + 0.45 * breadth   # 0–1

    # ── cfr term: log-scaled so 0.1%→50% spreads sensibly (0–1) ──
    # log10(cfr) ranges roughly -4 (0.01%) .. 0 (100%)
    cfr_term = min(max((math.log10(max(cfr, 1e-4)) + 4) / 4.0, 0.0), 1.0)

    # ── momentum term: 1.0 neutral -> 0.5; 4x -> ~1.0; 0.3x -> ~0.2 ──
    m = momentum.get("momentum", 1.0)
    mom_term = min(max(0.5 + 0.5 * math.log2(max(m, 0.1)) / 2.0, 0.0), 1.0)

    # ── intrinsic transmissibility bonus from R0 (0–0.15) ──
    if r0 is None:
        r0wt = 0.03                       # zoonotic/vector: modest floor
    else:
        r0wt = min(r0 / 15.0, 1.0) * 0.15  # measles R0~15 -> full bonus

    # Weighted blend → 0..1, then scaled to 0..100
    core = (0.34 * load) + (0.34 * cfr_term) + (0.24 * mom_term) + r0wt
    score = round(min(core, 1.0) * 100.0, 1)

    tier_en, tier_ru = _tier(score)

    return {
        "threat_index": score,
        "threat_tier": tier_en,
        "threat_tier_ru": tier_ru,
        "components": {
            "load": round(load, 3),
            "cfr_term": round(cfr_term, 3),
            "momentum_term": round(mom_term, 3),
            "r0_weight": round(r0wt, 3),
        },
    }


# ---------------------------------------------------------------------------
# One-call enrichment used by the signals engine
# ---------------------------------------------------------------------------

def enrich_signal(history: dict, iso: str, disease: str,
                   confidence: float, source_count: int) -> dict:
    """
    Produce the full analytics block attached to a signal.

    Returns a dict ready to merge into the signal JSON object.
    """
    p = get_params(disease)
    mom = signal_momentum(history, iso, disease)
    ti = compute_threat_index(disease, confidence, source_count, mom)
    td = doubling_time_days(mom)

    return {
        "pathogen": {
            "r0": p.get("r0"),
            "cfr": p.get("cfr"),
            "cfr_note": p.get("cfr_note"),
            "incubation_days": p.get("incubation_days"),
            "serial_days": p.get("serial_days"),
            "route": p.get("route"),
            "hazard_tier": p.get("tier"),
            "source": p.get("source"),
            "literature_backed": not p.get("fallback", False),
        },
        "momentum": mom["momentum"],
        "momentum_confidence": mom["confidence"],
        "trend": trend_class(mom),
        "doubling_time_days": td,
        "threat_index": ti["threat_index"],
        "threat_tier": ti["threat_tier"],
        "threat_tier_ru": ti["threat_tier_ru"],
        "threat_components": ti["components"],
    }
