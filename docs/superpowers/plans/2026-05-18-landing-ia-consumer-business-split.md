# Landing IA — Consumer / Business Split — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the landing into a slim consumer `/` and a new self-contained bilingual B2B funnel at `/business` with a deliberately evolved Semrush-energy on-brand visual system — honest-aggressive, no fabricated traction, no predictive overclaim, no social-proof scaffolding.

**Architecture:** New self-contained `business.html` + `ru/business.html` (same pattern as `report.html`: own `<head>`, embedded `<style>` with the shared brand token system + section color-blocking + honest "juice" devices, own header nav, a tiny vanilla-JS reveal/count-up guarded by `prefers-reduced-motion`). The committed consumer `index.html`/`ru/index.html` gain TWO header nav links ("For Business" → `/business`, quiet "Log in" → `/app.html`); nothing is removed (there is no `#biz` in the committed base — see BASE CORRECTION). A Netlify 200-rewrite mirrors `/report`. A stdlib `unittest` honesty/parity guard is the TDD anchor.

**Tech Stack:** Static HTML/CSS/vanilla-JS (no framework — project pattern), Netlify redirects, Python 3.9 stdlib `unittest` (canonical: `python3 -m unittest discover -t . -s tests`). No new dependencies.

**Spec:** `docs/specs/2026-05-18-landing-ia-consumer-business-split-design.md` (read its **"Visual system — deliberate evolution"** + **"Honest-positioning rules"** sections — authoritative).

## Verified codebase facts (COMMITTED/LIVE base — do not re-derive)

> ⚠️ The canonical base is the **committed/deployed** landing (not the
> uncommitted local `#biz` draft). See spec "BASE CORRECTION".

- `index.html` (committed) header (`<header id="hdr">` …
  `<div class="wrap nav">`): brand `/`, then
  `<a class="nav-lnk" href="#how">How it works</a>`,
  `…href="#features">Features</a>`, `…href="#data">Data</a>`,
  `…href="#pricing">Pricing</a>`, `<a class="lang" href="/ru/">RU</a>`,
  `<a class="hbtn" href="/app.html">Open the app →</a>`. Sections:
  hero, intro, `#how`, `#features`, `#data`, `#pricing`, footer.
  **There is NO `#biz` and NO "For Business" nav.** `#pricing` is the
  consumer free/Pro block — it stays (consumer-appropriate).
- `ru/index.html` (committed) header: same shape with
  `…href="#how">Как это работает</a>`, `…href="#features">Возможности</a>`,
  `…href="#data">Данные</a>`, `…href="#pricing">Тарифы</a>`, then the
  `.lang` link and `<a class="hbtn" href="/ru/app.html">Приложение →</a>`.
  Structurally **1:1 parallel** to EN.
- **No separate consumer login page**; `/app.html` (`/ru/app.html`) is
  the app entry and self-authenticates. "Log in"/"Войти" → that.
- The uncommitted 928-line `#biz` draft is the founder's WIP — **NOT
  touched, NOT committed** by this work.
- Consumer change is therefore minimal: insert TWO nav links right
  after the `#pricing` nav `<a>` — no section/CSS removal exists to do.
- Self-contained pattern (`report.html`): `<!doctype html>` …
  `<style>:root{--bg:#F4F2EE;--card:#FFF;--ink:#0F0E0C;
  --muted:#807E76;--line:#ECEAE2;--accent:#E8590C;…}` + dark theme.
- `netlify.toml`: `[[redirects]]` `from`/`to`/`status=200`; existing
  `/report`,`/reports`,`/widgets`, then `/.netlify/functions/:splat`.
- Lang link convention: EN→RU `<a class="lang" href="/ru/…">RU</a>`;
  RU→EN `href="/…">EN`.

## File Structure

```
business.html            # CREATE — EN B2B funnel (self-contained, evolved visual)
ru/business.html         # CREATE — RU 1:1 mirror (byte copy + string swaps)
netlify.toml             # MODIFY — add /business 200 rewrite
index.html               # MODIFY — +2 header nav links (For Business→/business, Log in)
ru/index.html            # MODIFY — same, RU
tests/test_landing_ia.py # CREATE — honesty + structural-parity + no-social-proof guard
```

---

## Task 1: TDD anchor — `tests/test_landing_ia.py`

**Files:**
- Create: `tests/test_landing_ia.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_landing_ia.py`:

