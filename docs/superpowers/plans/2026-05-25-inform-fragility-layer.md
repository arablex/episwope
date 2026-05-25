# INFORM Structural-Fragility Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Blend INFORM Risk (structural fragility) into Vigilo's event-driven composite score as a bounded floor + amplifier, keeping live signal dominant, transparent, and reversible.

**Architecture:** A committed annual data file `public/inform_risk.json` ({ISO2: F∈[0,1]}) is read at runtime by a tiny stdlib loader. `risk_scoring.composite_score()` gains an optional `fragility` arg and applies `final = clip(max(live*(1+AMP*F), F*FLOOR_MAX), 0, 5)`. `risk_aggregate.build_index()` passes per-country F (including baseline-seeded quiet countries). All scores changing is gated by `USE_FRAGILITY` and the pre-fragility `live_score` is always stored.

**Tech Stack:** Python 3.12 stdlib (runtime). `pycountry` used only at annual build time (not in the hourly pipeline). pytest/unittest for tests.

Spec: `docs/superpowers/specs/2026-05-25-inform-fragility-layer-design.md`

---

## Task 0: Verify license + obtain INFORM data (BLOCKING, human gate)

**No code.** Before any integration:

- [ ] **Step 1: Confirm commercial-use license.** Open INFORM Risk "Results and data" + terms (drmkc.jrc.ec.europa.eu/inform-index). Confirm the data may be reused commercially with attribution. Record the license name/URL in the spec's "Open items".
- [ ] **Step 2: If permitted — download** the latest INFORM Risk dataset (the annual workbook/CSV with per-country overall "INFORM Risk" 0–10 + ISO3 country code) to `scripts/_data/inform_raw.csv` (export the relevant sheet to CSV if it's xlsx).
- [ ] **Step 3: If NOT permitted — switch source.** Use the Fund for Peace **Fragile States Index** (CSV, ISO/country) or World Bank WGI. Same downstream contract: a per-country 0–1 fragility `F`. Note the substitution in the spec; the rest of the plan is unchanged except the build script's column names.
- [ ] **Step 4: Record the exact column headers** present in the downloaded file (country/ISO3 column name, score column name) — Task 1 auto-detects but record them for verification.

---

## Task 1: Build script → `public/inform_risk.json`

**Files:**
- Create: `scripts/build_inform.py`
- Create (output): `public/inform_risk.json`

- [ ] **Step 1: Write `scripts/build_inform.py`**

```python
#!/usr/bin/env python3
"""Annual build step (NOT in the hourly pipeline): parse the downloaded INFORM
Risk file into public/inform_risk.json = {ISO2: F} where F = INFORM/10 in [0,1].

Run once a year after refreshing scripts/_data/inform_raw.csv:
    pip install pycountry
    python3 scripts/build_inform.py
"""
import csv, json, re
from pathlib import Path
import pycountry

ROOT = Path(__file__).resolve().parent.parent
RAW  = ROOT / "scripts" / "_data" / "inform_raw.csv"
OUT  = ROOT / "public" / "inform_risk.json"

def _find_col(headers, *needles):
    for h in headers:
        hl = h.lower()
        if all(n in hl for n in needles):
            return h
    return None

def main():
    rows = list(csv.DictReader(RAW.open(encoding="utf-8-sig")))
    if not rows:
        raise SystemExit("empty inform_raw.csv")
    headers = rows[0].keys()
    iso_col   = _find_col(headers, "iso3") or _find_col(headers, "iso")
    score_col = _find_col(headers, "inform", "risk") or _find_col(headers, "risk", "index")
    if not iso_col or not score_col:
        raise SystemExit(f"could not detect columns in {list(headers)}")
    out = {}
    for r in rows:
        iso3 = (r.get(iso_col) or "").strip().upper()
        raw  = (r.get(score_col) or "").strip().replace(",", ".")
        if not re.match(r"^[A-Z]{3}$", iso3):
            continue
        try:
            f = max(0.0, min(1.0, float(raw) / 10.0))
        except ValueError:
            continue
        try:
            iso2 = pycountry.countries.get(alpha_3=iso3).alpha_2
        except Exception:
            iso2 = None
        if iso2:
            out[iso2] = round(f, 3)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUT} — {len(out)} countries")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it**

Run: `pip install pycountry && python3 scripts/build_inform.py`
Expected: `wrote .../public/inform_risk.json — ~190 countries`

- [ ] **Step 3: Sanity-check output**

Run: `python3 -c "import json; d=json.load(open('public/inform_risk.json')); print(len(d), d.get('SO'), d.get('SD'), d.get('DE'), d.get('NO'))"`
Expected: ~190; fragile states (SO/SD) near the top (~0.8+), stable states (DE/NO) low (<0.2).

- [ ] **Step 4: Commit**

```bash
git add scripts/build_inform.py public/inform_risk.json
git commit -m "feat(data): build INFORM fragility index -> public/inform_risk.json"
```

---

## Task 2: Runtime fragility loader (stdlib, graceful)

**Files:**
- Create: `scripts/inform.py`
- Test: `tests/test_inform_loader.py`

- [ ] **Step 1: Write the failing test**

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest tests/test_inform_loader.py -v`
Expected: FAIL (No module named 'inform').

- [ ] **Step 3: Write `scripts/inform.py`**

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m pytest tests/test_inform_loader.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add scripts/inform.py tests/test_inform_loader.py
git commit -m "feat: stdlib INFORM fragility loader"
```

---

## Task 3: Floor + amplifier in `composite_score`

**Files:**
- Modify: `scripts/risk_scoring.py` (constants near top after `BANDS`; `composite_score`)
- Test: `tests/test_fragility_math.py`

- [ ] **Step 1: Write the failing test**

```python
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import risk_scoring as rs

def test_quiet_fragile_gets_low_floor():
    # No signal anywhere, max fragility -> score == FLOOR_MAX (~1.0 = "low")
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
    assert amp["live_score"] == base["score"]           # live unchanged
    assert amp["score"] > base["score"]                  # fragility amplifies
    assert amp["score"] <= round(base["score"] * 1.20 + 1e-9, 2)  # <= +20%

def test_flag_off_is_passthrough(monkeypatch):
    monkeypatch.setattr(rs, "USE_FRAGILITY", False)
    cats = {c: 0.0 for c in rs.CATEGORIES}; cats["conflict"] = 2.0
    r = rs.composite_score(cats, fragility=1.0)
    assert r["score"] == r["live_score"]

def test_score_never_exceeds_5():
    cats = {c: 5.0 for c in rs.CATEGORIES}
    r = rs.composite_score(cats, fragility=1.0)
    assert r["score"] <= 5.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest tests/test_fragility_math.py -v`
Expected: FAIL (composite_score takes 1 arg / no FLOOR_MAX attr).

- [ ] **Step 3: Add constants after `BANDS` (line ~41) in `risk_scoring.py`**

```python
# ── Structural fragility layer (INFORM) ─────────────────────────────
# Bounded floor + amplifier so a quiet-but-fragile country reads above a
# quiet-stable one, WITHOUT letting structure dominate the live signal.
USE_FRAGILITY = True
FLOOR_MAX = 1.0   # max score (=="low") a quiet, maximally-fragile country reaches
AMP = 0.20        # live signal of the most fragile country amplified up to +20%
```

- [ ] **Step 4: Replace `composite_score` with the fragility-aware version**

```python
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python3 -m pytest tests/test_fragility_math.py -v`
Expected: PASS (5 passed).

- [ ] **Step 6: Commit**

```bash
git add scripts/risk_scoring.py tests/test_fragility_math.py
git commit -m "feat(scoring): INFORM floor+amplifier in composite_score"
```

---

## Task 4: Thread fragility through `score_geo`

**Files:**
- Modify: `scripts/risk_scoring.py` (`score_geo`)
- Test: `tests/test_score_geo_fragility.py`

- [ ] **Step 1: Write the failing test**

```python
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import risk_scoring as rs

def test_score_geo_passes_fragility():
    # No events + fragility -> composite gets the floor
    out = rs.score_geo([], fragility=1.0)
    assert out["composite_risk"]["live_score"] == 0.0
    assert abs(out["composite_risk"]["score"] - rs.FLOOR_MAX) < 1e-9
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest tests/test_score_geo_fragility.py -v`
Expected: FAIL (score_geo got unexpected kwarg 'fragility').

- [ ] **Step 3: Update `score_geo` signature + call**

In `scripts/risk_scoring.py`, change the signature:

```python
def score_geo(events: list[dict], now: datetime | None = None,
              fragility: float = 0.0) -> dict:
```

and the composite call (was `comp = composite_score(cat_scores)`):

```python
    comp = composite_score(cat_scores, fragility=fragility)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m pytest tests/test_score_geo_fragility.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/risk_scoring.py tests/test_score_geo_fragility.py
git commit -m "feat(scoring): thread fragility through score_geo"
```

---

## Task 5: Wire fragility into `build_index` (incl. baseline-seeded quiet countries)

**Files:**
- Modify: `scripts/risk_aggregate.py` (imports; `build_index`)

- [ ] **Step 1: Add import + composite import**

At the existing import line `from risk_scoring import score_geo, CATEGORIES` (line ~36) change to:

```python
from risk_scoring import score_geo, composite_score, CATEGORIES  # noqa: E402
from inform import load_fragility  # noqa: E402
```

- [ ] **Step 2: Load fragility once + pass to score_geo**

In `build_index` (line ~641), before the loop:

```python
    now = _now()
    frag = load_fragility()
    index = {}
    for iso, evs in by_country.items():
        scored = score_geo(evs, now, fragility=frag.get(iso, 0.0))
```

- [ ] **Step 3: Apply floor to baseline-seeded quiet countries**

In the baseline-seeding loop (line ~666), replace the hardcoded composite with a real fragility-aware one so a quiet *fragile* country shows its floor:

```python
    for iso in ISO_CENTROID:
        if iso in index:
            continue
        comp = composite_score({c: 0.0 for c in CATEGORIES}, fragility=frag.get(iso, 0.0))
        index[iso] = {
            "composite_risk": comp,
            "category_breakdown": _empty_breakdown(),
            "event_count": 0,
            "event_ids": [],
            "baseline": True,
        }
        seeded += 1
```

- [ ] **Step 4: Smoke-run the aggregator**

Run: `python3 scripts/risk_aggregate.py` (uses local signals.json/events). 
Expected: completes; `python3 -c "import json; d=json.load(open('public/risk_index.json'))['index']; r=d.get('SO',{}).get('composite_risk',{}); print(r)"` shows `score`, `live_score`, `fragility` keys present and a fragile quiet country (e.g. SO) has score ≈ its floor when live_score is 0.

- [ ] **Step 5: Commit**

```bash
git add scripts/risk_aggregate.py
git commit -m "feat(scoring): apply INFORM fragility per-country in build_index"
```

---

## Task 6: Before/after validation gate (one-off, not committed test)

**Files:**
- Create (temporary): `scripts/_validate_fragility.py`

- [ ] **Step 1: Write the validator**

```python
"""One-off: compare composite scores with fragility ON vs OFF on the live index.
Eyeball that (a) the live-driven top of the table keeps its rank, (b) quiet
countries only move 0 -> <=FLOOR_MAX, (c) no band jump from the amplifier alone."""
import json, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
import risk_scoring as rs
idx = json.load(open("public/risk_index.json"))["index"]
rows = []
for iso, v in idx.items():
    cr = v.get("composite_risk", {})
    live = cr.get("live_score", cr.get("score", 0.0))
    final = cr.get("score", 0.0)
    rows.append((iso, live, final, round(final - live, 2)))
rows.sort(key=lambda r: r[2], reverse=True)
print("TOP 15 (iso, live, final, delta):")
for r in rows[:15]: print(" ", r)
moved = [r for r in rows if r[3] > 0]
print(f"\ncountries lifted by fragility: {len(moved)}")
print("max delta:", max((r[3] for r in rows), default=0))
print("quiet (live==0) but lifted:", sum(1 for r in rows if r[1] == 0 and r[2] > 0))
```

- [ ] **Step 2: Run + eyeball**

Run: `python3 scripts/_validate_fragility.py`
Expected: top-15 still the conflict hotspots (Ukraine/Russia/etc., unchanged order); `max delta` ≤ ~0.7 (20% of ~3.5); quiet-but-lifted countries have final ≤ 1.0. If the top reshuffles or deltas exceed expectations, STOP and revisit AMP/FLOOR_MAX before proceeding.

- [ ] **Step 3: Remove the throwaway validator**

```bash
rm scripts/_validate_fragility.py
```

---

## Task 7: Methodology section + "0–6" → "0–5" copy fix

**Files:**
- Modify: `methodology.html` (add fragility section)
- Modify: `scripts/gen_infographic.py` (footer string), `scripts/gen_og.py` (footer string), `intel/wef-global-risks-2025-live.html` (any "0–6"), `scripts/gen_weekly_brief.py` (any "0–6"/"0-6")

- [ ] **Step 1: Find every "0–6" / "0-6" occurrence**

Run: `grep -rn "0–6\|0-6" methodology.html scripts/gen_infographic.py scripts/gen_og.py scripts/gen_weekly_brief.py intel/`
Replace each with `0–5` (the engine clips 0–5). Edit each hit.

- [ ] **Step 2: Add the fragility methodology section** to `methodology.html` (place after the existing scoring/sources explanation; match the page's existing heading + paragraph markup):

```html
<h2>Structural fragility</h2>
<p>The composite is the live, multi-domain signal — but it is modified by
<strong>structural fragility</strong> drawn from the INFORM Risk Index
(European Commission JRC and UN OCHA), the humanitarian sector's standard
country-risk measure. Fragility lifts a quiet but fragile country to at most the
"low" band, and amplifies the live signal of the most fragile countries by up to
20%. It never dominates: a stable country stays low and the top of the table is
always driven by live events. Each country's record carries both the live score
and the fragility applied, so the structural contribution is fully traceable.</p>
```

- [ ] **Step 3: Verify no "0–6" remains**

Run: `grep -rn "0–6\|0-6" methodology.html scripts/ intel/` 
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add methodology.html scripts/gen_infographic.py scripts/gen_og.py scripts/gen_weekly_brief.py intel/wef-global-risks-2025-live.html
git commit -m "docs(methodology): document fragility layer; fix 0-6 to 0-5 copy"
```

---

## Task 8: Annual refresh note

**Files:**
- Modify: `scripts/build_inform.py` (docstring already documents the yearly run — confirm)

- [ ] **Step 1:** Confirm `build_inform.py` docstring states the yearly manual run. No workflow is added (annual cadence does not justify CI). Optionally add a calendar reminder outside the repo.
- [ ] **Step 2:** No commit needed if docstring already covers it.

---

## Self-Review Notes (author)

- Spec coverage: data source (T0/T1), loader (T2), floor+amplifier math (T3), score_geo wiring (T4), build_index incl. baseline-seeded quiet countries (T5), validation (T6), transparency fields live_score/fragility (T3 output, surfaced T5), reversibility USE_FRAGILITY (T3 + tested), methodology + 0–6→0–5 (T7), annual refresh (T1/T8). All covered.
- Reversibility: `USE_FRAGILITY=False` ⇒ `score==live_score` (tested in T3).
- Type/name consistency: `composite_score(cat_scores, fragility=0.0)`, `score_geo(events, now, fragility=0.0)`, `load_fragility(path)`, constants `USE_FRAGILITY/FLOOR_MAX/AMP` — used identically across tasks.
- Live dominance bounded: amplifier ≤ +20%, floor ≤ FLOOR_MAX(1.0=="low"); enforced + tested.
