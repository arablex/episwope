/**
 * POST /api/magic-link  { email, lang? }
 *
 * Signs a 30-day JWT containing {email, plan, paid_until} and emails
 * a login link to the user. Works for any registered subscriber;
 * free-tier users get the link but the JWT will show plan:'free'.
 *
 * Rate-limited: 5 requests / IP / hour (same store as subscribe).
 * Returns 200 even if email not found (to avoid user enumeration).
 *
 * Env: JWT_SECRET, RESEND_API_KEY
 */
import { getStore }                from '@netlify/blobs';
import { signJWT }                 from './_lib/jwt.mjs';
import { getSubscriberPlan }       from './_lib/paid.mjs';
import { sendEmail }               from './_lib/resend.mjs';
import { renderMagicLinkEmail }    from './_lib/templates.mjs';
import { rateLimitOk, ipFromReq }  from './_lib/rate-limit.mjs';

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

const rlStore = () => {
  const blobs = getStore({ name: 'rate-limits', consistency: 'strong' });
  return {
    get: (k) => blobs.get(k, { type: 'json' }),
    put: (k, v) => blobs.setJSON(k, v),
  };
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: CORS });
  }

  const ip = ipFromReq(req);
  if (!await rateLimitOk({ key: `magic-link:${ip}`, store: rlStore() })) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...CORS, 'Retry-After': '3600' } });
  }

  let email, lang;
  try {
    ({ email, lang } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: CORS });
  }

  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) {
    return new Response(JSON.stringify({ error: 'invalid_email' }), { status: 400, headers: CORS });
  }

  const resolvedLang = ['en', 'ru'].includes(lang) ? lang : 'en';

  // Always return 200 — don't leak whether email exists
  const { plan, paid_until } = await getSubscriberPlan(normalized).catch(() => ({ plan: 'free', paid_until: null }));

  try {
    const token    = signJWT({ email: normalized, plan, paid_until });
    const origin   = new URL(req.url).origin;
    const loginUrl = `${origin}/auth?token=${encodeURIComponent(token)}&lang=${resolvedLang}`;
    const { subject, html, text } = renderMagicLinkEmail({ loginUrl, lang: resolvedLang });
    await sendEmail({ to: normalized, subject, html, text });
  } catch (e) {
    console.error('magic-link send error:', e.message);
    // Still return 200 to avoid enumeration
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });
};

export const config = { path: '/api/magic-link' };
