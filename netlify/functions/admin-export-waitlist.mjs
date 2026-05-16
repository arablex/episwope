// netlify/functions/admin-export-waitlist.mjs
// GET /api/admin/export-waitlist  (Authorization: Bearer EPISCOPE_TOKEN_SECRET)
// Returns the Pro-interest waitlist + counts for validation analysis.

import { getStore } from '@netlify/blobs';
import { checkBearerAuth } from './_lib/auth.mjs';

export default async (req) => {
  if (!checkBearerAuth(req)) return new Response('forbidden', { status: 403 });

  const store = getStore({ name: 'waitlist', consistency: 'strong' });
  const { blobs } = await store.list();
  const rows = [];
  for (const b of blobs) {
    const r = await store.get(b.key, { type: 'json' });
    if (r) rows.push(r);
  }
  rows.sort((a, b) => (b.first_seen || '').localeCompare(a.first_seen || ''));

  const bySource = {};
  for (const r of rows) bySource[r.source] = (bySource[r.source] || 0) + 1;

  return new Response(JSON.stringify({
    total: rows.length,
    by_source: bySource,
    by_lang: rows.reduce((a, r) => (a[r.lang] = (a[r.lang] || 0) + 1, a), {}),
    rows,
  }, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const config = { path: '/api/admin/export-waitlist' };
