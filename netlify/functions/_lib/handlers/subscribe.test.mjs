import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleSubscribe } from './subscribe.mjs';

function makeDeps() {
  const blobs = new Map();
  const sent = [];
  return {
    blobs,
    sent,
    getSubscriber: async (k) => (blobs.has(k) ? blobs.get(k) : null),
    putSubscriber: async (k, v) => { blobs.set(k, v); },
    sendEmail: async (msg) => { sent.push(msg); return { id: 'mock' }; },
    now: () => new Date('2026-05-14T10:00:00Z'),
    randomToken: () => 'tok_' + (blobs.size + sent.length),
    siteOrigin: 'https://episwope.ru',
  };
}

test('valid new subscription creates pending record and sends verify email', async () => {
  const deps = makeDeps();
  const res = await handleSubscribe(
    { email: 'a@example.com', country: 'Brazil', lang: 'ru' },
    deps,
  );
  assert.equal(res.status, 200);
  assert.equal(deps.blobs.size, 1);
  const rec = [...deps.blobs.values()][0];
  assert.equal(rec.email, 'a@example.com');
  assert.deepEqual(rec.countries, ['Brazil']);
  assert.equal(rec.lang, 'ru');
  assert.equal(rec.status, 'pending');
  assert.equal(deps.sent.length, 1);
  assert.match(deps.sent[0].html, /episwope\.ru\/api\/verify/);
});

test('subscribing same email to second country appends, sends one more verify', async () => {
  const deps = makeDeps();
  await handleSubscribe({ email: 'a@example.com', country: 'Brazil', lang: 'en' }, deps);
  await handleSubscribe({ email: 'a@example.com', country: 'Vietnam', lang: 'en' }, deps);
  assert.equal(deps.blobs.size, 1);
  const rec = [...deps.blobs.values()][0];
  assert.deepEqual(rec.countries, ['Brazil', 'Vietnam']);
  assert.equal(rec.status, 'pending');
  assert.equal(deps.sent.length, 2);
});

test('subscribing already-verified email to new country does NOT resend verify', async () => {
  const deps = makeDeps();
  await handleSubscribe({ email: 'a@example.com', country: 'Brazil', lang: 'en' }, deps);
  const rec = [...deps.blobs.values()][0];
  rec.status = 'verified';
  rec.verifiedAt = '2026-05-10T00:00:00Z';
  deps.sent.length = 0;
  await handleSubscribe({ email: 'a@example.com', country: 'Vietnam', lang: 'en' }, deps);
  assert.deepEqual(rec.countries, ['Brazil', 'Vietnam']);
  assert.equal(deps.sent.length, 0);
});

test('duplicate country on same email is a no-op', async () => {
  const deps = makeDeps();
  await handleSubscribe({ email: 'a@example.com', country: 'Brazil', lang: 'en' }, deps);
  deps.sent.length = 0;
  await handleSubscribe({ email: 'a@example.com', country: 'Brazil', lang: 'en' }, deps);
  const rec = [...deps.blobs.values()][0];
  assert.deepEqual(rec.countries, ['Brazil']);
  assert.equal(deps.sent.length, 0);
});

test('unknown country rejected with 400', async () => {
  const deps = makeDeps();
  const res = await handleSubscribe(
    { email: 'a@example.com', country: 'Atlantis', lang: 'en' }, deps,
  );
  assert.equal(res.status, 400);
  assert.equal(deps.blobs.size, 0);
});

test('invalid email rejected with 400', async () => {
  const deps = makeDeps();
  const res = await handleSubscribe(
    { email: 'not-an-email', country: 'Brazil', lang: 'en' }, deps,
  );
  assert.equal(res.status, 400);
  assert.equal(deps.blobs.size, 0);
});

test('unsubscribed email blocked from re-subscribing without verification', async () => {
  const deps = makeDeps();
  await handleSubscribe({ email: 'a@example.com', country: 'Brazil', lang: 'en' }, deps);
  const rec = [...deps.blobs.values()][0];
  rec.status = 'unsubscribed';
  deps.sent.length = 0;
  const res = await handleSubscribe({ email: 'a@example.com', country: 'Vietnam', lang: 'en' }, deps);
  assert.equal(res.status, 200);
  // Re-opens as pending and re-sends verify
  assert.equal(rec.status, 'pending');
  assert.equal(deps.sent.length, 1);
});
