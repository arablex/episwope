// netlify/functions/subscribe.mjs
import { handleSubscribe } from './_lib/handlers/subscribe.mjs';
import { getSubscriber, putSubscriber } from './_lib/blobs.mjs';
import { sendEmail } from './_lib/resend.mjs';
import { randomToken } from './_lib/tokens.mjs';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  let input;
  try {
    input = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Hand the handler the same dep contract the tests use:
  // getSubscriber(key) and putSubscriber(key, rec), both keyed by hash.
  const deps = {
    getSubscriber,        // (key) => record | null
    putSubscriber,        // (key, rec) => void
    sendEmail,            // ({to, subject, html, text}) => Promise
    randomToken,
    now: () => new Date(),
    siteOrigin: new URL(req.url).origin,
  };

  const { status, body } = await handleSubscribe(input, deps);
  return new Response(JSON.stringify(body || {}), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { path: '/api/subscribe' };
