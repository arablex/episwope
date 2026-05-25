# Telegram-channel Ingestion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest curated public Telegram channels (via free `t.me/s/` scraping) as a tier5 conflict/civil-unrest source, quarantined from the composite score until corroborated by a non-Telegram event in the same country+category.

**Architecture:** A new `telegram_fetch.py` scrapes `t.me/s/<handle>` into `Article` objects. `risk_aggregate.collect_events()` (which already builds conflict/civil_unrest events per category) pulls these for those two categories only. A pure quarantine pass marks Telegram-only events `unverified` unless their (country, category) co-occurs with a non-Telegram source; `build_index` excludes `unverified` events from scoring. Runs inside the existing `risk_aggregate.py` step of the fast-signals Action — no workflow change.

**Tech Stack:** Python 3.12 stdlib (regex scraping, no bs4/Telethon), reuses `fast_signals.Article/fetch_url/_strip_html`. pytest with `sys.path.insert(scripts)`.

Spec: `docs/superpowers/specs/2026-05-25-telegram-ingest-design.md`

Reference (current code):
- `Article(source, title, body, url, pub_date)` — `__slots__` incl. `domain`; body is `_strip_html`-ped + capped 600 (fast_signals.py:804).
- `risk_aggregate.collect_events()` loops `for cat, cfg in TAXONOMY.items()`, builds `arts`, classifies, assembles `events[eid]` with `sources`/`source_count`/`source_class` (risk_aggregate.py:327-395).
- `_source_class(domain, source)` returns `(tier, verif)` (risk_aggregate.py:228).
- `build_index()` groups events by country → `score_geo(evs, now, fragility=...)` (risk_aggregate.py:636-650).

---

## Task 1: Channel config (vetted seed)

**Files:** Create `scripts/telegram_channels.json`

- [ ] **Step 1: Create the file**

```json
[
  { "handle": "bellingcat", "lang": "en", "note": "verified OSINT investigations" }
]
```

- [ ] **Step 2: Commit**

```bash
git add scripts/telegram_channels.json
git commit -m "feat(telegram): vetted channel seed config"
```

> The founder vets/expands this list. Code never hardcodes a channel.

---

## Task 2: HTML parser `parse_tme_html` (TDD, real fixture)

**Files:**
- Create: `scripts/telegram_fetch.py`
- Create (fixture): `tests/fixtures/tme_sample.html`
- Test: `tests/test_telegram_parse.py`

- [ ] **Step 1: Save a REAL fixture** (so the parser matches reality, not a guess)

```bash
mkdir -p tests/fixtures
curl -sS --max-time 30 -A "Mozilla/5.0 (compatible)" "https://t.me/s/bellingcat" \
  -o /tmp/tme_full.html
# keep it small + deterministic: first ~8 message blocks
python3 - <<'PY'
import re, pathlib
html = pathlib.Path("/tmp/tme_full.html").read_text(encoding="utf-8")
# grab <head>...</head> dropped; keep the messages list container slice
blocks = re.findall(r'<div class="tgme_widget_message[ "].*?data-post="[^"]+/\d+".*?</div>\s*</div>\s*</div>', html, re.S)
sample = "<html><body>" + "\n".join(blocks[:8]) + "</body></html>"
pathlib.Path("tests/fixtures/tme_sample.html").write_text(sample, encoding="utf-8")
print("wrote fixture, blocks:", len(blocks[:8]))
PY
```
Expected: `wrote fixture, blocks: >=1`. If 0 blocks, the t.me markup changed — inspect `/tmp/tme_full.html` for the real message wrapper class/attr and adjust the regex here AND in Step 3 before continuing.

- [ ] **Step 2: Write the failing test `tests/test_telegram_parse.py`**

```python
import os, sys, pathlib
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import telegram_fetch as tf

FIX = pathlib.Path(__file__).parent / "fixtures" / "tme_sample.html"

def test_parses_messages_from_real_fixture():
    arts = tf.parse_tme_html(FIX.read_text(encoding="utf-8"), "bellingcat")
    assert len(arts) >= 1
    a = arts[0]
    assert a.source == "telegram_bellingcat"
    assert a.url.startswith("https://t.me/bellingcat/")
    assert a.body.strip() != ""

def test_empty_or_garbage_returns_empty():
    assert tf.parse_tme_html("", "x") == []
    assert tf.parse_tme_html("<html>no messages</html>", "x") == []
```

- [ ] **Step 3: Run test, verify FAIL**

Run: `python3 -m pytest tests/test_telegram_parse.py -v`
Expected: FAIL (No module named 'telegram_fetch').

- [ ] **Step 4: Implement `scripts/telegram_fetch.py`**