```python
import os
import re
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


SECTION_IDS = ["overview", "breadth", "capabilities", "audience",
               "compare", "validation", "pricing"]
FORBIDDEN = ["trusted by", "predict", "lead-time", "lead time",
             "earlier than who", "case study", "join thousands",
             "our customers say"]
# social-proof scaffolding markers (we have no customers)
NO_SOCIAL_PROOF = ["testimonial", "logo-wall", "logowall",
                   "client-logos", "clientlogos", "star-rating",
                   "starrating", "case-study", "casestudy"]


class BusinessLandingTest(unittest.TestCase):
    def setUp(self):
        self.en = read("business.html")
        self.ru = read("ru/business.html")

    def test_pages_exist_and_have_required_sections(self):
        for page in (self.en, self.ru):
            for sid in SECTION_IDS:
                self.assertIn(f'id="{sid}"', page)

    def test_en_ru_structural_parity(self):
        ids = lambda h: re.findall(r'<section id="([^"]+)"', h)
        self.assertEqual(ids(self.en), ids(self.ru),
                         "EN/RU business section order must match 1:1")

    def test_no_forbidden_tokens(self):
        for name, page in (("business.html", self.en),
                           ("ru/business.html", self.ru)):
            low = page.lower()
            for bad in FORBIDDEN:
                self.assertNotIn(bad, low, f"{name} contains '{bad}'")

    def test_no_social_proof_scaffolding(self):
        for name, page in (("business.html", self.en),
                           ("ru/business.html", self.ru)):
            low = page.lower()
            for bad in NO_SOCIAL_PROOF:
                self.assertNotIn(bad, low,
                                 f"{name} has social-proof '{bad}'")

    def test_methodology_link_present_quiet(self):
        for page in (self.en, self.ru):
            self.assertIn("/methodology", page)

    def test_who_its_for_three_cards(self):
        for page in (self.en, self.ru):
            seg = page.split('id="audience"', 1)[1].split("</section>", 1)[0]
            self.assertEqual(seg.count('class="seg-card"'), 3)

    def test_pricing_no_invented_numbers(self):
        for page in (self.en, self.ru):
            pr = page.split('id="pricing"', 1)[1].split("</section>", 1)[0]
            self.assertNotIn("$", pr)
            self.assertNotIn("/mo", pr.lower())

    def test_reduced_motion_respected(self):
        # the juice JS must bail under prefers-reduced-motion
        for page in (self.en, self.ru):
            self.assertIn("prefers-reduced-motion", page)


class ConsumerLandingTest(unittest.TestCase):
    def test_existing_sections_intact(self):
        # committed base has these; the IA change must NOT remove them
        for rel in ("index.html", "ru/index.html"):
            h = read(rel)
            for sid in ("how", "features", "data", "pricing"):
                self.assertIn(f'id="{sid}"', h,
                              f"{rel} lost section #{sid}")

    def test_for_business_links_to_business_page(self):
        for rel in ("index.html", "ru/index.html"):
            self.assertIn('href="/business"', read(rel),
                          f"{rel} For-Business must link /business")

    def test_login_affordance_present(self):
        self.assertIn(">Log in<", read("index.html"))
        self.assertIn(">Войти<", read("ru/index.html"))


class NetlifyRouteTest(unittest.TestCase):
    def test_business_rewrite(self):
        toml = read("netlify.toml")
        self.assertRegex(
            toml,
            r'from\s*=\s*"/business"\s*\n\s*to\s*=\s*"/business\.html"'
            r'\s*\n\s*status\s*=\s*200')


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd "$(git rev-parse --show-toplevel)" && python3 -m unittest tests.test_landing_ia -v`
Expected: FAIL — `FileNotFoundError: business.html`, and
`ConsumerLandingTest` red (no `/business` link / `Log in` in the
committed consumer pages yet). `test_existing_sections_intact` should
already PASS (committed base has those sections).

- [ ] **Step 3: Commit**

```bash
git add tests/test_landing_ia.py
git commit -m "test: landing IA split — honesty/parity/no-social-proof guard (red)"
```

---

## Task 2: Netlify `/business` rewrite

**Files:**
- Modify: `netlify.toml`

- [ ] **Step 1: Add the redirect**

In `netlify.toml`, immediately AFTER the existing block:

```toml
[[redirects]]
  from = "/reports"
  to = "/reports.html"
  status = 200
```

add:

```toml
[[redirects]]
  from = "/business"
  to = "/business.html"
  status = 200
```

(Anywhere among the page redirects, before the
`/.netlify/functions/:splat` block, is fine.)

- [ ] **Step 2: Run the route test**

