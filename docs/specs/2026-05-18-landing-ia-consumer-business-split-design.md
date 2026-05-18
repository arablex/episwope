# Landing IA — Consumer / Business Split (Design)

**Date:** 2026-05-18
**Status:** Design approved (dialogue), pending spec review

## Goal

Split the single landing into two audience-focused surfaces:

1. **Consumer landing** (`/`, `index.html` + `ru/index.html`) — the
   showcase: a regular person explores the product and logs in.
2. **Business landing** (`/business`, new `business.html` +
   `ru/business.html`) — the B2B sales funnel, opened from the main
   header's "For Business" item, with its own header nav (API,
   Widgets, Pricing, …) consolidating the B2B story.

## Guardrail-conflict resolution (read first)

`docs/specs/2026-05-18-honest-repositioning-methodology-design.md`
contains a HARD GUARDRAIL "do NOT touch index.html / ru/index.html".
The user has **explicitly lifted that rule for this landing work**.
This spec **supersedes** that guardrail for the landing files only.
The separate `/methodology` page work remains queued and unaffected;
its honesty requirements still hold (see "Honest-positioning rules").

## Honest-positioning rules (non-negotiable, Senior-DS/CPO)

The B2B landing is "honest-aggressive" (user-chosen). Hard lines:

- **No fabricated traction/revenue.** No "trusted by", customer
  logos, user counts, or revenue claims — we have no paying
  customers.
- **No predictive overclaim.** Never imply the disproven climate /
  GDELT models predict outbreaks. No "lead-time", "earlier than
  WHO", "we predict" language.
- **Validation framed positively, kept quiet, kept reachable.** Framed
  as "pre-registered + backtested; only validated logic ships" — NOT
  "our failures". It is a calm single line + a quiet footer link to
  `/methodology`; never the hero. `/methodology` stays reachable and
  truthful (verdicts unchanged) — not deleted, not buried so it can't
  be found, not contradicted.
- **No secrets.** Source breadth shown as a count + 7 domain
  categories + cadence; never the individual feed list.
- **Comparison must be defensible per cell.** Axes only where we
  genuinely win; competitors described factually/neutrally.

## Audience — pain → solution → outcome (drives B2B copy)

The B2B landing sells to organisations that embed risk data, not to
consumers. Primary **entry persona** = the developer/integrator
(evaluates, converts to a free API key). Three **buyer segments** are
the "who it's for / outcomes" proof. Outcomes are phrased as value we
credibly deliver — never fabricated case studies or named clients.

| Segment | Pain today | What we give | Their business becomes |
|---|---|---|---|
| Travel / insurers / TMC / OTA | Enterprise-priced incumbents (Crisis24, Int.SOS), black-box, not embeddable | Open API + brandable widgets + composite | Duty-of-care + checkout trust without an enterprise contract |
| Insurance / reinsurance / parametric | Non-auditable signals, slow, expensive | Machine-readable composite + webhooks + published methodology | Auditable, regulator-defensible geo risk monitoring, cheaper |
| Supply chain / logistics / ops-risk | Siloed per-domain vendors, no API | 7 domains in one API + what-if cascade + webhooks | One integration replaces several; earlier cascade awareness |
| Developer / integrator (champion) | Everything behind a sales call, no self-serve key, opaque pricing | Free API key, working curl on real data, transparent docs | Evaluate & ship in a day, no procurement |

Messaging spine: lead for the developer/integrator (the free-key
conversion), with a "Who it's for" block carrying the three segments'
pain→outcome. Honesty: we win on accessibility / transparency /
breadth / price — NOT on predicting outbreaks earlier.

## IA / routing

```
/            index.html, ru/index.html       — CONSUMER (showcase + login)
/business    business.html, ru/business.html — B2B sales funnel (own nav)
```

- `netlify.toml`: add `[[redirects]] from="/business" to="/business.html" status=200`
  (mirror the existing `/report`, `/reports`, `/widgets` entries).
- Consumer header "For Business" link: `href="#biz"` → `href="/business"`.
- Deep B2B tools are **linked, not duplicated/absorbed**:
  `/api/v1/docs` (api-docs.html), `/widgets` (widgets.html),
  `/report` (report.html), `/methodology` (methodology.html, separate
  queued work). `business.html` is a funnel wrapper.

## Consumer landing changes (`index.html`, `ru/index.html`)

- **Remove:** the in-page `#biz` section (block ~lines 705–819) and
  its `/* For Business section */` CSS (~line 387). This content seeds
  `business.html`.
- **Keep unchanged:** hero, `#instrument`, `#list` (Coverage),
  `#risk`, `#data`, `.final`, footer, the waitlist form + its JS.
- **Header:** "For Business" → `/business`; add a quiet **"Log in"**
  link. The implementation MUST first locate the existing
  consumer login entry point (magic-link / `/app.html` auth flow
  already in the codebase) and point the link there — it must NOT
  invent a new auth backend or endpoint. If no distinct consumer
  login entry exists, the "Log in" link falls back to `/app.html`
  (the app handles its own auth) and this is recorded in the plan.
  Primary CTA stays "Open the app" → `/app.html`.
