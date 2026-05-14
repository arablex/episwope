// netlify/functions/_lib/rate-limit.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rateLimitOk, ipFromReq } from './rate-limit.mjs';

function makeStore() {
  const m = new Map();
  return {
    map: m,
    get: async (k) => (m.has(k) ? m.get(k) : null),
    put: async (k, v) => { m.set(k, v); },
  };
}

test('first attempt is allowed', async () => {
  const store = makeStore();
  const ok = await rateLimitOk({ key: 'k', store, now: () => 1000 });
  assert.equal(ok, true);
  assert.equal(store.map.get('k').attempts.length, 1);
});

test('within limit (limit=3) — three attempts allowed, fourth blocked', async () => {
  const store = makeStore();
  let t = 0;
  const tick = () => { t += 1; return t; };
  for (let i = 0; i < 3; i++) {
    const ok = await rateLimitOk({ key: 'k', store, limit: 3, now: tick });
    assert.equal(ok, true, `attempt ${i + 1} should be allowed`);
  }
  const blocked = await rateLimitOk({ key: 'k', store, limit: 3, now: tick });
  assert.equal(blocked, false);
});

test('attempts older than window roll off', async () => {
  const store = makeStore();
  // Two attempts at t=0 and t=10
  await rateLimitOk({ key: 'k', store, limit: 3, windowMs: 1000, now: () => 0 });
  await rateLimitOk({ key: 'k', store, limit: 3, windowMs: 1000, now: () => 10 });
  // Way past the window
  const ok = await rateLimitOk({ key: 'k', store, limit: 3, windowMs: 1000, now: () => 5000 });
  assert.equal(ok, true);
  // The old ones should have been dropped — store should only have the latest
  assert.equal(store.map.get('k').attempts.length, 1);
});

test('different keys are isolated', async () => {
  const store = makeStore();
  for (let i = 0; i < 5; i++) await rateLimitOk({ key: 'a', store, limit: 3, now: () => i });
  const okA = await rateLimitOk({ key: 'a', store, limit: 3, now: () => 100 });
  const okB = await rateLimitOk({ key: 'b', store, limit: 3, now: () => 100 });
  assert.equal(okA, false);
  assert.equal(okB, true);
});

test('ipFromReq prefers x-nf-client-connection-ip', () => {
  const req = {
    headers: {
      get: (k) =>
        ({
          'x-nf-client-connection-ip': '1.2.3.4',
          'x-forwarded-for': '5.6.7.8, 9.10.11.12',
        }[k.toLowerCase()] || null),
    },
  };
  assert.equal(ipFromReq(req), '1.2.3.4');
});

test('ipFromReq falls back to x-forwarded-for first hop', () => {
  const req = {
    headers: {
      get: (k) => (k.toLowerCase() === 'x-forwarded-for' ? '5.6.7.8, 9.10.11.12' : null),
    },
  };
  assert.equal(ipFromReq(req), '5.6.7.8');
});

test('ipFromReq returns "unknown" when no headers present', () => {
  const req = { headers: { get: () => null } };
  assert.equal(ipFromReq(req), 'unknown');
});
