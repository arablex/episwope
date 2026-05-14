// netlify/functions/_lib/handlers/unsubscribe.mjs
import { hashEmail } from '../tokens.mjs';

export async function handleUnsubscribe({ token }, deps) {
  if (!token) return { status: 400, body: { error: 'missing_token' } };
  const rec = await deps.findByUnsubToken(token);
  if (!rec) return { status: 404, body: { error: 'unknown_token' } };

  if (rec.status !== 'unsubscribed') {
    rec.status = 'unsubscribed';
    const key = rec.__key || hashEmail(rec.email);
    await deps.putSubscriber(key, rec);
  }
  return { status: 302, location: '/unsubscribed.html' };
}
