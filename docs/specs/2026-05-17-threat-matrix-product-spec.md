# Vigilo Threat Matrix — Product Spec (CPO)

Date: 2026-05-17 · Status: approved direction · Owner: solo + AI

## Guiding principle (anti-feature-creep contract)

The product exposes **exactly 4 macro-domains, ever**. New threat types
are only ever added as a controlled-vocabulary `event_type` inside an
existing sub-category — never as a new top-level concept, never as a new
UI layer, never as a new pin shape. If a new threat can't be filed under
the 4×(3–4) matrix, it is **rejected at ingest**, not accommodated. This
is the single rule that keeps the UI minimal and the backend sane.

Backward-compat: the shipped 7 flat categories (health, conflict,
civil_unrest, transport, border, infrastructure, climate) are **not
rewritten** — they become `sub` values under the 4 macros via a grouping
map. Zero breaking change to `risk_scoring.py` / `/api/v1/risk`; we add a
`macro` field, that's it.

## 1. Universal taxonomy (4 macro × 3–4 sub)

| Macro (B2B-legible) | Sub-categories | Maps shipped category |
|---|---|---|
| **BIO_ENV** — Biological & Environmental | `infectious_disease`, `natural_disaster`, `environmental_hazard` | health, climate |
| **SECURITY** — Security & Conflict | `armed_conflict`, `terrorism_insurgency`, `civil_unrest` | conflict, civil_unrest |
| **MOBILITY** — Mobility & Access | `aviation_disruption`, `surface_transport`, `border_entry` | transport, border |
| **CONTINUITY** — Infrastructure & Continuity | `energy_grid`, `connectivity`, `utilities_supply` | infrastructure |

Four because that is the max a buyer holds in their head and the min that
keeps insurer/logistics/travel mental models intact. Not 5, not 7.

### Universal Severity (0–5) — defined by OPERATIONAL IMPACT, not drama

Severity is **buyer-impact, domain-agnostic**. Same number = same
operational consequence regardless of domain. Anchor rubric:

| L | Universal meaning | BIO_ENV L=x | SECURITY L=x | MOBILITY L=x | CONTINUITY L=x |
|---|---|---|---|---|---|
| 0 | No signal | — | — | — | — |
| 1 | Localised, no ops impact | sporadic cases | isolated incident | minor delays | brief local outage |
| 2 | Sub-national disruption | local cluster | localised clashes | one hub degraded | regional utility cut |
| 3 | National-level / advisory | regional outbreak, MoH response | sustained armed activity | major hub closed / national strike | national grid instability |
| 4 | Severe, multi-region / cross-border | epidemic, health-system strain | open armed conflict | national airspace closed / borders sealed | prolonged national blackout |
| 5 | Catastrophic / systemic collapse | PHEIC, sustained H2H | war / contested territorial control | total airspace + border lockdown | nationwide grid + comms collapse |

Rule: the classifier never assigns severity from keywords alone — it maps
to the **nearest anchor** using the impact rubric. "Strike" is L2 if one
airport, L4 if national ATC walkout. This is what makes a flu epidemic
(L5) and an airspace closure (L5) commensurable in the composite.

## 2. AI tagging — controlled-vocabulary contract

Every ingested item (GDELT/GNews) gets exactly this meta-tag object or is
**quarantined** (never silently dropped into the matrix):

```json
{
  "macro": "SECURITY",                 // closed enum (4)
  "sub": "armed_conflict",             // closed enum (12 total)
  "event_type": "kinetic_strike",      // closed enum per sub (~5 each)
  "severity": 4,                       // 0–5, impact-anchored
  "confidence": 0.86,                  // 0–1
  "verification": "official_agency",   // | media_ai_signal
  "source_class": "tier1_official",    // tier1..tier5
  "geo": { "iso":"UA","lat":50.4,"lng":30.5,"admin1":"Kyiv",
           "precision":"point" },      // country|admin1|point
  "is_escalation": true,               // Δ vs same geo+sub 24h
  "actors": ["state_military"],        // ENTERPRISE-only enrichment
  "observed_at": "2026-05-17T11:58Z"
}
```

**Anti-chaos mechanisms (the core of this spec):**
1. **Closed vocabularies.** `macro`/`sub`/`event_type` are fixed enums.
   The model maps free text → one enum value. It is forbidden to invent a
   tag. Unknown → `quarantine` queue, reviewed offline, never rendered.
2. **Deterministic-first.** Keyword/regex classifier assigns sub +
   event_type + severity (already shipped in `risk_aggregate.py`). AI is
   only a fallback for ambiguous items and only to pick among existing
   enums — never to expand the schema.
3. **Confidence gate.** `confidence < 0.45` → quarantine, not matrix.
4. **One event_type per item.** No multi-tag. A protest that turns
   violent is reclassified, not double-tagged. Prevents GDELT tag-soup.
5. **Schema is versioned and frozen per major.** New event_type =
   additive enum value behind a flag, never a structural change.

## 3. UI — layered, minimal by default

**Default (B2C / tourist):** the globe is unchanged — ONE composite heat
layer, one marker per geography. Zero new visual elements ship to the
default view. New domains are invisible until explicitly summoned.

**Layers control** (single collapsible chip group, like map layers):
- 4 macro toggles + "Composite" (default-only).
- Tourist: stays on Composite (or just BIO_ENV). Never forced to see war
  data.
- B2B analyst: toggles macros on; sidebar/widget drills macro → sub →
  event. Progressive disclosure — depth on demand, never by default.

**Co-location clustering (one place, many threats):**
One marker per geography, always. Encode multi-domain via a **4-segment
ring** around the marker — each segment = one macro, lit if active,
opacity = that macro's sub-score. Marker core color = composite band.
Click → expands to a single grouped panel: macro → sub → ranked events.
A city with both a protest and an outbreak is **one ring with two lit
segments**, not two pins. This is the hard rule that protects the map:
**geography is the unit, never the event.**

## 4. Monetization packs

| | **Public / B2C (Free)** | **Travel Tech Pack** | **Enterprise Risk Pack** |
|---|---|---|---|
| Buyer | consumers | OTAs / travel (Островок) | insurers / logistics |
| Domains | Composite + BIO_ENV (simplified) | + MOBILITY + SECURITY (advisory) | all 4, full sub + event-level |
| Geo | country only | country + route corridor | country + radius + point |
| Events feed | ✗ (score only) | verified-only event list | full verified + AI signals |
| Severity | banded label | numeric 0–5 | 0–5 + components + escalation |
| Latency | 60-min | 15-min | 15-min + webhook on threshold |
| History | none | 90 days | backfill ≥ 1 yr |
| Actors / methodology | ✗ | ✗ | ✓ under NDA |
| Delivery | web UI | API + webhook | API + webhook + SLA + support |

**Packaging logic:** sell **depth and latency**, not categories piecemeal
(piecemeal = the feature-creep trap on the commercial side too). Three
SKUs, fixed. Upsell axes are orthogonal and few: geo-granularity,
history-depth, latency/webhook, NDA-methodology. SECURITY data is
advisory-level (no actors) below Enterprise — caps liability and creates
a clean upgrade reason.

## Acceptance / guardrails

- 4 macros, 12 subs, frozen enums. Adding a macro requires a spec
  amendment + version bump (intentionally high friction).
- Default UI ships zero new elements; everything new is behind Layers.
- One marker per geography — enforced in render code, not convention.
- Quarantine queue exists and is non-zero by design (proof the gate works).
- No new top-level nav, no new pin shapes, no per-event pins — ever.
