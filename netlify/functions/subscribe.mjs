// netlify/functions/subscribe.mjs
import { getStore } from '@netlify/blobs';
import { handleSubscribe } from './_lib/handlers/subscribe.mjs';
import { getSubscriber, putSubscriber } from './_lib/blobs.mjs';
import { sendEmail } from './_lib/resend.mjs';
import { randomToken } from './_lib/tokens.mjs';
import { rateLimitOk, ipFromReq } from './_lib/rate-limit.mjs';

// Bind a Netlify-Blobs-backed store the rate limiter can use.
// 5 attempts per IP per hour caps the worst-case Resend send cost from abuse.
const rlStore = () => {
  const blobs = getStore({ name: 'rate-limits', consistency: 'strong' });
  return {
    get: (k) => blobs.get(k, { type: 'json' }),
    put: (k, v) => blobs.setJSON(k, v),
  };
};

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Per-IP rate limit before any work that costs money (sending email).
  const ip = ipFromReq(req);
  const ok = await rateLimitOk({ key: `subscribe:${ip}`, store: rlStore() });
  if (!ok) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' },
    });
  }

  let input;
  try {
    input = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Hand the handler the same dep contract the tests use:
  // getSubscriber(key) and putSubscriber(key, rec), both keyed by hash.
  const deps = {
    getSubscriber,        // (key) => record | null
    putSubscriber,        // (key, rec) => void
    sendEmail,            // ({to, subject, html, text}) => Promise
    randomToken,
    now: () => new Date(),
    siteOrigin: new URL(req.url).origin,
  };

  const { status, body } = await handleSubscribe(input, deps);
  return new Response(JSON.stringify(body || {}), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { path: '/api/subscribe' };
