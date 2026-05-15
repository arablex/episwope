/**
 * Save or delete a Web Push subscription.
 * POST { subscription, lang, action }  — action: 'subscribe'|'unsubscribe'
 * Keyed by endpoint hash so re-subscribing is idempotent.
 * Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (set in Netlify dashboard)
 */
import { getStore } from '@netlify/blobs';
import { createHash }  from 'crypto';

function pushStore() {
  return getStore({ name: 'push-subscriptions', consistency: 'strong' });
}

function endpointKey(endpoint) {
  return createHash('sha256').update(endpoint).digest('hex').slice(0, 32);
}

export default async (req) => {
  const cors = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: cors });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: cors });
  }

  const { subscription, lang = 'en', action = 'subscribe' } = body;
  if (!subscription?.endpoint) {
    return new Response(JSON.stringify({ error: 'missing_subscription' }), { status: 400, headers: cors });
  }

  const key = endpointKey(subscription.endpoint);
  const store = pushStore();

  if (action === 'unsubscribe') {
    await store.delete(key);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors });
  }

  await store.setJSON(key, {
    subscription,
    lang,
    createdAt: new Date().toISOString(),
  });

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors });
};

export const config = { path: '/api/push-subscribe' };
