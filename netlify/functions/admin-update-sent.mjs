// netlify/functions/admin-update-sent.mjs
import { getStore } from '@netlify/blobs';
import { checkBearerAuth } from './_lib/auth.mjs';

export default async (req) => {
  if (!checkBearerAuth(req)) {
    return new Response('forbidden', { status: 403 });
  }
  if (req.method !== 'POST') return new Response('method', { status: 405 });

  const body = await req.json(); // { at, sent: [[key, resendId], ...] }
  const store = getStore({ name: 'subscribers', consistency: 'strong' });
  let updated = 0;
  for (const [key, _resendId] of body.sent || []) {
    const rec = await store.get(key, { type: 'json' });
    if (!rec) continue;
    rec.lastDigestSentAt = body.at;
    await store.setJSON(key, rec);
    updated++;
  }
  return new Response(JSON.stringify({ updated }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { path: '/api/admin/update-sent' };
