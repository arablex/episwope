// netlify/functions/_lib/rate-limit.mjs
//
// Sliding-window IP rate limit, backed by a key-value store (injected).
// In production the store is Netlify Blobs; in tests it's an in-memory Map.
//
// Used by /api/subscribe to cap subscription attempts per source IP, so a
// bad actor can't burn through Resend's free-tier daily send budget by
// triggering verify emails to addresses they don't own.

const DEFAULT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_LIMIT = 5;

/**
 * Returns true if the request is allowed, false if over the limit.
 * Records a new attempt timestamp when allowed.
 *
 * @param {object} opts
 * @param {string} opts.key                 — unique key per actor (e.g. `subscribe:1.2.3.4`)
 * @param {object} opts.store               — { get(key) → record | null, put(key, record) → Promise }
 * @param {number} [opts.limit=5]           — max attempts per window
 * @param {number} [opts.windowMs=3600000]  — sliding window length
 * @param {() => number} [opts.now]         — clock dep for tests
 */
export async function rateLimitOk({ key, store, limit = DEFAULT_LIMIT, windowMs = DEFAULT_WINDOW_MS, now = () => Date.now() }) {
  const t = now();
  const record = (await store.get(key)) || { attempts: [] };
  const fresh = (record.attempts || []).filter((x) => t - x < windowMs);
  if (fresh.length >= limit) {
    // Persist the trimmed list so the record doesn't grow forever
    await store.put(key, { attempts: fresh });
    return false;
  }
  fresh.push(t);
  await store.put(key, { attempts: fresh });
  return true;
}

/** Best-effort client IP. Netlify sets x-nf-client-connection-ip; fall back to x-forwarded-for. */
export function ipFromReq(req) {
  const get = req.headers?.get?.bind(req.headers) || (() => null);
  return (
    get('x-nf-client-connection-ip') ||
    (get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  );
}
