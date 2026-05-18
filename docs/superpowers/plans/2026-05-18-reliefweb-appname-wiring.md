# ReliefWeb Approved-Appname Wiring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate the real ReliefWeb v2 API with the approved appname `episcope-ownalex-9yimg` as the primary path in the live signals engine, keeping the Google-News path as an honest fallback, and fix the stub in the secondary data pipeline.

**Architecture:** Add a non-secret module constant in each of the two independent cron scripts. In `fast_signals.py`, extract a pure `parse_reliefweb_json()` and call the real ReliefWeb v2 API first, falling back to the existing Google-News path if the API errors or returns nothing. In `fetch_data.py`, swap the hardcoded unapproved appname and fix the stale comment. Pure parser is unit-tested with no network.

**Tech Stack:** Python 3.9 stdlib only (`json`, `urllib`), `unittest` (canonical: `python3 -m unittest discover -t . -s tests`). No new dependencies.

**Spec:** `docs/specs/2026-05-18-reliefweb-appname-wiring-design.md`

## Verified codebase facts (do not re-derive)

- `scripts/fast_signals.py`:
  - `class Article` (line ~701), `__slots__=("source","title","body","url","pub_date","domain")`, ctor `Article(source, title, body, url, pub_date="")` — **body is auto HTML-stripped and truncated to 600 inside `__init__`** (via `_strip_html`). The parser passes raw body; the ctor strips it.
  - `fetch_url(url, timeout=HTTP_TIMEOUT, extra_headers=None, retries=1, retry_wait=3.0) -> bytes | None` (line ~363).
  - `fetch_reliefweb()` (line ~958) currently: Google-News `site:reliefweb.int` RSS → `_parse_feed_items(raw, "reliefweb")`.
  - imports: `import json`, `from urllib import request, error, parse`.
  - The source id used everywhere for this feed is the string `"reliefweb"`.
- `scripts/fetch_data.py`:
  - `fetch_reliefweb()` (line ~585) already does a real GET to
    `https://api.reliefweb.int/v2/reports?{params}` with
    `("appname", "vigilo")` (unapproved → 403 → caught → returns `[]`).
  - Stale comment at lines ~56–60 (inside the SOURCES list, after the
    "CDC HAN" entry) says ReliefWeb "until then fetch_reliefweb()
    returns 0".
  - imports: `import json, os, re, time, ...`, `import urllib.request, urllib.error, urllib.parse`.
- `tests/__init__.py` exists (empty). Tests import scripts via
  `sys.path.insert(0, "scripts")`.

## File Structure

```
scripts/fast_signals.py     # MODIFY: RELIEFWEB_APPNAME const, parse_reliefweb_json(), fetch_reliefweb() rework
scripts/fetch_data.py       # MODIFY: RELIEFWEB_APPNAME const, appname swap, stale comment fix
tests/test_reliefweb.py     # CREATE: pure-parser tests + appname guard
```

---

## Task 1: TDD anchor — `tests/test_reliefweb.py`

**Files:**
- Create: `tests/test_reliefweb.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_reliefweb.py`:

