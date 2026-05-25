"""
risk_scoring.py — Composite Risk Score (0–5) for the B2B Risk API.

Pure standard library, no deps, fully unit-testable. Implements the
hybrid "max-dominant + weighted tail" model from the design spec
(docs/specs/2026-05-17-b2b-risk-intelligence-api-design.md §6).

A single catastrophic event must dominate, not be averaged away — that
is what insurer / travel buyers require (kinetic > equally-loud flu).
"""

from __future__ import annotations

import math
from datetime import datetime, timezone

CATEGORIES = (
    "health", "conflict", "civil_unrest", "transport",
    "border", "infrastructure", "climate",
)

# Intrinsic hazard weight: how dangerous a category is *per se*.
INTRINSIC_WEIGHT = {
    "conflict": 1.00, "border": 0.80, "transport": 0.70,
    "infrastructure": 0.70, "civil_unrest": 0.60,
    "health": 0.55, "climate": 0.50,
}

# Recency half-life (days) — kinetic decays fast, health slow.
HALFLIFE_DAYS = {
    "conflict": 3, "civil_unrest": 5, "transport": 4, "border": 6,
    "infrastructure": 4, "health": 14, "climate": 7,
}

# Source-class trust multiplier.
SRC_MULT = {
    "tier1_official": 1.00, "tier2_official": 0.95, "tier3_pro": 0.90,
    "tier4_media": 0.85, "tier5_social": 0.70,
}

BANDS = ["minimal", "low", "moderate", "elevated", "severe", "critical"]

# ── Structural fragility layer (INFORM) ─────────────────────────────
# Bounded floor + amplifier so a quiet-but-fragile country reads above a
# quiet-stable one, WITHOUT letting structure dominate the live signal.
USE_FRAGILITY = True
FLOOR_MAX = 1.0   # max score (=="low") a quiet, maximally-fragile country reaches
AMP = 0.20        # live signal of the most fragile country amplified up to +20%


def _clip(v: float, lo: float = 0.0, hi: float = 5.0) -> float:
    return max(lo, min(hi, v))


def band_for(score: float) -> str:
    return BANDS[min(int(round(score)), 5)]


def _age_days(ts: str, now: datetime) -> float:
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return max((now - dt).total_seconds() / 86400.0, 0.0)
    except Exception:
        return 1.0


def event_score(ev: dict, now: datetime | None = None) -> float:
    """Per-event contribution in [0, 1]."""
    now = now or datetime.now(timezone.utc)
    cat = ev.get("category", "health")
    sev = float(ev.get("severity", 0)) / 5.0
    conf = float(ev.get("confidence", 0.5))
    hl = HALFLIFE_DAYS.get(cat, 7)
    rec = math.exp(-_age_days(ev.get("last_updated") or ev.get("first_seen", ""), now) / hl)
    smult = SRC_MULT.get(ev.get("source_class", "tier4_media"), 0.85)
    return max(0.0, min(1.0, sev * rec * conf * smult))


def category_score(events: list[dict], category: str,
                    now: datetime | None = None) -> float:
    """Aggregate one category's events into a 0–5 score."""
    if not events:
        return 0.0
    scored = sorted((event_score(e, now) for e in events), reverse=True)
    top = scored[0]
    top3 = scored[:3]
    raw = 0.65 * top + 0.35 * (sum(top3) / len(top3))
    return round(_clip(raw * INTRINSIC_WEIGHT.get(category, 0.6) * 5.0), 2)


def composite_score(cat_scores: dict[str, float], fragility: float = 0.0) -> dict:
    """
    Fuse per-category scores into the headline 0–5 composite, then apply the
    structural-fragility floor + amplifier. Returns
    {score, live_score, fragility, band, dominant_category}.
    """
    ranked = sorted(
        ((c, s) for c, s in cat_scores.items()),
        key=lambda kv: kv[1], reverse=True,
    )
    if not ranked or ranked[0][1] <= 0:
        live = 0.0
        dominant = None
    else:
        top_score = ranked[0][1]
        tail = ranked[1:]
        tail_add = 0.0
        for i, (_, s) in enumerate(tail):
            tail_add += (0.45 if i == 0 else 0.20 if i == 1 else 0.08) * s
        comp = top_score + min(tail_add, 5.0 - top_score) * 0.6
        if sum(1 for _, s in ranked if s >= 3.0) >= 2:
            comp *= 1.15
        live = round(_clip(comp), 2)
        dominant = ranked[0][0]

    f = max(0.0, min(1.0, float(fragility))) if USE_FRAGILITY else 0.0
    final = round(_clip(max(live * (1.0 + AMP * f), f * FLOOR_MAX)), 2)
    return {
        "score": final,
        "live_score": live,
        "fragility": round(f, 3),
        "band": band_for(final),
        "dominant_category": dominant,
    }


def score_geo(events: list[dict], now: datetime | None = None,
              fragility: float = 0.0) -> dict:
    """
    Full scoring for one geography.

    Input: list of event dicts (each with category, severity, confidence,
    source_class, first_seen/last_updated).
    Output: {composite_risk, category_breakdown}.
    """
    now = now or datetime.now(timezone.utc)
    by_cat: dict[str, list[dict]] = {c: [] for c in CATEGORIES}
    for e in events:
        by_cat.setdefault(e.get("category", "health"), []).append(e)

    cat_scores = {}
    breakdown = {}
    for cat in CATEGORIES:
        evs = by_cat.get(cat, [])
        sc = category_score(evs, cat, now)
        cat_scores[cat] = sc
        top = max(evs, key=lambda e: event_score(e, now), default=None)
        breakdown[cat] = {
            "score": sc,
            "band": band_for(sc),
            "active_events": len(evs),
            "top_threat": (top or {}).get("type") or (top or {}).get("headline"),
        }

    comp = composite_score(cat_scores, fragility=fragility)
    return {"composite_risk": comp, "category_breakdown": breakdown}
