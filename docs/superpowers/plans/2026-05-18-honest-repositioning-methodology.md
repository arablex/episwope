# Honest Repositioning + /methodology Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public `/methodology` page publishing our three committed backtests (incl. the honest NOT DEMONSTRATED verdicts) as the transparency moat, and wire a canonical honest disclaimer into the few predictive-ish surfaces — without breaking the API or touching the landing pages.

**Architecture:** One new static HTML page mirroring existing `report.html`/`reports.html` conventions (self-contained, `?lang=en|ru`, light/dark); a Netlify 200-rewrite mirroring existing routes; additive-only fields in `risk-v1.mjs`; small honest copy in `api-docs.html`/`report.html`/`widget.js`. A stdlib `unittest` honesty-guard ties the page to the source reports and asserts the landing pages stay untouched.

**Tech Stack:** Static HTML/CSS/JS (no framework — matches the repo), Netlify redirects, Node ESM for the one `.mjs` edit, Python 3.9 stdlib `unittest` (canonical: `python3 -m unittest discover -t . -s tests`). No new dependencies.

**Spec:** `docs/specs/2026-05-18-honest-repositioning-methodology-design.md`

**Verbatim numbers (must appear EXACTLY, copied from the committed reports):**

| Report (`docs/validation/…`) | Verdict | Key metrics (verbatim substrings) |
|---|---|---|
| `dengue-backtest.md` | `NOT DEMONSTRATED` | TSS indicator `0.1213`, seasonal `0.6624`, **Skill vs seasonal `-0.541`**, CI `[-0.711716, -0.349235]` |
| `gdelt-combined-backtest.md` | `NOT DEMONSTRATED` (near-miss) | PR-AUC `0.1925` → `0.2175`, Brier `0.0656` → `0.0658`, **skill `0.025`**, CI `[0.004902, 0.104248]` |
| `gdelt-phase2-backtest.md` | `NOT DEMONSTRATED` (decisive) | PR-AUC `0.1925` → `0.0724`, Brier `0.0656` → `0.1308`, **skill `-0.1201`**, CI `[-0.073529, 0.001337]` |

**Canonical disclaimer (one source of wording):**
- EN: `Directional model output — NOT validated outbreak prediction. We backtest our own signals and publish results, including failures: /methodology`
- RU: `Directional-вывод модели — НЕ валидированное предсказание вспышек. Мы бэктестим свои сигналы и публикуем результаты, включая провалы: /methodology`

**GitHub blob base for raw-report links:**
`https://github.com/arablex/episwope/blob/main/docs/validation/`

**HARD GUARDRAIL:** never modify `index.html` or `ru/index.html`.

---

## File Structure

```
methodology.html                       # CREATE — the transparency page (static)
netlify.toml                           # MODIFY — add /methodology 200 rewrite
netlify/functions/risk-v1.mjs          # MODIFY — additive disclaimer+methodology_url
api-docs.html                          # MODIFY — "Validation & limitations" section
report.html                            # MODIFY — canonical qualifier near projection/lead
widget.js                              # MODIFY — canonical qualifier near lead/outbreak
tests/__init__.py                      # exists (empty) — leave
tests/test_methodology_honesty.py      # CREATE — honesty guard + landing guardrail
```

Each file has one responsibility. `methodology.html` is the only large
new unit; everything else is a small, isolated, additive edit.

---

## Task 1: Honesty-guard + landing-guardrail test (TDD anchor)

This test is written FIRST and drives the page content to be
verbatim-correct. It also permanently enforces the HARD GUARDRAIL.

**Files:**
- Create: `tests/test_methodology_honesty.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_methodology_honesty.py`:

