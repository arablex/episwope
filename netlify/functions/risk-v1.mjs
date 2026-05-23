/**
 * GET /api/v1/risk — B2B Risk Intelligence API (v1)
 *
 * Reads precomputed public/risk_index.json + public/risk_events.json
 * (written every 15 min by scripts/risk_aggregate.py). No AI, no DB,
 * no per-request compute — pure filter + serve.
 *
 * Modes (mutually exclusive):
 *   ?country=ISO2
 *   ?lat=&lng=&radius_km=   (lat/lng snapped to 0.5°, radius bucketed)
 *
 * Filters: categories, min_confidence, history_days, severity_min,
 *          include_events, lang
 *
 * Open access for now; rate-limited per IP (anon tier). API-key tier
 * scaffold present for future monetization.
 *
 * Spec: docs/specs/2026-05-17-b2b-risk-intelligence-api-design.md
 */
import { getStore } from '@netlify/blobs';
import { rateLimitOk, ipFromReq } from './_lib/rate-limit.mjs';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key',
};

// ── Scoring constants — must mirror scripts/risk_scoring.py ──
const CATEGORIES = ['health', 'conflict', 'civil_unrest', 'transport',
  'border', 'infrastructure', 'climate'];
const INTRINSIC = { conflict: 1.0, border: 0.8, transport: 0.7,
  infrastructure: 0.7, civil_unrest: 0.6, health: 0.55, climate: 0.5 };
const HALFLIFE = { conflict: 3, civil_unrest: 5, transport: 4, border: 6,
  infrastructure: 4, health: 14, climate: 7 };
const SRC_MULT = { tier1_official: 1.0, tier2_official: 0.95,
  tier3_pro: 0.9, tier4_media: 0.85, tier5_social: 0.7 };
const BANDS = ['minimal', 'low', 'moderate', 'elevated', 'severe', 'critical'];

const clip = (v, lo = 0, hi = 5) => Math.max(lo, Math.min(hi, v));
const bandFor = (s) => BANDS[Math.min(Math.round(s), 5)];

function ageDays(ts, now) {
  const d = Date.parse(ts);
  return Number.isFinite(d) ? Math.max((now - d) / 86400000, 0) : 1;
}
function eventScore(e, now) {
  const sev = (Number(e.severity) || 0) / 5;
  const conf = Number(e.confidence) || 0.5;
  const hl = HALFLIFE[e.category] || 7;
  const rec = Math.exp(-ageDays(e.last_updated || e.first_seen, now) / hl);
  const sm = SRC_MULT[e.source_class] || 0.85;
  return Math.max(0, Math.min(1, sev * rec * conf * sm));
}
function scoreGeo(events, now) {
  const byCat = {};
  for (const c of CATEGORIES) byCat[c] = [];
  for (const e of events) (byCat[e.category] || (byCat[e.category] = [])).push(e);

  const catScores = {}, breakdown = {};
  for (const cat of CATEGORIES) {
    const evs = byCat[cat] || [];
    if (!evs.length) { catScores[cat] = 0; breakdown[cat] = { score: 0, band: 'minimal', active_events: 0, top_threat: null }; continue; }
    const scored = evs.map((e) => eventScore(e, now)).sort((a, b) => b - a);
    const top3 = scored.slice(0, 3);
    const raw = 0.65 * scored[0] + 0.35 * (top3.reduce((a, b) => a + b, 0) / top3.length);
    const sc = Math.round(clip(raw * (INTRINSIC[cat] || 0.6) * 5) * 100) / 100;
    catScores[cat] = sc;
    const top = evs.reduce((m, e) => eventScore(e, now) > eventScore(m, now) ? e : m, evs[0]);
    breakdown[cat] = { score: sc, band: bandFor(sc), active_events: evs.length,
      top_threat: top.type || top.headline };
  }
  const ranked = Object.entries(catScores).sort((a, b) => b[1] - a[1]);
  const topScore = ranked[0] ? ranked[0][1] : 0;
  let tailAdd = 0;
  ranked.slice(1).forEach(([, s], i) => {
    tailAdd += (i === 0 ? 0.45 : i === 1 ? 0.20 : 0.08) * s;
  });
  let comp = topScore + Math.min(tailAdd, 5 - topScore) * 0.6;
  if (ranked.filter(([, s]) => s >= 3).length >= 2) comp *= 1.15;
  comp = Math.round(clip(comp) * 100) / 100;
  return {
    composite_risk: { score: comp, band: bandFor(comp),
      dominant_category: ranked[0] && ranked[0][1] > 0 ? ranked[0][0] : null },
    category_breakdown: breakdown,
  };
}

