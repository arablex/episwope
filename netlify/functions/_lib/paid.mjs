// netlify/functions/_lib/paid.mjs
// Read/write paid-plan status in the existing 'subscribers' Blobs store.
// Adds plan/paid_until/stripe_* fields to the subscriber record.

import { getSubscriber, putSubscriber } from './blobs.mjs';
import { hashEmail } from './tokens.mjs';

// Founder / internal accounts — always top tier (testing all reports,
// premium features, B2B packs). Bypasses Stripe/Blobs entirely so it
// can't be lost on a store reset.
const FOUNDER_EMAILS = new Set([
  'aleksey.stepikin@gmail.com',
  'xqrmedia@gmail.com',
]);
const FOUNDER_PLAN = { plan: 'pro', paid_until: '2099-12-31T00:00:00.000Z' };

/** Return {plan, paid_until} for an email. Defaults to free if no record. */
export async function getSubscriberPlan(email) {
  const norm = String(email || '').trim().toLowerCase();
  if (FOUNDER_EMAILS.has(norm)) return { ...FOUNDER_PLAN };
  const rec = await getSubscriber(hashEmail(email));
  return {
    plan:       rec?.plan       ?? 'free',
    paid_until: rec?.paid_until ?? null,
  };
}

/** Mark subscriber as paid. Creates a minimal record if none exists yet. */
export async function markPaid(email, { stripe_customer_id, stripe_subscription_id, paid_until }) {
  const hash = hashEmail(email);
  const existing = await getSubscriber(hash) ?? {
    email:     String(email).trim().toLowerCase(),
    status:    'verified',
    countries: [],
    lang:      'en',
    createdAt: new Date().toISOString(),
  };
  await putSubscriber(hash, {
    ...existing,
    plan:                   'pro',
    paid_until,
    stripe_customer_id,
    stripe_subscription_id,
    updatedAt: new Date().toISOString(),
  });
}

/** Downgrade subscriber to free (subscription cancelled / payment failed). */
export async function markFree(email) {
  const hash = hashEmail(email);
  const rec  = await getSubscriber(hash);
  if (!rec) return;
  await putSubscriber(hash, {
    ...rec,
    plan:       'free',
    paid_until: null,
    updatedAt:  new Date().toISOString(),
  });
}

/** True iff paid_until is set and is in the future. */
export function isPaidActive(paid_until) {
  return !!paid_until && new Date(paid_until) > new Date();
}