```python
import os
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def _read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


# (report markdown, verdict token, key metric that MUST be verbatim)
CASES = [
    ("docs/validation/dengue-backtest.md", "NOT DEMONSTRATED", "-0.541"),
    ("docs/validation/gdelt-combined-backtest.md", "NOT DEMONSTRATED",
     "0.004902"),
    ("docs/validation/gdelt-phase2-backtest.md", "NOT DEMONSTRATED",
     "-0.1201"),
]

CANON_EN = ("Directional model output — NOT validated outbreak "
            "prediction. We backtest our own signals and publish "
            "results, including failures: /methodology")


class MethodologyHonestyTest(unittest.TestCase):
    def test_page_numbers_match_source_reports_verbatim(self):
        page = _read("methodology.html")
        for md_rel, verdict, metric in CASES:
            md = _read(md_rel)
            self.assertIn(verdict, md, f"{md_rel} missing verdict")
            self.assertIn(metric, md, f"{md_rel} missing metric {metric}")
            self.assertIn(verdict, page,
                          f"methodology.html missing verdict for {md_rel}")
            self.assertIn(metric, page,
                          f"methodology.html missing {metric} from {md_rel}")

    def test_page_links_each_source_report(self):
        page = _read("methodology.html")
        for md_rel, _v, _m in CASES:
            fname = os.path.basename(md_rel)
            self.assertIn(
                "github.com/arablex/episwope/blob/main/docs/validation/"
                + fname, page, f"methodology.html missing link to {fname}")

    def test_canonical_disclaimer_present_on_page(self):
        self.assertIn(CANON_EN, _read("methodology.html"))

    def test_landing_pages_untouched_no_methodology_injection(self):
        # HARD GUARDRAIL: we must not have edited the landing pages.
        for rel in ("index.html", "ru/index.html"):
            txt = _read(rel)
            self.assertNotIn(CANON_EN, txt,
                             f"GUARDRAIL VIOLATED: canonical disclaimer "
                             f"injected into {rel}")
            self.assertNotIn("/methodology", txt,
                             f"GUARDRAIL VIOLATED: /methodology added to "
                             f"{rel}")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd "$(git rev-parse --show-toplevel)" && python3 -m unittest tests.test_methodology_honesty -v`
Expected: FAIL — `FileNotFoundError` / assertion on missing `methodology.html` (the landing-guardrail test should already PASS since landing has neither string).

- [ ] **Step 3: Commit the test**

```bash
git add tests/test_methodology_honesty.py
git commit -m "test: methodology honesty-guard + landing guardrail (red)"
```

---

## Task 2: Create `methodology.html`

Self-contained static page. Verbatim numbers. `?lang=en|ru` toggle and
light/dark via a tiny inline script (same lightweight approach as
`report.html`). No external assets, no framework.

**Files:**
- Create: `methodology.html`

- [ ] **Step 1: Create the page**

