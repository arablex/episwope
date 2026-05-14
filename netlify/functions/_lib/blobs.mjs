// netlify/functions/_lib/blobs.mjs
import { getStore } from '@netlify/blobs';

const STORE_NAME = 'subscribers';

function store() {
  return getStore({ name: STORE_NAME, consistency: 'strong' });
}

/** Read a subscriber record by sha256(email). Returns null if missing. */
export async function getSubscriber(emailHash) {
  const json = await store().get(emailHash, { type: 'json' });
  return json || null;
}

/** Write a subscriber record. */
export async function putSubscriber(emailHash, record) {
  await store().setJSON(emailHash, record);
}

/** Remove a subscriber (used for stale pending sweeps). */
export async function deleteSubscriber(emailHash) {
  await store().delete(emailHash);
}

/** Iterate ALL subscribers (used by the digest cron from Python via a tiny lister endpoint, NOT yet implemented in Phase 1). */
export async function listSubscribers() {
  const { blobs } = await store().list();
  const records = [];
  for (const b of blobs) {
    const json = await store().get(b.key, { type: 'json' });
    if (json) records.push(json);
  }
  return records;
}
