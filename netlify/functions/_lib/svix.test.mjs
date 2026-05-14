// netlify/functions/_lib/svix.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifySvixSignature } from './svix.mjs';

// 32 bytes of zeros → b64; matches the "whsec_..." format
const RAW_SECRET = Buffer.alloc(32, 7).toString('base64');
const SECRET = 'whsec_' + RAW_SECRET;

function signOnce(id, ts, body, secret = RAW_SECRET) {
  const keyBuf = Buffer.from(secret, 'base64');
  return createHmac('sha256', keyBuf).update(`${id}.${ts}.${body}`).digest('base64');
}

function makeHeaders(obj) {
  return { get: (k) => obj[k.toLowerCase()] ?? null };
}

const NOW_SEC = 1731600000;
const fixedNow = () => NOW_SEC;

test('accepts a valid v1 signature within tolerance', () => {
  const id = 'msg_abc';
  const ts = String(NOW_SEC - 10);
  const body = '{"type":"email.bounced"}';
  const sig = signOnce(id, ts, body);
  const ok = verifySvixSignature({
    headers: makeHeaders({ 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': `v1,${sig}` }),
    rawBody: body,
    secret: SECRET,
    now: fixedNow,
  });
  assert.equal(ok, true);
});

test('accepts when secret has no whsec_ prefix', () => {
  const id = 'msg_a';
  const ts = String(NOW_SEC);
  const body = 'hi';
  const sig = signOnce(id, ts, body);
  const ok = verifySvixSignature({
    headers: makeHeaders({ 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': `v1,${sig}` }),
    rawBody: body,
    secret: RAW_SECRET, // raw base64, no whsec_ prefix
    now: fixedNow,
  });
  assert.equal(ok, true);
});

test('accepts when header carries multiple signatures and one matches', () => {
  const id = 'msg_a';
  const ts = String(NOW_SEC);
  const body = 'hi';
  const goodSig = signOnce(id, ts, body);
  const ok = verifySvixSignature({
    headers: makeHeaders({
      'svix-id': id,
      'svix-timestamp': ts,
      'svix-signature': `v1,not-this v1,${goodSig} v0,old-stuff`,
    }),
    rawBody: body,
    secret: SECRET,
    now: fixedNow,
  });
  assert.equal(ok, true);
});

test('rejects when no secret configured', () => {
  const ok = verifySvixSignature({
    headers: makeHeaders({ 'svix-id': 'a', 'svix-timestamp': '1', 'svix-signature': 'v1,xxx' }),
    rawBody: 'b',
    secret: '',
    now: fixedNow,
  });
  assert.equal(ok, false);
});

test('rejects when any required header is missing', () => {
  const base = { 'svix-id': 'a', 'svix-timestamp': String(NOW_SEC), 'svix-signature': 'v1,xxx' };
  for (const k of Object.keys(base)) {
    const drop = { ...base };
    delete drop[k];
    const ok = verifySvixSignature({
      headers: makeHeaders(drop),
      rawBody: 'b',
      secret: SECRET,
      now: fixedNow,
    });
    assert.equal(ok, false, `should reject when missing ${k}`);
  }
});

test('rejects a tampered body', () => {
  const id = 'msg_a';
  const ts = String(NOW_SEC);
  const sig = signOnce(id, ts, 'original');
  const ok = verifySvixSignature({
    headers: makeHeaders({ 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': `v1,${sig}` }),
    rawBody: 'tampered',
    secret: SECRET,
    now: fixedNow,
  });
  assert.equal(ok, false);
});

test('rejects when timestamp is too old (>5 min)', () => {
  const id = 'msg_a';
  const ts = String(NOW_SEC - 6 * 60); // 6 minutes ago
  const body = 'hi';
  const sig = signOnce(id, ts, body);
  const ok = verifySvixSignature({
    headers: makeHeaders({ 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': `v1,${sig}` }),
    rawBody: body,
    secret: SECRET,
    now: fixedNow,
  });
  assert.equal(ok, false);
});

test('rejects when timestamp is far in the future', () => {
  const id = 'msg_a';
  const ts = String(NOW_SEC + 6 * 60);
  const body = 'hi';
  const sig = signOnce(id, ts, body);
  const ok = verifySvixSignature({
    headers: makeHeaders({ 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': `v1,${sig}` }),
    rawBody: body,
    secret: SECRET,
    now: fixedNow,
  });
  assert.equal(ok, false);
});

test('rejects when only a non-v1 signature is present', () => {
  const id = 'msg_a';
  const ts = String(NOW_SEC);
  const ok = verifySvixSignature({
    headers: makeHeaders({ 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': 'v0,nope' }),
    rawBody: 'hi',
    secret: SECRET,
    now: fixedNow,
  });
  assert.equal(ok, false);
});
