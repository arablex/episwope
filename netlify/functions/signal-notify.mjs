/**
 * POST /api/signal-notify
 *
 * Called by the client (app.html) when it detects a new URGENT/ALERT signal.
 * Sends a Web Push notification to:
 *   a) the specific subscription from the request body (immediate, from open tab)
 *   b) ALL stored subscriptions (for closed-tab delivery of high-confidence signals)
 *
 * Body: { signal: SignalObject, subscription?: PushSubscription }
 * Env:  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
 */
import webpush      from 'web-push';
import { getStore } from '@netlify/blobs';

function cors(extra = {}) {
  return { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...extra };
}

function pushStore() {
  return getStore({ name: 'push-subscriptions', consistency: 'strong' });
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: cors({
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      }),
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: cors() });
  }

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: cors() }); }

  const { signal } = body;
  if (!signal || !signal.disease) {
    return new Response(JSON.stringify({ error: 'signal_required' }), { status: 400, headers: cors() });
  }

  // Only deliver for alert+urgent with meaningful confidence
  if (signal.level === 'watch' || (signal.confidence || 0) < 0.55) {
    return new Response(JSON.stringify({ ok: true, skipped: 'low_confidence' }), { headers: cors() });
  }

  // Build notification payload
  const emoji = signal.level === 'urgent' ? '🚨' : '⚠️';
  const country = signal.country && signal.country !== 'XX' ? ` · ${signal.country}` : '';
  const ahead   = signal.hours_ahead_estimate
    ? ` · ⚡ ${signal.hours_ahead_estimate}h ahead`
    : '';

  const notifTitle = `${emoji} ${signal.level === 'urgent' ? 'URGENT' : 'Alert'}: ${signal.disease}`;
  const notifBody  = `${signal.source_count} sources · spike ${signal.spike_ratio}×${country}${ahead}`;
  const notifUrl   = '/app.html#signals';
  const notifTag   = `vigilo-signal-${signal.id || Date.now()}`;

  const payload = JSON.stringify({
    title: notifTitle,
    body:  notifBody,
    url:   notifUrl,
    tag:   notifTag,
    icon:  '/icon.svg',
    badge: '/icon.svg',
  });

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return new Response(JSON.stringify({ error: 'vapid_not_configured' }), { status: 503, headers: cors() });
  }

  webpush.setVapidDetails(
    'mailto:noreply@vigilo.cc',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );

  const store = pushStore();
  let sent = 0, failed = 0, stale = 0;

  try {
    const { blobs } = await store.list();

    await Promise.allSettled(
      blobs.map(async ({ key }) => {
        let sub;
        try { sub = JSON.parse(await store.get(key, { type: 'text' })); }
        catch { return; }
        if (!sub?.endpoint) return;

        try {
          await webpush.sendNotification(sub, payload);
          sent++;
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            // Subscription expired — clean up
            await store.delete(key).catch(() => {});
            stale++;
          } else {
            failed++;
          }
        }
      })
    );
  } catch (err) {
    console.error('signal-notify store error', err);
  }

  return new Response(
    JSON.stringify({ ok: true, sent, failed, stale, level: signal.level }),
    { headers: cors() },
  );
};

export const config = { path: '/api/signal-notify' };
