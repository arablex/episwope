// netlify/functions/_lib/handlers/verify.mjs
import { hashEmail } from '../tokens.mjs';

export async function handleVerify({ token }, deps) {
  if (!token) return { status: 400, body: { error: 'missing_token' } };
  const rec = await deps.findByVerifyToken(token);
  if (!rec) return { status: 404, body: { error: 'unknown_token' } };

  if (rec.status === 'pending') {
    rec.status = 'verified';
    rec.verifiedAt = deps.now().toISOString();
    const key = rec.__key || hashEmail(rec.email);
    await deps.putSubscriber(key, rec);
  }
  // If the subscriber later unsubscribed, the verify link is stale —
  // route them to the unsubscribed page rather than misleadingly claiming
  // they're now signed up.
  if (rec.status === 'unsubscribed') {
    return { status: 302, location: '/unsubscribed.html' };
  }
  return { status: 302, location: '/thanks-subscribe.html' };
}
