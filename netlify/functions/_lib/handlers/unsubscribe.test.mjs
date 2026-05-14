// netlify/functions/_lib/handlers/unsubscribe.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleUnsubscribe } from './unsubscribe.mjs';

function deps(records) {
  const map = new Map(records.map((r) => [r.__key, r]));
  return {
    findByUnsubToken: async (t) => [...map.values()].find((r) => r.unsubToken === t) || null,
    putSubscriber: async (k, v) => { map.set(k, v); },
  };
}

test('valid token marks subscriber unsubscribed and redirects', async () => {
  const rec = { __key:'k1', email:'a@x.com', countries:['Brazil'], status:'verified', unsubToken:'good' };
  const d = deps([rec]);
  const res = await handleUnsubscribe({ token: 'good' }, d);
  assert.equal(res.status, 302);
  assert.match(res.location, /unsubscribed/);
  assert.equal(rec.status, 'unsubscribed');
});

test('already-unsubscribed is idempotent', async () => {
  const rec = { __key:'k1', email:'a@x.com', countries:['Brazil'], status:'unsubscribed', unsubToken:'good' };
  const d = deps([rec]);
  const res = await handleUnsubscribe({ token: 'good' }, d);
  assert.equal(res.status, 302);
  assert.match(res.location, /unsubscribed/);
});

test('unknown token returns 404', async () => {
  const d = deps([]);
  const res = await handleUnsubscribe({ token: 'nope' }, d);
  assert.equal(res.status, 404);
});

test('missing token returns 400', async () => {
  const d = deps([]);
  const res = await handleUnsubscribe({ token: '' }, d);
  assert.equal(res.status, 400);
});
