import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderVerifyEmail } from './templates.mjs';

const SAMPLE = {
  countries: ['Brazil', 'Vietnam'],
  verifyUrl: 'https://episwope.ru/api/verify?t=abc',
  unsubUrl: 'https://episwope.ru/api/unsubscribe?t=xyz',
};

test('English verify email contains all dynamic fields', () => {
  const { subject, html, text } = renderVerifyEmail({ ...SAMPLE, lang: 'en' });
  assert.match(subject, /Confirm/i);
  assert.match(html, /Brazil/);
  assert.match(html, /Vietnam/);
  assert.match(html, /api\/verify\?t=abc/);
  assert.match(html, /api\/unsubscribe\?t=xyz/);
  assert.match(text, /Brazil/);
  assert.match(text, /verify\?t=abc/);
});

test('Russian verify email is in Russian', () => {
  const { subject, html } = renderVerifyEmail({ ...SAMPLE, lang: 'ru' });
  assert.match(subject, /Подтверди/);
  assert.match(html, /Бразилия|Brazil/); // either is OK — list is canonical English
  assert.match(html, /подписк/i);
});

test('HTML escapes country names (defence in depth)', () => {
  const { html } = renderVerifyEmail({
    ...SAMPLE,
    countries: ['<script>alert(1)</script>'],
    lang: 'en',
  });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
