// netlify/functions/waitlist.mjs
//
// POST /api/waitlist  { email, source?, lang? }
//
// Fake-door validation instrument: stores Pro-interest emails so we can
// measure willingness to pay BEFORE building Stripe. No email is sent.
// Rate-limited 10/IP/hour.

import { getStore } from '@netlify/blobs';
import { rateLimitOk, ipFromReq } from './_lib/rate-limit.mjs';

const J = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

const rlStore = () => {
  const b = getStore({ name: 'rate-limits', consistency: 'strong' });
  return { get: (k) => b.get(k, { type: 'json' }), put: (k, v) => b.setJSON(k, v) };
};

export default async (req) => {
  if (req.method !== 'POST') return J({ error: 'method_not_allowed' }, 405);

  const ip = ipFromReq(req);
  if (!await rateLimitOk({ key: `waitlist:${ip}`, store: rlStore(), limit: 10 })) {
    return J({ error: 'rate_limited' }, 429);
  }

  let email, source, lang;
  try { ({ email, source, lang } = await req.json()); }
  catch { return J({ error: 'invalid_json' }, 400); }

  const e = String(email || '').trim().toLowerCase();
  if (!e || !e.includes('@') || e.length > 200) return J({ error: 'invalid_email' }, 400);

  const store = getStore({ name: 'waitlist', consistency: 'strong' });
  const key = Buffer.from(e).toString('base64url');

  const existing = await store.get(key, { type: 'json' }).catch(() => null);
  await store.setJSON(key, {
    email: e,
    source: String(source || 'unknown').slice(0, 40),
    lang: lang === 'ru' ? 'ru' : 'en',
    first_seen: existing?.first_seen || new Date().toISOString(),
    last_seen: new Date().toISOString(),
    hits: (existing?.hits || 0) + 1,
  });

  return J({ ok: true });
};

export const config = { path: '/api/waitlist' };