Run: `python3 -m unittest tests.test_landing_ia.NetlifyRouteTest -v`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add netlify.toml
git commit -m "feat: route /business -> business.html (200 rewrite)"
```

---

## Task 3: Create `business.html` (EN, evolved visual system)

Self-contained. Brand tokens + **section color-blocking** (cream →
orange-wash → dark ink → cream), bold type scale, SVG icons (no
emoji), an authentic inline-SVG product mock, and honest "juice"
(count-up + scroll-reveal) gated by `prefers-reduced-motion`. Exact
section `id`s the test expects. NO social-proof scaffolding. Pricing
has no `$`/`/mo`.

**Files:**
- Create: `business.html`

- [ ] **Step 1: Create the file**

Create `business.html` with EXACTLY this content:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vigilo for Business — risk intelligence API</title>
<meta name="description" content="44+ live risk sources across 7 domains, one open API. Transparent, self-serve, no enterprise sales gate.">
<style>
  :root{--bg:#F4F2EE;--card:#FFF;--ink:#0F0E0C;--muted:#807E76;--line:#ECEAE2;
    --accent:#E8590C;--accent-d:#cf4d09;--wash:rgba(232,89,12,.06);--ink2:#1C1A16;
    --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--ink);font:16px/1.62 var(--sans);-webkit-font-smoothing:antialiased}
  a{color:inherit;text-decoration:none}
  .wrap{max-width:1120px;margin:0 auto;padding:0 24px}
  :focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:4px}
  header{position:sticky;top:0;background:rgba(244,242,238,.85);backdrop-filter:blur(12px);
    border-bottom:1px solid var(--line);z-index:50}
  .nav{display:flex;align-items:center;gap:24px;height:62px}
  .brand{font-weight:800;letter-spacing:-.04em;font-size:20px}
  .brand b{color:var(--accent)}
  .logo{display:inline-grid;place-items:center;width:25px;height:25px;background:var(--accent);
    color:#fff;border-radius:7px;font-size:13px;margin-right:8px;vertical-align:-5px}
  .sp{flex:1}
  .nav a.nl{font-size:14px;font-weight:600;color:var(--muted);display:none;transition:color .18s}
  .nav a.nl:hover{color:var(--ink)}
  @media(min-width:880px){.nav a.nl{display:inline}}
  .btn{display:inline-block;font-weight:700;font-size:14.5px;border-radius:11px;padding:11px 20px;
    border:1.5px solid var(--ink);cursor:pointer;transition:transform .18s,background .18s,color .18s,border-color .18s}
  .btn:hover{background:var(--ink);color:var(--bg);transform:translateY(-1px)}
  .btn-acc{background:var(--accent);border-color:var(--accent);color:#fff}
  .btn-acc:hover{background:var(--accent-d);border-color:var(--accent-d);color:#fff}
  .lang{font-size:13px;font-weight:700;color:var(--muted)}
  section{padding:clamp(80px,11vw,150px) 0}
  .band-wash{background:var(--wash);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
  .band-dark{background:var(--ink2);color:#F2EFE9}
  .band-dark h2,.band-dark h1{color:#fff}
  .band-dark .lead{color:rgba(242,239,233,.62)}
  .kick{font-size:11px;font-weight:800;letter-spacing:.24em;text-transform:uppercase;color:var(--accent)}
  h1{font-size:clamp(40px,6vw,76px);font-weight:800;letter-spacing:-.05em;line-height:1.02;margin:20px 0}
  h2{font-size:clamp(28px,3.6vw,46px);font-weight:800;letter-spacing:-.04em;margin:14px 0 12px}
  .lead{font-size:clamp(17px,1.75vw,22px);color:var(--muted);max-width:660px;line-height:1.55}
  .cta{display:flex;gap:14px;flex-wrap:wrap;margin-top:34px}
  .hero-grid{display:grid;gap:48px;align-items:center;grid-template-columns:1fr}
  @media(min-width:920px){.hero-grid{grid-template-columns:1.05fr .95fr}}
  .mock{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:22px;
    box-shadow:0 24px 60px -28px rgba(28,26,22,.32)}
  .grid{display:grid;gap:16px;grid-template-columns:1fr;margin-top:44px}
  @media(min-width:760px){.grid.c3{grid-template-columns:repeat(3,1fr)}}
  .card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:30px;
    transition:transform .2s,border-color .2s,box-shadow .2s}
  .card:hover{transform:translateY(-3px);border-color:var(--accent);box-shadow:0 18px 40px -26px rgba(28,26,22,.3)}
  .card .ic{width:40px;height:40px;border-radius:11px;background:var(--wash);color:var(--accent);
    display:grid;place-items:center;margin-bottom:18px}
  .card h3{font-size:19px;font-weight:700;letter-spacing:-.02em}
  .card p{color:var(--muted);font-size:14.5px;margin-top:8px}
  .card a.deep{display:inline-block;margin-top:16px;font-size:13px;font-weight:700;color:var(--accent)}
  .stats{display:flex;gap:clamp(24px,5vw,72px);flex-wrap:wrap;margin-top:40px}
  .stat .n{font-size:clamp(34px,5vw,58px);font-weight:800;letter-spacing:-.04em;color:var(--accent)}
  .stat .l{font-size:14px;color:var(--muted);margin-top:4px}
  .seg-card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:28px;
    transition:transform .2s,border-color .2s}
  .seg-card:hover{transform:translateY(-3px);border-color:var(--accent)}
  .seg-card h3{font-size:18px;font-weight:700;letter-spacing:-.02em}
  .seg-card .pain{color:var(--muted);font-size:14px;margin-top:10px}
  .seg-card .out{font-weight:700;margin-top:14px;font-size:15px;color:var(--ink)}
  table{width:100%;border-collapse:collapse;margin-top:36px;font-size:14.5px;background:var(--card);
    border:1px solid var(--line);border-radius:16px;overflow:hidden}
  th,td{padding:15px 18px;text-align:left;border-bottom:1px solid var(--line)}
  th{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:700}
  td.us{font-weight:800;color:var(--accent)}
  tr:last-child td{border-bottom:0}
  .quiet{font-size:13px;color:var(--muted);margin-top:20px}
  .quiet a{color:var(--accent);font-weight:700}
  .price-grid{display:grid;gap:18px;grid-template-columns:1fr;margin-top:40px}
  @media(min-width:680px){.price-grid{grid-template-columns:1fr 1fr}}
  .price{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:34px}
  .price.acc{border:2px solid var(--accent)}
  .price h3{font-size:20px;font-weight:800}
  .price .big{font-size:30px;font-weight:800;letter-spacing:-.03em;margin:12px 0}
  .price ul{list-style:none;margin:16px 0 24px;display:flex;flex-direction:column;gap:9px}
  .price li{font-size:14px;color:var(--muted)}
  .reveal{opacity:0;transform:translateY(18px);transition:opacity .6s ease,transform .6s ease}
  .reveal.in{opacity:1;transform:none}
  footer{border-top:1px solid var(--line);padding:36px 0;font-size:13px;color:var(--muted)}
  footer a{color:var(--muted);transition:color .15s}
  footer a:hover{color:var(--ink)}
  .frow{display:flex;gap:22px;flex-wrap:wrap;align-items:center}
  @media(prefers-reduced-motion:reduce){
    .reveal{opacity:1;transform:none;transition:none}
    .btn:hover,.card:hover,.seg-card:hover{transform:none}
  }
</style>
</head>
<body>
<header><div class="wrap nav">
  <a class="brand" href="/"><span class="logo">V</span>Vigi<b>lo</b></a>
  <span class="sp"></span>
  <a class="nl" href="#overview">Overview</a>
  <a class="nl" href="/api/v1/docs">API</a>
  <a class="nl" href="/widgets">Widgets</a>
  <a class="nl" href="#pricing">Pricing</a>
  <a class="lang" href="/ru/business.html">RU</a>
  <a class="btn btn-acc" href="/api/v1/docs">Get a free API key</a>
</div></header>

<section id="overview"><div class="wrap">
  <div class="hero-grid">
    <div>
      <span class="kick">Vigilo for Business</span>
      <h1>Real-time risk intelligence, one open API.</h1>
      <p class="lead">Most risk-intel vendors hide behind enterprise sales calls. We don't — 44+ live sources across 7 domains, a transparent composite score, self-serve from minute one.</p>
      <div class="cta">
        <a class="btn btn-acc" href="/api/v1/docs">Get a free API key</a>
        <a class="btn" href="mailto:hello@vigilo.cc?subject=Vigilo%20for%20Business">Talk to us</a>
      </div>
    </div>
    <div class="mock reveal" aria-hidden="true">
      <svg viewBox="0 0 360 240" width="100%" role="img" aria-label="Composite risk score sample">
        <rect width="360" height="240" rx="14" fill="#FBFAF7"/>
        <text x="22" y="36" font-family="var(--sans)" font-size="12" fill="#807E76" font-weight="700">GET /api/v1/risk?country=ET</text>
        <text x="22" y="74" font-family="var(--sans)" font-size="13" fill="#0F0E0C">composite_risk</text>
        <text x="338" y="74" text-anchor="end" font-family="var(--sans)" font-size="22" font-weight="800" fill="#E8590C">3.8 / 5</text>
        <g font-family="var(--sans)" font-size="11" fill="#807E76">
          <text x="22" y="108">health</text><rect x="120" y="98" width="218" height="9" rx="4.5" fill="#EFEAE2"/><rect x="120" y="98" width="170" height="9" rx="4.5" fill="#E8590C"/>
          <text x="22" y="134">conflict</text><rect x="120" y="124" width="218" height="9" rx="4.5" fill="#EFEAE2"/><rect x="120" y="124" width="120" height="9" rx="4.5" fill="#E8590C"/>
          <text x="22" y="160">climate</text><rect x="120" y="150" width="218" height="9" rx="4.5" fill="#EFEAE2"/><rect x="120" y="150" width="84" height="9" rx="4.5" fill="#E8590C"/>
          <text x="22" y="186">transport</text><rect x="120" y="176" width="218" height="9" rx="4.5" fill="#EFEAE2"/><rect x="120" y="176" width="52" height="9" rx="4.5" fill="#E8590C"/>
        </g>
        <text x="22" y="220" font-family="var(--sans)" font-size="10" fill="#A8A399">7 domains · 44+ sources · refreshed ~15 min</text>
      </svg>
    </div>
  </div>
</div></section>

<section id="breadth" class="band-dark"><div class="wrap">
  <span class="kick">Coverage</span>
  <h2>Live multi-domain coverage</h2>
  <p class="lead">Health &amp; outbreaks · armed conflict · civil unrest · transport · border · infrastructure · climate — continuously aggregated into one composite signal.</p>
  <div class="stats">
    <div class="stat"><div class="n" data-count="44" data-suffix="+">0</div><div class="l">live sources</div></div>
    <div class="stat"><div class="n" data-count="7">0</div><div class="l">risk domains</div></div>
    <div class="stat"><div class="n" data-count="15" data-prefix="~" data-suffix=" min">0</div><div class="l">refresh cadence</div></div>
  </div>
</div></section>

<section id="capabilities"><div class="wrap">
  <span class="kick">What you can build on</span>
  <h2>Integrate in an afternoon</h2>
  <div class="grid c3">
    <div class="card reveal"><div class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h4l3 8 4-16 3 8h4"/></svg></div><h3>Composite Risk Score</h3><p>0–5 per country across 7 domains, with the per-domain breakdown.</p><a class="deep" href="/api/v1/docs">API docs →</a></div>
    <div class="card reveal"><div class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v12H5l-1 4z"/></svg></div><h3>Webhooks</h3><p>A callback when a country crosses a risk threshold you set.</p><a class="deep" href="/api/v1/docs">API docs →</a></div>
    <div class="card reveal"><div class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg></div><h3>What-if simulator</h3><p>Drop a synthetic shock, cascade it across the exposure graph.</p><a class="deep" href="/api/v1/docs">/api/v1/simulate →</a></div>
    <div class="card reveal"><div class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18"/></svg></div><h3>Embeddable widgets</h3><p>Brandable risk cards &amp; checkout components — one snippet.</p><a class="deep" href="/widgets">Widgets →</a></div>
    <div class="card reveal"><div class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/></svg></div><h3>Country dossier</h3><p>A full shareable risk report per country, print-ready.</p><a class="deep" href="/report">Sample report →</a></div>
    <div class="card reveal"><div class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg></div><h3>Transparent method</h3><p>Pre-registered, backtested signals — the validation is public.</p><a class="deep" href="/methodology">Methodology →</a></div>
  </div>
</div></section>

<section id="audience" class="band-wash"><div class="wrap">
  <span class="kick">Who it's for</span>
  <h2>What changes for your business</h2>
  <div class="grid c3">
    <div class="seg-card reveal">
      <h3>Travel · insurers · OTAs</h3>
      <p class="pain">Today: enterprise-priced incumbents, black-box, not embeddable.</p>
      <p class="out">→ Duty-of-care &amp; checkout trust — without an enterprise contract.</p>
    </div>
    <div class="seg-card reveal">
      <h3>Insurance · reinsurance</h3>
      <p class="pain">Today: non-auditable signals, slow, expensive.</p>
      <p class="out">→ Auditable, regulator-defensible geo risk monitoring, cheaper.</p>
    </div>
    <div class="seg-card reveal">
      <h3>Supply chain · ops</h3>
      <p class="pain">Today: a siloed vendor per domain, no API.</p>
      <p class="out">→ One integration replaces several; earlier cascade awareness.</p>
    </div>
  </div>
</div></section>

<section id="compare"><div class="wrap">
  <span class="kick">How we differ</span>
  <h2>What they gate. What we open.</h2>
  <table>
    <tr><th>&nbsp;</th><th>Enterprise incumbents<br><span style="font-weight:400;text-transform:none;letter-spacing:0">Recorded Future · Dataminr · Crisis24</span></th><th>Vigilo</th></tr>
    <tr><td>Self-serve API key</td><td>Sales call required</td><td class="us">Free, instant</td></tr>
    <tr><td>Pricing</td><td>Quote on request</td><td class="us">Published</td></tr>
    <tr><td>Source breadth</td><td>Domain-specialised</td><td class="us">7 domains, one composite</td></tr>
    <tr><td>Integration</td><td>Onboarding project</td><td class="us">REST + webhooks, copy-paste</td></tr>
    <tr><td>Methodology</td><td>Proprietary / opaque</td><td class="us">Published, backtested</td></tr>
  </table>
  <p class="quiet">Comparison reflects publicly observable posture (self-serve access, published pricing &amp; methodology), not a capability ranking.</p>
</div></section>

<section id="validation" class="band-wash"><div class="wrap">
  <span class="kick">Validation discipline</span>
  <h2>Only validated logic ships</h2>
  <p class="lead">Every signal is pre-registered and backtested before it influences a score; the methodology and results are public.</p>
  <p class="quiet"><a href="/methodology">Read the methodology →</a></p>
</div></section>

<section id="pricing"><div class="wrap">
  <span class="kick">Pricing</span>
  <h2>Start free. Talk when you scale.</h2>
  <div class="price-grid">
    <div class="price acc">
      <h3>Free tier</h3>
      <div class="big">Live now</div>
      <ul><li>Open REST API (anonymous)</li><li>60 requests / hour</li><li>Composite score + events</li></ul>
      <a class="btn btn-acc" href="/api/v1/docs">Get a free API key</a>
    </div>
    <div class="price">
      <h3>Enterprise</h3>
      <div class="big">Talk to us</div>
      <ul><li>Higher rate limits</li><li>Webhooks at scale</li><li>Priority support &amp; SLAs</li></ul>
      <a class="btn" href="mailto:hello@vigilo.cc?subject=Vigilo%20Enterprise">Talk to us</a>
    </div>
  </div>
</div></section>

<section class="band-dark" style="text-align:center"><div class="wrap">
  <h2>Ship risk intelligence this week</h2>
  <p class="lead" style="margin:0 auto">Free API key, a working request on real data, no procurement.</p>
  <div class="cta" style="justify-content:center">
    <a class="btn btn-acc" href="/api/v1/docs">Get a free API key</a>
    <a class="btn" style="border-color:rgba(242,239,233,.4);color:#F2EFE9" href="mailto:hello@vigilo.cc?subject=Vigilo%20for%20Business">Talk to us</a>
  </div>
</div></section>

<footer><div class="wrap frow">
  <span>© Vigilo</span>
  <span class="sp"></span>
  <a href="/api/v1/docs">API</a>
  <a href="/widgets">Widgets</a>
  <a href="/report">Sample report</a>
  <a href="/methodology">Methodology</a>
  <a href="/">← Consumer site</a>
</div></footer>

<script>
(function(){
  var rm=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var rev=[].slice.call(document.querySelectorAll(".reveal"));
  var cnt=[].slice.call(document.querySelectorAll("[data-count]"));
  if(rm||!("IntersectionObserver"in window)){
    rev.forEach(function(e){e.classList.add("in");});
    cnt.forEach(function(e){
      e.textContent=(e.dataset.prefix||"")+e.dataset.count+(e.dataset.suffix||"");});
    return;
  }
  var io=new IntersectionObserver(function(es){
    es.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add("in"); io.unobserve(en.target);}});
  },{threshold:.15});
  rev.forEach(function(e){io.observe(e);});
  var cio=new IntersectionObserver(function(es){
    es.forEach(function(en){
      if(!en.isIntersecting)return; var el=en.target; cio.unobserve(el);
      var to=+el.dataset.count,pf=el.dataset.prefix||"",sf=el.dataset.suffix||"",s=0,t0=null;
      function tick(ts){ if(!t0)t0=ts; var p=Math.min((ts-t0)/900,1);
        el.textContent=pf+Math.round(p*to)+sf; if(p<1)requestAnimationFrame(tick);}
      requestAnimationFrame(tick);
    });
  },{threshold:.4});
  cnt.forEach(function(e){cio.observe(e);});
})();
</script>
</body>
</html>
```

