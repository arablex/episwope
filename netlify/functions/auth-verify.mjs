/**
 * GET /api/auth/verify?token=JWT
 *
 * Verifies a magic-link JWT. On success returns:
 *   { ok: true, email, plan, paid_until }
 *
 * The client stores the raw JWT in localStorage and reads plan/paid_until
 * from it client-side (no round-trip needed per page load).
 * This endpoint is used once — right after the user clicks the magic link.
 *
 * Env: JWT_SECRET
 */
import { verifyJWT } from './_lib/jwt.mjs';

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: CORS });
  }

  const url   = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) {
    return new Response(JSON.stringify({ error: 'token_required' }), { status: 400, headers: CORS });
  }

  let payload;
  try {
    payload = verifyJWT(token);
  } catch (e) {
    const code = ['token_expired', 'invalid_signature', 'invalid_token'].includes(e.message)
      ? e.message : 'invalid_token';
    return new Response(JSON.stringify({ error: code }), { status: 401, headers: CORS });
  }

  return new Response(JSON.stringify({
    ok:         true,
    email:      payload.email,
    plan:       payload.plan      ?? 'free',
    paid_until: payload.paid_until ?? null,
  }), { status: 200, headers: CORS });
};

export const config = { path: '/api/auth/verify' };
