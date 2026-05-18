# Honest Repositioning + /methodology Transparency Page (Design)

**Date:** 2026-05-18
**Status:** Design approved (dialogue), pending spec review
**Decision context:** Two independent honest negatives (climate ≈ random;
GDELT Phase-1 near-miss → Phase-2 decisive negative) ⇒ pre-registered
pivot: the defensible product is **multi-source aggregation + seasonal
/ historical risk calendars + directional composite + radical
transparency**, NOT validated outbreak prediction.

## Goal

1. Remove predictive over-implication from the product surface without
   breaking the API (keep fields, label them honestly).
2. Ship a public `/methodology` page that publishes our own committed
   backtests **including the NOT DEMONSTRATED results** — converting the
   honest negatives into the transparency moat.

## Audit finding (basis for scope)

The surface is already lightly hedged. Predictive language is confined
to: `projection` (already tagged `model: "transparent pre-ML model"` in
`risk-v1.mjs`), `lead_time` / `lead_days`, the climate "leading
indicator" event tag, and field docs. There is **no** marketing
"we predict outbreaks" copy in `reports.html`/`api-docs.html`. Scope is
therefore: a canonical honest disclaimer wired into the few fields, plus
the new transparency page — not a site rewrite.

## HARD GUARDRAIL

`index.html` and `ru/index.html` (landing pages) are **NOT touched** —
standing user rule. Any landing change is explicitly out of scope.

## Field-handling policy (decided)

Keep all fields (non-breaking, no rename/removal). Each predictive-ish
field carries an explicit honest qualifier + link to `/methodology`.
No change to scoring/composite. The climate "leading indicator" event
is kept as-is (already `source_verification: model`); only its honest
labelling is surfaced — no score-influence surgery.

## Canonical disclaimer (single source of wording)

One string, reused verbatim everywhere (API field, api-docs, report,
widget):

- **EN:** `Directional model output — NOT validated outbreak prediction. We backtest our own signals and publish results, including failures: /methodology`
- **RU:** `Directional-вывод модели — НЕ валидированное предсказание вспышек. Мы бэктестим свои сигналы и публикуем результаты, включая провалы: /methodology`

If the wording changes it changes in one place per surface; the EN/RU
pair above is authoritative.

## Components

### Create: `methodology.html`
Standalone static page in existing site conventions (mirror
`report.html` / `reports.html`: self-contained, RU/EN via the same
`window.TR` / lang pattern those pages use, light/dark). Sections:

1. **Thesis** — "Radical transparency: we validate our own signals and
   publish what fails."
2. **Claim / Don't-claim** two-column table. Claim: aggregation of 44
   sources, seasonal/historical risk calendars, directional composite,
   transparency. Don't-claim: validated outbreak prediction, beating
   WHO, lead-time as fact.
3. **Three backtest cards** — numbers quoted **verbatim from the
   committed `.md`** (no fabricated figures):
   - Climate→dengue: `NOT DEMONSTRATED` · TSS 0.12 vs seasonal 0.66 ·
     ≈ random · link to `docs/validation/dengue-backtest.md` (GitHub).
   - GDELT Phase-1: `NOT DEMONSTRATED (near-miss)` · PR-AUC skill
     +0.025, 95% CI [0.0049, 0.1042], Brier regressed · 3 countries ·
     link to `docs/validation/gdelt-combined-backtest.md`.
   - GDELT Phase-2: `NOT DEMONSTRATED (decisive)` · PR-AUC 0.0724 vs
     0.1925, skill −0.12, Brier 0.1308 vs 0.0656 · 6 countries +
     calibration · COVID-volume confound · link to
     `docs/validation/gdelt-phase2-backtest.md`.
4. **"How to read this"** — pre-registered criteria, no-lookahead,
   no goalpost-moving; harness reusable & open in-repo.
5. **Footer** — canonical disclaimer + generated date.

Links to raw reports use the concrete GitHub blob base
`https://github.com/arablex/episwope/blob/main/docs/validation/<file>.md`
(single source of truth; page is a curated digest, not a copy).

### Modify: `netlify.toml`
Add `/methodology` → `/methodology.html` 200 rewrite, mirroring the
existing `/report`, `/reports`, `/api/v1/docs` entries.

### Modify: `netlify/functions/risk-v1.mjs`
Additive only. Add `disclaimer` (EN canonical string) and
`methodology_url` (`<site>/methodology`) to exactly these existing
response objects: the `projection` object and `investigative_leads`
(the OSINT block, which also carries `lead_time_est_hours`). No field
removed or renamed. No behavioural/scoring change.

### Modify: `api-docs.html`
Add a short "Validation & limitations" section: `projection` /
`lead_time` / climate leading-indicator are **directional, not
validated outbreak prediction**; the three verdicts in one line;
link to `/methodology`.

### Modify: `report.html` and `widget.js`
Where user-facing text shows `projection` / `lead_time` / "ahead of" /
"outbreak", append the canonical qualifier + `/methodology` link.
Consistent phrasing from the canonical source. Landing untouched.

## Honesty-guard test

`tests/test_methodology_honesty.py` (stdlib `unittest`, canonical
`python3 -m unittest discover -t . -s tests`): for each of the three
reports, assert that the verdict token (`NOT DEMONSTRATED`) and at
least one key headline metric shown on `methodology.html` appear
**verbatim in the source `docs/validation/*.md`**. The transparency
page physically cannot silently drift from or overstate the actual
committed reports. No new dependencies.

## Error / edge handling

- `methodology.html` is static — no runtime failure surface.
- `risk-v1.mjs` additions are additive constants; if `projection` is
  null the disclaimer fields are simply absent (no crash).
- Netlify redirect mirrors a proven existing pattern.

## Out of scope (YAGNI)

- Landing pages (`index.html`, `ru/index.html`).
- Auto-generating the page from markdown (over-engineering for 3
  rarely-changing reports).
- Removing/renaming API fields; any scoring/composite change.
- A Phase-3 GDELT attempt (would need its own new pre-registration).

## Success criteria

- `/methodology` resolves and presents the three honest verdicts with
  verbatim-correct numbers and links to the committed reports.
- Every predictive-ish field/surface carries the canonical disclaimer +
  `/methodology` link; API contract unchanged (additive only).
- Honesty-guard test green; full suite green; landing untouched.
