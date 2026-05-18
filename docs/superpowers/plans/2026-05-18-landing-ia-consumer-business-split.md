# Landing IA — Consumer / Business Split — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the landing into a slim consumer `/` and a new self-contained bilingual B2B funnel at `/business`, honest-aggressive, no fabricated traction / no predictive overclaim.

**Architecture:** New self-contained `business.html` + `ru/business.html` (same pattern as `report.html`: own `<head>`, embedded `<style>` with the shared token system, own header nav). Consumer `index.html`/`ru/index.html` lose the in-page `#biz` section + its CSS and the "For Business" link points to `/business`. A Netlify 200-rewrite mirrors the existing `/report` pattern. A stdlib `unittest` honesty/parity guard is the TDD anchor.

**Tech Stack:** Static HTML/CSS/JS (no framework — project pattern), Netlify redirects, Python 3.9 stdlib `unittest` (canonical: `python3 -m unittest discover -t . -s tests`). No new dependencies.

**Spec:** `docs/specs/2026-05-18-landing-ia-consumer-business-split-design.md`

## Verified codebase facts (do not re-derive)

- `index.html` header nav (lines ~460–471): brand `/`, `.nav-lnk` →
  `#instrument` (The instrument), `#list` (Coverage), `#data` (Data),
  `#biz` (For Business, accent-styled), `.lang` → `/ru/`, `.hbtn` →
  `/app.html` ("Open the app"). **There is NO separate consumer login
  page**; `/app.html` is the app entry (it handles its own auth).
  `magic-link.mjs` / `auth-verify.mjs` are the email-digest verify
  flow, NOT a landing login. → Per spec fallback: the quiet "Log in"
  link points to `/app.html` (recorded here).
- `index.html` `#biz` CSS: contiguous block starting at the comment
  line `  /* ── For Business section ──...── */` (line ~387) through
  the last consecutive `#biz` / `.biz-cards` / `.biz-card` / `.bc-*`
  rule before the next unrelated CSS comment. `#biz` HTML: the block
  bracketed by `<!-- ── For Business ──...── -->` (line ~705) and
  `<!-- /For Business -->` (line ~819), containing
  `<section id="biz"> … </section>`.
- `ru/index.html`: nav anchors differ from EN (`#how`, `#features`,
  `#data`, `#pricing`, `#biz` "Для бизнеса"); CTA `/ru/app.html`;
  `#biz` CSS contiguous block ~lines 283–288; `#biz` HTML
  `<section id="biz">` (line ~634) … `<!-- /Для бизнеса -->`
  (line ~747). **Pre-existing EN/RU structural divergence on the
  consumer pages is OUT OF SCOPE — do not reconcile it.**
- Self-contained page pattern (`report.html`): `<!doctype html>` …
  `<style>:root{--bg:#F4F2EE;--card:#FFF;--ink:#0F0E0C;--muted:#807E76;
  --line:#ECEAE2;--accent:#E8590C; --sans:-apple-system,…}` +
  `[data-theme=dark]{…}`. `business.html` follows this exact pattern.
- `netlify.toml` redirect pattern: `[[redirects]]` blocks with
  `from` / `to` / `status = 200`; existing `/report`, `/reports`,
  `/widgets` then a `/.netlify/functions/:splat` block. Insert the
  `/business` block alongside the page redirects (before the
  functions splat).
- Lang link convention: EN page links RU via `<a class="lang"
  href="/ru/…">RU</a>`; RU page links EN via `href="/…">EN`.

## File Structure

```
business.html            # CREATE — EN B2B funnel (self-contained)
ru/business.html         # CREATE — RU 1:1 mirror (same ids/DOM, RU copy)
netlify.toml             # MODIFY — add /business 200 rewrite
index.html               # MODIFY — remove #biz sec+css, For-Business→/business, +Log in
ru/index.html            # MODIFY — same, RU
tests/test_landing_ia.py # CREATE — honesty + structural-parity guard
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

    def test_methodology_link_present_quiet(self):
        for page in (self.en, self.ru):
            self.assertIn("/methodology", page)

    def test_who_its_for_three_cards(self):
        # audience section must carry exactly 3 segment cards
        for page in (self.en, self.ru):
            seg = page.split('id="audience"', 1)[1].split("</section>", 1)[0]
            self.assertEqual(seg.count('class="seg-card"'), 3)

    def test_pricing_no_invented_numbers(self):
        # honest pricing: free tier + talk-to-us, no "$"/"/mo" prices
        for page in (self.en, self.ru):
            pr = page.split('id="pricing"', 1)[1].split("</section>", 1)[0]
            self.assertNotIn("$", pr)
            self.assertNotIn("/mo", pr.lower())


class ConsumerLandingTest(unittest.TestCase):
    def test_biz_section_removed(self):
        for rel in ("index.html", "ru/index.html"):
            h = read(rel)
            self.assertNotIn('<section id="biz"', h, f"{rel} still has #biz")
            self.assertNotIn(".biz-card", h, f"{rel} still has #biz CSS")

    def test_for_business_links_to_business_page(self):
        for rel in ("index.html", "ru/index.html"):
            h = read(rel)
            self.assertNotIn('href="#biz"', h, f"{rel} still anchors #biz")
            self.assertIn('href="/business"', h,
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
Expected: FAIL — `FileNotFoundError: business.html` (and other assertions red). The `ConsumerLandingTest.test_biz_section_removed` also fails (today `#biz` still present).

