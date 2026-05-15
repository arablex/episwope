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

/** Severities that trigger email notifications */
const ALERT_SEVERITIES = new Set(['critical', 'alert']);

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

  /* Build country index keyed by lowercase country name */
  const byCountry = new Map();
  for (const ev of events) {
    if (!ev.country || !ALERT_SEVERITIES.has(ev.severity)) continue;
    const key = ev.country.toLowerCase();
    if (!byCountry.has(key)) byCountry.set(key, []);
    byCountry.get(key).push(ev);
  }

  /* ── process subscribers ────────────────────────────────────────────── */
  const subscribers = await listAllVerified();
  let notified = 0;

  for (const sub of subscribers) {
    if (!sub.countries || sub.countries.length === 0) continue;

    const alerted = sub.alerted_events ?? {};   // { [event_id]: true }
    const newEvs  = [];

    for (const country of sub.countries) {
      const hits = byCountry.get(country.toLowerCase()) || [];
      for (const ev of hits) {
        if (!alerted[ev.id]) newEvs.push(ev);
      }
    }

    if (newEvs.length === 0) continue;

    /* Send alert email */
    const lang = sub.lang || 'en';
    try {
      const { subject, html, text } = renderAlertEmail({ events: newEvs, lang });
      await sendEmail({ to: sub.email, subject, html, text });
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
