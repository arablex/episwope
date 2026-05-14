// netlify/functions/verify.mjs
import { handleVerify } from './_lib/handlers/verify.mjs';
import { findByVerifyToken, putSubscriber } from './_lib/blobs.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('t') || '';
  const deps = {
    findByVerifyToken,
    putSubscriber,
    now: () => new Date(),
  };
  const res = await handleVerify({ token }, deps);
  if (res.status === 302) {
    return Response.redirect(`${url.origin}${res.location}`, 302);
  }
  return new Response(JSON.stringify(res.body || {}), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { path: '/api/verify' };
