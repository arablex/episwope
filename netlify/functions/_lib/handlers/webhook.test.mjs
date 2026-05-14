// netlify/functions/_lib/handlers/webhook.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleResendWebhook } from './webhook.mjs';

function deps(records) {
  const map = new Map(records.map((r) => [r.__key, r]));
  return {
    findByEmail: async (e) => [...map.values()].find((r) => r.email === e) || null,
    putSubscriber: async (k, v) => { map.set(k, v); },
  };
}

test('email.bounced (hard) flips subscriber to unsubscribed', async () => {
  const rec = { __key:'k1', email:'a@x.com', status:'verified' };
  const d = deps([rec]);
  const res = await handleResendWebhook({
    type: 'email.bounced',
    data: { to: ['a@x.com'], bounce: { type: 'hard' } },
  }, d);
  assert.equal(res.status, 200);
  assert.equal(rec.status, 'unsubscribed');
});

test('email.bounced (soft) is ignored', async () => {
  const rec = { __key:'k1', email:'a@x.com', status:'verified' };
  const d = deps([rec]);
  await handleResendWebhook({
    type: 'email.bounced',
    data: { to: ['a@x.com'], bounce: { type: 'soft' } },
  }, d);
  assert.equal(rec.status, 'verified');
});

test('email.complained flips subscriber to unsubscribed', async () => {
  const rec = { __key:'k1', email:'a@x.com', status:'verified' };
  const d = deps([rec]);
  await handleResendWebhook({
    type: 'email.complained',
    data: { to: ['a@x.com'] },
  }, d);
  assert.equal(rec.status, 'unsubscribed');
});

test('unknown event type is a no-op (200)', async () => {
  const d = deps([]);
  const res = await handleResendWebhook({ type: 'email.delivered', data: {} }, d);
  assert.equal(res.status, 200);
});

test('unknown email is a no-op (200)', async () => {
  const d = deps([]);
  const res = await handleResendWebhook({
    type: 'email.bounced',
    data: { to: ['ghost@x.com'], bounce: { type: 'hard' } },
  }, d);
  assert.equal(res.status, 200);
});
