/**
 * POST /api/alert-check
 * Authorization: Bearer <EPISCOPE_TOKEN_SECRET>
 *
 * Body: { events: [...] }   — the full events array from events.json
 *
 * For each verified subscriber who has countries saved:
 *   1. Find events in their watched countries with critical/alert severity
 *   2. Skip events already notified (tracked in subscriber.alerted_events)
 *   3. Send an alert email for new events
 *   4. Persist the updated alerted_events set
 *
 * Called from GitHub Actions after fetch_data.py completes.
 * Returns { ok, checked, notified }.
 *
 * Env: EPISCOPE_TOKEN_SECRET, RESEND_API_KEY
 */
import { listAllVerified, putSubscriber } from './_lib/blobs.mjs';
import { sendEmail }                      from './_lib/resend.mjs';
import { renderAlertEmail }               from './_lib/templates.mjs';

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

/** Unified severity rank — handles both the health vocabulary
 *  (monitoring/low/warning/alert/critical) and the risk bands
 *  (minimal/low/moderate/elevated/severe/critical). */
const SEV_RANK = {
  minimal: 0, monitoring: 0, low: 1, moderate: 2, warning: 2,
  elevated: 3, alert: 3, severe: 4, critical: 5, catastrophic: 6,
};
const DEFAULT_ALERTS = {
  threshold: 'elevated', email: true, digest: 'daily',
  domains: { health:true, conflict:true, civil_unrest:true, climate:true,
             infrastructure:true, transport:true, border:true },
  recipients: [],
};
function rank(s){
  // Risk events carry a numeric severity (0–5) already on the rank scale;
  // health events use string labels. Handle both.
  if (typeof s === 'number') return s;
  const n = Number(s);
  if (String(s ?? '').trim() !== '' && !Number.isNaN(n)) return n;
  return SEV_RANK[String(s || '').toLowerCase()] ?? 0;
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: CORS });
  }

  /* ── admin auth ─────────────────────────────────────────────────────── */
  const secret = process.env.EPISCOPE_TOKEN_SECRET;
  const auth   = req.headers.get('authorization') || '';
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS });
  }

  /* ── parse body ─────────────────────────────────────────────────────── */
  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: CORS });
  }

  const events = Array.isArray(body.events) ? body.events : [];

  /* Index ALL events by country (also by ISO) — per-subscriber threshold &
     domain filters are applied below, not here. */
  const byCountry = new Map();
  const add = (key, ev) => {
    if (!key) return;
    const k = String(key).toLowerCase();
    if (!byCountry.has(k)) byCountry.set(k, []);
    byCountry.get(k).push(ev);
  };
  for (const ev of events) {
    if (!ev.country) continue;
    add(ev.country, ev);
    if (ev.geo?.country) add(ev.geo.country, ev);   // ISO key too
  }

  /* ── process subscribers ────────────────────────────────────────────── */
  const subscribers = await listAllVerified();
  let notified = 0;

  for (const sub of subscribers) {
    if (!sub.countries || sub.countries.length === 0) continue;

    const cfg = { ...DEFAULT_ALERTS, ...(sub.alerts || {}) };
    cfg.domains = { ...DEFAULT_ALERTS.domains, ...((sub.alerts || {}).domains || {}) };
    if (cfg.email === false) continue;           // email channel off
    if (cfg.digest === 'off') continue;          // per-event sending disabled (digest only)
    const minRank = rank(cfg.threshold);

    const alerted = sub.alerted_events ?? {};     // { [event_id]: true }
    const newEvs  = [];

    for (const country of sub.countries) {
      const hits = byCountry.get(String(country).toLowerCase()) || [];
      for (const ev of hits) {
        if (alerted[ev.id]) continue;
        if (rank(ev.severity) < minRank) continue;            // below their threshold
        const cat = ev.category || 'health';
        if (cfg.domains[cat] === false) continue;             // domain muted
        newEvs.push(ev);
      }
    }

    if (newEvs.length === 0) continue;

    /* Send alert email */
    const lang = sub.lang || 'en';
    try {
      const { subject, html, text } = renderAlertEmail({ events: newEvs, lang });
      const origin = new URL(req.url).origin;
      const listUnsubscribeUrl = sub.unsubToken
        ? `${origin}/api/unsubscribe?t=${sub.unsubToken}`
        : undefined;
      // Account holder + any extra recipients they configured (security@, ops@…)
      const to = [sub.email, ...(Array.isArray(cfg.recipients) ? cfg.recipients : [])]
        .filter((v, i, a) => v && a.indexOf(v) === i);
      await sendEmail({ to, subject, html, text, listUnsubscribeUrl });
      notified++;

      /* Mark events as alerted so we don't re-notify */
      const updatedAlerted = { ...alerted };
      for (const ev of newEvs) updatedAlerted[ev.id] = true;

      await putSubscriber(sub.__key, {
        ...sub,
        alerted_events:   updatedAlerted,
        last_alerted_at:  new Date().toISOString(),
      });

      console.log(`alert-check: notified ${sub.email} — ${newEvs.length} event(s)`);
    } catch (e) {
      console.error(`alert-check: failed for ${sub.email}:`, e.message);
    }
  }

  console.log(`alert-check: checked=${subscribers.length} notified=${notified}`);
  return new Response(JSON.stringify({ ok: true, checked: subscribers.length, notified }), {
    status: 200,
    headers: CORS,
  });
};

export const config = { path: '/api/alert-check' };
