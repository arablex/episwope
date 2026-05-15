/**
 * GET  /api/my-countries               — load saved countries for logged-in user
 * PATCH /api/my-countries { countries: string[] } — save watched countries
 *
 * Authorization: Bearer <jwt>
 *
 * Free plan: max 3 countries.
 * Pro  plan: max 50 countries.
 *
 * Env: JWT_SECRET
 */
import { verifyJWT }                    from './_lib/jwt.mjs';
import { getSubscriber, putSubscriber } from './_lib/blobs.mjs';
import { hashEmail }                    from './_lib/tokens.mjs';
import { isPaidActive }                 from './_lib/paid.mjs';

const FREE_LIMIT = 3;
const PRO_LIMIT  = 50;

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

function bearerToken(req) {
  const auth = req.headers.get('authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

function authPayload(req) {
  const token = bearerToken(req);
  if (!token) return null;
  try { return verifyJWT(token); } catch { return null; }
}

export default async (req) => {
  /* ── preflight ─────────────────────────────────────────────────────── */
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...CORS,
        'Access-Control-Allow-Methods': 'GET, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  /* ── auth ───────────────────────────────────────────────────────────── */
  const payload = authPayload(req);
  if (!payload) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS });
  }

  const email   = payload.email;
  const hash    = hashEmail(email);
  const isPro   = payload.plan === 'pro' && isPaidActive(payload.paid_until);
  const limit   = isPro ? PRO_LIMIT : FREE_LIMIT;

  /* ── GET ────────────────────────────────────────────────────────────── */
  if (req.method === 'GET') {
    const rec = await getSubscriber(hash);
    return new Response(JSON.stringify({
      ok:       true,
      countries: rec?.countries ?? [],
      plan:     payload.plan ?? 'free',
      isPro,
      limit,
    }), { status: 200, headers: CORS });
  }

  /* ── PATCH ──────────────────────────────────────────────────────────── */
  if (req.method === 'PATCH') {
    let body;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: CORS });
    }

    if (!Array.isArray(body.countries)) {
      return new Response(JSON.stringify({ error: 'countries must be an array' }), { status: 400, headers: CORS });
    }

    // Sanitise: trim, dedupe, cap
    const countries = [...new Set(
      body.countries
        .map(c => String(c).trim())
        .filter(c => c.length > 0 && c.length < 120),
    )].slice(0, limit);

    const existing = await getSubscriber(hash) ?? {
      email:     email.toLowerCase(),
      status:    'verified',
      lang:      'en',
      createdAt: new Date().toISOString(),
    };

    await putSubscriber(hash, {
      ...existing,
      countries,
      updatedAt: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ ok: true, countries, plan: payload.plan ?? 'free', isPro, limit }), {
      status: 200,
      headers: CORS,
    });
  }

  return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: CORS });
};

export const config = { path: '/api/my-countries' };
