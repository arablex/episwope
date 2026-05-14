// netlify/functions/resend-webhook.mjs
import { handleResendWebhook } from './_lib/handlers/webhook.mjs';
import { findByEmail, putSubscriber } from './_lib/blobs.mjs';
import { verifySvixSignature } from './_lib/svix.mjs';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('method', { status: 405 });
  }

  // Read RAW body once, so we can both verify the signature (which is computed
  // over the exact bytes) AND parse JSON for the handler.
  let rawBody;
  try {
    rawBody = await req.text();
  } catch {
    return new Response('bad body', { status: 400 });
  }

  // Resend signs deliveries via Svix. Verify when a secret is configured.
  // Without a configured secret the endpoint accepts any POST — fine for
  // staging, but PRODUCTION should always set RESEND_WEBHOOK_SECRET.
  const sigSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (sigSecret) {
    const ok = verifySvixSignature({
      headers: req.headers,
      rawBody,
      secret: sigSecret,
    });
    if (!ok) return new Response('forbidden', { status: 403 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('bad json', { status: 400 });
  }

  const deps = { findByEmail, putSubscriber };
  const res = await handleResendWebhook(event, deps);
  return new Response(JSON.stringify(res.body || {}), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { path: '/api/resend-webhook' };