```python
import json
import os
import sys
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

from fast_signals import parse_reliefweb_json, Article  # noqa: E402

SAMPLE = json.dumps({
    "data": [
        {"href": "https://api.reliefweb.int/v2/reports/1",
         "fields": {
             "title": "Cholera outbreak in Region X",
             "body": "<p>Cases <b>rising</b> sharply.</p>",
             "country": [{"name": "Sudan", "iso3": "SDN"}],
             "date": {"created": "2026-05-10T00:00:00+00:00"},
             "source": [{"name": "WHO"}],
             "disease": [{"name": "Cholera"}],
             "url": "https://reliefweb.int/report/sudan/cholera-1"}},
        {"fields": {
             "title": "Measles surge",
             "body": "Plain text body.",
             "url": "https://reliefweb.int/report/measles-2",
             "date": {"created": "2026-05-09T00:00:00+00:00"}}},
    ]
})


class ParseReliefWebTest(unittest.TestCase):
    def setUp(self):
        self.arts = parse_reliefweb_json(SAMPLE)

    def test_count_and_type(self):
        self.assertEqual(len(self.arts), 2)
        self.assertTrue(all(isinstance(a, Article) for a in self.arts))

    def test_fields_mapped(self):
        a = self.arts[0]
        self.assertEqual(a.source, "reliefweb")
        self.assertEqual(a.title, "Cholera outbreak in Region X")
        self.assertEqual(a.url, "https://reliefweb.int/report/sudan/cholera-1")
        self.assertEqual(a.pub_date, "2026-05-10T00:00:00+00:00")

    def test_body_html_stripped(self):
        # Article.__init__ strips HTML; assert no tags survive.
        self.assertNotIn("<", self.arts[0].body)
        self.assertIn("rising", self.arts[0].body)

    def test_url_falls_back_to_href(self):
        # second item has no fields.url → use top-level href if present,
        # else empty string; here href absent → empty, must not crash.
        self.assertIsInstance(self.arts[1].url, str)

    def test_garbage_and_empty(self):
        self.assertEqual(parse_reliefweb_json("not json"), [])
        self.assertEqual(parse_reliefweb_json("{}"), [])
        self.assertEqual(parse_reliefweb_json('{"data": []}'), [])
        self.assertEqual(parse_reliefweb_json('{"data": "x"}'), [])


class AppnameGuardTest(unittest.TestCase):
    APPROVED = "episcope-ownalex-9yimg"

    def _read(self, rel):
        with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
            return f.read()

    def test_both_scripts_use_approved_appname(self):
        for rel in ("scripts/fast_signals.py", "scripts/fetch_data.py"):
            src = self._read(rel)
            self.assertIn(self.APPROVED, src, f"{rel} missing approved appname")

    def test_no_legacy_vigilo_appname(self):
        # the literal unapproved appname value must be gone
        self.assertNotIn('("appname", "vigilo")',
                          self._read("scripts/fetch_data.py"))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd "$(git rev-parse --show-toplevel)" && python3 -m unittest tests.test_reliefweb -v`
Expected: FAIL — `ImportError: cannot import name 'parse_reliefweb_json' from 'fast_signals'`. (The two `AppnameGuardTest` methods also fail until Tasks 2–3.)

- [ ] **Step 3: Commit**

```bash
git add tests/test_reliefweb.py
git commit -m "test: ReliefWeb parser + approved-appname guard (red)"
```

---

## Task 2: `fast_signals.py` — constant, pure parser, real API primary + GNews fallback

**Files:**
- Modify: `scripts/fast_signals.py`

- [ ] **Step 1: Add the appname constant**

In `scripts/fast_signals.py`, immediately AFTER the import block
(after the line `from pathlib import Path` / `from urllib import request, error, parse`,
before the first constant/`HTTP_TIMEOUT` definition), add:

```python
# ReliefWeb API appname — approved, non-secret public identifier
# (ReliefWeb uses it for contact/analytics, NOT auth). Server-side only.
RELIEFWEB_APPNAME = "episcope-ownalex-9yimg"
```

- [ ] **Step 2: Replace `fetch_reliefweb()` with parser + API-primary + fallback**

Find the existing block (line ~955):

```python
# Source 7: ReliefWeb API — epidemic-tagged reports
# ---------------------------------------------------------------------------

def fetch_reliefweb() -> list[Article]:
    log("Fetching ReliefWeb API...")
    # ReliefWeb API requires app registration (returns 403 without it).
    # Use Google News targeting reliefweb.int epidemic reports as primary source.
    results = []
    url = (
        "https://news.google.com/rss/search?q=epidemic+disease+outbreak+"
        "site:reliefweb.int&hl=en&gl=US&ceid=US:en"
    )
    raw = fetch_url(url, retries=1)
    if raw:
        results.extend(_parse_feed_items(raw, "reliefweb"))
    log(f"  -> {len(results)} ReliefWeb reports")
    return results
```

Replace it ENTIRELY with:

