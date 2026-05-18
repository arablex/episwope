# Wire approved ReliefWeb API appname (Design)

**Date:** 2026-05-18
**Status:** Design approved (dialogue), pending spec review
**Scope:** Small, focused engine change. Separate from the
methodology/repositioning work.

## Goal

Activate the real ReliefWeb v2 API as a proper data source now that
the appname `episcope-ownalex-9yimg` is approved, replacing the
degraded Google-News workaround in the live signals engine — with an
honest fallback so the source never silently disappears.

## Context (verified)

- `scripts/fast_signals.py` `fetch_reliefweb()` (live cron
  `.github/workflows/fast-signals.yml`, every 15 min) currently uses a
  Google-News `site:reliefweb.int` RSS workaround. No real API call.
- `scripts/fetch_data.py` `fetch_reliefweb()` (separate cron
  `.github/workflows/update-data.yml`, 00:00 & 12:00) already has a
  near-complete real call to `https://api.reliefweb.int/v2/reports`
  but hardcodes the unapproved `appname=vigilo` → ReliefWeb 403 →
  caught → returns 0. A stale top-of-file comment (~lines 57–59) says
  the source returns 0 until an approved appname exists.
- `appname` is a non-secret, non-domain-bound identifier (ReliefWeb
  uses it for contact/analytics, not auth). Same value works from
  GitHub Actions; the produced JSON is served on vigilo.cc via Netlify.

## Design

1. **Constant.** Add `RELIEFWEB_APPNAME = "episcope-ownalex-9yimg"` in
   each of the two scripts. No shared module — these are two
   independent standalone cron scripts; a shared module for one
   non-secret string is over-engineering (YAGNI). Minor, accepted
   duplication.

2. **`scripts/fetch_data.py`.** Replace `("appname", "vigilo")` with
   `("appname", RELIEFWEB_APPNAME)`. Update the stale ~lines 57–59
   comment to state the source is now active via the approved appname.
   No other change to that function.

3. **`scripts/fast_signals.py` `fetch_reliefweb()`.** Real ReliefWeb
   v2 API as **primary**: GET `https://api.reliefweb.int/v2/reports`
   with the same query shape proven in `fetch_data.py`
   (`appname=RELIEFWEB_APPNAME`, `filter[field]=primary_type.name`,
   `filter[value]=Epidemic`, `limit=30`, `sort[]=date.created:desc`,
   include fields title/body/country/date/source/disease/url),
   `Accept: application/json`, parsed into the existing `Article`
   type. **Honest fallback:** if the API errors or yields 0 items,
   fall back to the existing Google-News `site:reliefweb.int` path so
   the source is never lost. Log which path produced results.

4. **Parsing isolation.** Extract a pure
   `parse_reliefweb_json(text) -> list[Article]` function (no
   network) so it is unit-testable; the network shell calls it.

## Testing

`tests/test_reliefweb.py` (stdlib `unittest`, canonical
`python3 -m unittest discover -t . -s tests`):

- `parse_reliefweb_json` on a small inline JSON fixture → correct
  count + fields mapped into `Article` (title, body stripped of HTML,
  country, url, date).
- Garbage / empty / missing-`data` JSON → `[]` (no crash).
- Both scripts contain `RELIEFWEB_APPNAME = "episcope-ownalex-9yimg"`
  verbatim and do NOT still hardcode `appname=vigilo`.

No network in tests. No new dependencies.

## Error / edge handling

- API timeout/4xx/5xx or non-JSON → caught; `fast_signals` falls back
  to Google-News, `fetch_data` returns `[]` (its existing behaviour),
  never raises out of the fetcher.
- Empty `data` array → treated as "no results" → fallback (fast) /
  `[]` (data).

## Out of scope (YAGNI)

- Other sources; any refactor of `fetch_reliefweb` beyond the above.
- Env-var plumbing for the appname (it is not a secret).
- Client/browser code — appname stays server-side only.
- The methodology/repositioning plan (separate spec/plan).

## Success criteria

- Live engine pulls structured ReliefWeb v2 API epidemic reports with
  the approved appname; Google-News remains an automatic fallback.
- `fetch_data.py` uses the approved appname; stale comment corrected.
- Parser unit-tested; full suite green; no new dependencies; no
  client-side exposure of the appname.
