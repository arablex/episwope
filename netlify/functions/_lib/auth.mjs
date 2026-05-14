// netlify/functions/_lib/auth.mjs
//
// Timing-safe Bearer-token check for admin endpoints.
// Plain string `!==` short-circuits on the first byte mismatch and leaks the
// prefix one byte at a time to an attacker who can measure response timing.
// `crypto.timingSafeEqual` runs in constant time on equal-length buffers.

import { timingSafeEqual } from 'node:crypto';

/** True iff `Authorization: Bearer <secret>` matches process.env[envName]. */
export function checkBearerAuth(req, envName = 'EPISCOPE_TOKEN_SECRET') {
  const expected = process.env[envName];
  const header = req.headers?.get?.('authorization') || '';
  if (!expected || !header.startsWith('Bearer ')) return false;
  const got = header.slice(7);
  const a = Buffer.from(got, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