```python
# Source 7: ReliefWeb v2 API — epidemic-tagged reports
# ---------------------------------------------------------------------------

def parse_reliefweb_json(text: str) -> list[Article]:
    """Pure parser: ReliefWeb v2 /reports JSON -> [Article].

    No network. Robust to garbage / missing keys -> []. Article's
    __init__ HTML-strips & truncates the body, so raw body is passed.
    """
    try:
        data = json.loads(text)
    except (ValueError, TypeError):
        return []
    rows = data.get("data") if isinstance(data, dict) else None
    if not isinstance(rows, list):
        return []
    out: list[Article] = []
    for item in rows:
        if not isinstance(item, dict):
            continue
        f = item.get("fields") or {}
        title = (f.get("title") or "").strip()
        if not title:
            continue
        body = f.get("body") or title
        url = f.get("url") or item.get("href") or ""
        date_str = ""
        d = f.get("date")
        if isinstance(d, dict):
            date_str = d.get("created") or d.get("changed") or ""
        out.append(Article("reliefweb", title, body, url, date_str))
    return out


def _fetch_reliefweb_api() -> list[Article]:
    """Real ReliefWeb v2 API (approved appname). Empty list on any error."""
    params = parse.urlencode([
        ("appname", RELIEFWEB_APPNAME),
        ("filter[field]", "primary_type.name"),
        ("filter[value]", "Epidemic"),
        ("limit", "30"),
        ("sort[]", "date.created:desc"),
        ("fields[include][]", "title"),
        ("fields[include][]", "body"),
        ("fields[include][]", "country"),
        ("fields[include][]", "date"),
        ("fields[include][]", "source"),
        ("fields[include][]", "disease"),
        ("fields[include][]", "url"),
    ])
    raw = fetch_url(
        f"https://api.reliefweb.int/v2/reports?{params}",
        extra_headers={"Accept": "application/json"},
        retries=1,
    )
    if not raw:
        return []
    try:
        return parse_reliefweb_json(raw.decode("utf-8", "ignore"))
    except Exception as e:  # noqa: BLE001 - defensive: never break the run
        log(f"  ReliefWeb API parse error: {e}")
        return []


def _fetch_reliefweb_gnews() -> list[Article]:
    """Honest fallback: Google-News targeting reliefweb.int."""
    results: list[Article] = []
    url = (
        "https://news.google.com/rss/search?q=epidemic+disease+outbreak+"
        "site:reliefweb.int&hl=en&gl=US&ceid=US:en"
    )
    raw = fetch_url(url, retries=1)
    if raw:
        results.extend(_parse_feed_items(raw, "reliefweb"))
    return results


def fetch_reliefweb() -> list[Article]:
    log("Fetching ReliefWeb v2 API...")
    results = _fetch_reliefweb_api()
    if results:
        log(f"  -> {len(results)} ReliefWeb reports (API)")
        return results
    results = _fetch_reliefweb_gnews()
    log(f"  -> {len(results)} ReliefWeb reports (Google-News fallback)")
    return results
```

- [ ] **Step 3: Run the parser tests**

Run: `python3 -m unittest tests.test_reliefweb.ParseReliefWebTest -v`
Expected: all 5 ParseReliefWebTest methods PASS.

- [ ] **Step 4: Syntax + import sanity (no network triggered on import)**

Run:
```
python3 -c "import ast; ast.parse(open('scripts/fast_signals.py').read()); print('parse ok')"
python3 -c "import sys; sys.path.insert(0,'scripts'); import fast_signals; print('import ok', hasattr(fast_signals,'parse_reliefweb_json'))"
```
Expected: `parse ok` then `import ok True`. (Importing must NOT hit the
network — `fetch_reliefweb()` is only called from the pipeline/`main`.)

- [ ] **Step 5: Full suite**

Run: `python3 -m unittest discover -t . -s tests`
Expected: all OK (ParseReliefWebTest green; AppnameGuardTest still has
1 failing — `test_no_legacy_vigilo_appname` — until Task 3; that is
expected at this point).

- [ ] **Step 6: Commit**

```bash
git add scripts/fast_signals.py
git commit -m "feat(signals): real ReliefWeb v2 API primary + GNews honest fallback"
```

---

## Task 3: `fetch_data.py` — constant, approved appname, fix stale comment

**Files:**
- Modify: `scripts/fetch_data.py`

- [ ] **Step 1: Add the appname constant**

In `scripts/fetch_data.py`, immediately after the
`MAX_EVENT_AGE_DAYS = 90 ...` line (line ~33), add:

```python
# ReliefWeb API appname — approved, non-secret public identifier.
RELIEFWEB_APPNAME = "episcope-ownalex-9yimg"
```

- [ ] **Step 2: Use the approved appname**

