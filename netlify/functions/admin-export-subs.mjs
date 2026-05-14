// netlify/functions/admin-export-subs.mjs
import { listAllVerified } from './_lib/blobs.mjs';
import { checkBearerAuth } from './_lib/auth.mjs';

export default async (req) => {
  if (!checkBearerAuth(req)) {
    return new Response('forbidden', { status: 403 });
  }
  const subs = await listAllVerified();
  return new Response(JSON.stringify(subs), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { path: '/api/admin/export-subs' };
