// TEMPORARY — grant Pro to a specific email, then this file is removed.
// Guarded by an unguessable path secret.

import { markPaid, getSubscriberPlan } from './_lib/paid.mjs';

const SECRET = 'bff10cd418635119cc3f7923';
const J = (o, s = 200) => new Response(JSON.stringify(o, null, 2),
  { status: s, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get('s') !== SECRET) return new Response('not found', { status: 404 });

  const email = (url.searchParams.get('email') || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return J({ error: 'bad_email' }, 400);

  const paid_until = '2031-01-01T00:00:00.000Z'; // long-lived comp Pro
  try {
    await markPaid(email, {
      stripe_customer_id: 'comp',
      stripe_subscription_id: 'comp',
      paid_until,
    });
    const now = await getSubscriberPlan(email);
    return J({ ok: true, email, granted: now });
  } catch (e) {
    return J({ ok: false, error: e.message }, 500);
  }
};

export const config = { path: '/api/tmp-grantpro' };
