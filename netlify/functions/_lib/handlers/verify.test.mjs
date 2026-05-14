// netlify/functions/_lib/handlers/verify.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleVerify } from './verify.mjs';

function deps(records) {
  const map = new Map(records.map((r) => [r.__key, r]));
  return {
    findByVerifyToken: async (t) => [...map.values()].find((r) => r.verifyToken === t) || null,
    putSubscriber: async (k, v) => { map.set(k, v); },
    now: () => new Date('2026-05-14T10:00:00Z'),
  };
}

test('valid pending token transitions to verified', async () => {
  const rec = { __key: 'k1', email:'a@x.com', countries:['Brazil'], status: 'pending', verifyToken: 'good', verifiedAt: null };
  const d = deps([rec]);
  const res = await handleVerify({ token: 'good' }, d);
  assert.equal(res.status, 302);
  assert.match(res.location, /thanks-subscribe/);
  assert.equal(rec.status, 'verified');
  assert.equal(rec.verifiedAt, '2026-05-14T10:00:00.000Z');
});

test('already-verified token still redirects to thanks page (idempotent)', async () => {
  const rec = { __key: 'k1', email:'a@x.com', countries:['Brazil'], status: 'verified', verifyToken: 'good', verifiedAt: '2026-05-10T00:00:00Z' };
  const d = deps([rec]);
  const res = await handleVerify({ token: 'good' }, d);
  assert.equal(res.status, 302);
  assert.match(res.location, /thanks-subscribe/);
});

test('unknown token returns 404', async () => {
  const d = deps([]);
  const res = await handleVerify({ token: 'nope' }, d);
  assert.equal(res.status, 404);
});

test('missing token returns 400', async () => {
  const d = deps([]);
  const res = await handleVerify({ token: '' }, d);
  assert.equal(res.status, 400);
});

test('unsubscribed record routes the verify link to /unsubscribed.html', async () => {
  // User verified, then unsubscribed, then clicked the old verify link.
  // Should NOT mislead them into thinking they're subscribed again.
  const rec = { __key: 'k1', email:'a@x.com', countries:['Brazil'], status: 'unsubscribed', verifyToken: 'good', verifiedAt: '2026-05-10T00:00:00Z' };
  const d = deps([rec]);
  const res = await handleVerify({ token: 'good' }, d);
  assert.equal(res.status, 302);
  assert.match(res.location, /unsubscribed/);
});
