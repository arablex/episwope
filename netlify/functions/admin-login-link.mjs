// netlify/functions/admin-login-link.mjs
//
// Protected: returns a ready-to-use magic login URL WITHOUT sending email.
// Use when Resend domain isn't verified yet (e.g. right after a domain move)
// but you still need to log in. Requires Authorization: Bearer <EPISCOPE_TOKEN_SECRET>.
//
//   GET  /api/admin/login-link?email=you@example.com[&lang=ru]
//   POST /api/admin/login-link  { email, lang? }
//
// Mirrors magic-link.mjs token/URL construction exactly so the link is valid.

import { checkBearerAuth }   from './_lib/auth.mjs';
import { signJWT }           from './_lib/jwt.mjs';
import { getSubscriberPlan } from './_lib/paid.mjs';

const J = (obj, status = 200) =>
  new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export default async (req) => {
  if (!checkBearerAuth(req)) {
    return new Response('forbidden', { status: 403 });
  }

  let email, lang;
  if (req.method === 'POST') {
    try { ({ email, lang } = await req.json()); }
    catch { return J({ error: 'invalid_json' }, 400); }
  } else {
    const u = new URL(req.url);
    email = u.searchParams.get('email');
    lang  = u.searchParams.get('lang');
  }

  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) {
    return J({ error: 'invalid_email' }, 400);
  }

  const resolvedLang = ['en', 'ru'].includes(lang) ? lang : 'en';
  const { plan, paid_until } =
    await getSubscriberPlan(normalized).catch(() => ({ plan: 'free', paid_until: null }));

  const token    = signJWT({ email: normalized, plan, paid_until });
  const origin   = new URL(req.url).origin;
  const loginUrl = `${origin}/auth?token=${encodeURIComponent(token)}&lang=${resolvedLang}`;

  return J({ ok: true, email: normalized, plan, paid_until, loginUrl });
};

export const config = { path: '/api/admin/login-link' };