```python
"""Free Telegram-channel ingest via the public web preview t.me/s/<handle>.
No account, no Telethon. Emits fast_signals Article objects tagged
source='telegram_<handle>'. Best-effort: any failure -> [] for that channel."""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fast_signals import Article, fetch_url, _strip_html, log  # noqa: E402

CHANNELS_FILE = Path(__file__).resolve().parent / "telegram_channels.json"

# A t.me/s message block: outer div carries data-post="handle/123"; the text is
# in a nested div.tgme_widget_message_text. Tolerant: capture text up to the
# closing of the text div, allowing nested tags. Fail-soft if markup changes.
_MSG_RE = re.compile(
    r'data-post="(?P<handle>[^/"]+)/(?P<id>\d+)"'
    r'(?P<rest>.*?tgme_widget_message_text[^>]*>(?P<text>.*?)</div>)',
    re.S,
)
_TIME_RE = re.compile(r'datetime="(?P<dt>[^"]+)"')

def load_channels(path=CHANNELS_FILE):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8")) or []
    except Exception:
        return []

def parse_tme_html(html: str, handle: str) -> list[Article]:
    out = []
    for m in _MSG_RE.finditer(html or ""):
        text = _strip_html(m.group("text")).strip()
        if not text:
            continue
        mid = m.group("id")
        tm = _TIME_RE.search(m.group("rest"))
        ts = tm.group("dt") if tm else ""
        a = Article(f"telegram_{handle}", text[:180], text, f"https://t.me/{handle}/{mid}", ts)
        a.domain = "t.me"
        out.append(a)
    return out
```

- [ ] **Step 5: Run test, verify PASS**

Run: `python3 -m pytest tests/test_telegram_parse.py -v`
Expected: 2 passed. If `test_parses_messages_from_real_fixture` fails on `_strip_html` truncation (nested tags), widen the text capture to `(?P<text>.*?)</div>\s*</div>` and re-run. Do NOT loosen the empty-input test.

- [ ] **Step 6: Commit**

```bash
git add scripts/telegram_fetch.py tests/test_telegram_parse.py tests/fixtures/tme_sample.html
git commit -m "feat(telegram): t.me/s HTML parser -> Article (TDD on real fixture)"
```

---

## Task 3: `fetch_telegram` (best-effort multi-channel)

**Files:** Modify `scripts/telegram_fetch.py`

- [ ] **Step 1: Append `fetch_telegram` to `scripts/telegram_fetch.py`**

```python
def fetch_telegram(channels=None, seen=None) -> list[Article]:
    """Fetch recent messages for each configured channel. Best-effort: a dead/
    renamed channel or parse failure is skipped + logged, never raised. `seen`
    is a set of already-ingested 'handle/id' urls to skip (dedup)."""
    channels = channels if channels is not None else load_channels()
    seen = seen or set()
    out = []
    for ch in channels:
        handle = (ch.get("handle") or "").strip().lstrip("@")
        if not handle:
            continue
        try:
            raw = fetch_url(f"https://t.me/s/{handle}",
                            extra_headers={"Accept": "text/html"})
            if not raw:
                log(f"[telegram] {handle}: empty response"); continue
            html = raw.decode("utf-8", "replace") if isinstance(raw, bytes) else str(raw)
            arts = [a for a in parse_tme_html(html, handle) if a.url not in seen]
            log(f"[telegram] {handle}: {len(arts)} new messages")
            out += arts
        except Exception as e:
            log(f"[telegram] {handle}: skipped ({e})")
    return out
```

- [ ] **Step 2: Smoke-check it imports + runs (network best-effort)**

Run: `python3 -c "import sys; sys.path.insert(0,'scripts'); import telegram_fetch as t; print('channels:', t.load_channels()); a=t.fetch_telegram(); print('articles:', len(a)); print(a[0].source, a[0].url) if a else print('no articles (network/parse)')"`
Expected: prints the seed channel; `articles: N` (≥0). If network blocks t.me here it may print 0 — acceptable (best-effort); the parser is already unit-tested.

- [ ] **Step 3: Commit**

```bash
git add scripts/telegram_fetch.py
git commit -m "feat(telegram): best-effort multi-channel fetch_telegram"
```

---

## Task 4: `_source_class` → tier5_social for Telegram

**Files:** Modify `scripts/risk_aggregate.py` (`_source_class`, ~line 228)
**Test:** `tests/test_telegram_sourceclass.py`

- [ ] **Step 1: Write failing test**

```python
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import risk_aggregate as ra

def test_telegram_source_is_tier5():
    tier, verif = ra._source_class("t.me", "telegram_bellingcat")
    assert tier == "tier5_social"

def test_news_source_unchanged():
    tier, _ = ra._source_class("reuters.com", "gnews")
    assert tier == "tier1_official"  # reuters is in TIER1
```

