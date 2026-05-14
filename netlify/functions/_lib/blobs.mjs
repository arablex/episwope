// netlify/functions/_lib/blobs.mjs
import { getStore } from '@netlify/blobs';

const STORE_NAME = 'subscribers';

function store() {
  return getStore({ name: STORE_NAME, consistency: 'strong' });
}

export async function getSubscriber(emailHash) {
  const json = await store().get(emailHash, { type: 'json' });
  return json || null;
}

export async function putSubscriber(emailHash, record) {
  await store().setJSON(emailHash, record);
}

export async function deleteSubscriber(emailHash) {
  await store().delete(emailHash);
}

/** Walk every blob and find the record whose verifyToken === t. O(n) — fine for Phase 1. */
export async function findByVerifyToken(t) {
  return findBy('verifyToken', t);
}

export async function findByUnsubToken(t) {
  return findBy('unsubToken', t);
}

export async function findByEmail(email) {
  return findBy('email', String(email).trim().toLowerCase());
}

async function findBy(field, value) {
  const s = store();
  const { blobs } = await s.list();
  for (const b of blobs) {
    const json = await s.get(b.key, { type: 'json' });
    if (json && json[field] === value) {
      json.__key = b.key;
      return json;
    }
  }
  return null;
}

export async function listAllVerified() {
  const s = store();
  const { blobs } = await s.list();
  const out = [];
  for (const b of blobs) {
    const json = await s.get(b.key, { type: 'json' });
    if (json && json.status === 'verified') {
      json.__key = b.key;
      out.push(json);
    }
  }
  return out;
}
