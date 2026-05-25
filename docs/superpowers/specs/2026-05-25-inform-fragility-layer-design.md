# Structural Fragility Layer (INFORM) — Design

_Date: 2026-05-25 · Status: approved, pending implementation plan_

## Problem

Vigilo's composite risk score (`scripts/risk_scoring.py → composite_score`) is
**event-driven only**: per-category event scores fused via max-dominant + weighted
tail + multi-domain amplifier. There is **no structural input**.

Two consequences:
1. A structurally fragile but quiet country (weak institutions, low coping capacity)
   reads as low-risk as a stable quiet country — a real blind spot.
2. Published copy (WEF intel post, weekly briefs) claims the score blends
   "structural fragility" — which the engine does **not** compute. That is an
   overclaim, harmful for a credibility-first product.

## Goal

Add a structural-fragility layer that (a) makes the score smarter on the
quiet-but-fragile case, and (b) makes the "structural fragility" claim true —
**while the live real-time signal stays dominant** (must not become "INFORM with
a news tint"). Every-country score changes, so it must be careful, transparent,
and reversible.

## Data source

- **INFORM Risk Index** (European Commission JRC + UN OCHA) — the humanitarian
  sector's standard country-risk index (~191 countries, annual). Conceptually it
  IS the A−R−X framing: Hazard & Exposure × Vulnerability × Lack of Coping
  Capacity. Crucially, it is an index our B2B buyers (NGO/UN/duty-of-care)
  already trust.
- We take the **overall INFORM Risk score (0–10)** per ISO2 → normalize
  `F = INFORM / 10 ∈ [0,1]`.
- Fetch once, cache to `public/inform_risk.json` (committed). Refresh annually —
  it is slow structural data, no hourly fetch needed.
- **License gate (blocking):** confirm INFORM terms permit *commercial* reuse
  with attribution before shipping. If not → fallback to another open structural
  index (Fragile States Index, or World Bank WGI/HDI composite) using the same
  math. Attribute the chosen source in `/methodology`.

## Combine math — "floor + amplifier"

In `risk_scoring.py → composite_score()` (the only changed scoring logic).
Inputs: live composite `comp` ∈ [0,5] (existing logic unchanged) and `F` ∈ [0,1].

- **Floor (matters when quiet):** `floor = F * FLOOR_MAX`, `FLOOR_MAX = 1.0`.
  A maximally fragile country with zero events reads ~1.0 ("low"). Structure
  alone can **never exceed "low"**.
- **Amplifier (matters when signal present):** `amp = 1 + AMP * F`, `AMP = 0.20`.
  The most fragile countries escalate up to +20% faster on real signal.
- **Final:** `score = clip( max(comp * amp, floor), 0, 5 )` → `band_for(score)`.

This keeps live signal dominant (amplifier ≤ +20%, floor ≤ "low"), satisfies
"quiet-fragile ≠ quiet-stable", and never lets structure drive the top of the table.

## Transparency (source-traceable — on brand)

Store in `risk_index.json` per country:
- `composite_risk.score` — final (fragility-adjusted)
- `composite_risk.live_score` — pre-fragility live composite
- `composite_risk.fragility` — F used (and INFORM raw 0–10)

So the structural contribution is always visible and auditable — not a black box.

## Reversibility

- Single flag `USE_FRAGILITY` (constant / env) in `risk_scoring.py`. Off →
  `score == live_score`, instant revert.
- `live_score` is always stored regardless, so rollback is lossless.

## Validation (mandatory — all scores change)

Before/after comparison, captured in the implementation:
- Score distribution (histogram) before vs after.
- Top-N table: the live-driven hotspots (conflict, etc.) must keep their rank —
  fragility must not reshuffle the top.
- Quiet-fragile countries move only 0 → ~"low" (≤ FLOOR_MAX).
- No country moves more than one band from the amplifier alone.
- A unit test pinning the floor/amplifier math on fixed inputs.

## Methodology + copy

- `/methodology`: add a "Structural fragility" section — "The composite is the
  live multi-domain signal, modified by structural fragility (INFORM Risk, EC JRC
  + UN OCHA). Fragility lifts a quiet fragile country to at most 'low' and
  amplifies live signal by up to +20%; it never dominates." Makes the claim true
  + cites a buyer-trusted source.
- Fix the unrelated copy inconsistency "0–6" → "0–5" (engine clips 0–5) in the
  infographic footer, WEF post, and weekly-brief generator.

## Scope / non-goals

- Only the **composite** changes. Per-category `category_breakdown` is untouched.
- Internal scale stays **0–5** (we fix copy to match, not the scale).
- INFORM refreshed **annually**, not live. This layer is descriptive (current
  structural risk), **not predictive** — prediction R&D is a separate track.
- No change to alerts logic beyond the score values they already read.

## Open items

- Confirm INFORM commercial-use license (blocking) + pick fallback if needed.
- Decide refresh mechanism (manual yearly vs a tiny annual workflow).
