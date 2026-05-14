import { listAllVerified } from './_lib/blobs.mjs';

export default async (req) => {
  const expected = process.env.EPISCOPE_TOKEN_SECRET;
  const auth = req.headers.get('authorization') || '';
  if (!expected || auth !== `Bearer ${expected}`) {
    return new Response('forbidden', { status: 403 });
  }
  const subs = await listAllVerified();
  return new Response(JSON.stringify(subs), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { path: '/api/admin/export-subs' };