- [ ] **Step 2: Sanity-check the page**

Run: `python3 -c "h=open('business.html').read(); import re; print(re.findall(r'<section id=\"([^\"]+)\"',h)); print('predict' not in h.lower(), 'testimonial' not in h.lower(), h.count('class=\"seg-card\"'), '/methodology' in h, '$' not in h.split('id=\"pricing\"')[1].split('</section>')[0])"`
Expected: `['overview','breadth','capabilities','audience','compare','validation','pricing'] True True 3 True True`.

- [ ] **Step 3: Commit**

```bash
git add business.html
git commit -m "feat: /business B2B funnel (EN, evolved Semrush-energy visual, honest)"
```

---

## Task 4: Create `ru/business.html` (RU 1:1 mirror)

Byte copy of `business.html` with ONLY: `<html lang="ru">`, localized
`<title>`/meta, `.lang` → `href="/business.html">EN`, brand
`href="/ru/"`, footer "Consumer site" → `/ru/`, and the visible-string
swaps below. **Section `id`s, DOM order, ALL CSS and the `<script>`
stay byte-identical** (structural + behavioural parity; the juice/JS
is language-agnostic).

**Files:**
- Create: `ru/business.html`

- [ ] **Step 1: Copy then localize**

Create `ru/business.html` as a byte copy of `business.html`, then
apply ONLY:

