// netlify/functions/_lib/rate-limit.mjs
//
// Sliding-window rate limiter backed by a key-value store (injected).
// In production the store is Netlify Blobs; in tests it's an in-memory Map.
//
// Supports both per-hour (default) and per-minute windows so callers can
// enforce strict RPM limits for API key tiers alongside hourly caps.

const HOUR_MS = 60 * 60 * 1000;
const MIN_MS  = 60 * 1000;

/**
 * Returns true if the request is allowed, false if over the limit.
 * Records a new attempt timestamp when allowed.
 *
 * @param {object} opts
 * @param {string} opts.key          — unique key per actor (e.g. `risk:1.2.3.4`)
 * @param {object} opts.store        — { get(key), put(key, record) } interface
 * @param {number} [opts.limit=60]   — max attempts per window
 * @param {number} [opts.windowMs]   — sliding window length (default: 1h)
 * @param {() => number} [opts.now]  — clock dep for tests
 */
export async function rateLimitOk({
  key,
  store,
  limit = 60,
  windowMs = HOUR_MS,
  now = () => Date.now(),
}) {
  const t = now();
  const record = (await store.get(key)) || { attempts: [] };
  const fresh = (record.attempts || []).filter((x) => t - x < windowMs);
  if (fresh.length >= limit) {
    await store.put(key, { attempts: fresh });
    return false;
  }
  fresh.push(t);
  await store.put(key, { attempts: fresh });
  return true;
}

/**
 * Dual-window check: enforces both RPM and RPH caps simultaneously.
 * Returns { ok, reason } so callers can surface the right Retry-After.
 *
 * @param {object} opts
 * @param {string} opts.key         — base key; suffixed with :m/:h internally
 * @param {object} opts.store       — { get(key), put(key, record) }
 * @param {number} [opts.rpm=60]    — requests per minute cap
 * @param {number} [opts.rph=3600]  — requests per hour cap
 * @param {() => number} [opts.now]
 * @returns {Promise<{ok:boolean, reason:'rpm'|'rph'|null, retryAfterSeconds:number}>}
 */
export async function dualWindowOk({
  key,
  store,
  rpm = 60,
  rph = 3600,
  now = () => Date.now(),
}) {
  const t = now();

  // Minute window
  const mKey = key + ':m';
  const mRec = (await store.get(mKey)) || { attempts: [] };
  const mFresh = (mRec.attempts || []).filter((x) => t - x < MIN_MS);
  if (mFresh.length >= rpm) {
    await store.put(mKey, { attempts: mFresh });
    const oldestM = Math.min(...mFresh);
    return { ok: false, reason: 'rpm', retryAfterSeconds: Math.ceil((oldestM + MIN_MS - t) / 1000) };
  }

  // Hour window
  const hKey = key + ':h';
  const hRec = (await store.get(hKey)) || { attempts: [] };
  const hFresh = (hRec.attempts || []).filter((x) => t - x < HOUR_MS);
  if (hFresh.length >= rph) {
    await store.put(hKey, { attempts: hFresh });
    const oldestH = Math.min(...hFresh);
    return { ok: false, reason: 'rph', retryAfterSeconds: Math.ceil((oldestH + HOUR_MS - t) / 1000) };
  }

  // Allowed — record in both windows
  mFresh.push(t); hFresh.push(t);
  await Promise.all([
    store.put(mKey, { attempts: mFresh }),
    store.put(hKey, { attempts: hFresh }),
  ]);
  return { ok: true, reason: null, retryAfterSeconds: 0 };
}

/** Best-effort client IP. Netlify sets x-nf-client-connection-ip first. */
export function ipFromReq(req) {
  const get = req.headers?.get?.bind(req.headers) || (() => null);
  return (
    get('x-nf-client-connection-ip') ||
    (get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  );
}
