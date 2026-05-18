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
- Deep B2B tools are **linked, not duplicated/absorbed**:
  `/api/v1/docs` (api-docs.html), `/widgets` (widgets.html),
  `/report` (report.html), `/methodology` (methodology.html, separate
  queued work). `business.html` is a funnel wrapper.

## BASE CORRECTION (read — supersedes earlier assumptions)

The earlier draft of this spec assumed the consumer landing had an
in-page `#biz` / "For Business" section to extract. **It does not.**
Fact-finding had been done against an *uncommitted local working
draft* of `index.html`/`ru/index.html`. The **canonical base is the
committed/deployed landing** (what vigilo.cc serves):

- `index.html` (committed, ~625 lines): header nav = `#how` (How it
  works) · `#features` (Features) · `#data` (Data) · `#pricing`
  (Pricing) · `.lang /ru/` · `.hbtn /app.html` ("Open the app →").
  Sections: hero, intro, `#how` (band), `#features`, `#data` (band),
  `#pricing` ("Free to use. Pro when you need depth"), footer. **No
  `#biz`, no "For Business" nav.** `#pricing` is consumer pricing.
- `ru/index.html` (committed, ~615 lines): structurally **1:1
  parallel** to EN (`#how/#features/#data/#pricing`, `/ru/app.html`).
- The uncommitted 928-line `#biz` draft is the founder's WIP — **NOT
  touched, NOT committed** by this work (shipping an unvalidated
  redesign as a side-effect would be scope creep + risk).
- There is no separate consumer login page; `/app.html` is the app
  entry and self-authenticates.

## Consumer landing changes (`index.html`, `ru/index.html`)

Minimal, low-risk (no section/CSS surgery — there is no `#biz`):

- **Header — add two nav items** before the `.lang` link:
  a `For Business` link → `/business` (accent-styled, matching the
  other `.nav-lnk`) and a quiet `Log in` link → `/app.html`
  (RU: `Для бизнеса` → `/business`; `Войти` → `/ru/app.html`).
  Primary CTA stays "Open the app" → `/app.html`.
- **Keep unchanged:** everything else — hero, intro section, `#how`,
  `#features`, `#data`, `#pricing` (consumer pricing — legitimately
  consumer, NOT moved/removed), footer. The B2B/API/widgets/Enterprise
  story lives ONLY on `/business`; consumer `#pricing` stays as the
  free/Pro consumer block.
- Visual system + i18n unchanged (`--bg #F4F2EE`, `--accent #E8590C`,
  Inter). Committed EN/RU are already structural mirrors — do not
  reconcile anything else (out of scope).

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

Visual system = the adopted design system below (Geist/Instrument-Serif,
plate/pill components, light theme). Self-contained static page
(project pattern; plain CSS, no Tailwind/React/build).

## Visual system — adopted design system (external design, re-skinned)

SUPERSEDES the earlier "Semrush-energy" note. The founder supplied a
Claude-design deliverable (`Vigilo landing.zip`, React/Tailwind +
2 renders) whose visual language we adopt across surfaces. We port the
**visual system only** into our plain-CSS self-contained skeleton — NOT
their React/Tailwind code, NOT their structure, NOT their false claims.
This becomes the shared "Vigilo design system" (foundation for the
later app/report/widget reskins; this spec covers /business + consumer).

- **Typography (the signature):** Google Fonts **`Geist`** (400–900)
  + **`Geist Mono`** + **`Instrument Serif` italic**. Heavy Geist
  display with very tight tracking, with an **Instrument Serif
  italic accent word** inside headlines (e.g. "Risk you can
  *actually* defend."). Mono for codes/figures. This replaces Inter
  on the marketing surfaces — a deliberate, founder-approved swap (new
  web-font dependency, acceptable on marketing pages).
- **Palette:** warm "paper" cream `#F4F2EE`/`#EFEDE8`, ink `#14110C`
  + muted ink-600/500/400 scale, hairline `--rule` borders, brand
  accent orange `#E8590C`, positive/live `--mark-green #00A56F`,
  severity tones reuse the product scale. Light theme.
- **Components ("плашки"):** dark filled **pill buttons** + light
  ghost; small **pill chips** (eyebrow with a `NEW`/status badge,
  pulsing `LiveDot`); soft-shadow **plate cards** (`shadow-plate`,
  rounded 16–24px, hairline header with mono code); clean `V`
  brand mark; stat row on `--rule` dividers.
- **Rhythm/effects:** large editorial whitespace, soft drop shadows,
  subtle inner-highlight (`hl-l`), gentle scroll-reveal + count-up,
  the authentic product mock (a "risk console / composite" plate
  rendered from our REAL fields).
- **Quality bar:** SVG icons (no emoji), `:focus-visible`, contrast
  ≥ 4.5:1, responsive 375/768/1024/1440, `prefers-reduced-motion`
  respected, transitions 150–300ms. Plain CSS/vanilla-JS, **no
  Tailwind/React, no build step**.

**Explicit prohibitions (honesty) — found IN the supplied design,
must NOT be carried over (test-guard enforced):**
- `SOC 2 Type II` (and any compliance/cert badge) — we are NOT
  certified. Fabricated.
- The supplied "Risk console" mock shows a POSITIVE validated result
  (`0.78 · +0.12 · verdict-gate approved`). We have a public
  `/methodology` with two committed **NOT DEMONSTRATED** verdicts.
  Reproduce the mock's *look* only, with neutral/clearly-illustrative
  sample content — **never a fabricated positive verdict / skill /
  "approved"**.
- No predictive overclaim ("days early", "predict", "lead-time").
- No social-proof scaffolding (testimonials, client logos, user/
  customer counters, star ratings, case studies) — none exist.

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
- Consumer `index.html` & `ru/index.html`: their "For Business" link
  points to `/business`, a `Log in`/`Войти` affordance is present,
  and their existing real sections remain intact (EN still has
  `id="how"`/`id="features"`/`id="data"`/`id="pricing"`; RU likewise).
  (There is no `#biz` to remove — see BASE CORRECTION.)
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
  its own nav; the committed consumer `/` gains a "For Business" →
  `/business` nav item + a quiet "Log in" → `/app.html`, all its
  existing sections intact; deep tools linked not duplicated.
- Honest-positioning rules hold (test-enforced: no fabricated
  traction, no predictive overclaim, methodology reachable).
- Full suite green; no new deps; visual system unchanged.
