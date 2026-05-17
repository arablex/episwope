# Vigilo B2B Risk Intelligence API — Design Spec

Date: 2026-05-17
Status: approved (concept) → implementation
Owner: solo (Aleksey) + AI engineering

## 1. Product thesis

Sell a single, defensible **Composite Risk Score (0–5) per geography** plus
the underlying verified event feed to insurers, banks, and travel platforms
(e.g. Островок-class OTAs). Buyers integrate the score into underwriting,
travel-policy, and duty-of-care engines.

What makes it sellable (the moat — not the raw data):

1. **Temporal lead.** Health: pre-clinical wastewater + GenBank submission
   velocity (1–4 wks before WHO). Non-health: GDELT 15-min cadence on
   conflict/transport/border. Competitors (raw GDELT, news APIs) give noise,
   not a scored, deduplicated, provenance-tagged signal.
2. **Provenance split.** Every event tagged `official_agency` vs
   `media_ai_signal` + `source_count` + `confidence`. Underwriters need
   defensible lineage; this is the core differentiator vs scraping GDELT.
3. **One number.** Composite 0–5 that drops into actuarial / travel-risk
   pipelines without the client doing NLP.
4. **Multi-domain fusion.** Health + Conflict + Civil unrest + Transport +
   Border + Infrastructure + Climate in one call, geo-resolved.

## 2. Scope

### v1 (sellable MVP — this build)
- Batch aggregator producing `risk_index.json` + `risk_events.json`.
- `GET /api/v1/risk` — filter/serve, CDN-cached, rate-limited. Open access
  for now (no key gating), but metering scaffold present.
- Composite scoring module (0–5), category weights, recency decay.
- Taxonomy: `health, conflict, civil_unrest, transport, border,
  infrastructure, climate`.

### v2 (post-MVP, not this build)
- Webhook push on threshold breach (reuse push/telegram infra).
- Historical backfill endpoint (actuarial models need ≥1y).
- API-key tiers + usage metering UI.
- `/api/v1/docs` self-serve developer page.

### Out of scope
- Per-request AI / DB. All parsing in batch. Endpoint is a pure filter.
- Real-time (<15 min) — cron cadence is the SLA.

## 3. Architecture

Reuse the existing pattern (cron → static JSON → thin function):

```
GitHub Actions (every 15 min)
  ├── scripts/fast_signals.py        (health — unchanged)
  └── scripts/risk_aggregate.py      (NEW: conflict/unrest/transport/...)
        ├── fetch GDELT GKG/DOC + Google News by category taxonomy
        ├── AI-classify (reuse ai_classify, capped GROQ calls)
        ├── scripts/risk_scoring.py  (NEW: composite 0–5 algorithm)
        └── writes public/risk_index.json + public/risk_events.json

Netlify fn  netlify/functions/risk-v1.mjs   (config.path = /api/v1/risk)
  └── read static JSON → filter by geo/category/thresholds → JSON
      (no AI, no DB, no external calls; ~120ms cold)
```

Decision: **separate module `risk_aggregate.py`**, not extending
`fast_signals.py`. Rationale: different taxonomy, different source-trust
model, isolates the revenue path from the health engine's stability. They
share helpers (`fetch_url`, `ai_classify`, GDELT fetchers) via import.

## 4. Endpoint spec

`GET /api/v1/risk`

Geo (mutually exclusive, 400 on conflict):
- `country=<ISO-3166-alpha2>` — country aggregate
- `lat&lng&radius_km` (radius ≤ 2000) — radius mode; lat/lng snapped to
  0.5° grid, radius bucketed {50,100,250,500,1000,2000} for finite cache keys

Filters:
| param | type | default |
|---|---|---|
| `categories` | csv | all 7 |
| `min_confidence` | 0–1 | 0.4 |
| `history_days` | 1–90 | 14 |
| `severity_min` | 0–5 | 0 |
| `include_events` | bool | true |
| `lang` | en\|ru | en |

Auth: optional `X-Api-Key`; absent → tier `anon`. Versioned path `/v1/`.

## 5. Response shape