- Visual system + i18n approach unchanged
  (`--bg #F4F2EE`, `--accent #E8590C`, Inter).

## Business landing structure (`business.html`, `ru/business.html`)

Own header nav: `Overview · API · Widgets · Pricing · [Get API key]
(primary) · Talk to us`. Footer carries the quiet `Methodology` and
`Sample report` links.

Sections top→bottom:

1. **Hero** — contrarian-honest one-liner (no "predict"). Value prop:
   real-time multi-domain risk intelligence via an open API. CTA:
   **Get a free API key** + Talk to us.
2. **Breadth** — "**44+ live sources** across 7 domains (health,
   conflict, civil unrest, transport, border, infrastructure,
   climate), refreshed every ~15 min." Count + categories + cadence
   only. No feed list.
3. **Capabilities** (cards, deep-linked): Composite Risk Score (7
   domains) → `/api/v1/docs`; webhooks; What-if simulator
   (`/api/v1/simulate`); embeddable widgets → `/widgets`; country
   dossier → `/report`.
4. **Who it's for — outcomes by segment** (3 cards from the audience
   matrix above): Travel/insurers/TMC; Insurance/reinsurance;
   Supply-chain/ops. Each card = one-line pain → "with Vigilo" →
   business outcome. Phrased as credible delivered value; **no named
   client logos, no case-study claims** (none exist).
5. **Honest comparison table.** Axes (each cell defensible):
   self-serve open API (no sales gate) · transparent pricing · source
   breadth · integration friction · published methodology.
   Competitors as a neutral factual category ("Enterprise incumbents:
   Recorded Future / Dataminr / Crisis24"). We win by contrast, no
   puffery, no capability war.
6. **Validation discipline (quiet, positive)** — one calm line:
   "Every signal is pre-registered and backtested; only validated
   logic ships." → quiet `Methodology` link. Not a hero block.
7. **Pricing (no invented tiers)** — "Free tier — live now (anon API,
   60 req/h)." + "Enterprise — Talk to us." Mirrors the real
   `risk-v1.mjs` rate-limit scaffold (anon/partner/enterprise). No
   fabricated prices.
8. **Final CTA band** + footer (quiet Methodology / Sample report).

Visual system identical to the consumer landing (same tokens, Inter,
light theme). Self-contained static page (project pattern).

## Bilingual sync strategy

Four files total: `index.html`, `ru/index.html`, `business.html`,
`ru/business.html`. The project's established pattern is separate RU
files mirrored manually (a recurring drift source). To bound the debt:

- `business.html` and `ru/business.html` share an **identical section
  structure and DOM order**; RU is a 1:1 content mirror of EN.
- The implementation plan will include an explicit EN↔RU parity
  checklist per section, and a test (below) that asserts structural
  parity so drift is caught mechanically.

## Testing

`tests/test_landing_ia.py` (stdlib `unittest`, canonical
`python3 -m unittest discover -t . -s tests`):

- `business.html` and `ru/business.html` exist; both contain each
  required section anchor id (overview, api, widgets, pricing) and the
  same set of section ids (structural EN↔RU parity).
- Consumer `index.html` & `ru/index.html` no longer contain the
  `#biz` section id; their "For Business" link points to `/business`
  (not `#biz`).
- Honesty guards: business pages contain NO forbidden tokens —
  case-insensitive absence of "trusted by", "predict", "lead-time",
  "earlier than WHO" — and DO contain a `/methodology` link.
- The "Who it's for" block exists (3 segment cards present) and the
  business pages contain no fabricated-traction phrases
  (case-insensitive absence of "case study", "trusted by", "join
  thousands", "our customers say"). The bare word "customers" is NOT
  banned (legitimate in benign copy) — only the listed phrases.
- `netlify.toml` has the `/business` → `/business.html` 200 rewrite.

No new dependencies. No network in tests.

## Out of scope (YAGNI)

- Absorbing/rewriting `api-docs.html` or `widgets.html` (linked, not
  duplicated).
- The `/methodology` page build itself (separate queued spec/plan).
- Self-serve billing / real pricing tiers (none exist; "Talk to us").
- Analytics instrumentation (noted by the analyst lens as a follow-up;
  not built here — YAGNI until the funnel exists).
- Visual-system redesign; the existing tokens/Inter are preserved.

## Success criteria

- `/business` resolves to a self-contained bilingual B2B funnel with
  its own nav; consumer `/` is slimmed (no `#biz`) and "For Business"
  links out to `/business`; deep tools linked not duplicated.
- Honest-positioning rules hold (test-enforced: no fabricated
  traction, no predictive overclaim, methodology reachable).
- Full suite green; no new deps; visual system unchanged.