- [ ] **Step 3: Commit**

```bash
git add tests/test_landing_ia.py
git commit -m "test: landing IA split — honesty + parity guard (red)"
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

(If the `/reports` block is followed by another `/reports.html`
alias block, place the new block right after the first `/reports`
one — anywhere among the page redirects, before the
`/.netlify/functions/:splat` block, is fine.)

- [ ] **Step 2: Verify + run the route test**

Run: `python3 -m unittest tests.test_landing_ia.NetlifyRouteTest -v`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add netlify.toml
git commit -m "feat: route /business -> business.html (200 rewrite)"
```

---

## Task 3: Create `business.html` (EN)

Self-contained, same token system as `report.html`. 8 sections with
the exact `id`s the test expects: `overview` (hero), `breadth`,
`capabilities`, `audience`, `compare`, `validation`, `pricing`, plus a
final CTA + footer (footer carries the quiet `/methodology` &
`/report` links). Honest-aggressive copy; NO "predict"/"lead-time"/
"trusted by"/"case study" anywhere; pricing has no `$` or `/mo`.

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
    --accent:#E8590C;--ink2:#1C1A16;
    --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--ink);font:16px/1.62 var(--sans);-webkit-font-smoothing:antialiased}
  a{color:inherit;text-decoration:none}
  .wrap{max-width:1080px;margin:0 auto;padding:0 24px}
  header{position:sticky;top:0;background:rgba(244,242,238,.86);backdrop-filter:blur(10px);
    border-bottom:1px solid var(--line);z-index:50}
  .nav{display:flex;align-items:center;gap:22px;height:60px}
  .brand{font-weight:800;letter-spacing:-.04em;font-size:19px}
  .brand b{color:var(--accent)}
  .logo{display:inline-grid;place-items:center;width:24px;height:24px;background:var(--accent);
    color:#fff;border-radius:7px;font-size:13px;margin-right:8px;vertical-align:-5px}
  .sp{flex:1}
  .nav a.nl{font-size:14px;font-weight:600;color:var(--muted);display:none}
  .nav a.nl:hover{color:var(--ink)}
  @media(min-width:860px){.nav a.nl{display:inline}}
  .btn{display:inline-block;font-weight:700;font-size:14px;border-radius:10px;padding:10px 18px;
    border:1px solid var(--ink);transition:.18s}
  .btn:hover{background:var(--ink);color:var(--bg)}
  .btn-acc{background:var(--accent);border-color:var(--accent);color:#fff}
  .btn-acc:hover{background:#cf4d09;color:#fff}
  .lang{font-size:13px;font-weight:700;color:var(--muted)}
  section{padding:clamp(64px,9vw,116px) 0}
  .kick{font-size:11px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:var(--accent)}
  h1{font-size:clamp(34px,5.4vw,62px);font-weight:800;letter-spacing:-.045em;line-height:1.04;margin:18px 0}
  h2{font-size:clamp(26px,3.4vw,40px);font-weight:800;letter-spacing:-.035em;margin:12px 0 10px}
  .lead{font-size:clamp(17px,1.7vw,21px);color:var(--muted);max-width:640px}
  .cta{display:flex;gap:14px;flex-wrap:wrap;margin-top:30px}
  .grid{display:grid;gap:16px;grid-template-columns:1fr;margin-top:40px}
  @media(min-width:760px){.grid.c3{grid-template-columns:repeat(3,1fr)}.grid.c2{grid-template-columns:repeat(2,1fr)}}
  .card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:28px}
  .card h3{font-size:19px;font-weight:700;letter-spacing:-.02em}
  .card p{color:var(--muted);font-size:14.5px;margin-top:8px}
  .card a.deep{display:inline-block;margin-top:14px;font-size:13px;font-weight:700;color:var(--accent)}
  .seg-card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:26px}
  .seg-card .pain{color:var(--muted);font-size:14px}
  .seg-card .out{font-weight:700;margin-top:12px;font-size:15px}
  table{width:100%;border-collapse:collapse;margin-top:32px;font-size:14px;background:var(--card);
    border:1px solid var(--line);border-radius:16px;overflow:hidden}
  th,td{padding:14px 16px;text-align:left;border-bottom:1px solid var(--line)}
  th{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}
  td.us{font-weight:700;color:var(--accent)}
  tr:last-child td{border-bottom:0}
  .quiet{font-size:13px;color:var(--muted);margin-top:18px}
  .quiet a{color:var(--accent);font-weight:700}
  .price-grid{display:grid;gap:16px;grid-template-columns:1fr;margin-top:36px}
  @media(min-width:680px){.price-grid{grid-template-columns:1fr 1fr}}
  .price{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:30px}
  .price.acc{border-color:var(--accent)}
  .price h3{font-size:20px;font-weight:800}
  .price .big{font-size:30px;font-weight:800;letter-spacing:-.03em;margin:10px 0}
  .price ul{list-style:none;margin:14px 0 22px;display:flex;flex-direction:column;gap:8px}
  .price li{font-size:14px;color:var(--muted)}
  .final{background:var(--ink2);color:#F2EFE9;text-align:center}
  .final h2{color:#fff}.final .lead{color:rgba(242,239,233,.6);margin:0 auto}
  footer{border-top:1px solid var(--line);padding:34px 0;font-size:13px;color:var(--muted)}
  footer a{color:var(--muted)}footer a:hover{color:var(--ink)}
  .frow{display:flex;gap:20px;flex-wrap:wrap;align-items:center}
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
  <span class="kick">Vigilo for Business</span>
  <h1>Real-time risk intelligence,<br>one open API.</h1>
  <p class="lead">Most risk-intel vendors hide behind enterprise sales calls. We don't. 44+ live sources across 7 domains, a transparent composite score, self-serve from minute one.</p>
  <div class="cta">
    <a class="btn btn-acc" href="/api/v1/docs">Get a free API key</a>
    <a class="btn" href="mailto:hello@vigilo.cc?subject=Vigilo%20for%20Business">Talk to us</a>
  </div>
</div></section>

<section id="breadth" style="background:var(--card);border-top:1px solid var(--line);border-bottom:1px solid var(--line)"><div class="wrap">
  <span class="kick">Coverage</span>
  <h2>44+ live sources. 7 domains. ~15-minute refresh.</h2>
  <p class="lead">Health &amp; outbreaks · armed conflict · civil unrest · transport · border · infrastructure · climate — continuously aggregated and scored into one composite signal.</p>
</div></section>

<section id="capabilities"><div class="wrap">
  <span class="kick">What you can build on</span>
  <h2>Integrate in an afternoon</h2>
  <div class="grid c3">
    <div class="card"><h3>Composite Risk Score</h3><p>0–5 score per country across 7 domains, with the per-domain breakdown.</p><a class="deep" href="/api/v1/docs">API docs →</a></div>
    <div class="card"><h3>Webhooks</h3><p>Get pushed a callback when a country crosses a risk threshold you set.</p><a class="deep" href="/api/v1/docs">API docs →</a></div>
    <div class="card"><h3>What-if simulator</h3><p>Drop a synthetic shock, cascade it across the exposure graph, read the impact.</p><a class="deep" href="/api/v1/docs">/api/v1/simulate →</a></div>
    <div class="card"><h3>Embeddable widgets</h3><p>Brandable risk cards &amp; checkout components — one snippet, your colors.</p><a class="deep" href="/widgets">Widgets →</a></div>
    <div class="card"><h3>Country dossier</h3><p>A full shareable risk report per country, all 7 domains, print-ready.</p><a class="deep" href="/report">Sample report →</a></div>
    <div class="card"><h3>Transparent method</h3><p>Pre-registered, backtested signals — the validation is public.</p><a class="deep" href="/methodology">Methodology →</a></div>
  </div>
</div></section>

<section id="audience" style="background:var(--card);border-top:1px solid var(--line);border-bottom:1px solid var(--line)"><div class="wrap">
  <span class="kick">Who it's for</span>
  <h2>What changes for your business</h2>
  <div class="grid c3">
    <div class="seg-card">
      <h3>Travel · insurers · OTAs</h3>
      <p class="pain">Today: enterprise-priced incumbents, black-box, not embeddable.</p>
      <p class="out">→ Duty-of-care &amp; checkout trust — without an enterprise contract.</p>
    </div>
    <div class="seg-card">
      <h3>Insurance · reinsurance</h3>
      <p class="pain">Today: non-auditable signals, slow, expensive.</p>
      <p class="out">→ Auditable, regulator-defensible geo risk monitoring, cheaper.</p>
    </div>
    <div class="seg-card">
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

<section id="validation" style="background:var(--card);border-top:1px solid var(--line);border-bottom:1px solid var(--line)"><div class="wrap">
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

<section class="final"><div class="wrap">
  <h2>Ship risk intelligence this week</h2>
  <p class="lead">Free API key, a working request on real data, no procurement.</p>
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
</body>
</html>
```

- [ ] **Step 2: Run the EN-side tests**

Run: `python3 -m unittest tests.test_landing_ia.BusinessLandingTest -v`
Expected: still some FAIL (ru/business.html missing) but the EN
content is parseable; confirm no traceback other than missing
`ru/business.html`. Quick sanity:
`python3 -c "h=open('business.html').read(); import re; print(re.findall(r'<section id=\"([^\"]+)\"',h))"`
Expected: `['overview','breadth','capabilities','audience','compare','validation','pricing']`.

- [ ] **Step 3: Commit**

```bash
git add business.html
git commit -m "feat: /business B2B funnel page (EN, honest-aggressive)"
```

---

## Task 4: Create `ru/business.html` (RU 1:1 mirror)

Identical file to `business.html` with EXACTLY these changes: `<html
lang="ru">`, the `.lang` link `href="/business.html">EN`, every other
internal link prefixed `/ru` where the consumer site uses `/ru` —
**except** API/widgets/report/methodology deep links stay as the
shared routes `/api/v1/docs`, `/widgets`, `/report`, `/methodology`
(those pages are shared, not localized) and `/` → `/ru/`. Section
`id`s and DOM order are UNCHANGED (structural parity). Visible English
strings replaced per the table below — nothing else.

**Files:**
- Create: `ru/business.html`

- [ ] **Step 1: Copy then localize**

Create `ru/business.html` as a byte copy of `business.html`, then
apply ONLY these replacements:

- `<html lang="en">` → `<html lang="ru">`
- `<title>…</title>` → `<title>Vigilo для бизнеса — API риск-аналитики</title>`
- meta description → `content="44+ живых источника риска по 7 доменам, один открытый API. Прозрачно, self-serve, без enterprise sales-gate."`
- `.lang` link: `href="/ru/business.html">RU` → `href="/business.html">EN`
- `<a class="brand" href="/">` → `<a class="brand" href="/ru/">`
- footer `<a href="/">← Consumer site</a>` → `<a href="/ru/">← Сайт для людей</a>`
- Visible-string table (replace each EN string with the RU one; leave all tags/classes/ids/links untouched):

| EN | RU |
|---|---|
| Vigilo for Business | Vigilo для бизнеса |
| Real-time risk intelligence,<br>one open API. | Risk-аналитика в реальном времени,<br>один открытый API. |
| Most risk-intel vendors hide behind enterprise sales calls. We don't. 44+ live sources across 7 domains, a transparent composite score, self-serve from minute one. | Большинство risk-вендоров прячутся за enterprise sales-звонками. Мы — нет. 44+ живых источника по 7 доменам, прозрачный composite-скор, self-serve с первой минуты. |
| Get a free API key | Получить бесплатный API-ключ |
| Talk to us | Связаться с нами |
| Coverage | Охват |
| 44+ live sources. 7 domains. ~15-minute refresh. | 44+ живых источника. 7 доменов. Обновление ~15 минут. |
| Health &amp; outbreaks · armed conflict · civil unrest · transport · border · infrastructure · climate — continuously aggregated and scored into one composite signal. | Здоровье и вспышки · вооружённые конфликты · беспорядки · транспорт · границы · инфраструктура · климат — непрерывная агрегация в один composite-сигнал. |
| What you can build on | На чём строить |
| Integrate in an afternoon | Интеграция за полдня |
| Composite Risk Score | Composite Risk Score |
| 0–5 score per country across 7 domains, with the per-domain breakdown. | Скор 0–5 по стране и 7 доменам, с разбивкой по доменам. |
| API docs → | API-доки → |
| Webhooks | Вебхуки |
| Get pushed a callback when a country crosses a risk threshold you set. | Колбэк, когда страна пересекает заданный вами порог риска. |
| What-if simulator | What-if симулятор |
| Drop a synthetic shock, cascade it across the exposure graph, read the impact. | Бросьте синтетический шок, прогоните каскад по графу экспозиции, читайте эффект. |
| Embeddable widgets | Встраиваемые виджеты |
| Brandable risk cards &amp; checkout components — one snippet, your colors. | Брендируемые риск-карточки и checkout-компоненты — один сниппет, ваши цвета. |
| Widgets → | Виджеты → |
| Country dossier | Страновое досье |
| A full shareable risk report per country, all 7 domains, print-ready. | Полный риск-отчёт по стране, все 7 доменов, готов к печати. |
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
| API | API |
| Widgets | Виджеты |
| Sample report | Образец отчёта |

(Strings already identical EN/RU — "Composite Risk Score",
"Enterprise", "API" — left as-is. The footer `Widgets`/`Methodology`
links: localize the visible text per the table; the `href` stays the
shared route.)

- [ ] **Step 2: Run the full landing test (business side now green)**

Run: `python3 -m unittest tests.test_landing_ia.BusinessLandingTest -v`
Expected: ALL `BusinessLandingTest` PASS — including
`test_en_ru_structural_parity` (section id order identical),
`test_no_forbidden_tokens`, `test_who_its_for_three_cards`,
`test_pricing_no_invented_numbers`.

- [ ] **Step 3: Commit**

```bash
git add ru/business.html
git commit -m "feat: /business B2B funnel page (RU 1:1 mirror)"
```

---

## Task 5: Slim `index.html` (consumer, EN)

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Remove the `#biz` CSS block**

In `index.html`, delete the contiguous CSS starting at the comment
line `  /* ── For Business section ──...── */` (≈ line 387) through
the last consecutive rule whose selector begins `#biz`, `.biz-cards`,
`.biz-card`, or `.bc-` — i.e. up to (not including) the next CSS
comment / unrelated selector. Read the block first to confirm its
end; remove the whole block.

- [ ] **Step 2: Remove the `#biz` HTML section**

Delete everything from the line `<!-- ── For Business ──...── -->`
(≈ 705) through the line `<!-- /For Business -->` (≈ 819) inclusive
(this is the entire `<section id="biz"> … </section>` with its
comment brackets). Leave the following `<section class="final">`
untouched.

- [ ] **Step 3: Repoint "For Business" + add quiet "Log in"**

In the header nav, replace:

```html
    <a class="nav-lnk" href="#biz" style="color:var(--accent);font-weight:600">For Business</a>
```

with:

```html
    <a class="nav-lnk" href="/business" style="color:var(--accent);font-weight:600">For Business</a>
    <a class="nav-lnk" href="/app.html">Log in</a>
```

(There is no separate consumer login page in the codebase —
`/app.html` is the app entry and handles its own auth; `magic-link`
is the email-digest verify flow, not a landing login. Per spec
fallback the "Log in" link points to `/app.html`. Recorded.)

- [ ] **Step 4: Verify**

Run: `python3 -c "h=open('index.html').read(); print('#biz' not in h.replace('href=\"/business\"',''), 'biz-card' not in h, 'href=\"/business\"' in h, '>Log in<' in h)"`
Expected: `True True True True`.
Run: `python3 -m unittest tests.test_landing_ia.ConsumerLandingTest -v`
Expected: `index.html`-related assertions PASS (ru still red until Task 6).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: slim consumer landing — remove #biz, link /business, add Log in (EN)"
```

---

## Task 6: Slim `ru/index.html` (consumer, RU)

**Files:**
- Modify: `ru/index.html`

- [ ] **Step 1: Remove the RU `#biz` CSS block**

In `ru/index.html`, delete the contiguous `#biz`-prefixed CSS block
(≈ lines 283–288 plus any immediately-consecutive `.biz-card`/`.bc-`
rules) — read first, remove the whole contiguous block up to the next
unrelated selector/comment.

- [ ] **Step 2: Remove the RU `#biz` HTML section**

Delete from `<section id="biz">` (≈ line 634) through the
`<!-- /Для бизнеса -->` comment (≈ line 747) inclusive. Leave the
following section untouched.

- [ ] **Step 3: Repoint "Для бизнеса" + add quiet "Войти"**

Replace:

```html
    <a class="nav-lnk" href="#biz" style="color:var(--accent);font-weight:600">Для бизнеса</a>
```

with:

```html
    <a class="nav-lnk" href="/business" style="color:var(--accent);font-weight:600">Для бизнеса</a>
    <a class="nav-lnk" href="/ru/app.html">Войти</a>
```

- [ ] **Step 4: Verify — full suite**

Run: `python3 -m unittest discover -t . -s tests`
Expected: ALL OK — `tests.test_landing_ia` fully green (BusinessLandingTest, ConsumerLandingTest incl. `>Войти<`, NetlifyRouteTest) and no regressions elsewhere.

- [ ] **Step 5: Commit**

```bash
git add ru/index.html
git commit -m "feat: slim consumer landing — remove #biz, link /business, add Войти (RU)"
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
  echo "== $f =="; grep -niE "trusted by|predict|lead.?time|earlier than who|case study|join thousands|our customers say" "$f" && echo "FORBIDDEN(bad)" || echo "clean";
  grep -c "/methodology" "$f";
done
```
Expected: `clean` for both; `/methodology` count ≥ 1 each.

- [ ] **Step 3: Scope proof**

Run: `git diff --name-only main..HEAD | sort`
Expected EXACTLY (plus the already-committed spec/plan docs):
`business.html`, `index.html`, `netlify.toml`, `ru/business.html`,
`ru/index.html`, `tests/test_landing_ia.py`. No other files (no
api-docs.html / widgets.html / globe.js / methodology.html — those
are linked, not modified).

- [ ] **Step 4: EN↔RU parity checklist**

Confirm by eye that `ru/business.html` differs from `business.html`
ONLY in: `<html lang>`, title/meta, the `.lang` & brand & "Consumer
site" hrefs, and the visible-string table swaps — section `id`s and
DOM order byte-identical (the `test_en_ru_structural_parity` test
enforces id order; this step confirms no structural drift was
introduced).

---

## Self-Review

**1. Spec coverage**

| Spec requirement | Task |
|---|---|
| New self-contained bilingual `/business` funnel, own nav, 8 sections | Tasks 3, 4 |
| Honest-aggressive, no "predict"/traction; positive spine | Task 3 copy + Task 1 guard |
| Audience "Who it's for" 3 segment cards, no logos | Task 3 (`#audience`, `.seg-card`×3) + Task 1 `test_who_its_for_three_cards` |
| Honest comparison on defensible axes vs named incumbents (factual) | Task 3 `#compare` + quiet disclaimer |
| Validation quiet+positive+reachable; `/methodology` link | Task 3 `#validation` + footer; Task 1 `test_methodology_link_present_quiet` |
| Pricing free-tier-live + Enterprise-talk-to-us, no invented prices | Task 3 `#pricing`; Task 1 `test_pricing_no_invented_numbers` |
| Consumer `/` slimmed: remove #biz sec+CSS, For-Business→/business, Log in | Tasks 5, 6 |
| netlify `/business` 200 rewrite | Task 2 |
| Tests: existence, EN↔RU parity, honesty guards, consumer + route | Task 1 |
| RU = 1:1 mirror + per-section parity checklist | Task 4 (string table) + Task 7 Step 4 |
| No new deps; deep tools linked not duplicated; landing visual system | Tasks 3–6 (token system reused; only the 6 listed files touched) |
| Login: locate existing entry, fallback /app.html, recorded | Task 5 Step 3 (recorded: no separate login → /app.html) |

No gaps.

**2. Placeholder scan:** None. Full HTML in Task 3; complete RU
replacement table in Task 4 (every visible string mapped); exact CSS/
section removal anchored to verifiable in-file comments in Tasks 5–6.

**3. Consistency:** Section `id`s used in Task 3 (`overview, breadth,
capabilities, audience, compare, validation, pricing`) are exactly
the `SECTION_IDS` list asserted in Task 1. `.seg-card` (×3) matches
`test_who_its_for_three_cards`. `#pricing` has no `$`/`/mo` →
`test_pricing_no_invented_numbers`. Forbidden tokens absent from the
Task-3 copy (no "predict"/"lead-time"/"trusted by"/"case study"/
"join thousands"/"our customers say"/"earlier than WHO"). `/business`
rewrite regex in Task 1 matches the TOML block added in Task 2.
Consumer-test strings `>Log in<` / `>Войти<` match Tasks 5/6.

---

## Execution Handoff

(Provided after save.)
