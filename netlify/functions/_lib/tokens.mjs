import { randomBytes, createHash } from 'node:crypto';

/** Random 32-char url-safe token. Uses base64url so it's URL-safe by default. */
export function randomToken() {
  // 24 bytes → 32 base64url chars (no padding)
  return randomBytes(24).toString('base64url');
}

/** SHA-256 hex of the email, lowercased and trimmed. Stable lookup key for Blobs. */
export function hashEmail(email) {
  const normalized = String(email).trim().toLowerCase();
  return createHash('sha256').update(normalized).digest('hex');
}