- `<html lang="en">` → `<html lang="ru">`
- `<title>` → `Vigilo для бизнеса — API риск-аналитики`
- meta description → `44+ живых источника риска по 7 доменам, один открытый API. Прозрачно, self-serve, без enterprise sales-gate.`
- `.lang`: `href="/ru/business.html">RU` → `href="/business.html">EN`
- `<a class="brand" href="/">` → `<a class="brand" href="/ru/">`
- footer `<a href="/">← Consumer site</a>` → `<a href="/ru/">← Сайт для людей</a>`
- Visible-string table (replace EN→RU; leave tags/classes/ids/links/SVG/JS untouched). SVG mock label text `GET /api/v1/risk?country=ET`, `composite_risk`, `3.8 / 5`, domain labels (`health`/`conflict`/`climate`/`transport`) and `7 domains · 44+ sources · refreshed ~15 min` → keep technical strings as-is except the last → `7 доменов · 44+ источника · обновление ~15 мин`.

| EN | RU |
|---|---|
| Vigilo for Business | Vigilo для бизнеса |
| Real-time risk intelligence, one open API. | Risk-аналитика в реальном времени, один открытый API. |
| Most risk-intel vendors hide behind enterprise sales calls. We don't — 44+ live sources across 7 domains, a transparent composite score, self-serve from minute one. | Большинство risk-вендоров прячутся за enterprise sales-звонками. Мы — нет: 44+ живых источника по 7 доменам, прозрачный composite-скор, self-serve с первой минуты. |
| Get a free API key | Получить бесплатный API-ключ |
| Talk to us | Связаться с нами |
| Coverage | Охват |
| Live multi-domain coverage | Живой мульти-доменный охват |
| Health &amp; outbreaks · armed conflict · civil unrest · transport · border · infrastructure · climate — continuously aggregated into one composite signal. | Здоровье и вспышки · вооружённые конфликты · беспорядки · транспорт · границы · инфраструктура · климат — непрерывная агрегация в один composite-сигнал. |
| live sources | живых источника |
| risk domains | домена риска |
| refresh cadence | каденс обновления |
| What you can build on | На чём строить |
| Integrate in an afternoon | Интеграция за полдня |
| 0–5 per country across 7 domains, with the per-domain breakdown. | 0–5 по стране и 7 доменам, с разбивкой по доменам. |
| API docs → | API-доки → |
| Webhooks | Вебхуки |
| A callback when a country crosses a risk threshold you set. | Колбэк, когда страна пересекает заданный вами порог риска. |
| What-if simulator | What-if симулятор |
| Drop a synthetic shock, cascade it across the exposure graph. | Бросьте синтетический шок, прогоните каскад по графу экспозиции. |
| Embeddable widgets | Встраиваемые виджеты |
| Brandable risk cards &amp; checkout components — one snippet. | Брендируемые риск-карточки и checkout-компоненты — один сниппет. |
| Widgets → | Виджеты → |
| Country dossier | Страновое досье |
| A full shareable risk report per country, print-ready. | Полный риск-отчёт по стране, готов к печати. |
| Sample report → | Образец отчёта → |
| Transparent method | Прозрачный метод |
| Pre-registered, backtested signals — the validation is public. | Pre-registered, бэктестенные сигналы — валидация публична. |
| Methodology → | Методология → |
| Who it's for | Для кого |
| What changes for your business | Что меняется для вашего бизнеса |
| Travel · insurers · OTAs | Travel · страховщики · OTA |
| Today: enterprise-priced incumbents, black-box, not embeddable. | Сейчас: enterprise-цена, чёрный ящик, не встроить. |
| → Duty-of-care &amp; checkout trust — without an enterprise contract. | → Duty-of-care и доверие на checkout — без enterprise-контракта. |
| Insurance · reinsurance | Страхование · перестрахование |
| Today: non-auditable signals, slow, expensive. | Сейчас: неаудируемые сигналы, медленно, дорого. |
| → Auditable, regulator-defensible geo risk monitoring, cheaper. | → Аудируемый, защитимый перед регулятором гео-мониторинг, дешевле. |
| Supply chain · ops | Supply chain · операции |
| Today: a siloed vendor per domain, no API. | Сейчас: силос — вендор на каждый домен, без API. |
| → One integration replaces several; earlier cascade awareness. | → Одна интеграция вместо нескольких; раньше видно каскад. |
| How we differ | Чем мы отличаемся |
| What they gate. What we open. | Что они закрывают. Что мы открываем. |
| Enterprise incumbents | Enterprise-инкумбенты |
| Self-serve API key | Self-serve API-ключ |
| Sales call required | Нужен sales-звонок |
| Free, instant | Бесплатно, сразу |
| Pricing | Цены |
| Quote on request | Цена по запросу |
| Published | Опубликованы |
| Source breadth | Широта источников |
| Domain-specialised | Узкая специализация |
| 7 domains, one composite | 7 доменов, один composite |
| Integration | Интеграция |
| Onboarding project | Проект внедрения |
| REST + webhooks, copy-paste | REST + вебхуки, copy-paste |
| Methodology | Методология |
| Proprietary / opaque | Проприетарно / непрозрачно |
| Published, backtested | Опубликовано, бэктестено |
| Comparison reflects publicly observable posture (self-serve access, published pricing &amp; methodology), not a capability ranking. | Сравнение отражает публично наблюдаемую позицию (self-serve доступ, опубликованные цены и методология), не рейтинг возможностей. |
| Validation discipline | Дисциплина валидации |
| Only validated logic ships | В продукт идёт только проверенная логика |
| Every signal is pre-registered and backtested before it influences a score; the methodology and results are public. | Каждый сигнал pre-registered и бэктестится прежде чем влиять на скор; методология и результаты публичны. |
| Read the methodology → | Читать методологию → |
| Start free. Talk when you scale. | Начните бесплатно. Поговорим на масштабе. |
| Free tier | Бесплатный тариф |
| Live now | Уже работает |
| Open REST API (anonymous) | Открытый REST API (анонимный) |
| 60 requests / hour | 60 запросов / час |
| Composite score + events | Composite-скор + события |
| Enterprise | Enterprise |
| Higher rate limits | Выше лимиты |
| Webhooks at scale | Вебхуки на масштабе |
| Priority support &amp; SLAs | Приоритетная поддержка и SLA |
| Ship risk intelligence this week | Запустите risk-аналитику на этой неделе |
| Free API key, a working request on real data, no procurement. | Бесплатный API-ключ, рабочий запрос на реальных данных, без procurement. |
| Sample report | Образец отчёта |
| ← Consumer site | ← Сайт для людей |
| 7 domains · 44+ sources · refreshed ~15 min | 7 доменов · 44+ источника · обновление ~15 мин |

