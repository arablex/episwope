import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalCountry, isKnownCountry } from './countries.mjs';

test('English names pass through unchanged', () => {
  assert.equal(canonicalCountry('Brazil'), 'Brazil');
  assert.equal(canonicalCountry('United States'), 'United States');
});

test('Russian names resolve to canonical English', () => {
  assert.equal(canonicalCountry('Бразилия'), 'Brazil');
  assert.equal(canonicalCountry('США'), 'United States');
  assert.equal(canonicalCountry('ДР Конго'), 'Democratic Republic of Congo');
});

test('case and whitespace insensitive', () => {
  assert.equal(canonicalCountry('  brazil  '), 'Brazil');
  assert.equal(canonicalCountry('BRAZIL'), 'Brazil');
});

test('unknown country returns null', () => {
  assert.equal(canonicalCountry('Atlantis'), null);
  assert.equal(canonicalCountry(''), null);
  assert.equal(canonicalCountry(null), null);
});

test('isKnownCountry returns boolean', () => {
  assert.equal(isKnownCountry('Brazil'), true);
  assert.equal(isKnownCountry('Atlantis'), false);
});