In `scripts/fetch_data.py` `fetch_reliefweb()`, find:

```python
        ("appname", "vigilo"),
```

Replace with:

```python
        ("appname", RELIEFWEB_APPNAME),
```

- [ ] **Step 3: Fix the stale comment**

Find the comment block (lines ~56–60, inside the SOURCES list right
after the "CDC HAN" entry):

```python
    # NOTE: Eurosurveillance (403 bot-block) and old ECDC news RSS (404)
    # removed — dead/blocked. ReliefWeb API now needs an APPROVED appname
    # (register: https://apidoc.reliefweb.int/parameters#appname) — until
    # then fetch_reliefweb() returns 0 (it fails gracefully).
```

Replace with:

```python
    # NOTE: Eurosurveillance (403 bot-block) and old ECDC news RSS (404)
    # removed — dead/blocked. ReliefWeb v2 API is ACTIVE via the approved
    # appname RELIEFWEB_APPNAME (episcope-ownalex-9yimg); fetch_reliefweb()
    # returns real epidemic reports (still fails gracefully to [] on error).
```

- [ ] **Step 4: Syntax check**

Run: `python3 -c "import ast; ast.parse(open('scripts/fetch_data.py').read()); print('parse ok')"`
Expected: `parse ok`.

- [ ] **Step 5: Full suite (now fully green)**

Run: `python3 -m unittest discover -t . -s tests`
Expected: all OK — including both `AppnameGuardTest` methods
(`test_both_scripts_use_approved_appname`,
`test_no_legacy_vigilo_appname`).

- [ ] **Step 6: Commit**

```bash
git add scripts/fetch_data.py
git commit -m "fix(data): approved ReliefWeb appname + correct stale comment"
```

---

## Task 4: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full suite**

Run: `python3 -m unittest discover -t . -s tests`
Expected: all OK including `tests.test_reliefweb` (7 methods).

- [ ] **Step 2: Proof greps**

Run:
```
grep -c "episcope-ownalex-9yimg" scripts/fast_signals.py scripts/fetch_data.py
grep -n '("appname", "vigilo")' scripts/fetch_data.py && echo "LEGACY PRESENT (bad)" || echo "legacy gone (good)"
```
Expected: each script ≥ 1 occurrence of the approved appname;
`legacy gone (good)`.

- [ ] **Step 3: Scope proof**

Run: `git diff --name-only main..HEAD | sort`
Expected EXACTLY (plus the spec/plan docs already committed earlier):
`scripts/fast_signals.py`, `scripts/fetch_data.py`,
`tests/test_reliefweb.py`. No other files (no client/frontend, no
landing).

---

## Self-Review

**1. Spec coverage**

| Spec requirement | Task |
|---|---|
| `RELIEFWEB_APPNAME` constant in both scripts | Tasks 2, 3 |
| fetch_data.py appname swap + stale comment fixed | Task 3 |
| fast_signals real ReliefWeb v2 API primary, Article-mapped | Task 2 |
| Honest Google-News fallback on API error/empty | Task 2 (`fetch_reliefweb` → `_fetch_reliefweb_gnews`) |
| Pure `parse_reliefweb_json(text) -> list[Article]`, no network | Task 2 |
| Tests: parser fixture mapping, garbage/empty/missing-data → [] | Task 1 (`ParseReliefWebTest`) |
| Tests: approved appname verbatim, no `appname=vigilo` | Task 1 (`AppnameGuardTest`) |
| No network in tests; no new deps; server-side only | Tasks 1–2 (import-only, stdlib) |

No gaps.

**2. Placeholder scan:** None. All code is complete and literal;
exact line anchors and full replacement blocks given.

**3. Consistency:** `parse_reliefweb_json` signature/return identical
between Task 1 test import and Task 2 definition. `Article("reliefweb",
title, body, url, date_str)` matches the verified ctor
`Article(source, title, body, url, pub_date="")`. Source id string
`"reliefweb"` consistent with the existing feed id used elsewhere in
`fast_signals.py`. `RELIEFWEB_APPNAME` literal identical in both
scripts and in the test guard (`episcope-ownalex-9yimg`).
`fetch_url(..., extra_headers=..., retries=1)` matches the verified
signature.

---

## Execution Handoff

(Provided after save.)
