/**
 * POST /api/internal/risk-dispatch  — fire B2B risk webhooks.
 *
 * Internal: Authorization: Bearer <EPISCOPE_TOKEN_SECRET>. Invoked by the
 * GitHub Actions cron right after risk_aggregate.py writes risk_index.json.
 *
 * For every active subscription, compares the watched geography's
 * effective risk score (composite, or max of the subscribed categories)
 * against its threshold. Edge-triggered + 6h-debounced + band-escalation
 * override → no alert storms, no duplicate fires. Deliveries are
 * HMAC-SHA256 signed so the client can verify authenticity.
 */
import { getStore } from '@netlify/blobs';
import { createHmac } from 'node:crypto';
import { checkBearerAuth } from './_lib/auth.mjs';

/**
 * Deliver a signed webhook with exponential backoff retry.
 * Attempts: 0 ms → 2 s → 8 s (up to MAX_RETRIES total attempts).
 * Returns { ok, status, attempts, error }.
 */
const MAX_RETRIES = 3;
const TIMEOUT_MS = 8000;

async function deliverWithRetry(url, rawBody, headers) {
  let lastErr, lastStatus;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 2^(attempt-1) * 2000 ms  → 2 s, 8 s
      await new Promise((r) => setTimeout(r, (2 ** (attempt - 1)) * 2000));
    }
    try {
      const ctrl = AbortSignal.timeout ? AbortSignal.timeout(TIMEOUT_MS) : undefined;
      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body: rawBody,
        signal: ctrl,
      });
      lastStatus = resp.status;
      if (resp.status >= 200 && resp.status < 300) {
        return { ok: true, status: resp.status, attempts: attempt + 1, error: null };
      }
      // Non-2xx: retry (treat 4xx without retry-after as terminal on last attempt)
      lastErr = `HTTP ${resp.status}`;
      if (resp.status >= 400 && resp.status < 500 && resp.status !== 429) break; // client error, don't retry
    } catch (e) {
      lastErr = String(e).slice(0, 120);
    }
  }
  return { ok: false, status: lastStatus ?? 0, attempts: MAX_RETRIES, error: lastErr };
}

const J = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

const BAND = ['minimal', 'low', 'moderate', 'elevated', 'severe', 'critical'];
const bandIdx = (b) => Math.max(0, BAND.indexOf(b));
const DEBOUNCE_MS = 6 * 60 * 60 * 1000;   // 6h unless band escalates

export default async (req) => {
  if (req.method !== 'POST') return J({ error: 'method_not_allowed' }, 405);
  if (!checkBearerAuth(req, 'EPISCOPE_TOKEN_SECRET'))
    return J({ error: 'forbidden' }, 403);

  const origin = new URL(req.url).origin;
  let idx;
  try {
    const r = await fetch(`${origin}/public/risk_index.json?_=${Date.now()}`);
    idx = r.ok ? await r.json() : null;
  } catch { idx = null; }
  if (!idx || !idx.index) return J({ error: 'risk_index_unavailable' }, 503);

  const subs = getStore({ name: 'risk-webhooks', consistency: 'strong' });
  const state = getStore({ name: 'risk-webhook-state', consistency: 'strong' });

  let listing;
  try { listing = await subs.list(); } catch { listing = { blobs: [] }; }
  const keys = (listing.blobs || []).map((b) => b.key);

  const now = Date.now();
  const report = { checked: 0, fired: 0, errors: 0, skipped: 0 };

  for (const key of keys) {
    const sub = await subs.get(key, { type: 'json' });
    if (!sub || sub.active === false) { report.skipped++; continue; }
    report.checked++;

    const geo = idx.index[sub.country];
    if (!geo || !geo.composite_risk) { report.skipped++; continue; }

    // Effective score: max of subscribed categories, else composite.
    let score = geo.composite_risk.score;
    let band = geo.composite_risk.band;
    let driver = geo.composite_risk.dominant_category;
    if (Array.isArray(sub.categories) && sub.categories.length) {
      let best = -1, bestCat = null;
      for (const c of sub.categories) {
        const cs = geo.category_breakdown?.[c]?.score;
        if (typeof cs === 'number' && cs > best) { best = cs; bestCat = c; }
      }
      if (best >= 0) {
        score = best; driver = bestCat;
        band = BAND[Math.min(Math.round(score), 5)];
      }
    }

    const st = (await state.get(key, { type: 'json' })) ||
      { was_above: false, last_band: 'minimal', last_fired_at: 0 };

    const aboveNow = score >= sub.threshold;
    if (!aboveNow) {
      if (st.was_above) await state.setJSON(key, { ...st, was_above: false });
      continue;
    }

    const escalated = st.was_above && bandIdx(band) > bandIdx(st.last_band);
    const crossedUp = !st.was_above;
    const debounced = (now - (st.last_fired_at || 0)) < DEBOUNCE_MS;
    if (!(crossedUp || escalated) || (debounced && !escalated)) {
      // still above but already alerted & not escalating — keep state
      await state.setJSON(key, { ...st, was_above: true, last_band: band });
      continue;
    }

    const payload = {
      event: 'risk.threshold.crossed',
      subscription_id: sub.id,
      country: sub.country,
      threshold: sub.threshold,
      reason: escalated ? 'band_escalation' : 'threshold_crossed',
      composite_risk: { score, band, dominant_category: driver },
      category_breakdown: geo.category_breakdown,
      generated_at: idx.meta?.generated_at,
      triggered_at: new Date(now).toISOString(),
      dashboard_url: `https://vigilo.cc/api/v1/risk?country=${sub.country}`,
    };
    const raw = JSON.stringify(payload);
    const sig = createHmac('sha256', sub.secret).update(raw).digest('hex');

    const delivery = await deliverWithRetry(sub.callback_url, raw, {
      'Content-Type': 'application/json',
      'User-Agent': 'Vigilo-Webhook/1.0',
      'X-Vigilo-Event': payload.event,
      'X-Vigilo-Signature': `sha256=${sig}`,
      'X-Vigilo-Delivery': `${sub.id}.${now}`,
    });

    if (delivery.ok) report.fired++; else report.errors++;
    await state.setJSON(key, {
      was_above: true, last_band: band, last_fired_at: now,
      last_status: delivery.status,
      last_attempts: delivery.attempts,
      ...(delivery.error ? { last_error: delivery.error } : {}),
    });
  }

  return J({ ok: true, ...report });
};

export const config = { path: '/api/internal/risk-dispatch' };