(Authoritative example in the conversation design; key invariants:)
- `composite_risk`: `{score 0–5, band, trend, delta_7d, dominant_category, advisory}`
- `category_breakdown`: per-category `{score, band, active_events, top_threat}`
- `events[]`: `{id, category, type, headline, severity 0–5, confidence 0–1,
  source_verification (official_agency|media_ai_signal), source_class
  (tier1_official..tier5_social), geo{lat,lng,place,country,admin1},
  first_seen, last_updated, lead_time_hours, source_count, sources[], url, is_new}`
- `meta`: `{events_total, events_returned, sources_checked, data_freshness_seconds}`
- Business-friendly English field names; values localised by `lang`.

## 6. Composite scoring (0–5)

Hybrid max-dominant + weighted tail (one catastrophic event must not be
averaged away):

```
INTRINSIC_WEIGHT = { conflict:1.00, border:0.80, transport:0.70,
  infrastructure:0.70, civil_unrest:0.60, health:0.55, climate:0.50 }
HALFLIFE_DAYS    = { conflict:3, civil_unrest:5, transport:4, border:6,
  infrastructure:4, health:14, climate:7 }
SRC_MULT = { tier1_official:1.0, tier2_official:0.95, tier3_pro:0.9,
  tier4_media:0.85, tier5_social:0.7 }

event_score = (severity/5) * exp(-age_days/HALFLIFE[cat])
              * confidence * SRC_MULT[source_class]
cat_raw   = 0.65*max(event_score) + 0.35*mean(top3 event_score)
cat_score = clip(cat_raw * INTRINSIC_WEIGHT[cat] * 5, 0, 5)
ranked    = categories sorted by cat_score desc
composite = 0.60*r[0] + 0.25*r[1] + 0.10*r[2] + 0.05*rest
if count(cat_score>=3) >= 2: composite *= 1.15
composite = clip(composite, 0, 5)
band = {0:minimal,1:low,2:moderate,3:elevated,4:severe,5:critical}
```

Effect: kinetic (missile/clash) structurally outweighs an equally "loud"
flu outbreak — required by insurer/travel buyers.

GDELT/CAMEO mapping: `KILL/ASSAULT/MILITARY`→conflict;
`PROTEST`→civil_unrest; `STRIKE/SLOWDOWN`→transport;
`BORDER/IMMIGRATION` + airport/airspace-closed→border;
`POWER OUTAGE/BLACKOUT`→infrastructure; storms/floods→climate.

## 7. Solo-dev backend optimization

- **No per-request compute.** AI parsing only in the 15-min batch (reuse
  `GROQ_MAX_CALLS` cap). Endpoint = O(events) JSON filter.
- **CDN cache:** `Cache-Control: public, s-maxage=300, stale-while-revalidate=900`
  + `ETag` (hash of `generated_at`). Edge serves repeat B2B queries without
  hitting the function.
- **Finite cache keys:** geo grid-snap + radius buckets.
- **Cheap mode:** `include_events=false` → ~1 KB score-only payload.
- **Rate limiting:** reuse `_lib/rate-limit.mjs` + Netlify Blobs token bucket,
  key `risk:{apiKeyOrIP}`. Tiers (scaffold; all open now): anon 60/h,
  partner 1k/h, enterprise 20k/h. 429 + `Retry-After` + RFC 9239
  `RateLimit-*` headers.
- AI cost is decoupled from request volume by construction.

## 8. Risks / mitigations

- **GDELT 429s** (already observed in health engine): cache last good
  aggregate; never fail the endpoint on a stale batch — serve stale + flag
  `data_freshness_seconds`.
- **AI misclassification** of conflict events → liability for a paid product:
  emit `confidence`; gate paid SLA tiers to `min_confidence>=0.6`; always
  expose `source_verification` so clients can hard-filter to official only.
- **Scope creep** vs health engine: hard module boundary, shared helpers
  only via import, separate output files.

## 9. Acceptance criteria (v1)

- `risk_aggregate.py` runs in CI < 5 min, writes both JSON blobs.
- `/api/v1/risk?country=TR` returns valid scored payload < 300 ms warm.
- Composite reproduces the kinetic-vs-health weighting from §6.
- Rate limit + cache headers verified.
- Health engine (`fast_signals.py`) untouched / still green.