function haversine(a, b, c, d) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (c - a) * r, dLng = (d - b) * r;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// ── Static-blob cache (warm invocations) ──
let _cache = { at: 0, idx: null, evt: null, fc: null, os: null };
async function loadData(origin) {
  if (Date.now() - _cache.at < 60000 && _cache.idx) return _cache;
  const [i, e, f, o] = await Promise.all([
    fetch(`${origin}/public/risk_index.json`).then((r) => r.ok ? r.json() : null).catch(() => null),
    fetch(`${origin}/public/risk_events.json`).then((r) => r.ok ? r.json() : null).catch(() => null),
    fetch(`${origin}/public/forecast.json`).then((r) => r.ok ? r.json() : null).catch(() => null),
    fetch(`${origin}/public/osint_dossiers.json`).then((r) => r.ok ? r.json() : null).catch(() => null),
  ]);
  if (i && e) _cache = { at: Date.now(), idx: i, evt: e, fc: f, os: o };
  return _cache;
}

const J = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, ...extra } });

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'GET') return J({ error: 'method_not_allowed' }, 405);

  const ip = ipFromReq(req);
  const apiKey = req.headers.get('x-api-key');
  // Tier scaffold (all open now): anon 60/h, future paid tiers higher.
  const tier = apiKey ? 'partner' : 'anon';
  const limit = { anon: 60, partner: 1000, enterprise: 20000 }[tier];
  const store = (() => {
    const b = getStore({ name: 'rate-limits', consistency: 'strong' });
    return { get: (k) => b.get(k, { type: 'json' }), put: (k, v) => b.setJSON(k, v) };
  })();
  if (!await rateLimitOk({ key: `risk:${apiKey || ip}`, store, limit })) {
    return J({ error: 'rate_limited', tier, limit }, 429,
      { 'Retry-After': '3600', 'RateLimit-Limit': String(limit), 'RateLimit-Remaining': '0' });
  }

  const u = new URL(req.url);
  const q = u.searchParams;
  const country = (q.get('country') || '').trim().toUpperCase();
  const lat = q.get('lat'), lng = q.get('lng');
  const radiusKm = Number(q.get('radius_km') || 250);
  if (country && (lat || lng)) return J({ error: 'specify country OR lat/lng, not both' }, 400);
  if (!country && !(lat && lng)) return J({ error: 'missing geo: country or lat&lng required' }, 400);

  const cats = (q.get('categories') || CATEGORIES.join(','))
    .split(',').map((s) => s.trim()).filter(Boolean);
  const minConf = Number(q.get('min_confidence') || 0.4);
  const histDays = Math.min(Math.max(Number(q.get('history_days') || 14), 1), 90);
  const sevMin = Number(q.get('severity_min') || 0);
  const includeEvents = q.get('include_events') !== 'false';
  const lang = q.get('lang') === 'ru' ? 'ru' : 'en';

  const origin = u.origin;
  const { idx, evt, fc, os } = await loadData(origin);
  if (!idx || !evt) return J({ error: 'risk_data_unavailable' }, 503);

  const now = Date.now();
  const cutoff = now - histDays * 86400000;
  const passFilters = (e) =>
    cats.includes(e.category) &&
    (Number(e.confidence) || 0) >= minConf &&
    (Number(e.severity) || 0) >= sevMin &&
    Date.parse(e.last_updated || e.first_seen || 0) >= cutoff;

  let mode, scoped, scoring, queryEcho;
  // Coverage honesty (#7): distinguish a real low score from "no active
  // signals this window" (baseline) and "country not covered". Without this
  // an off-list country (e.g. FR/BR) returned a fabricated all-zero
  // 'minimal' record indistinguishable from an assessed-calm verdict.
  let coverage = 'scored';

  if (country) {
    mode = 'country';
    scoped = evt.events.filter((e) => e.country === country && passFilters(e));
    // use precomputed composite when no extra filtering narrows it, else recompute
    const pre = idx.index[country];
    scoring = (scoped.length === (pre ? pre.event_count : -1))
      ? { composite_risk: pre.composite_risk, category_breakdown: pre.category_breakdown }
      : scoreGeo(scoped, now);
    if (!pre && scoped.length === 0) coverage = 'not_covered';
    else if (pre && pre.baseline) coverage = 'baseline_no_signal';
    queryEcho = { mode, country };
  } else {
    mode = 'radius';
    const la = Math.round(parseFloat(lat) * 2) / 2;   // snap 0.5°
    const lo = Math.round(parseFloat(lng) * 2) / 2;
    const rad = [50, 100, 250, 500, 1000, 2000].find((x) => radiusKm <= x) || 2000;
    scoped = evt.events.filter((e) =>
      e.geo && Number.isFinite(e.geo.lat) && Number.isFinite(e.geo.lng) &&
      passFilters(e) && haversine(la, lo, e.geo.lat, e.geo.lng) <= rad);
    scoring = scoreGeo(scoped, now);
    queryEcho = { mode, lat: la, lng: lo, radius_km: rad };
  }

  // 7-day forward projection (country mode; transparent pre-ML model)
  const projection = (country && fc && fc.forecast && fc.forecast[country])
    ? { horizon_days: fc.meta?.horizon_days || 7,
        model: fc.meta?.model, ...fc.forecast[country] }
    : null;

  // Agentic OSINT — UNVERIFIED investigative leads (country mode only).
  // QUARANTINE GATE: only status==='lead' surfaces; never added to the
  // composite or any score. Explicitly tagged so consumers cannot mistake
  // a lead for a confirmed event.
  let investigative_leads = null;
  if (country && os && Array.isArray(os.dossiers)) {
    const leads = os.dossiers
      .filter((d) => d.country === country && d.status === 'lead')
      .map((d) => ({
        id: d.id,
        category: d.category,
        claim: d.claim,
        confidence: d.confidence,
        independent_sources: d.independent_sources,
        official_corroboration: d.official_corroboration,
        evidence_domains: d.evidence_domains,
        lead_time_est_hours: d.lead_time_est_hours,
        investigated_at: d.investigated_at,
        status: 'unverified_lead',
        in_composite: false,
        disclaimer: d.disclaimer ||
          'Agentic OSINT — UNVERIFIED investigative lead. Not a confirmed '
          + 'event; not included in any risk score.',
      }));
    if (leads.length) {
      investigative_leads = {
        note: 'Pre-confirmation OSINT signals. Quarantine-by-default; '
            + 'NOT scored, NOT in composite_risk. Directional only.',
        model: os.meta?.model || 'agentic OSINT v0',
        count: leads.length,
        leads,
      };
    }
  }

  const body = {
    api_version: '1.0',
    generated_at: evt.meta?.generated_at || new Date().toISOString(),
    cache_ttl_seconds: 300,
    query: { ...queryEcho, history_days: histDays, min_confidence: minConf, lang },
    coverage,
    coverage_note: coverage === 'not_covered'
      ? 'No monitoring coverage for this country yet — score is not an '
        + 'assessment. Absence of data is not an all-clear.'
      : coverage === 'baseline_no_signal'
        ? 'No active signals detected in this window. Country is monitored '
          + 'but currently shows no scored events.'
        : undefined,
    ...scoring,
    projection,
    investigative_leads,
    events: includeEvents
      ? scoped.sort((a, b) => (b.severity - a.severity) || (b.confidence - a.confidence))
      : undefined,
    meta: {
      events_total: scoped.length,
      events_returned: includeEvents ? scoped.length : 0,
      sources_checked: evt.meta?.events_total ?? null,
      data_freshness_seconds: Math.round(
        (now - Date.parse(evt.meta?.generated_at || now)) / 1000),
    },
  };

  const etag = 'W/"' + (evt.meta?.generated_at || '') + ':' + mode + ':' +
    (country || `${queryEcho.lat},${queryEcho.lng}`) + '"';
  if (req.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { ...CORS, ETag: etag } });
  }

  return J(body, 200, {
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
    ETag: etag,
    'RateLimit-Limit': String(limit),
    'X-Risk-Tier': tier,
  });
};

export const config = { path: '/api/v1/risk' };
