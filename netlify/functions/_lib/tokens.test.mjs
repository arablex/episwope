import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomToken, hashEmail } from './tokens.mjs';

test('randomToken returns 32-char url-safe string', () => {
  const t = randomToken();
  assert.equal(t.length, 32);
  assert.match(t, /^[A-Za-z0-9_-]+$/);
});

test('randomToken values are unique across many calls', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(randomToken());
  assert.equal(seen.size, 200);
});

test('hashEmail is deterministic, lowercase- and trim-insensitive', () => {
  const a = hashEmail('User@Example.com');
  const b = hashEmail('  user@example.com  ');
  assert.equal(a, b);
});

test('hashEmail produces 64-hex-char output', () => {
  const h = hashEmail('user@example.com');
  assert.equal(h.length, 64);
  assert.match(h, /^[a-f0-9]+$/);
});
