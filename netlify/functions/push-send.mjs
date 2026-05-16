/**
 * Admin-only endpoint: broadcast a push notification to all subscribed devices.
 * POST { title, body, url, tag, lang? }
 * Secured by ADMIN_SECRET header (set in Netlify env).
 *
 * Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, ADMIN_SECRET
 */
import webpush      from 'web-push';
import { getStore } from '@netlify/blobs';

function pushStore() {
  return getStore({ name: 'push-subscriptions', consistency: 'strong' });
}

function cors(extra = {}) {
  return { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...extra };
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors({ 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret' }) });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: cors() });
  }

  // Auth check
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: cors() });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: cors() });
  }

  const { title = 'Vigilo Alert', body: msgBody = '', url = '/', tag = 'vigilo-alert', lang } = body;
  if (!msgBody) return new Response(JSON.stringify({ error: 'body_required' }), { status: 400, headers: cors() });

  webpush.setVapidDetails(
    'mailto:noreply@vigilo.cc',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );

  const store  = pushStore();
  const { blobs } = await store.list();

  const payload = JSON.stringify({ title, body: msgBody, url, tag });

  const results = await Promise.allSettled(
    blobs.map(async (b) => {
      const rec = await store.get(b.key, { type: 'json' });
      if (!rec?.subscription) return;
      if (lang && rec.lang !== lang) return; // optional lang filter
      try {
        await webpush.sendNotification(rec.subscription, payload);
        return { key: b.key, ok: true };
      } catch (e) {
        // 410 Gone = subscription expired; clean it up
        if (e.statusCode === 410) await store.delete(b.key);
        return { key: b.key, ok: false, status: e.statusCode };
      }
    })
  );

  const sent   = results.filter(r => r.status === 'fulfilled' && r.value?.ok).length;
  const failed = results.filter(r => r.status === 'fulfilled' && r.value && !r.value.ok).length;

  return new Response(JSON.stringify({ sent, failed, total: blobs.length }), { status: 200, headers: cors() });
};

export const config = { path: '/api/push-send' };