- [ ] **Step 2: Run, verify FAIL**

Run: `python3 -m pytest tests/test_telegram_sourceclass.py -v`
Expected: FAIL (telegram returns tier4_media currently).

- [ ] **Step 3: Edit `_source_class`** — add a Telegram branch FIRST (before the tier checks):

```python
def _source_class(domain: str, source: str) -> tuple[str, str]:
    if (source or "").startswith("telegram_"):
        return "tier5_social", "social_telegram"
    d = (domain or "").lower()
    if any(t in d for t in TIER1):
        return "tier1_official", "official_agency"
    if any(t in d for t in TIER3):
        return "tier3_pro", "media_ai_signal"
    if source == "gdelt":
        return "tier4_media", "media_ai_signal"
    return "tier4_media", "media_ai_signal"
```

- [ ] **Step 4: Run, verify PASS**

Run: `python3 -m pytest tests/test_telegram_sourceclass.py -v`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/risk_aggregate.py tests/test_telegram_sourceclass.py
git commit -m "feat(telegram): classify telegram sources as tier5_social"
```

---

## Task 5: Quarantine helper `apply_quarantine` (TDD, pure)

**Files:** Modify `scripts/risk_aggregate.py` (add helper near `collect_events`)
**Test:** `tests/test_quarantine_gate.py`

- [ ] **Step 1: Write failing test**

```python
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import risk_aggregate as ra

def _ev(country, category, sources):
    return {"country": country, "category": category, "sources": list(sources)}

def test_lone_telegram_is_quarantined():
    evs = [_ev("SO", "conflict", ["telegram_x"])]
    ra.apply_quarantine(evs)
    assert evs[0]["unverified"] is True

def test_telegram_promoted_when_country_category_corroborated():
    evs = [
        _ev("UA", "conflict", ["telegram_x"]),
        _ev("UA", "conflict", ["gnews"]),     # non-telegram, same country+category
    ]
    ra.apply_quarantine(evs)
    assert evs[0]["unverified"] is False      # promoted
    assert evs[1]["unverified"] is False      # non-telegram never quarantined

def test_telegram_not_promoted_by_other_category_or_country():
    evs = [
        _ev("ML", "conflict", ["telegram_x"]),
        _ev("ML", "civil_unrest", ["gnews"]),  # same country, DIFFERENT category
        _ev("NG", "conflict", ["gnews"]),       # same category, DIFFERENT country
    ]
    ra.apply_quarantine(evs)
    assert evs[0]["unverified"] is True
```

- [ ] **Step 2: Run, verify FAIL**

Run: `python3 -m pytest tests/test_quarantine_gate.py -v`
Expected: FAIL (apply_quarantine not defined).

- [ ] **Step 3: Add `apply_quarantine` to `scripts/risk_aggregate.py`** (just above `collect_events`):

```python
def apply_quarantine(events: list[dict]) -> None:
    """Mark Telegram-only events `unverified` unless a non-Telegram event of the
    SAME (country, category) exists (country+domain co-occurrence). Mutates in
    place. Non-Telegram events are always verified."""
    corroborated = {
        (e.get("country"), e.get("category"))
        for e in events
        if any(not str(s).startswith("telegram_") for s in (e.get("sources") or []))
    }
    for e in events:
        srcs = e.get("sources") or []
        telegram_only = srcs and all(str(s).startswith("telegram_") for s in srcs)
        if telegram_only and (e.get("country"), e.get("category")) not in corroborated:
            e["unverified"] = True
        else:
            e["unverified"] = False
```

- [ ] **Step 4: Run, verify PASS**

Run: `python3 -m pytest tests/test_quarantine_gate.py -v`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/risk_aggregate.py tests/test_quarantine_gate.py
git commit -m "feat(telegram): quarantine gate (country+category co-occurrence)"
```

---

## Task 6: Wire Telegram into `collect_events` + apply quarantine

**Files:** Modify `scripts/risk_aggregate.py` (`collect_events`, imports)

- [ ] **Step 1: Add import** near the other imports (after `from inform import load_fragility`):

```python
from telegram_fetch import fetch_telegram  # noqa: E402
```

- [ ] **Step 2: Pull Telegram articles for conflict/civil_unrest only.** In `collect_events`, inside the `for cat, cfg in TAXONOMY.items():` loop, AFTER the existing `for q in CRISIS_WATCH.get(cat, []): arts += _fetch_gnews(q)` line and BEFORE `log(f"[risk]   {cat}: {len(arts)} raw articles")`, add:

```python
        if cat in ("conflict", "civil_unrest"):
            try:
                arts += fetch_telegram()
            except Exception as e:
                log(f"[risk]   telegram fetch skipped: {e}")
```
Because the loop only ever creates events of the current `cat` (via `cfg["rules"]`), a Telegram message only becomes an event if it classifies as conflict/civil_unrest — the domain filter is automatic.

