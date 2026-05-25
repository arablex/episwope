# Telegram-channel Ingestion (t.me/s, quarantine model) — Design

_Date: 2026-05-25 · Status: approved, pending implementation plan_

## Problem / goal

Telegram is a primary, real-time source for conflict and civil-unrest — often
hours ahead of news/GDELT. Vigilo should ingest a CURATED set of credible public
Telegram channels as an early-warning source, **without** poisoning the score
with propaganda/noise (which would also break Vigilo's source-traceable brand).

Free, no account, no paid infra. Public RSSHub is Cloudflare-blocked, so we scrape
the public web preview `https://t.me/s/<channel>` directly (confirmed working:
returns HTML with `tgme_widget_message` blocks).

## Decisions (locked in brainstorming)

- **Trust gate = QUARANTINE until corroborated (by country + domain).** A
  Telegram-origin event is captured (speed preserved) but marked `unverified:true`
  and **excluded from the composite score** unless there is at least one
  NON-Telegram event of the **same category** (conflict/civil_unrest) in the
  **same country** in the current event set. (Headline-level dedup can't match a
  Telegram post to a differently-worded news headline, so "same incident"
  corroboration is impossible without semantic matching, which is out of scope —
  hence the country+domain co-occurrence rule.) This blocks the dangerous case (a
  fabricated crisis in a quiet country has no corroborating news → stays
  quarantined), while letting Telegram add speed/granularity where conflict is
  already corroborated elsewhere (at tier5 = 0.70, a low contribution).
- **Domains: conflict + civil_unrest only** at start. Telegram-derived items whose
  extracted category is anything else are dropped (health/disasters are well
  covered by official feeds).
- **Trust tier = `tier5_social`** (existing SRC_MULT 0.70, the lowest).
- **Runs inside `fast-signals`** (GitHub Actions, free, 3h cadence). No account,
  no Telethon, no VPS.
- **Channels are human-vetted** by the founder; ship a tiny credible seed.

## Components (isolated)

1. **`scripts/telegram_channels.json`** (new, config) — vetted list:
   `[{ "handle": "bellingcat", "lang": "en", "note": "verified OSINT" }, ...]`.
   Small seed (3–5); the founder vets/expands. This is the single place channels
   live; no channel hardcoded in code.
2. **`scripts/telegram_fetch.py`** (new, standalone, importable) —
   `fetch_telegram(channels, limit_per_channel, seen_ids) -> list[Article]`:
   - For each channel: GET `https://t.me/s/<handle>` with a browser User-Agent.
   - Parse `tgme_widget_message` blocks → message text (`tgme_widget_message_text`),
     timestamp (`<time datetime=...>`), permalink (`/<handle>/<id>`).
   - Emit `Article("telegram_<handle>", text, text, permalink, ts)` — the same
     shape the existing news fetchers produce — only for messages not in `seen_ids`
     and within a freshness window.
   - Best-effort: a dead/renamed channel or parse failure is skipped + logged,
     never raises (mirrors the other feeds' `continue-on-error` behaviour).
   - Pure parse function (`parse_tme_html(html, handle) -> list[Article]`) is unit-
     tested against a saved fixture.
3. **`scripts/fast_signals.py`** (modify) — in the gather step, call
   `fetch_telegram(...)` and merge its Articles into the news pool that already
   goes through categorisation/geo/scoring. **Keep only** Telegram-derived items
   whose extracted category ∈ {`conflict`, `civil_unrest`}; drop the rest.
   Persist seen message ids (reuse signals_history or a small `telegram_seen.json`)
   so the same post isn't re-ingested.
4. **`scripts/risk_aggregate.py`** (modify) — two precise changes:
   - `_source_class()`: a source id starting `telegram_` → return
     `("tier5_social", "social_telegram")`.
   - **Quarantine gate (country + domain co-occurrence):** after all events are
     assembled, compute the set of `(country, category)` pairs that have at least
     one NON-Telegram source. Any event whose `sources` are ALL `telegram_*` is
     marked `unverified: true` UNLESS its `(country, category)` is in that set
     (i.e. a non-Telegram conflict/unrest event exists in the same country) — in
     which case it's promoted (`unverified: false`). In `build_index`, events with
     `unverified: true` are **filtered out before `score_geo`** (they don't move
     the composite). All events (incl. unverified) still go into `risk_events.json`
     so the app can show a separate "unverified / early" lane.

## Data flow

`t.me/s/<channel>` → `parse_tme_html` → `Article(telegram_*)` → news pool →
categorise + geo → keep {conflict, civil_unrest} → dedup/corroborate
(risk_aggregate) → **Telegram-only ⇒ `unverified` (quarantined, not scored)** ;
**corroborated by non-Telegram ⇒ counts at tier5 (0.70)**.

## Safety layers (defense in depth)

Curated credible channels (config) × tier5 trust (0.70) × quarantine-until-
corroborated × domain filter (conflict/unrest only) × dedup. A single
propaganda post cannot move the composite.

## Error handling

Per-channel fetch wrapped in try/except → skip + log on failure (HTTP error,
Cloudflare, HTML shape change). The whole Telegram step is non-blocking: if it
fails entirely, the rest of fast-signals is unaffected (same `continue-on-error`
posture as climate/osint steps).

## Testing

- Unit: `parse_tme_html(fixture_html, "bellingcat")` → expected list of messages
  (text/permalink/ts), incl. an empty/garbled page → `[]`.
- Unit: quarantine gate — an event whose sources are all `telegram_*` →
  `unverified=true` and excluded from `score_geo`; the same event with an added
  non-Telegram source → `unverified=false` and counted.

## Channel seed (founder vets / replaces)

Ship a minimal seed of clearly-credible/verification-oriented channels (e.g.
`bellingcat`). The founder reviews each handle for existence + credibility and
expands deliberately; partisan/propaganda channels are excluded by policy. Start
with 3–5, not 15 raw.

## Scope / non-goals

- No Telethon, no message history/media, no private channels — public web
  preview only.
- Domains beyond conflict/civil_unrest are out (revisit later).
- No automated channel discovery/curation — vetting is manual.
- No new infra; runs in the existing fast-signals Action.

## Open items

- Founder supplies/vets the channel list (seed ships with `bellingcat` + founder
  additions).
- Confirm `t.me/s` HTML structure is stable enough; the parser fails soft if it
  changes (returns `[]`, logged) — so a structure change degrades gracefully, it
  doesn't crash the pipeline.
