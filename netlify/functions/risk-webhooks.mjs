/**
 * /api/v1/risk/webhooks — B2B risk-alert webhook subscriptions (Partner tier).
 *
 *   POST   { country, threshold, categories?, callback_url, email? }
 *            → { id, secret, manage_token }
 *   DELETE  ?id=<id>&manage_token=<t>            → { ok:true }
 *   GET     ?id=<id>&manage_token=<t>            → subscription (no secret)
 *
 * Client gets a `secret` to verify the HMAC signature on delivered alerts
 * (X-Vigilo-Signature: sha256=...). The dispatcher
 * (risk-webhook-dispatch.mjs) fires alerts when a watched geography's
 * Composite Risk Score crosses the threshold (edge-triggered, debounced).
 *
 * Open registration (no auth) but IP rate-limited. SSRF-guarded:
 * callback must be public https, never localhost / private ranges.
 */
import { getStore } from '@netlify/blobs';
import { randomBytes } from 'node:crypto';
import { rateLimitOk, ipFromReq } from './_lib/rate-limit.mjs';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: CORS });

const subStore = () => getStore({ name: 'risk-webhooks', consistency: 'strong' });
const rlStore = () => {
  const b = getStore({ name: 'rate-limits', consistency: 'strong' });
  return { get: (k) => b.get(k, { type: 'json' }), put: (k, v) => b.setJSON(k, v) };
};

const BANDS = { minimal: 0, low: 1, moderate: 2, elevated: 3, severe: 4, critical: 5 };

// SSRF guard: only public https endpoints.
function badCallback(raw) {
  let u;
  try { u = new URL(raw); } catch { return 'invalid_url'; }
  if (u.protocol !== 'https:') return 'must_be_https';
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal'))
    return 'private_host';
  // IPv4 literal in private / loopback / link-local ranges
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0 ||
        (a === 192 && b === 168) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 169 && b === 254) || a >= 224) return 'private_ip';
  }
  if (h === '::1' || h.startsWith('fd') || h.startsWith('fe80')) return 'private_ip';
  return null;
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const ip = ipFromReq(req);
  const store = subStore();
  const url = new URL(req.url);

  // ── DELETE / GET — manage existing subscription ──
  if (req.method === 'DELETE' || req.method === 'GET') {
    const id = url.searchParams.get('id');
    const mt = url.searchParams.get('manage_token');
    if (!id || !mt) return J({ error: 'id_and_manage_token_required' }, 400);
    const sub = await store.get(id, { type: 'json' });
    if (!sub || sub.manage_token !== mt) return J({ error: 'not_found' }, 404);
    if (req.method === 'DELETE') {
      await store.delete(id);
      return J({ ok: true, deleted: id });
    }
    const { secret, manage_token, ...safe } = sub;
    return J(safe);
  }

  if (req.method !== 'POST') return J({ error: 'method_not_allowed' }, 405);

  if (!await rateLimitOk({ key: `rwh:${ip}`, store: rlStore(), limit: 20 }))
    return J({ error: 'rate_limited' }, 429);

  let body;
  try { body = await req.json(); } catch { return J({ error: 'invalid_json' }, 400); }

  const country = String(body.country || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country))
    return J({ error: 'country (ISO-3166 alpha-2) required' }, 400);

  let threshold = body.threshold;
  if (typeof threshold === 'string') threshold = BANDS[threshold.toLowerCase()];
  threshold = Number(threshold);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 5)
    return J({ error: 'threshold must be 0–5 or a band name' }, 400);

  const cbErr = badCallback(body.callback_url);
  if (cbErr) return J({ error: `callback_url ${cbErr}` }, 400);

  const cats = Array.isArray(body.categories)
    ? body.categories.filter((c) => typeof c === 'string').slice(0, 7)
    : null;

  const id = 'whk_' + randomBytes(9).toString('hex');
  const secret = 'whsec_' + randomBytes(24).toString('hex');
  const manage_token = randomBytes(18).toString('hex');

  const sub = {
    id, secret, manage_token,
    country, threshold,
    categories: cats,            // null = all
    callback_url: body.callback_url,
    email: typeof body.email === 'string' ? body.email.slice(0, 200) : null,
    created_at: new Date().toISOString(),
    created_ip: ip,
    active: true,
  };
  await store.setJSON(id, sub);

  return J({
    id, secret, manage_token,
    country, threshold,
    note: 'Verify delivered alerts with HMAC-SHA256 over the raw body using `secret`; compare to the X-Vigilo-Signature header (sha256=<hex>).',
  }, 201);
};

export const config = { path: '/api/v1/risk/webhooks' };