(Strings identical EN/RU — "Composite Risk Score", "Enterprise",
"API", "Widgets" link text where it equals "Widgets→Виджеты" handled
above — leave technical/code/SVG-numeric strings unchanged. The
`<script>` is NOT translated.)

- [ ] **Step 2: Run the business-side tests**

Run: `python3 -m unittest tests.test_landing_ia.BusinessLandingTest -v`
Expected: ALL PASS — incl. `test_en_ru_structural_parity`,
`test_no_forbidden_tokens`, `test_no_social_proof_scaffolding`,
`test_who_its_for_three_cards`, `test_pricing_no_invented_numbers`,
`test_reduced_motion_respected`.

- [ ] **Step 3: Commit**

```bash
git add ru/business.html
git commit -m "feat: /business B2B funnel (RU 1:1 mirror)"
```

---

## Task 5: Add "For Business" + "Log in" nav to `index.html` (consumer, EN)

Minimal — the committed base has NO `#biz` to remove. Only insert two
nav links into the existing header. Touch nothing else.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Confirm the anchor exists**

Run: `grep -n '<a class="nav-lnk" href="#pricing">Pricing</a>' index.html`
Expected: exactly one match (inside `<header id="hdr">`). If zero/many,
STOP and report BLOCKED (base differs from spec).