Create `methodology.html` with EXACTLY this content:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vigilo — Methodology &amp; Validation</title>
<meta name="description" content="We backtest our own risk signals and publish the results, including the failures.">
<style>
  :root{--bg:#0b0f14;--fg:#e6edf3;--mut:#9aa7b2;--card:#121821;--bd:#223;--accent:#4da3ff;--bad:#ff6b6b}
  [data-t=light]{--bg:#f7f9fc;--fg:#0f172a;--mut:#475569;--card:#fff;--bd:#e2e8f0;--accent:#0067d6;--bad:#c0392b}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 -apple-system,Segoe UI,Roboto,sans-serif}
  .wrap{max-width:880px;margin:0 auto;padding:32px 20px 80px}
  a{color:var(--accent)}
  h1{font-size:28px;margin:.2em 0}
  h2{font-size:20px;margin:1.6em 0 .4em;border-bottom:1px solid var(--bd);padding-bottom:6px}
  .sub{color:var(--mut);margin:.2em 0 1.4em}
  .bar{display:flex;gap:14px;justify-content:flex-end;font-size:14px}
  .bar a{cursor:pointer}
  table{border-collapse:collapse;width:100%;margin:10px 0}
  td,th{border:1px solid var(--bd);padding:8px 10px;text-align:left;vertical-align:top}
  .card{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:16px 18px;margin:14px 0}
  .verdict{display:inline-block;font-weight:700;color:var(--bad);border:1px solid var(--bad);border-radius:6px;padding:2px 8px;font-size:13px}
  .nums{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;color:var(--mut)}
  .disc{margin-top:40px;padding:14px 16px;border:1px dashed var(--bd);border-radius:8px;color:var(--mut);font-size:14px}
  .foot{margin-top:24px;color:var(--mut);font-size:13px}
</style>
</head>
<body data-t="dark">
<div class="wrap">
  <div class="bar">
    <a id="lang">RU</a><a id="theme">Light</a><a href="/api/v1/docs">API docs</a>
  </div>

  <h1 data-i="title">Methodology &amp; Validation</h1>
  <p class="sub" data-i="thesis">Radical transparency: we backtest our own
  signals and publish the results — <strong>including the ones that
  failed</strong>. Pre-registered criteria, no lookahead, no
  goalpost-moving.</p>

  <h2 data-i="claimh">What we claim — and what we don't</h2>
  <table>
    <tr><th data-i="cdo">We claim</th><th data-i="cdont">We do NOT claim</th></tr>
    <tr>
      <td data-i="cdo1">Aggregation of 44 public sources; seasonal &amp;
      historical risk calendars; a directional composite risk score;
      full transparency of method.</td>
      <td data-i="cdont1">Validated outbreak prediction; beating WHO;
      lead-time as established fact.</td>
    </tr>
  </table>

  <h2 data-i="bth">What our own backtests found</h2>

  <div class="card">
    <span class="verdict">NOT DEMONSTRATED</span>
    <p><strong data-i="b1t">Climate → dengue (Mordecai indicator)</strong></p>
    <p data-i="b1d">A standalone climate heuristic does not beat a trivial
    seasonal calendar. It performs ≈ as well as random.</p>
    <p class="nums">TSS indicator 0.1213 vs seasonal 0.6624 ·
    Skill vs seasonal -0.541 · 95% CI [-0.711716, -0.349235]</p>
    <p><a href="https://github.com/arablex/episwope/blob/main/docs/validation/dengue-backtest.md" data-i="raw">Full report ↗</a></p>
  </div>

  <div class="card">
    <span class="verdict">NOT DEMONSTRATED</span>
    <p><strong data-i="b2t">GDELT × seasonal — Phase 1 (near-miss)</strong></p>
    <p data-i="b2d">Adding GDELT health-news showed a tiny ranking lift,
    but failed the pre-registered calibration clause. The bar was not
    moved.</p>
    <p class="nums">PR-AUC 0.1925 → 0.2175 · Brier 0.0656 → 0.0658 ·
    skill 0.025 · 95% CI [0.004902, 0.104248]</p>
    <p><a href="https://github.com/arablex/episwope/blob/main/docs/validation/gdelt-combined-backtest.md" data-i="raw">Full report ↗</a></p>
  </div>

  <div class="card">
    <span class="verdict">NOT DEMONSTRATED</span>
    <p><strong data-i="b3t">GDELT × seasonal — Phase 2 (decisive)</strong></p>
    <p data-i="b3d">With real BigQuery GKG, all 6 countries and a
    calibration layer — the same frozen bar — the combined model
    decisively loses to seasonality (a visible 2020–22 COVID volume
    confound). The predictive hypothesis is not supported.</p>
    <p class="nums">PR-AUC 0.1925 → 0.0724 · Brier 0.0656 → 0.1308 ·
    skill -0.1201 · 95% CI [-0.073529, 0.001337]</p>
    <p><a href="https://github.com/arablex/episwope/blob/main/docs/validation/gdelt-phase2-backtest.md" data-i="raw">Full report ↗</a></p>
  </div>

  <h2 data-i="howh">How to read this</h2>
  <p data-i="how">Each criterion was registered before the run. The
  reconstruction is strictly causal (no lookahead, enforced by unit
  tests). We never re-subset data or move the bar to manufacture a
  positive. The validation harness is reusable and open in the repo.</p>

  <div class="disc" data-i="disc">Directional model output — NOT
  validated outbreak prediction. We backtest our own signals and
  publish results, including failures: /methodology</div>

  <p class="foot"><span data-i="foot">Vigilo — global risk intelligence.
  Aggregation + seasonal calendars + transparency.</span></p>
</div>

<script>
(function(){
  var q=new URLSearchParams(location.search);
  var lang=q.get('lang')==='ru'?'ru':'en';
  var RU={
    title:"Методология и валидация",
    thesis:"Радикальная прозрачность: мы бэктестим свои сигналы и публикуем результаты — <strong>включая провалы</strong>. Критерии заданы заранее, без подглядывания в будущее, без сдвига планки.",
    claimh:"Что мы заявляем — и что НЕ заявляем",
    cdo:"Заявляем", cdont:"НЕ заявляем",
    cdo1:"Агрегация 44 публичных источников; сезонные и исторические календари риска; directional composite-score; полная прозрачность метода.",
    cdont1:"Валидированное предсказание вспышек; опережение ВОЗ; lead-time как доказанный факт.",
    bth:"Что нашли наши собственные бэктесты",
    b1t:"Климат → денге (индикатор Mordecai)",
    b1d:"Самостоятельная климатическая эвристика не бьёт тривиальный сезонный календарь. Работает ≈ как случайность.",
    b2t:"GDELT × сезонность — Phase 1 (near-miss)",
    b2d:"Добавление GDELT-новостей дало крошечный прирост по ранжированию, но провалило заранее заданную клаузу калибровки. Планку не двигали.",
    b3t:"GDELT × сезонность — Phase 2 (решающий)",
    b3d:"С реальным BigQuery GKG, всеми 6 странами и слоем калибровки — тот же замороженный критерий — комбинированная модель решительно проигрывает сезонности (виден COVID-конфаунд 2020–22). Предиктивная гипотеза не подтверждена.",
    howh:"Как это читать",
    how:"Каждый критерий зарегистрирован до прогона. Реконструкция строго причинна (без lookahead, проверено юнит-тестами). Мы не пере-нарезаем данные и не двигаем планку ради положительного результата. Валидационный стенд переиспользуемый и открыт в репозитории.",
    disc:"Directional-вывод модели — НЕ валидированное предсказание вспышек. Мы бэктестим свои сигналы и публикуем результаты, включая провалы: /methodology",
    foot:"Vigilo — глобальная risk-аналитика. Агрегация + сезонные календари + прозрачность.",
    raw:"Полный отчёт ↗"
  };
  function applyLang(){
    document.documentElement.lang=lang;
    if(lang==='ru'){
      document.querySelectorAll('[data-i]').forEach(function(el){
        var k=el.getAttribute('data-i'); if(RU[k]) el.innerHTML=RU[k];
      });
    }
    document.getElementById('lang').textContent=lang==='ru'?'EN':'RU';
  }
  document.getElementById('lang').onclick=function(){
    lang=lang==='ru'?'en':'ru';
    q.set('lang',lang); history.replaceState(0,0,location.pathname+'?'+q);
    location.reload();
  };
  var t=document.body;
  document.getElementById('theme').onclick=function(){
    var n=t.getAttribute('data-t')==='dark'?'light':'dark';
    t.setAttribute('data-t',n);
    this.textContent=n==='dark'?'Light':'Dark';
  };
  applyLang();
})();
</script>
</body>
</html>
```

- [ ] **Step 2: Run the honesty test**

Run: `python3 -m unittest tests.test_methodology_honesty -v`
Expected: all 4 tests PASS (numbers verbatim, links present, canonical
disclaimer present, landing untouched).

- [ ] **Step 3: Run the full suite**

Run: `python3 -m unittest discover -t . -s tests`
Expected: all OK.

- [ ] **Step 4: Commit**

```bash
git add methodology.html
git commit -m "feat: /methodology transparency page (verbatim backtest verdicts)"
```

---

## Task 3: Netlify `/methodology` rewrite

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
  from = "/methodology"
  to = "/methodology.html"
  status = 200
```

- [ ] **Step 2: Verify TOML still parses**

Run: `python3 -c "import tomllib,sys; tomllib.load(open('netlify.toml','rb')); print('toml ok')"`
Expected: `toml ok`. (Python 3.11+ has `tomllib`; if it errors with
`No module named 'tomllib'`, instead run
`grep -n 'from = \"/methodology\"' netlify.toml` and confirm one match
plus visually confirm the block mirrors the `/reports` one exactly.)

- [ ] **Step 3: Commit**

```bash
git add netlify.toml
git commit -m "feat: route /methodology -> methodology.html (200 rewrite)"
```

---

## Task 4: Additive disclaimer in `risk-v1.mjs`

Non-breaking: add two keys to the `projection` object and to
`investigative_leads`. No rename, no removal, no scoring change.

**Files:**
- Modify: `netlify/functions/risk-v1.mjs`

- [ ] **Step 1: Inspect the exact current shape**

Run: `grep -n "const projection = \|investigative_leads\|projection,\|return J(" netlify/functions/risk-v1.mjs`
Note the lines where `projection` is built and where `investigative_leads` is built.

- [ ] **Step 2: Add a canonical constant**

Near the top of `netlify/functions/risk-v1.mjs`, after the existing
`const BANDS = [...]` line, add:

```javascript
const METHODOLOGY_URL = 'https://vigilo.cc/methodology';
const HONEST_DISCLAIMER =
  'Directional model output — NOT validated outbreak prediction. ' +
  'We backtest our own signals and publish results, including ' +
  'failures: /methodology';
```

- [ ] **Step 3: Attach to `projection` (additive)**

Find the projection assignment (currently):

```javascript
  const projection = (country && fc && fc.forecast && fc.forecast[country])
    ? { horizon_days: fc.meta?.horizon_days || 7,
        model: fc.meta?.model, ...fc.forecast[country] }
    : null;
```

Replace with (only adds two keys when projection is non-null;
null path unchanged):

```javascript
  const projection = (country && fc && fc.forecast && fc.forecast[country])
    ? { horizon_days: fc.meta?.horizon_days || 7,
        model: fc.meta?.model, ...fc.forecast[country],
        disclaimer: HONEST_DISCLAIMER, methodology_url: METHODOLOGY_URL }
    : null;
```

- [ ] **Step 4: Attach to `investigative_leads` (additive)**

Find where `investigative_leads` is built (an object with a `note`
and `leads` array, per the OSINT block). Add the same two keys to
that object literal — locate the line that closes the
`investigative_leads = { ... }` object and add, as additional
properties of that object:

```javascript
        disclaimer: HONEST_DISCLAIMER,
        methodology_url: METHODOLOGY_URL,
```

(If `investigative_leads` is assembled as `{ note, model, count, leads }`,
add the two keys alongside `note`. Do not alter `leads`/scoring.)

- [ ] **Step 5: Syntax check**

Run: `node --check netlify/functions/risk-v1.mjs && echo "node syntax ok"`
Expected: `node syntax ok`.

- [ ] **Step 6: Assert the disclaimer is wired (stdlib test addition)**

Append to `tests/test_methodology_honesty.py` a new method inside
`MethodologyHonestyTest`:

```python
    def test_api_carries_canonical_disclaimer(self):
        src = _read("netlify/functions/risk-v1.mjs")
        self.assertIn("methodology", src)
        self.assertIn("NOT validated outbreak prediction", src)
        self.assertIn("methodology_url", src)
```

- [ ] **Step 7: Run tests + commit**

Run: `python3 -m unittest discover -t . -s tests`
Expected: all OK.

```bash
git add netlify/functions/risk-v1.mjs tests/test_methodology_honesty.py
git commit -m "feat(api): additive honest disclaimer + methodology_url (non-breaking)"
```

---

## Task 5: `api-docs.html` Validation & limitations section

**Files:**
- Modify: `api-docs.html`

- [ ] **Step 1: Find a safe insertion point**

Run: `grep -n "</body>\|<footer\|class=\"section\"\|<h2" api-docs.html | tail -8`
Pick the point right before `</body>` (or before the closing
container) to append a new self-contained section.

- [ ] **Step 2: Insert the section**

Immediately before `</body>` in `api-docs.html`, insert:

```html
<section style="max-width:880px;margin:40px auto;padding:16px 20px;border:1px dashed #889;border-radius:8px;font:15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif">
  <h2 style="font-size:18px;margin:.2em 0">Validation &amp; limitations</h2>
  <p>The <code>projection</code>, <code>lead_time*</code> and the
  climate <em>leading-indicator</em> fields are <strong>directional
  model output, not validated outbreak prediction</strong>. We backtest
  our own signals and publish the results, including failures:
  <a href="/methodology">/methodology</a>.</p>
  <p>Headline verdicts (full reports linked from the methodology page):
  climate→dengue <strong>NOT DEMONSTRATED</strong>;
  GDELT phase&nbsp;1 <strong>NOT DEMONSTRATED</strong> (near-miss);
  GDELT phase&nbsp;2 <strong>NOT DEMONSTRATED</strong> (decisive).</p>
</section>
```

- [ ] **Step 3: Verify the strings landed**

Run: `grep -c "/methodology" api-docs.html && grep -c "NOT DEMONSTRATED" api-docs.html`
Expected: `/methodology` ≥ 1 and `NOT DEMONSTRATED` = 3.

- [ ] **Step 4: Commit**

```bash
git add api-docs.html
git commit -m "docs(api): Validation & limitations section + /methodology link"
```

---

## Task 6: Canonical qualifier in `report.html` and `widget.js`

Follow each file's existing localisation. `report.html` uses an inline
`T={en:{…}}` dict with `var L=(Q.get('lang')==='en')?'en':'ru'`;
`proj:'7-day projection'`, `ahead:'ahead of WHO'`, `lead_time_hours`,
`d.projection`. Add a short honest qualifier string + `/methodology`
link rendered next to the projection block.

**Files:**
- Modify: `report.html`
- Modify: `widget.js`

- [ ] **Step 1: Locate the projection render in report.html**

Run: `grep -n "d.projection\|proj:\|ahead:\|lead_time_hours" report.html`
Note the function that renders `d.projection` (around the
`var p=d.projection; if(!p) return '';` line).

- [ ] **Step 2: Add bilingual qualifier keys to report.html's T dict**

In `report.html`, inside the `T` object, add to BOTH the `en` and `ru`
maps a key `mnote`:

- in `en:{…}` add: `mnote:'Directional model output — not validated outbreak prediction. Method &amp; backtests: ',`
- in `ru:{…}` add: `mnote:'Directional-вывод модели — не валидированное предсказание вспышек. Метод и бэктесты: ',`

- [ ] **Step 3: Render the qualifier under the projection block**

In the function that returns the projection HTML (the
`var p=d.projection; if(!p) return '';` block), immediately before its
`return` of the projection markup, append to the produced HTML string a
trailing node:

```javascript
      + '<p style="font-size:12px;color:#8895a3;margin-top:8px">'
      + (T[L].mnote||'Directional model output — not validated outbreak prediction. Method &amp; backtests: ')
      + '<a href="/methodology">/methodology</a></p>'
```

(Concatenate it onto the existing returned projection string — do not
remove any existing markup.)

- [ ] **Step 4: Add the qualifier in widget.js**

Run: `grep -n "lead_time\|ahead of\|outbreak\|methodology" widget.js`
In the widget's rendered card (wherever lead/outbreak copy is emitted),
append once, near the card footer, a small line:

```javascript
'<div style="font-size:11px;opacity:.7;margin-top:6px">Directional model output — not validated outbreak prediction. <a href="https://vigilo.cc/methodology" target="_blank" rel="noopener">/methodology</a></div>'
```

Insert it into the existing card HTML template string (additive; do not
delete existing widget markup).

- [ ] **Step 5: Verify + guardrail still holds**

Run:
```
grep -c "/methodology" report.html widget.js
python3 -m unittest discover -t . -s tests
```
Expected: each file ≥ 1 `/methodology`; full suite OK (incl. the
landing-guardrail test still green — proves `index.html`/`ru/index.html`
were not touched).

- [ ] **Step 6: Commit**

```bash
git add report.html widget.js
git commit -m "feat: honest directional qualifier + /methodology link (report, widget)"
```

---

## Task 7: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full suite**

Run: `python3 -m unittest discover -t . -s tests`
Expected: all OK, including `test_methodology_honesty` (4+1 methods).

- [ ] **Step 2: Guardrail proof via git**

Run: `git diff --name-only main..HEAD | grep -E '(^|/)index\.html$|^ru/index\.html$' && echo "GUARDRAIL VIOLATED" || echo "guardrail intact (landing untouched)"`
Expected: `guardrail intact (landing untouched)`.

- [ ] **Step 3: Scope proof**

Run: `git diff --name-only main..HEAD | sort`
Expected EXACTLY: `api-docs.html`, `methodology.html`, `netlify.toml`,
`netlify/functions/risk-v1.mjs`, `report.html`,
`tests/test_methodology_honesty.py`, `widget.js`
(plus the spec/plan docs). No other files.

- [ ] **Step 4: Final commit (if any stray fixes)**

Only if Steps 1–3 required a fix; otherwise nothing to commit.

---

## Self-Review

**1. Spec coverage**

| Spec requirement | Task |
|---|---|
| New static methodology.html, RU/EN, light/dark, verbatim numbers, GitHub links | Task 2 |
| netlify /methodology 200 rewrite mirroring existing | Task 3 |
| Additive disclaimer + methodology_url on projection + investigative_leads, non-breaking | Task 4 |
| api-docs.html Validation & limitations + link | Task 5 |
| Canonical qualifier + link in report.html & widget.js | Task 6 |
| Honesty-guard test (verdict+metric verbatim in page AND md) | Task 1 |
| HARD GUARDRAIL: landing untouched | Task 1 (test) + Task 7 (git proof) |
| No new dependencies; canonical disclaimer single source | Tasks 2/4 (constants) |
| Numbers verbatim from committed reports | Task 2 (values cross-checked in header table) |

No gaps.

**2. Placeholder scan:** None. All HTML/JS/TOML/Python is complete and
literal. Numbers cross-checked against the committed reports in the
header table.

**3. Consistency:** Canonical EN string identical in Task 1 test
(`CANON_EN`), Task 2 page (`.disc`), Task 4 `HONEST_DISCLAIMER`
(same words). Verdict token `NOT DEMONSTRATED` and metrics (`-0.541`,
`0.004902`, `-0.1201`) identical between the honesty test, the page
card `.nums`, and the source `.md` files. `/methodology` route
consistent across netlify.toml, page, api-docs, report, widget.

---

## Execution Handoff

(Provided after save.)
