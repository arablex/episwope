// netlify/functions/_lib/svix.mjs
//
// Verify a webhook signature produced by Resend (which uses Svix).
//
// Header format Resend sends:
//   svix-id:        msg_2xyz...                  — message id
//   svix-timestamp: 1731600000                   — unix seconds
//   svix-signature: v1,<base64> v1,<base64-2>    — space-separated list
//
// Signing key format:                            whsec_<base64>
//
// Algorithm: HMAC-SHA256(secret_bytes, `${id}.${timestamp}.${body}`),
// base64-encoded. We accept the request if any "v1,<sig>" in the header
// matches, and reject signatures older than 5 minutes (anti-replay).

import { createHmac, timingSafeEqual } from 'node:crypto';

const TOLERANCE_SECONDS = 5 * 60;

/**
 * @param {object} args
 * @param {object} args.headers   — a fetch-style Headers object (has .get(name))
 * @param {string} args.rawBody   — the body as a UTF-8 string (NOT pre-parsed JSON)
 * @param {string} args.secret    — process.env.RESEND_WEBHOOK_SECRET ("whsec_..." or raw base64)
 * @param {() => number} [args.now] — current time in unix seconds (for tests)
 * @returns {boolean}
 */
export function verifySvixSignature({ headers, rawBody, secret, now = () => Math.floor(Date.now() / 1000) }) {
  if (!secret) return false;
  const id = headers.get?.('svix-id');
  const ts = headers.get?.('svix-timestamp');
  const sig = headers.get?.('svix-signature');
  if (!id || !ts || !sig) return false;

  // Anti-replay: timestamp must be recent
  const tsNum = Number.parseInt(ts, 10);
  if (!Number.isFinite(tsNum) || Math.abs(now() - tsNum) > TOLERANCE_SECONDS) return false;

  // Decode the signing key
  const cleanSecret = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  let keyBuf;
  try {
    keyBuf = Buffer.from(cleanSecret, 'base64');
  } catch {
    return false;
  }
  if (keyBuf.length === 0) return false;

  const toSign = `${id}.${ts}.${rawBody}`;
  const expected = createHmac('sha256', keyBuf).update(toSign).digest('base64');
  const expectedBuf = Buffer.from(expected, 'utf8');

  // Header carries one or more "v1,<sig>" entries separated by spaces
  for (const entry of sig.split(' ')) {
    const [version, value] = entry.split(',');
    if (version !== 'v1' || !value) continue;
    const gotBuf = Buffer.from(value, 'utf8');
    if (gotBuf.length !== expectedBuf.length) continue;
    if (timingSafeEqual(gotBuf, expectedBuf)) return true;
  }
  return false;
}