- [ ] **Step 2: Insert the two nav links**

In `index.html`, replace the single line:

```html
    <a class="nav-lnk" href="#pricing">Pricing</a>
```

with:

```html
    <a class="nav-lnk" href="#pricing">Pricing</a>
    <a class="nav-lnk" href="/business" style="color:var(--accent);font-weight:600">For Business</a>
    <a class="nav-lnk" href="/app.html">Log in</a>
```

Change NOTHING else in the file (no section/CSS edits — there are none
to do; `#pricing` is consumer pricing and stays). Per spec, there is
no separate consumer login page → "Log in" → `/app.html` (recorded).

- [ ] **Step 3: Verify**

Run: `python3 -c "h=open('index.html').read(); print('href=\"/business\"' in h, '>Log in<' in h, all(('id=\"%s\"'%s) in h for s in ('how','features','data','pricing')))"`
Expected: `True True True` (links added, all sections intact).
Run: `python3 -m unittest tests.test_landing_ia.ConsumerLandingTest -v`
Expected: `index.html` assertions PASS (RU still red until Task 6).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(landing): add For Business + Log in nav (consumer EN)"
```

---

## Task 6: Add "Для бизнеса" + "Войти" nav to `ru/index.html` (consumer, RU)

Minimal — RU committed base has NO `#biz`. Insert two nav links only.

