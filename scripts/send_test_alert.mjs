// One-off: render the alert email (fixed template) on real events and send it
// via Resend to a chosen address. Run from CI (RESEND_API_KEY in env).
//   TEST_TO=you@example.com node scripts/send_test_alert.mjs
import { readFileSync } from 'node:fs';
import { renderAlertEmail } from '../netlify/functions/_lib/templates.mjs';
import { sendEmail }        from '../netlify/functions/_lib/resend.mjs';

const to = process.env.TEST_TO || process.argv[2];
if (!to) { console.error('No recipient (set TEST_TO)'); process.exit(1); }

const load = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')).events || []; } catch { return []; } };
let evs = [...load('public/events.json'), ...load('public/risk_events.json')]
  .filter((e) => e.country && (e.disease || e.headline || e.title || e.category));

const rank = (s) => typeof s === 'number' ? s
  : ({ minimal:0, low:1, moderate:2, warning:2, elevated:3, alert:3, severe:4, critical:5 }[String(s).toLowerCase()] ?? 0);
evs.sort((a, b) => rank(b.severity) - rank(a.severity));

// A varied sample (~18) so the email shows the real fixed layout.
const sample = evs.slice(0, 18);
const lang = (process.env.TEST_LANG === 'ru') ? 'ru' : 'en';

const { subject, html, text } = renderAlertEmail({ events: sample, lang });
await sendEmail({ to, subject, html, text });
console.log(`sent ${sample.length} events to ${to} — "${subject}"`);
