// netlify/functions/_lib/jwt.mjs
// Minimal HS256 JWT using Node.js built-in crypto — no external deps.
// Secret stored in JWT_SECRET env var (min 32 chars recommended).

import { createHmac, timingSafeEqual } from 'node:crypto';

function b64url(data) {
  return Buffer.from(data).toString('base64url');
}

function b64urlDecode(s) {
  return Buffer.from(s, 'base64url').toString('utf8');
}

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET not configured');
  return s;
}

/**
 * Sign a JWT payload.
 * @param {object} payload  — arbitrary fields; iat/exp added automatically
 * @param {number} expiresInDays — default 30
 * @returns {string} compact JWT
 */
export function signJWT(payload, expiresInDays = 30) {
  if ((process.env.JWT_SECRET || '').length < 32) {
    throw new Error('JWT_SECRET must be >= 32 chars');
  }
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now    = Math.floor(Date.now() / 1000);
  const body   = b64url(JSON.stringify({
    ...payload,
    iat: now,
    exp: now + expiresInDays * 86400,
  }));
  const data = `${header}.${body}`;
  const sig  = createHmac('sha256', secret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

/**
 * Verify a JWT and return its payload.
 * Throws 'invalid_token' | 'invalid_signature' | 'token_expired'.
 * @returns {object} decoded payload
 */
export function verifyJWT(token) {
  const parts = (token || '').split('.');
  if (parts.length !== 3) throw new Error('invalid_token');

  const [header, body, sig] = parts;

  // Pin algorithm — reject anything that isn't explicitly HS256/JWT
  let hdr;
  try { hdr = JSON.parse(b64urlDecode(header)); } catch { throw new Error('invalid_token'); }
  if (hdr.alg !== 'HS256' || hdr.typ !== 'JWT') throw new Error('invalid_token');

  const data     = `${header}.${body}`;
  const expected = createHmac('sha256', secret()).update(data).digest('base64url');

  const a = Buffer.from(sig,      'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('invalid_signature');
  }

  let payload;
  try { payload = JSON.parse(b64urlDecode(body)); } catch {
    throw new Error('invalid_token');
  }

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('token_expired');
  }

  return payload;
}