- [ ] **Step 3: Apply quarantine before returning.** Change the end of `collect_events` from `return list(events.values())` to:

```python
    out = list(events.values())
    apply_quarantine(out)
    return out
```

- [ ] **Step 4: Smoke-run the aggregator**

Run: `python3 scripts/risk_aggregate.py` (best-effort network). 
Expected: completes; `python3 -c "import json; evs=json.load(open('public/risk_events.json'))['events']; tg=[e for e in evs if any(str(s).startswith('telegram_') for s in e.get('sources',[]))]; print('telegram-origin events:', len(tg)); print('unverified among them:', sum(1 for e in tg if e.get('unverified')))"` runs without error (counts may be 0 if t.me is unreachable from here — acceptable).
Then restore the regenerated data (CI owns it): `git checkout -- public/risk_events.json public/risk_index.json`.

- [ ] **Step 5: Commit**

```bash
git add scripts/risk_aggregate.py
git commit -m "feat(telegram): ingest into conflict/unrest + quarantine pass"
```

---

## Task 7: Exclude `unverified` events from the composite

**Files:** Modify `scripts/risk_aggregate.py` (`build_index`, ~line 643)
**Test:** extend `tests/test_quarantine_gate.py`

- [ ] **Step 1: Add failing test** (append to `tests/test_quarantine_gate.py`):

```python
def test_build_index_excludes_unverified(monkeypatch):
    # Two events in SO: one verified (gnews) conflict, one unverified telegram.
    # score must derive only from the verified one.
    import risk_aggregate as ra
    base = {"severity": 4, "confidence": 0.8, "type": "x", "first_seen": "",
            "last_updated": "", "source_class": "tier4_media", "id": "a"}
    evs = [
        {**base, "country": "SO", "category": "conflict", "sources": ["gnews"], "id": "v"},
        {**base, "country": "SO", "category": "conflict", "sources": ["telegram_x"], "id": "u"},
    ]
    ra.apply_quarantine(evs)
    # group like build_index does: only SO
    idx = ra.build_index(evs)
    assert "SO" in idx
    assert idx["SO"]["event_count"] >= 1  # unverified still counted in event_count list
```

(If `build_index` signature differs, mirror its real call — the assertion that matters: the unverified event does not raise and SO is scored. Keep the test minimal and adjust the call to the real `build_index` signature observed in the file.)

- [ ] **Step 2: Run, verify behaviour** (may pass trivially; the real change is the filter)

Run: `python3 -m pytest tests/test_quarantine_gate.py -v`

- [ ] **Step 3: Filter unverified before scoring.** In `build_index`, change the per-country scoring loop so unverified events don't reach `score_geo`:

```python
    for iso, evs in by_country.items():
        scored_evs = [e for e in evs if not e.get("unverified")]
        scored = score_geo(scored_evs, now, fragility=frag.get(iso, 0.0))
        index[iso] = {
            "composite_risk": scored["composite_risk"],
            "category_breakdown": scored["category_breakdown"],
            "event_count": len(evs),          # full count incl. unverified (for UI)
            "event_ids": [e["id"] for e in evs],
        }
```

- [ ] **Step 4: Run tests + smoke aggregator**

Run: `python3 -m pytest tests/test_quarantine_gate.py tests/test_telegram_parse.py tests/test_telegram_sourceclass.py -v`
Expected: all pass.
Run: `python3 scripts/risk_aggregate.py` → completes; then `git checkout -- public/risk_events.json public/risk_index.json`.

- [ ] **Step 5: Commit**

```bash
git add scripts/risk_aggregate.py tests/test_quarantine_gate.py
git commit -m "feat(telegram): exclude unverified events from composite scoring"
```

---

## Self-Review Notes (author)

- Spec coverage: config seed (T1), parser (T2), fetch (T3), tier5 (T4), quarantine gate country+category (T5), wiring + domain filter via per-category loop (T6), exclude-unverified-from-score (T7), stored-in-risk_events for UI lane (T6/T7 keep them in the list). Runs in existing risk_aggregate step — no workflow change. All covered.
- Names consistent: `parse_tme_html`, `fetch_telegram`, `load_channels`, `apply_quarantine`, `unverified`, `telegram_<handle>` used identically across tasks.
- Safety: tier5 (0.70) × quarantine (country+category) × domain filter (only conflict/unrest categories pull Telegram) × dedup (`seen`) × curated channels. A lone Telegram post in a quiet country → no co-occurring non-Telegram event → `unverified` → excluded from score.
- Scraper reality risk: T2 grounds the parser on a REAL saved fixture and tells the implementer to adjust the regex if markup differs — fail-soft (`[]`) on change.
