// netlify/functions/_lib/auth.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkBearerAuth } from './auth.mjs';

function reqWith(headers = {}) {
  return {
    headers: {
      get: (k) => headers[k.toLowerCase()] || null,
    },
  };
}

test('rejects when env secret is missing', () => {
  const prev = process.env.EPISCOPE_TOKEN_SECRET;
  delete process.env.EPISCOPE_TOKEN_SECRET;
  try {
    const ok = checkBearerAuth(reqWith({ authorization: 'Bearer xxx' }));
    assert.equal(ok, false);
  } finally {
    if (prev !== undefined) process.env.EPISCOPE_TOKEN_SECRET = prev;
  }
});

test('rejects when Authorization header missing', () => {
  process.env.EPISCOPE_TOKEN_SECRET = 'secret-token-xyz';
  const ok = checkBearerAuth(reqWith({}));
  assert.equal(ok, false);
});

test('rejects when scheme is not Bearer', () => {
  process.env.EPISCOPE_TOKEN_SECRET = 'secret-token-xyz';
  const ok = checkBearerAuth(reqWith({ authorization: 'Basic xxx' }));
  assert.equal(ok, false);
});

test('rejects on length mismatch', () => {
  process.env.EPISCOPE_TOKEN_SECRET = 'secret-token-xyz';
  const ok = checkBearerAuth(reqWith({ authorization: 'Bearer wrong' }));
  assert.equal(ok, false);
});

test('rejects on same-length mismatch', () => {
  process.env.EPISCOPE_TOKEN_SECRET = 'secret-token-xyz';
  const ok = checkBearerAuth(reqWith({ authorization: 'Bearer wrong-token-xyz' }));
  assert.equal(ok, false);
});

test('accepts exact match', () => {
  process.env.EPISCOPE_TOKEN_SECRET = 'secret-token-xyz';
  const ok = checkBearerAuth(reqWith({ authorization: 'Bearer secret-token-xyz' }));
  assert.equal(ok, true);
});

test('honors custom env-var name', () => {
  process.env.OTHER_SECRET = 'abc123';
  const ok = checkBearerAuth(reqWith({ authorization: 'Bearer abc123' }), 'OTHER_SECRET');
  assert.equal(ok, true);
  delete process.env.OTHER_SECRET;
});