**Files:**
- Modify: `ru/index.html`

- [ ] **Step 1: Confirm the anchor exists**

Run: `grep -n '<a class="nav-lnk" href="#pricing">Тарифы</a>' ru/index.html`
Expected: exactly one match. If zero/many, STOP and report BLOCKED.

- [ ] **Step 2: Insert the two nav links**

In `ru/index.html`, replace the single line:

```html
    <a class="nav-lnk" href="#pricing">Тарифы</a>
```

with:

```html
    <a class="nav-lnk" href="#pricing">Тарифы</a>
    <a class="nav-lnk" href="/business" style="color:var(--accent);font-weight:600">Для бизнеса</a>
    <a class="nav-lnk" href="/ru/app.html">Войти</a>
```

Change NOTHING else.

- [ ] **Step 3: Verify — full suite**

Run: `python3 -m unittest discover -t . -s tests`
Expected: ALL OK — `tests.test_landing_ia` fully green (Business +
Consumer + Netlify classes) and no regressions elsewhere.

- [ ] **Step 4: Commit**

```bash
git add ru/index.html
git commit -m "feat(landing): add Для бизнеса + Войти nav (consumer RU)"
```

---

## Task 7: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full suite**

Run: `python3 -m unittest discover -t . -s tests`
Expected: all OK including `tests.test_landing_ia` (4 classes).

- [ ] **Step 2: Honesty grep proof**

Run:
```
for f in business.html ru/business.html; do
  echo "== $f =="
  grep -niE "trusted by|predict|lead.?time|earlier than who|case study|join thousands|our customers say|testimonial|logo-wall|client-logos|star-rating|case-study" "$f" && echo "FORBIDDEN(bad)" || echo "clean"
  grep -c "/methodology" "$f"
done
```
Expected: `clean` for both; `/methodology` ≥ 1 each.

- [ ] **Step 3: Scope proof**

Run: `git diff --name-only main..HEAD | sort`
Expected EXACTLY (plus already-committed spec/plan docs):
`business.html`, `index.html`, `netlify.toml`, `ru/business.html`,
`ru/index.html`, `tests/test_landing_ia.py`. No api-docs.html /
widgets.html / globe.js / methodology.html.

- [ ] **Step 4: EN↔RU parity checklist**

Confirm `ru/business.html` differs from `business.html` ONLY in:
`<html lang>`, title/meta, `.lang`/brand/"Consumer site" hrefs, and
the visible-string table swaps — section `id`s, DOM order, ALL CSS,
and the `<script>` byte-identical.

---

## Self-Review

**1. Spec coverage**

| Spec requirement | Task |
|---|---|
| New self-contained bilingual `/business` funnel, own nav, 8 sections | Tasks 3, 4 |
| Visual system deliberate evolution (color-blocking, bold scale, juice, product mock) | Task 3 (`<style>` bands, SVG mock, reveal/count-up JS) |
| Honest "juice" only; `prefers-reduced-motion` respected | Task 3 (`@media reduced-motion` + JS bail) + Task 1 `test_reduced_motion_respected` |
| No social-proof scaffolding (testimonials/logos/ratings/case studies) | Task 1 `test_no_social_proof_scaffolding`; Task 3 copy |
| Honest-aggressive, no "predict"/traction; positive spine | Task 3 copy + Task 1 `FORBIDDEN` |
| Audience "Who it's for" 3 segment cards, no logos | Task 3 `#audience` ×3 `.seg-card`; Task 1 guard |
| Honest comparison vs named incumbents (factual + disclaimer) | Task 3 `#compare` |
| Validation quiet+positive+reachable; `/methodology` link | Task 3 `#validation`+footer; Task 1 guard |
| Pricing free-live + Enterprise-talk, no invented prices | Task 3 `#pricing`; Task 1 `test_pricing_no_invented_numbers` |
| Consumer `/`: +2 nav links (For Business→/business, Log in), sections intact | Tasks 5, 6 |
| netlify `/business` 200 rewrite | Task 2 |
| RU = 1:1 mirror (CSS+JS byte-identical) + parity checklist | Task 4 + Task 7 Step 4 |
| SVG icons not emoji; focus states; responsive; transitions | Task 3 `<style>` (`:focus-visible`, SVG `<svg>` icons, media queries) |
| No new deps; deep tools linked not duplicated | Tasks 3–6 (only 6 files touched) |
| Login: existing entry / fallback /app.html, recorded | Task 5 Step 3 |

No gaps.

**2. Placeholder scan:** None. Full HTML+CSS+JS in Task 3; complete
RU replacement table in Task 4; CSS/section removal anchored to
verifiable in-file comments in Tasks 5–6.

**3. Consistency:** Section `id`s in Task 3 = `SECTION_IDS` in Task 1.
`.seg-card`×3 = `test_who_its_for_three_cards`. `#pricing` has no
`$`/`/mo` = `test_pricing_no_invented_numbers`. `prefers-reduced-motion`
present (CSS + JS) = `test_reduced_motion_respected`. No social-proof
class/text = `test_no_social_proof_scaffolding`. `/business` TOML regex
(Task 1) ↔ block added (Task 2). `>Log in<` / `>Войти<` ↔ Tasks 5/6.
RU `<script>`/CSS byte-identical to EN ↔ `test_en_ru_structural_parity`.

---

## Execution Handoff

(Provided after save.)
