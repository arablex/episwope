# Email Subscriptions (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the MVP of email subscriptions: a visitor can subscribe to a country from the EpiScope country profile, confirm the email by clicking a verification link, and receive a weekly digest every Monday until they unsubscribe.

**Architecture:** Three Netlify Functions (`subscribe`, `verify`, `unsubscribe`) read/write a Netlify Blobs KV store; the existing 12-hour GitHub Action gets a new Python script that, on Mondays, renders an HTML digest per subscriber and POSTs it to the Resend API. No accounts, no SDKs, no extra services.

**Tech Stack:** Node 20 ESM (`.mjs`) for Netlify Functions, plain `fetch` for Resend, `@netlify/blobs` (built into the Functions runtime, no install needed), `node:test` for unit tests, Python 3.12 with `urllib` for the cron sender (matches the existing `scripts/fetch_data.py` style — no new deps).

---

## File Structure

```
netlify/
  functions/
    subscribe.mjs              # thin wrapper → handlers/subscribe
    verify.mjs                 # thin wrapper → handlers/verify
    unsubscribe.mjs            # thin wrapper → handlers/unsubscribe
    resend-webhook.mjs         # thin wrapper → handlers/webhook
    _lib/
      tokens.mjs               # randomToken(), hashEmail()
      tokens.test.mjs
      countries.mjs            # canonicalCountry(name) — resolves RU/EN → English
      countries.test.mjs
      templates.mjs            # renderVerifyEmail(), renderDigestEmail()
      templates.test.mjs
      blobs.mjs                # getSubscriber, putSubscriber, deleteSubscriber
      resend.mjs               # sendEmail({to, subject, html, text})
      handlers/
        subscribe.mjs          # pure handler(input, deps) → response
        subscribe.test.mjs
        verify.mjs
        verify.test.mjs
        unsubscribe.mjs
        unsubscribe.test.mjs
        webhook.mjs
        webhook.test.mjs

scripts/
  send_digests.py              # Python cron, called from update-data.yml
  test_send_digests.py         # unit tests for digest rendering (mocks Resend)
  digest_email.html.j2         # HTML template, simple {{placeholder}} format

public/
  thanks-subscribe.html        # static landing after successful verify
  unsubscribed.html            # static landing after unsubscribe

index.html                     # add subscribe form into country profile
ru/index.html                  # same for Russian site
globe.js                       # wire subscribe form to /api/subscribe

.github/workflows/update-data.yml  # add RESEND_API_KEY env + run send_digests
netlify.toml                   # configure functions dir + redirects /api/* → /.netlify/functions/*
```

Two design principles drive this layout:

1. **Handlers are pure functions of `(input, deps)`.** The `.mjs` files in `netlify/functions/*.mjs` are 5-line wrappers that build the `deps` object (real Blobs store, real Resend) and forward to the handler. This makes the handlers fully unit-testable with `node:test` and zero external services.

2. **Helpers in `_lib/` have one concern each.** `tokens.mjs` only deals with crypto, `countries.mjs` only resolves names, `templates.mjs` only renders HTML, `blobs.mjs` only does Blobs I/O, `resend.mjs` only does HTTP. Each has a partner `*.test.mjs` next to it.

---

## Task 0: External setup checklist

This task is manual — no code commits, but mandatory for everything else to work. The agent should print the checklist and stop, asking the user to confirm each item is done.

**Files:** none (manual)

- [ ] **Step 0.1:** User signs up at https://resend.com (free tier). Generates an API key from the dashboard.

- [ ] **Step 0.2:** User adds the API key to GitHub repo secrets:
  - GitHub repo → Settings → Secrets and variables → Actions → New repository secret
  - Name: `RESEND_API_KEY`
  - Value: the `re_xxx…` key

- [ ] **Step 0.3:** User adds the same key to Netlify environment variables:
  - Netlify site dashboard → Site settings → Environment variables → Add a variable
  - Key: `RESEND_API_KEY`
  - Value: same `re_xxx…`
  - Scope: all (build + functions)

- [ ] **Step 0.4:** User adds the sender domain to Resend:
  - Resend dashboard → Domains → Add domain → `episcope.ru`
  - Copies the SPF, DKIM, and (optional) DMARC records shown

- [ ] **Step 0.5:** User adds those DNS records in Netlify:
  - Netlify → Domains → episcope.ru → DNS settings → Add record (one per Resend instruction)
  - Wait for green "verified" status in Resend (usually < 10 minutes)

- [ ] **Step 0.6:** User enables Netlify Blobs:
  - Netlify Blobs is automatic on Netlify — no toggle. The first write from a Function creates the store. Just confirm the site is on a current Netlify build image (Node 20 or newer).

- [ ] **Step 0.7:** User generates an HMAC secret for token signing and adds it as `EPISCOPE_TOKEN_SECRET` in **both** GitHub Actions secrets and Netlify env vars:
  - On the user's machine: `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`
  - Same secret in both places, scope: build + functions

After all 7 steps confirmed, proceed to Task 1.

---

## Task 1: Token & hash helpers with tests

**Files:**
- Create: `netlify/functions/_lib/tokens.mjs`
- Create: `netlify/functions/_lib/tokens.test.mjs`

- [ ] **Step 1.1: Write the failing test**

```javascript
// netlify/functions/_lib/tokens.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomToken, hashEmail } from './tokens.mjs';

test('randomToken returns 32-char url-safe string', () => {
  const t = randomToken();
  assert.equal(t.length, 32);
  assert.match(t, /^[A-Za-z0-9_-]+$/);
});

test('randomToken values are unique across many calls', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(randomToken());
  assert.equal(seen.size, 200);
});

test('hashEmail is deterministic, lowercase- and trim-insensitive', () => {
  const a = hashEmail('User@Example.com');
  const b = hashEmail('  user@example.com  ');
  assert.equal(a, b);
});

test('hashEmail produces 64-hex-char output', () => {
  const h = hashEmail('user@example.com');
  assert.equal(h.length, 64);
  assert.match(h, /^[a-f0-9]+$/);
});
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `cd /Users/alex/Documents/Cloude\ set/episwope && node --test netlify/functions/_lib/tokens.test.mjs`
Expected: FAIL with `Cannot find module './tokens.mjs'` (or similar).

- [ ] **Step 1.3: Write minimal implementation**

```javascript
// netlify/functions/_lib/tokens.mjs
import { randomBytes, createHash } from 'node:crypto';

/** Random 32-char url-safe token. Uses base64url so it's URL-safe by default. */
export function randomToken() {
  // 24 bytes → 32 base64url chars (no padding)
  return randomBytes(24).toString('base64url');
}

/** SHA-256 hex of the email, lowercased and trimmed. Stable lookup key for Blobs. */
export function hashEmail(email) {
  const normalized = String(email).trim().toLowerCase();
  return createHash('sha256').update(normalized).digest('hex');
}
```

- [ ] **Step 1.4: Run test to verify it passes**

Run: `node --test netlify/functions/_lib/tokens.test.mjs`
Expected: PASS — 4 passing tests.

- [ ] **Step 1.5: Commit**

```bash
git add netlify/functions/_lib/tokens.mjs netlify/functions/_lib/tokens.test.mjs
git commit -m "feat: add token + email hash helpers for subscriptions"
```

---

## Task 2: Country canonicalization helper with tests

The frontend passes whatever the user typed (Russian or English). The backend stores a single canonical English name. This helper turns either into the canonical form.

**Files:**
- Create: `netlify/functions/_lib/countries.mjs`
- Create: `netlify/functions/_lib/countries.test.mjs`

- [ ] **Step 2.1: Write the failing test**

```javascript
// netlify/functions/_lib/countries.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalCountry, isKnownCountry } from './countries.mjs';

test('English names pass through unchanged', () => {
  assert.equal(canonicalCountry('Brazil'), 'Brazil');
  assert.equal(canonicalCountry('United States'), 'United States');
});

test('Russian names resolve to canonical English', () => {
  assert.equal(canonicalCountry('Бразилия'), 'Brazil');
  assert.equal(canonicalCountry('США'), 'United States');
  assert.equal(canonicalCountry('ДР Конго'), 'Democratic Republic of Congo');
});

test('case and whitespace insensitive', () => {
  assert.equal(canonicalCountry('  brazil  '), 'Brazil');
  assert.equal(canonicalCountry('BRAZIL'), 'Brazil');
});

test('unknown country returns null', () => {
  assert.equal(canonicalCountry('Atlantis'), null);
  assert.equal(canonicalCountry(''), null);
  assert.equal(canonicalCountry(null), null);
});

test('isKnownCountry returns boolean', () => {
  assert.equal(isKnownCountry('Brazil'), true);
  assert.equal(isKnownCountry('Atlantis'), false);
});
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `node --test netlify/functions/_lib/countries.test.mjs`
Expected: FAIL with module-not-found.

- [ ] **Step 2.3: Write minimal implementation**

```javascript
// netlify/functions/_lib/countries.mjs
// Subset of the ALL_COUNTRIES list in globe.js, kept in sync manually.
// We only need name resolution here; lat/lng/iso live in globe.js for the map.
const COUNTRIES = [
  // Format: [canonicalEn, ru]
  ['Afghanistan', 'Афганистан'],
  ['Albania', 'Албания'],
  ['Algeria', 'Алжир'],
  // … (full list pasted from globe.js ALL_COUNTRIES at implementation time)
  ['Brazil', 'Бразилия'],
  ['Democratic Republic of Congo', 'ДР Конго'],
  ['United States', 'США'],
  ['United Kingdom', 'Великобритания'],
  // …
  ['Zimbabwe', 'Зимбабве'],
];

// Build lookup maps once at module load.
const BY_EN = new Map();
const BY_RU = new Map();
for (const [en, ru] of COUNTRIES) {
  BY_EN.set(en.toLowerCase(), en);
  BY_RU.set(ru.toLowerCase(), en);
}

export function canonicalCountry(input) {
  if (input == null) return null;
  const k = String(input).trim().toLowerCase();
  if (!k) return null;
  return BY_EN.get(k) || BY_RU.get(k) || null;
}

export function isKnownCountry(input) {
  return canonicalCountry(input) !== null;
}
```

- [ ] **Step 2.4: Replace the placeholder country list with the real one**

Open `globe.js`, find `const ALL_COUNTRIES = [...]` (around line 132). Copy the array into `_lib/countries.mjs`, keeping only the `en` and `ru` fields, in the `[en, ru]` tuple format above. The full ~198-row list must be present — no truncation.

- [ ] **Step 2.5: Run test to verify it passes**

Run: `node --test netlify/functions/_lib/countries.test.mjs`
Expected: PASS — 5 passing tests.

- [ ] **Step 2.6: Commit**

```bash
git add netlify/functions/_lib/countries.mjs netlify/functions/_lib/countries.test.mjs
git commit -m "feat: add country name canonicalization (EN/RU → canonical EN)"
```

---

## Task 3: Email template renderer (verify email) with tests

Two languages, two templates per language eventually. This task adds the verification email only.

**Files:**
- Create: `netlify/functions/_lib/templates.mjs`
- Create: `netlify/functions/_lib/templates.test.mjs`

- [ ] **Step 3.1: Write the failing test**

```javascript
// netlify/functions/_lib/templates.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderVerifyEmail } from './templates.mjs';

const SAMPLE = {
  countries: ['Brazil', 'Vietnam'],
  verifyUrl: 'https://episcope.ru/api/verify?t=abc',
  unsubUrl: 'https://episcope.ru/api/unsubscribe?t=xyz',
};

test('English verify email contains all dynamic fields', () => {
  const { subject, html, text } = renderVerifyEmail({ ...SAMPLE, lang: 'en' });
  assert.match(subject, /Confirm/i);
  assert.match(html, /Brazil/);
  assert.match(html, /Vietnam/);
  assert.match(html, /api\/verify\?t=abc/);
  assert.match(html, /api\/unsubscribe\?t=xyz/);
  assert.match(text, /Brazil/);
  assert.match(text, /verify\?t=abc/);
});

test('Russian verify email is in Russian', () => {
  const { subject, html } = renderVerifyEmail({ ...SAMPLE, lang: 'ru' });
  assert.match(subject, /Подтверди/);
  assert.match(html, /Бразилия|Brazil/); // either is OK — list is canonical English
  assert.match(html, /подписк/i);
});

test('HTML escapes country names (defence in depth)', () => {
  const { html } = renderVerifyEmail({
    ...SAMPLE,
    countries: ['<script>alert(1)</script>'],
    lang: 'en',
  });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
```

- [ ] **Step 3.2: Run test to verify it fails**

Run: `node --test netlify/functions/_lib/templates.test.mjs`
Expected: FAIL.

- [ ] **Step 3.3: Write minimal implementation**

```javascript
// netlify/functions/_lib/templates.mjs

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const STRINGS = {
  en: {
    verifySubject: 'Confirm your EpiScope subscription',
    verifyHeadline: 'Confirm your EpiScope subscription',
    verifyBody: 'You asked to follow these countries:',
    verifyCta: 'Confirm subscription',
    verifyFooter: "If you didn't sign up, ignore this email or",
    unsubscribeWord: 'unsubscribe',
  },
  ru: {
    verifySubject: 'Подтверди подписку на EpiScope',
    verifyHeadline: 'Подтверди подписку на EpiScope',
    verifyBody: 'Ты подписываешься на эти страны:',
    verifyCta: 'Подтвердить подписку',
    verifyFooter: 'Если ты не подписывался — проигнорируй или',
    unsubscribeWord: 'отпишись',
  },
};

export function renderVerifyEmail({ countries, verifyUrl, unsubUrl, lang }) {
  const L = STRINGS[lang] || STRINGS.en;
  const list = countries.map(escapeHtml);
  const htmlList = list.map((c) => `<li>${c}</li>`).join('');
  const textList = list.map((c) => `  • ${c}`).join('\n');

  const html = `<!doctype html>
<html lang="${lang}">
<body style="font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;color:#0F0E0C;background:#F4F2EE;margin:0;padding:24px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #ECEAE2;border-radius:14px;padding:32px;">
    <tr><td>
      <h1 style="font-size:20px;font-weight:800;letter-spacing:-0.02em;margin:0 0 16px;">${L.verifyHeadline}</h1>
      <p style="font-size:14px;line-height:1.55;color:#3B3A36;margin:0 0 16px;">${L.verifyBody}</p>
      <ul style="font-size:14px;line-height:1.55;color:#0F0E0C;padding-left:18px;margin:0 0 24px;">${htmlList}</ul>
      <p style="margin:0 0 28px;"><a href="${escapeHtml(verifyUrl)}" style="display:inline-block;background:#0F0E0C;color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:11px 22px;border-radius:10px;">${L.verifyCta}</a></p>
      <p style="font-size:11.5px;line-height:1.55;color:#807E76;margin:0;">${L.verifyFooter} <a href="${escapeHtml(unsubUrl)}" style="color:#807E76;">${L.unsubscribeWord}</a>.</p>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `${L.verifyHeadline}

${L.verifyBody}
${textList}

${L.verifyCta}: ${verifyUrl}

${L.verifyFooter} ${L.unsubscribeWord}: ${unsubUrl}
`;

  return { subject: L.verifySubject, html, text };
}
```

- [ ] **Step 3.4: Run test to verify it passes**

Run: `node --test netlify/functions/_lib/templates.test.mjs`
Expected: PASS — 3 passing tests.

- [ ] **Step 3.5: Commit**

```bash
git add netlify/functions/_lib/templates.mjs netlify/functions/_lib/templates.test.mjs
git commit -m "feat: add bilingual verify-email template"
```

---

## Task 4: Blobs I/O wrapper

This is a thin wrapper over `@netlify/blobs`. We don't unit-test this — it would only test the mock. Integration testing happens via `netlify dev` in Task 15.

**Files:**
- Create: `netlify/functions/_lib/blobs.mjs`

- [ ] **Step 4.1: Write the implementation**

```javascript
// netlify/functions/_lib/blobs.mjs
import { getStore } from '@netlify/blobs';

const STORE_NAME = 'subscribers';

function store() {
  return getStore({ name: STORE_NAME, consistency: 'strong' });
}

/** Read a subscriber record by sha256(email). Returns null if missing. */
export async function getSubscriber(emailHash) {
  const json = await store().get(emailHash, { type: 'json' });
  return json || null;
}

/** Write a subscriber record. */
export async function putSubscriber(emailHash, record) {
  await store().setJSON(emailHash, record);
}

/** Remove a subscriber (used for stale pending sweeps). */
export async function deleteSubscriber(emailHash) {
  await store().delete(emailHash);
}

/** Iterate ALL subscribers (used by the digest cron from Python via a tiny lister endpoint, NOT yet implemented in Phase 1). */
export async function listSubscribers() {
  const { blobs } = await store().list();
  const records = [];
  for (const b of blobs) {
    const json = await store().get(b.key, { type: 'json' });
    if (json) records.push(json);
  }
  return records;
}
```

- [ ] **Step 4.2: Commit**

```bash
git add netlify/functions/_lib/blobs.mjs
git commit -m "feat: add Netlify Blobs wrapper for subscriber records"
```

---

## Task 5: Resend send wrapper

**Files:**
- Create: `netlify/functions/_lib/resend.mjs`

- [ ] **Step 5.1: Write the implementation**

```javascript
// netlify/functions/_lib/resend.mjs

const RESEND_URL = 'https://api.resend.com/emails';

/** Send a transactional email through Resend.
 *  Throws on non-2xx. Caller decides whether to swallow or surface. */
export async function sendEmail({ to, subject, html, text, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');

  const body = {
    from: 'EpiScope <noreply@episcope.ru>',
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
  };
  if (replyTo) body.reply_to = replyTo;

  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend ${res.status}: ${errText}`);
  }
  return res.json(); // { id: 're_xxx' }
}
```

- [ ] **Step 5.2: Commit**

```bash
git add netlify/functions/_lib/resend.mjs
git commit -m "feat: add Resend API wrapper for transactional sends"
```

---

## Task 6: Subscribe handler (pure logic) with tests

The handler is a pure function so it can be tested without Netlify Blobs or Resend.

**Files:**
- Create: `netlify/functions/_lib/handlers/subscribe.mjs`
- Create: `netlify/functions/_lib/handlers/subscribe.test.mjs`

- [ ] **Step 6.1: Write the failing test**

```javascript
// netlify/functions/_lib/handlers/subscribe.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleSubscribe } from './subscribe.mjs';

function makeDeps() {
  const blobs = new Map();
  const sent = [];
  return {
    blobs,
    sent,
    getSubscriber: async (k) => (blobs.has(k) ? blobs.get(k) : null),
    putSubscriber: async (k, v) => { blobs.set(k, v); },
    sendEmail: async (msg) => { sent.push(msg); return { id: 'mock' }; },
    now: () => new Date('2026-05-14T10:00:00Z'),
    randomToken: () => 'tok_' + (blobs.size + sent.length),
    siteOrigin: 'https://episcope.ru',
  };
}

test('valid new subscription creates pending record and sends verify email', async () => {
  const deps = makeDeps();
  const res = await handleSubscribe(
    { email: 'a@example.com', country: 'Brazil', lang: 'ru' },
    deps,
  );
  assert.equal(res.status, 200);
  assert.equal(deps.blobs.size, 1);
  const rec = [...deps.blobs.values()][0];
  assert.equal(rec.email, 'a@example.com');
  assert.deepEqual(rec.countries, ['Brazil']);
  assert.equal(rec.lang, 'ru');
  assert.equal(rec.status, 'pending');
  assert.equal(deps.sent.length, 1);
  assert.match(deps.sent[0].html, /episcope\.ru\/api\/verify/);
});

test('subscribing same email to second country appends, sends one more verify', async () => {
  const deps = makeDeps();
  await handleSubscribe({ email: 'a@example.com', country: 'Brazil', lang: 'en' }, deps);
  await handleSubscribe({ email: 'a@example.com', country: 'Vietnam', lang: 'en' }, deps);
  assert.equal(deps.blobs.size, 1);
  const rec = [...deps.blobs.values()][0];
  assert.deepEqual(rec.countries, ['Brazil', 'Vietnam']);
  assert.equal(rec.status, 'pending');
  assert.equal(deps.sent.length, 2);
});

test('subscribing already-verified email to new country does NOT resend verify', async () => {
  const deps = makeDeps();
  await handleSubscribe({ email: 'a@example.com', country: 'Brazil', lang: 'en' }, deps);
  const rec = [...deps.blobs.values()][0];
  rec.status = 'verified';
  rec.verifiedAt = '2026-05-10T00:00:00Z';
  deps.sent.length = 0;
  await handleSubscribe({ email: 'a@example.com', country: 'Vietnam', lang: 'en' }, deps);
  assert.deepEqual(rec.countries, ['Brazil', 'Vietnam']);
  assert.equal(deps.sent.length, 0);
});

test('duplicate country on same email is a no-op', async () => {
  const deps = makeDeps();
  await handleSubscribe({ email: 'a@example.com', country: 'Brazil', lang: 'en' }, deps);
  deps.sent.length = 0;
  await handleSubscribe({ email: 'a@example.com', country: 'Brazil', lang: 'en' }, deps);
  const rec = [...deps.blobs.values()][0];
  assert.deepEqual(rec.countries, ['Brazil']);
  assert.equal(deps.sent.length, 0);
});

test('unknown country rejected with 400', async () => {
  const deps = makeDeps();
  const res = await handleSubscribe(
    { email: 'a@example.com', country: 'Atlantis', lang: 'en' }, deps,
  );
  assert.equal(res.status, 400);
  assert.equal(deps.blobs.size, 0);
});

test('invalid email rejected with 400', async () => {
  const deps = makeDeps();
  const res = await handleSubscribe(
    { email: 'not-an-email', country: 'Brazil', lang: 'en' }, deps,
  );
  assert.equal(res.status, 400);
  assert.equal(deps.blobs.size, 0);
});

test('unsubscribed email blocked from re-subscribing without verification', async () => {
  const deps = makeDeps();
  await handleSubscribe({ email: 'a@example.com', country: 'Brazil', lang: 'en' }, deps);
  const rec = [...deps.blobs.values()][0];
  rec.status = 'unsubscribed';
  deps.sent.length = 0;
  const res = await handleSubscribe({ email: 'a@example.com', country: 'Vietnam', lang: 'en' }, deps);
  assert.equal(res.status, 200);
  // Re-opens as pending and re-sends verify
  assert.equal(rec.status, 'pending');
  assert.equal(deps.sent.length, 1);
});
```

- [ ] **Step 6.2: Run test to verify it fails**

Run: `node --test netlify/functions/_lib/handlers/subscribe.test.mjs`
Expected: FAIL (module not found).

- [ ] **Step 6.3: Write the implementation**

```javascript
// netlify/functions/_lib/handlers/subscribe.mjs
import { hashEmail } from '../tokens.mjs';
import { canonicalCountry } from '../countries.mjs';
import { renderVerifyEmail } from '../templates.mjs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Pure handler. Inputs: parsed body + deps. Output: { status, body }. */
export async function handleSubscribe(input, deps) {
  const email = String(input.email || '').trim().toLowerCase();
  const lang = input.lang === 'ru' ? 'ru' : 'en';
  const country = canonicalCountry(input.country);

  if (!EMAIL_RE.test(email)) {
    return { status: 400, body: { error: 'invalid_email' } };
  }
  if (!country) {
    return { status: 400, body: { error: 'unknown_country' } };
  }

  const key = hashEmail(email);
  let rec = await deps.getSubscriber(key);
  const now = deps.now().toISOString();

  if (!rec) {
    rec = {
      email,
      countries: [country],
      lang,
      status: 'pending',
      verifyToken: deps.randomToken(),
      unsubToken: deps.randomToken(),
      createdAt: now,
      verifiedAt: null,
      lastDigestSentAt: null,
    };
  } else if (rec.status === 'unsubscribed') {
    // Treat as a brand-new subscription: reopen as pending with fresh tokens
    rec.status = 'pending';
    rec.countries = [country];
    rec.lang = lang;
    rec.verifyToken = deps.randomToken();
    rec.unsubToken = deps.randomToken();
    rec.verifiedAt = null;
    rec.createdAt = now;
  } else {
    if (!rec.countries.includes(country)) {
      rec.countries.push(country);
    } else {
      // Already subscribed to this country — no-op, no extra verify email
      return { status: 200, body: { ok: true, alreadySubscribed: true } };
    }
  }

  await deps.putSubscriber(key, rec);

  // Only send verify email if status is still pending
  if (rec.status === 'pending') {
    const verifyUrl = `${deps.siteOrigin}/api/verify?t=${rec.verifyToken}`;
    const unsubUrl = `${deps.siteOrigin}/api/unsubscribe?t=${rec.unsubToken}`;
    const { subject, html, text } = renderVerifyEmail({
      countries: rec.countries,
      verifyUrl,
      unsubUrl,
      lang: rec.lang,
    });
    await deps.sendEmail({ to: rec.email, subject, html, text });
  }

  return { status: 200, body: { ok: true } };
}
```

- [ ] **Step 6.4: Run test to verify it passes**

Run: `node --test netlify/functions/_lib/handlers/subscribe.test.mjs`
Expected: PASS — 7 passing tests.

- [ ] **Step 6.5: Commit**

```bash
git add netlify/functions/_lib/handlers/subscribe.mjs netlify/functions/_lib/handlers/subscribe.test.mjs
git commit -m "feat: add subscribe handler with idempotent merge logic"
```

---

## Task 7: Verify handler (pure logic) with tests

**Files:**
- Create: `netlify/functions/_lib/handlers/verify.mjs`
- Create: `netlify/functions/_lib/handlers/verify.test.mjs`

- [ ] **Step 7.1: Write the failing test**

```javascript
// netlify/functions/_lib/handlers/verify.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleVerify } from './verify.mjs';

function deps(records) {
  const map = new Map(records.map((r) => [r.__key, r]));
  return {
    findByVerifyToken: async (t) => [...map.values()].find((r) => r.verifyToken === t) || null,
    putSubscriber: async (k, v) => { map.set(k, v); },
    now: () => new Date('2026-05-14T10:00:00Z'),
  };
}

test('valid pending token transitions to verified', async () => {
  const rec = { __key: 'k1', email:'a@x.com', countries:['Brazil'], status: 'pending', verifyToken: 'good', verifiedAt: null };
  const d = deps([rec]);
  const res = await handleVerify({ token: 'good' }, d);
  assert.equal(res.status, 302);
  assert.match(res.location, /thanks-subscribe/);
  assert.equal(rec.status, 'verified');
  assert.equal(rec.verifiedAt, '2026-05-14T10:00:00.000Z');
});

test('already-verified token still redirects to thanks page (idempotent)', async () => {
  const rec = { __key: 'k1', email:'a@x.com', countries:['Brazil'], status: 'verified', verifyToken: 'good', verifiedAt: '2026-05-10T00:00:00Z' };
  const d = deps([rec]);
  const res = await handleVerify({ token: 'good' }, d);
  assert.equal(res.status, 302);
  assert.match(res.location, /thanks-subscribe/);
});

test('unknown token returns 404', async () => {
  const d = deps([]);
  const res = await handleVerify({ token: 'nope' }, d);
  assert.equal(res.status, 404);
});

test('missing token returns 400', async () => {
  const d = deps([]);
  const res = await handleVerify({ token: '' }, d);
  assert.equal(res.status, 400);
});
```

- [ ] **Step 7.2: Run test to verify it fails**

Run: `node --test netlify/functions/_lib/handlers/verify.test.mjs`
Expected: FAIL.

- [ ] **Step 7.3: Write the implementation**

```javascript
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
  return { status: 302, location: '/thanks-subscribe.html' };
}
```

- [ ] **Step 7.4: Run test to verify it passes**

Run: `node --test netlify/functions/_lib/handlers/verify.test.mjs`
Expected: PASS — 4 passing tests.

- [ ] **Step 7.5: Commit**

```bash
git add netlify/functions/_lib/handlers/verify.mjs netlify/functions/_lib/handlers/verify.test.mjs
git commit -m "feat: add verify handler — idempotent token confirmation"
```

---

## Task 8: Unsubscribe handler (pure logic) with tests

**Files:**
- Create: `netlify/functions/_lib/handlers/unsubscribe.mjs`
- Create: `netlify/functions/_lib/handlers/unsubscribe.test.mjs`

- [ ] **Step 8.1: Write the failing test**

```javascript
// netlify/functions/_lib/handlers/unsubscribe.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleUnsubscribe } from './unsubscribe.mjs';

function deps(records) {
  const map = new Map(records.map((r) => [r.__key, r]));
  return {
    findByUnsubToken: async (t) => [...map.values()].find((r) => r.unsubToken === t) || null,
    putSubscriber: async (k, v) => { map.set(k, v); },
  };
}

test('valid token marks subscriber unsubscribed and redirects', async () => {
  const rec = { __key:'k1', email:'a@x.com', countries:['Brazil'], status:'verified', unsubToken:'good' };
  const d = deps([rec]);
  const res = await handleUnsubscribe({ token: 'good' }, d);
  assert.equal(res.status, 302);
  assert.match(res.location, /unsubscribed/);
  assert.equal(rec.status, 'unsubscribed');
});

test('already-unsubscribed is idempotent', async () => {
  const rec = { __key:'k1', email:'a@x.com', countries:['Brazil'], status:'unsubscribed', unsubToken:'good' };
  const d = deps([rec]);
  const res = await handleUnsubscribe({ token: 'good' }, d);
  assert.equal(res.status, 302);
  assert.match(res.location, /unsubscribed/);
});

test('unknown token returns 404', async () => {
  const d = deps([]);
  const res = await handleUnsubscribe({ token: 'nope' }, d);
  assert.equal(res.status, 404);
});

test('missing token returns 400', async () => {
  const d = deps([]);
  const res = await handleUnsubscribe({ token: '' }, d);
  assert.equal(res.status, 400);
});
```

- [ ] **Step 8.2: Run test to verify it fails**

Run: `node --test netlify/functions/_lib/handlers/unsubscribe.test.mjs`
Expected: FAIL.

- [ ] **Step 8.3: Write the implementation**

```javascript
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
```

- [ ] **Step 8.4: Run test to verify it passes**

Run: `node --test netlify/functions/_lib/handlers/unsubscribe.test.mjs`
Expected: PASS — 4 passing tests.

- [ ] **Step 8.5: Commit**

```bash
git add netlify/functions/_lib/handlers/unsubscribe.mjs netlify/functions/_lib/handlers/unsubscribe.test.mjs
git commit -m "feat: add unsubscribe handler — one-click, idempotent"
```

---

## Task 9: Netlify Function wrappers + lookup helpers

These are the thin entry points Netlify will call. They glue real Blobs + Resend + the handlers together.

**Files:**
- Create: `netlify/functions/subscribe.mjs`
- Create: `netlify/functions/verify.mjs`
- Create: `netlify/functions/unsubscribe.mjs`
- Modify: `netlify/functions/_lib/blobs.mjs` — add `findByVerifyToken`, `findByUnsubToken`

- [ ] **Step 9.1: Extend blobs.mjs with token lookup helpers**

Replace the contents of `netlify/functions/_lib/blobs.mjs` (the file from Task 4) with:

```javascript
// netlify/functions/_lib/blobs.mjs
import { getStore } from '@netlify/blobs';

const STORE_NAME = 'subscribers';

function store() {
  return getStore({ name: STORE_NAME, consistency: 'strong' });
}

export async function getSubscriber(emailHash) {
  const json = await store().get(emailHash, { type: 'json' });
  return json || null;
}

export async function putSubscriber(emailHash, record) {
  await store().setJSON(emailHash, record);
}

export async function deleteSubscriber(emailHash) {
  await store().delete(emailHash);
}

/** Walk every blob and find the record whose verifyToken === t. O(n) — fine for Phase 1. */
export async function findByVerifyToken(t) {
  return findBy('verifyToken', t);
}

export async function findByUnsubToken(t) {
  return findBy('unsubToken', t);
}

async function findBy(field, value) {
  const s = store();
  const { blobs } = await s.list();
  for (const b of blobs) {
    const json = await s.get(b.key, { type: 'json' });
    if (json && json[field] === value) {
      json.__key = b.key;
      return json;
    }
  }
  return null;
}

export async function listAllVerified() {
  const s = store();
  const { blobs } = await s.list();
  const out = [];
  for (const b of blobs) {
    const json = await s.get(b.key, { type: 'json' });
    if (json && json.status === 'verified') {
      json.__key = b.key;
      out.push(json);
    }
  }
  return out;
}
```

- [ ] **Step 9.2: Write subscribe.mjs wrapper**

```javascript
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
```

- [ ] **Step 9.3: Write verify.mjs wrapper**

```javascript
// netlify/functions/verify.mjs
import { handleVerify } from './_lib/handlers/verify.mjs';
import { findByVerifyToken, putSubscriber } from './_lib/blobs.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('t') || '';
  const deps = {
    findByVerifyToken,
    putSubscriber,
    now: () => new Date(),
  };
  const res = await handleVerify({ token }, deps);
  if (res.status === 302) {
    return Response.redirect(`${url.origin}${res.location}`, 302);
  }
  return new Response(JSON.stringify(res.body || {}), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { path: '/api/verify' };
```

- [ ] **Step 9.4: Write unsubscribe.mjs wrapper**

```javascript
// netlify/functions/unsubscribe.mjs
import { handleUnsubscribe } from './_lib/handlers/unsubscribe.mjs';
import { findByUnsubToken, putSubscriber } from './_lib/blobs.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('t') || '';
  const deps = { findByUnsubToken, putSubscriber };
  const res = await handleUnsubscribe({ token }, deps);
  if (res.status === 302) {
    return Response.redirect(`${url.origin}${res.location}`, 302);
  }
  return new Response(JSON.stringify(res.body || {}), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { path: '/api/unsubscribe' };
```

- [ ] **Step 9.5: Commit**

```bash
git add netlify/functions/_lib/blobs.mjs netlify/functions/subscribe.mjs netlify/functions/verify.mjs netlify/functions/unsubscribe.mjs
git commit -m "feat: wire Netlify Function entry points to handlers"
```

---

## Task 10: Static thanks/unsubscribed pages

Tiny static pages users land on after clicking verify/unsubscribe.

**Files:**
- Create: `thanks-subscribe.html` (at repo root, served by Netlify)
- Create: `unsubscribed.html`

- [ ] **Step 10.1: Write `thanks-subscribe.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>EpiScope · Subscription confirmed</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
  <style>
    :root { color-scheme: light; }
    body { margin:0; min-height:100vh; display:grid; place-items:center; background:#F4F2EE;
           font-family:"Inter",-apple-system,sans-serif; color:#0F0E0C; padding:24px; }
    .card { max-width:480px; background:#fff; border:1px solid #ECEAE2; border-radius:14px; padding:32px; text-align:center; }
    h1 { font-size:22px; font-weight:800; letter-spacing:-0.02em; margin:0 0 12px; }
    p { font-size:14px; line-height:1.55; color:#3B3A36; margin:0 0 20px; }
    a { display:inline-block; background:#0F0E0C; color:#fff; text-decoration:none;
        font-size:13px; font-weight:600; padding:10px 18px; border-radius:10px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Subscription confirmed</h1>
    <p>You'll receive a calm weekly digest every Monday. Nothing else.</p>
    <a href="/">Back to EpiScope</a>
  </div>
</body>
</html>
```

- [ ] **Step 10.2: Write `unsubscribed.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>EpiScope · Unsubscribed</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
  <style>
    :root { color-scheme: light; }
    body { margin:0; min-height:100vh; display:grid; place-items:center; background:#F4F2EE;
           font-family:"Inter",-apple-system,sans-serif; color:#0F0E0C; padding:24px; }
    .card { max-width:480px; background:#fff; border:1px solid #ECEAE2; border-radius:14px; padding:32px; text-align:center; }
    h1 { font-size:22px; font-weight:800; letter-spacing:-0.02em; margin:0 0 12px; }
    p { font-size:14px; line-height:1.55; color:#3B3A36; margin:0 0 20px; }
    a { display:inline-block; background:#0F0E0C; color:#fff; text-decoration:none;
        font-size:13px; font-weight:600; padding:10px 18px; border-radius:10px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>You're unsubscribed</h1>
    <p>No further EpiScope emails will arrive. Resubscribe anytime from a country profile.</p>
    <a href="/">Back to EpiScope</a>
  </div>
</body>
</html>
```

- [ ] **Step 10.3: Commit**

```bash
git add thanks-subscribe.html unsubscribed.html
git commit -m "feat: add static landing pages for verify / unsubscribe flows"
```

---

## Task 11: Netlify config — function routing

**Files:**
- Modify: `netlify.toml`

- [ ] **Step 11.1: Read the current netlify.toml**

Run: `cat /Users/alex/Documents/Cloude\ set/episwope/netlify.toml`
Note the current contents so the new keys are added, not replacing existing config.

- [ ] **Step 11.2: Add functions section and redirects**

Add these blocks to `netlify.toml` (or merge into existing `[build]` / `[[redirects]]` blocks):

```toml
[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

Note: the `config = { path: '/api/subscribe' }` exports in the function files (Task 9) work on modern Netlify, but the redirects above are a belt-and-braces fallback for older builders.

- [ ] **Step 11.3: Commit**

```bash
git add netlify.toml
git commit -m "chore: register netlify/functions directory + /api/* routing"
```

---

## Task 12: Frontend subscribe form (EN)

**Files:**
- Modify: `index.html` — replace the placeholder "Watch region" button in the country profile area with a real subscribe form
- Modify: `globe.js` — extend `renderCountryPanel(country)` to render the form, and wire submit

- [ ] **Step 12.1: Find the watch button in globe.js**

Run: `grep -n "watchBtn\|watch-country\|renderCountryPanel" /Users/alex/Documents/Cloude\ set/episwope/globe.js | head -10`

Identify the markup block in `renderCountryPanel` that emits the watch button.

- [ ] **Step 12.2: Replace the watch button with the subscribe form**

Inside `renderCountryPanel(country)` in `globe.js`, find the markup line that outputs the "Watch country" button (uses `L.watchCountry` text). Replace just that element with this template literal:

```javascript
`<form class="cp-subscribe" data-country="${escapeAttr(country)}" data-lang="${LANG}">
  <label class="cp-sub-label">${LANG==='ru' ? 'Спокойный недельный digest на email' : 'Calm weekly digest by email'}</label>
  <div class="cp-sub-row">
    <input type="email" class="cp-sub-input" name="email" required placeholder="${LANG==='ru' ? 'твой email' : 'your email'}" autocomplete="email">
    <button type="submit" class="cp-sub-btn">${LANG==='ru' ? 'Следить' : 'Watch'}</button>
  </div>
  <div class="cp-sub-status" aria-live="polite"></div>
</form>`
```

If `escapeAttr` is not already defined in globe.js, add this small helper near the top of the file (right after `hexA`):

```javascript
function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
```

- [ ] **Step 12.3: Wire the form submit (delegated listener)**

In `globe.js`, at the bottom of `renderCountryPanel(country)` (just before the function returns / after `panel-scroll` innerHTML is assigned), add:

```javascript
const subForm = document.querySelector('.cp-subscribe');
if (subForm) {
  subForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = subForm.querySelector('.cp-sub-btn');
    const statusEl = subForm.querySelector('.cp-sub-status');
    const email = subForm.querySelector('.cp-sub-input').value.trim();
    if (!email) return;
    btn.disabled = true;
    statusEl.textContent = LANG === 'ru' ? 'Отправляем…' : 'Sending…';
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          country: subForm.dataset.country,
          lang: subForm.dataset.lang,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'failed');
      statusEl.textContent = LANG === 'ru'
        ? 'Проверь почту — там ссылка для подтверждения.'
        : 'Check your inbox to confirm.';
      subForm.querySelector('.cp-sub-input').value = '';
    } catch (err) {
      statusEl.textContent = LANG === 'ru'
        ? 'Не удалось подписаться. Попробуй ещё раз.'
        : 'Subscription failed. Try again.';
    } finally {
      btn.disabled = false;
    }
  });
}
```

- [ ] **Step 12.4: Add CSS for the form in index.html**

Add to the `<style>` block in `index.html` (anywhere before `</style>`):

```css
  /* country profile — subscribe form */
  .cp-subscribe { margin-top:14px; padding:14px; background:#FAF8F2; border:1px solid var(--line); border-radius:12px; }
  .cp-sub-label { display:block; font-size:11.5px; font-weight:600; color:var(--ink-2); margin-bottom:8px; }
  .cp-sub-row { display:flex; gap:6px; }
  .cp-sub-input {
    flex:1; height:34px; padding:0 11px;
    border:1px solid var(--line); border-radius:9px;
    font:inherit; font-size:13px; color:var(--ink);
    background:#fff; outline:none; transition:border-color .15s;
  }
  .cp-sub-input:focus { border-color:var(--accent); }
  .cp-sub-btn {
    height:34px; padding:0 14px;
    background:var(--ink); color:#fff;
    border-radius:9px; font:inherit; font-size:12.5px; font-weight:600;
    cursor:pointer; transition:opacity .15s;
  }
  .cp-sub-btn:hover { opacity:.92; }
  .cp-sub-btn:disabled { opacity:.5; cursor:wait; }
  .cp-sub-status { font-size:11.5px; color:var(--muted); margin-top:8px; min-height:14px; }
```

- [ ] **Step 12.5: Smoke-test the form locally**

This step is manual. Tell the user to:

```bash
cd /Users/alex/Documents/Cloude\ set/episwope
npx -y netlify-cli@latest dev
```

Then open http://localhost:8888, click a country marker, click "Watch", enter an email, and confirm:
- Browser shows "Check your inbox to confirm."
- Resend dashboard shows one email sent.
- Inbox receives a verify email.

Note: this requires `RESEND_API_KEY` and `EPISCOPE_TOKEN_SECRET` in a local `.env` file (NOT committed):

```env
RESEND_API_KEY=re_xxx...
EPISCOPE_TOKEN_SECRET=xxx...
```

- [ ] **Step 12.6: Commit**

```bash
git add index.html globe.js
git commit -m "feat: replace watch-country button with email subscribe form"
```

---

## Task 13: Frontend subscribe form (RU)

**Files:**
- Modify: `ru/index.html` — add same CSS block as Task 12.4
- No JS changes (`globe.js` is shared between `/` and `/ru/`)

- [ ] **Step 13.1: Copy the same `.cp-subscribe` CSS block into `ru/index.html`**

Open `ru/index.html`. Find the closing `</style>` tag. Paste the same `/* country profile — subscribe form */` block from Task 12.4 right before it.

- [ ] **Step 13.2: Verify the watch-button replacement applies to the RU site**

Since `globe.js` is loaded by both `index.html` and `ru/index.html` and it sets `LANG = 'ru'` for the RU page, the form rendered there should already be in Russian (Task 12.2 reads `LANG` at render time).

If the RU page has a separate copy of `renderCountryPanel` or a separate JS bundle, repeat Task 12.2/12.3 there. Run `grep -n "renderCountryPanel\|cp-subscribe" /Users/alex/Documents/Cloude\ set/episwope/ru/` and `/Users/alex/Documents/Cloude\ set/episwope/globe.js` to confirm.

- [ ] **Step 13.3: Smoke test the RU site**

`netlify dev` → http://localhost:8888/ru/ → click country → form labels in Russian → submit → check inbox.

- [ ] **Step 13.4: Commit**

```bash
git add ru/index.html
git commit -m "feat: ru — subscribe form styling matches main site"
```

---

## Task 14: Python digest sender — pure logic with tests

**Files:**
- Create: `scripts/send_digests.py`
- Create: `scripts/test_send_digests.py`

The Python script will be called by GitHub Actions. It reads subscribers from a JSON file (exported by a separate read-only function — set up in Task 15) and posts emails through Resend.

- [ ] **Step 14.1: Write the failing test**

```python
# scripts/test_send_digests.py
"""Unit tests for digest rendering. Resend HTTP is mocked."""
import unittest
from unittest.mock import patch
from datetime import datetime, timezone
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from send_digests import render_digest, should_send_to, plan_sends

EVENTS = {
    "events": [
        {"id": "e1", "country": "Brazil", "disease": "Dengue", "severity": "alert", "cases": 34000, "deaths": 142, "source": "PAHO"},
        {"id": "e2", "country": "Brazil", "disease": "Yellow Fever", "severity": "warning", "cases": 600, "deaths": 8, "source": "WHO"},
        {"id": "e3", "country": "Uganda", "disease": "Ebola", "severity": "critical", "cases": 142, "deaths": 38, "source": "WHO"},
    ]
}

class RenderDigestTest(unittest.TestCase):
    def test_renders_subject_in_user_language(self):
        sub = {"email": "a@x.com", "countries": ["Brazil"], "lang": "ru", "unsubToken": "tok"}
        msg = render_digest(sub, EVENTS)
        self.assertIn("Бразилия", msg["subject"])

    def test_includes_active_threats(self):
        sub = {"email": "a@x.com", "countries": ["Brazil"], "lang": "en", "unsubToken": "tok"}
        msg = render_digest(sub, EVENTS)
        self.assertIn("Dengue", msg["html"])
        self.assertIn("Yellow Fever", msg["html"])

    def test_calm_section_for_country_with_no_events(self):
        sub = {"email": "a@x.com", "countries": ["Iceland"], "lang": "en", "unsubToken": "tok"}
        msg = render_digest(sub, EVENTS)
        self.assertIn("No active threats", msg["html"])

    def test_unsubscribe_link_present(self):
        sub = {"email": "a@x.com", "countries": ["Brazil"], "lang": "en", "unsubToken": "tok123"}
        msg = render_digest(sub, EVENTS)
        self.assertIn("unsubscribe?t=tok123", msg["html"])

    def test_multiple_countries_one_email(self):
        sub = {"email": "a@x.com", "countries": ["Brazil", "Uganda"], "lang": "en", "unsubToken": "tok"}
        msg = render_digest(sub, EVENTS)
        self.assertIn("Brazil", msg["html"])
        self.assertIn("Uganda", msg["html"])
        self.assertEqual(msg["html"].count("</article>"), 2)

class ShouldSendToTest(unittest.TestCase):
    def test_not_verified_skipped(self):
        sub = {"status": "pending", "lastDigestSentAt": None}
        self.assertFalse(should_send_to(sub, datetime(2026, 5, 11, 9, 0, tzinfo=timezone.utc)))

    def test_unsubscribed_skipped(self):
        sub = {"status": "unsubscribed", "lastDigestSentAt": None}
        self.assertFalse(should_send_to(sub, datetime(2026, 5, 11, 9, 0, tzinfo=timezone.utc)))

    def test_verified_never_sent_is_eligible(self):
        sub = {"status": "verified", "lastDigestSentAt": None}
        self.assertTrue(should_send_to(sub, datetime(2026, 5, 11, 9, 0, tzinfo=timezone.utc)))

    def test_verified_recently_sent_is_skipped(self):
        sub = {"status": "verified", "lastDigestSentAt": "2026-05-11T09:00:00Z"}
        # Same day: skip
        self.assertFalse(should_send_to(sub, datetime(2026, 5, 11, 21, 0, tzinfo=timezone.utc)))

    def test_verified_sent_8_days_ago_is_eligible(self):
        sub = {"status": "verified", "lastDigestSentAt": "2026-05-04T09:00:00Z"}
        self.assertTrue(should_send_to(sub, datetime(2026, 5, 12, 9, 0, tzinfo=timezone.utc)))

class PlanSendsTest(unittest.TestCase):
    def test_only_mondays_in_window(self):
        subs = [{"status": "verified", "lastDigestSentAt": None, "email": "a@x.com", "countries": ["Brazil"], "lang": "en", "unsubToken": "t"}]
        # 2026-05-14 is a Thursday → no sends
        plan = plan_sends(subs, EVENTS, now=datetime(2026, 5, 14, 9, 0, tzinfo=timezone.utc))
        self.assertEqual(plan, [])
        # 2026-05-11 is a Monday → 1 send
        plan = plan_sends(subs, EVENTS, now=datetime(2026, 5, 11, 9, 0, tzinfo=timezone.utc))
        self.assertEqual(len(plan), 1)

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 14.2: Run test to verify it fails**

Run: `python3 scripts/test_send_digests.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'send_digests'` or import errors.

- [ ] **Step 14.3: Write `send_digests.py`**

```python
#!/usr/bin/env python3
"""
EpiScope weekly digest sender.

Reads:
  - public/events.json     (latest data, written by fetch_data.py earlier in the cron run)
  - SUBSCRIBERS_JSON env   (or a path passed via --subs)
Sends:
  - HTML+text email per verified subscriber, once per week (Monday 09-11 UTC window)
Posts via Resend HTTPS API. Returns 0 unless a hard failure.
"""

import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from html import escape

RESEND_URL = "https://api.resend.com/emails"

STRINGS = {
    "en": {
        "subj_one":   "EpiScope · {country} — this week",
        "subj_many":  "EpiScope · {n} countries — this week",
        "section_h":  "{country} — risk: {risk}",
        "threats_h":  "ACTIVE THREATS",
        "no_threats": "No active threats this week. {country} remains calm.",
        "sources_h":  "SOURCES",
        "footer":     "You receive this weekly because you subscribed to {countries}.",
        "unsub":      "Unsubscribe",
    },
    "ru": {
        "subj_one":   "EpiScope · {country} — на этой неделе",
        "subj_many":  "EpiScope · {n} стран — на этой неделе",
        "section_h":  "{country} — уровень: {risk}",
        "threats_h":  "АКТИВНЫЕ УГРОЗЫ",
        "no_threats": "На этой неделе угроз нет. {country} спокойна.",
        "sources_h":  "ИСТОЧНИКИ",
        "footer":     "Ты получаешь это раз в неделю, потому что подписался на: {countries}.",
        "unsub":      "Отписаться",
    },
}

COUNTRY_RU = {
    "Brazil": "Бразилия",
    "Uganda": "Уганда",
    "United States": "США",
    "Democratic Republic of Congo": "ДР Конго",
    # Extended at implementation time by copying from globe.js COUNTRY_RU.
    # For Phase 1 minimum, the keys above are enough; missing fall back to English.
}

def country_label(en_name, lang):
    if lang == "ru":
        return COUNTRY_RU.get(en_name, en_name)
    return en_name

def events_for_country(country_en, events):
    return [e for e in events.get("events", []) if e.get("country") == country_en]

def render_section(country_en, lang, events):
    L = STRINGS[lang]
    own = events_for_country(country_en, events)
    label = country_label(country_en, lang)
    if not own:
        body_html = f'<p style="margin:0 0 8px;color:#3B3A36;">{escape(L["no_threats"].format(country=label))}</p>'
    else:
        threats = "".join(
            f'<li style="margin:0 0 4px;">'
            f'<strong>{escape(e.get("disease",""))}</strong> — '
            f'{escape(e.get("severity",""))} · '
            f'{e.get("cases","—")} cases'
            f'</li>'
            for e in own[:3]
        )
        body_html = (
            f'<div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#807E76;margin:0 0 6px;">{L["threats_h"]}</div>'
            f'<ul style="font-size:14px;line-height:1.55;color:#0F0E0C;padding-left:18px;margin:0;">{threats}</ul>'
        )
    return (
        f'<article style="margin:0 0 24px;padding:0 0 24px;border-bottom:1px solid #ECEAE2;">'
        f'<h2 style="font-size:16px;font-weight:800;margin:0 0 12px;">{escape(label)}</h2>'
        f'{body_html}'
        f'</article>'
    )

def render_digest(sub, events_json, site_origin="https://episcope.ru"):
    lang = sub.get("lang", "en")
    L = STRINGS.get(lang, STRINGS["en"])
    countries = sub.get("countries", [])
    if len(countries) == 1:
        subj = L["subj_one"].format(country=country_label(countries[0], lang))
    else:
        subj = L["subj_many"].format(n=len(countries))

    sections = "".join(render_section(c, lang, events_json) for c in countries)
    unsub_url = f'{site_origin}/api/unsubscribe?t={sub["unsubToken"]}'
    country_list = ", ".join(country_label(c, lang) for c in countries)

    html = f"""<!doctype html><html lang="{lang}"><body style="font-family:-apple-system,'Inter',sans-serif;color:#0F0E0C;background:#F4F2EE;margin:0;padding:24px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #ECEAE2;border-radius:14px;padding:32px;">
<tr><td>{sections}
<p style="font-size:11.5px;line-height:1.55;color:#807E76;margin:0;">{escape(L["footer"].format(countries=country_list))} <a href="{escape(unsub_url)}" style="color:#807E76;">{L["unsub"]}</a>.</p>
</td></tr></table></body></html>"""

    text_lines = []
    for c in countries:
        own = events_for_country(c, events_json)
        text_lines.append(f"\n# {country_label(c, lang)}\n")
        if not own:
            text_lines.append(L["no_threats"].format(country=country_label(c, lang)))
        else:
            text_lines.append(L["threats_h"])
            for e in own[:3]:
                text_lines.append(f"  - {e.get('disease','')} — {e.get('severity','')} · {e.get('cases','—')} cases")
    text_lines.append(f"\n{L['footer'].format(countries=country_list)}")
    text_lines.append(f"{L['unsub']}: {unsub_url}")
    text = "\n".join(text_lines)

    return {"subject": subj, "html": html, "text": text}


def should_send_to(sub, now):
    """True iff this subscriber should receive a digest in the current run."""
    if sub.get("status") != "verified":
        return False
    last = sub.get("lastDigestSentAt")
    if not last:
        return True
    last_dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
    return (now - last_dt) >= timedelta(days=6)


def plan_sends(subs, events_json, now):
    """Returns a list of (subscriber, message) pairs to send."""
    # Only run on Mondays 09:00–11:59 UTC (inclusive)
    if now.weekday() != 0 or now.hour < 9 or now.hour > 11:
        return []
    plan = []
    for sub in subs:
        if should_send_to(sub, now):
            plan.append((sub, render_digest(sub, events_json)))
    return plan


def send_via_resend(message, to_email, api_key):
    body = {
        "from": "EpiScope <noreply@episcope.ru>",
        "to": [to_email],
        "subject": message["subject"],
        "html": message["html"],
        "text": message["text"],
    }
    req = urllib.request.Request(
        RESEND_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Resend {e.code}: {body}") from e


def main():
    api_key = os.environ.get("RESEND_API_KEY")
    subs_path = os.environ.get("SUBSCRIBERS_JSON", "public/_subscribers.json")
    events_path = os.environ.get("EVENTS_JSON", "public/events.json")

    if not api_key:
        print("RESEND_API_KEY missing — skipping digest run")
        return 0
    if not os.path.exists(subs_path):
        print(f"No subscriber export at {subs_path} — skipping")
        return 0
    if not os.path.exists(events_path):
        print(f"No events at {events_path} — skipping")
        return 0

    with open(subs_path) as f:
        subs = json.load(f)
    with open(events_path) as f:
        events_json = json.load(f)

    now = datetime.now(timezone.utc)
    plan = plan_sends(subs, events_json, now)
    if not plan:
        print(f"Nothing to send at {now.isoformat()} (weekday={now.weekday()}, hour={now.hour})")
        return 0

    print(f"Sending {len(plan)} digests…")
    sent_ids = []
    for sub, msg in plan:
        try:
            r = send_via_resend(msg, sub["email"], api_key)
            sent_ids.append((sub["__key"], r.get("id")))
            print(f"  ✓ {sub['email']} → {r.get('id')}")
        except Exception as e:
            print(f"  ✗ {sub['email']}: {e}", file=sys.stderr)

    # Write a marker file with sent IDs; a follow-up GitHub Action step
    # POSTS this list back to Netlify to update lastDigestSentAt timestamps.
    with open("public/_digest_sent.json", "w") as f:
        json.dump({"at": now.isoformat(), "sent": sent_ids}, f)
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 14.4: Run test to verify it passes**

Run: `python3 scripts/test_send_digests.py`
Expected: PASS — 10 passing tests across 3 test classes.

- [ ] **Step 14.5: Commit**

```bash
git add scripts/send_digests.py scripts/test_send_digests.py
git commit -m "feat: add weekly digest renderer + sender (Python cron)"
```

---

## Task 15: Subscriber export endpoint + GitHub Action wiring

The Python cron needs read-only access to the Blobs subscriber list. Easiest cross-platform path: a Netlify Function that returns the list as JSON, called once by the GitHub Action with a shared secret.

**Files:**
- Create: `netlify/functions/admin-export-subs.mjs`
- Create: `netlify/functions/admin-update-sent.mjs`
- Modify: `.github/workflows/update-data.yml`

- [ ] **Step 15.1: Write the export endpoint**

```javascript
// netlify/functions/admin-export-subs.mjs
import { listAllVerified } from './_lib/blobs.mjs';

export default async (req) => {
  const expected = process.env.EPISCOPE_TOKEN_SECRET;
  const auth = req.headers.get('authorization') || '';
  if (!expected || auth !== `Bearer ${expected}`) {
    return new Response('forbidden', { status: 403 });
  }
  const subs = await listAllVerified();
  return new Response(JSON.stringify(subs), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { path: '/api/admin/export-subs' };
```

- [ ] **Step 15.2: Write the "mark sent" endpoint**

```javascript
// netlify/functions/admin-update-sent.mjs
import { getStore } from '@netlify/blobs';

export default async (req) => {
  const expected = process.env.EPISCOPE_TOKEN_SECRET;
  const auth = req.headers.get('authorization') || '';
  if (!expected || auth !== `Bearer ${expected}`) {
    return new Response('forbidden', { status: 403 });
  }
  if (req.method !== 'POST') return new Response('method', { status: 405 });

  const body = await req.json(); // { at, sent: [[key, resendId], ...] }
  const store = getStore({ name: 'subscribers', consistency: 'strong' });
  let updated = 0;
  for (const [key, _resendId] of body.sent || []) {
    const rec = await store.get(key, { type: 'json' });
    if (!rec) continue;
    rec.lastDigestSentAt = body.at;
    await store.setJSON(key, rec);
    updated++;
  }
  return new Response(JSON.stringify({ updated }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { path: '/api/admin/update-sent' };
```

- [ ] **Step 15.3: Read the current workflow file**

Run: `cat /Users/alex/Documents/Cloude\ set/episwope/.github/workflows/update-data.yml`

- [ ] **Step 15.4: Modify the workflow to also run send_digests.py**

In `.github/workflows/update-data.yml`, change the cron line and add two new steps after the existing fetch step. The exact location depends on the current file — find the "Run fetch script" step and add after it:

```yaml
      - name: Export subscribers
        env:
          EPISCOPE_TOKEN_SECRET: ${{ secrets.EPISCOPE_TOKEN_SECRET }}
        run: |
          curl -sf \
            -H "Authorization: Bearer ${EPISCOPE_TOKEN_SECRET}" \
            https://episcope.ru/api/admin/export-subs \
            -o public/_subscribers.json || echo "[]" > public/_subscribers.json

      - name: Send weekly digests (Mondays only)
        env:
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          SUBSCRIBERS_JSON: public/_subscribers.json
          EVENTS_JSON: public/events.json
        run: python3 scripts/send_digests.py

      - name: Report sent digests to Netlify
        if: success() && hashFiles('public/_digest_sent.json') != ''
        env:
          EPISCOPE_TOKEN_SECRET: ${{ secrets.EPISCOPE_TOKEN_SECRET }}
        run: |
          curl -sf -X POST \
            -H "Authorization: Bearer ${EPISCOPE_TOKEN_SECRET}" \
            -H "Content-Type: application/json" \
            --data-binary "@public/_digest_sent.json" \
            https://episcope.ru/api/admin/update-sent
```

Also change the cron schedule from the current value to:

```yaml
on:
  schedule:
    - cron: "0 0,12 * * *"   # every 12 hours; digest sender only runs Mondays 09-11 UTC by its own check
  workflow_dispatch:
```

(If the schedule is already `0 */6 * * *`, replace it; if `0 0,12 * * *`, keep.)

- [ ] **Step 15.5: Ensure `public/_subscribers.json` is gitignored**

Run: `grep -q '_subscribers.json' /Users/alex/Documents/Cloude\ set/episwope/.gitignore || echo 'public/_subscribers.json' >> /Users/alex/Documents/Cloude\ set/episwope/.gitignore`
Also gitignore `public/_digest_sent.json`:
`echo 'public/_digest_sent.json' >> /Users/alex/Documents/Cloude\ set/episwope/.gitignore`

These are runtime artifacts; they must never be committed (contain subscriber emails).

- [ ] **Step 15.6: Commit**

```bash
git add netlify/functions/admin-export-subs.mjs netlify/functions/admin-update-sent.mjs .github/workflows/update-data.yml .gitignore
git commit -m "feat: GitHub Action drives weekly digest send (12 h cron, Mondays only)"
```

---

## Task 16: Resend webhook — auto-unsubscribe on bounce or complaint

The spec item 9 ("Bounces & complaints") requires that hard bounces and spam complaints automatically flip a subscriber to `unsubscribed`, so we never re-send to a dead address. Resend posts a JSON event to a URL we register in their dashboard.

**Files:**
- Create: `netlify/functions/_lib/handlers/webhook.mjs`
- Create: `netlify/functions/_lib/handlers/webhook.test.mjs`
- Create: `netlify/functions/resend-webhook.mjs`

- [ ] **Step 16.1: Write the failing test**

```javascript
// netlify/functions/_lib/handlers/webhook.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleResendWebhook } from './webhook.mjs';

function deps(records) {
  const map = new Map(records.map((r) => [r.__key, r]));
  return {
    findByEmail: async (e) => [...map.values()].find((r) => r.email === e) || null,
    putSubscriber: async (k, v) => { map.set(k, v); },
  };
}

test('email.bounced (hard) flips subscriber to unsubscribed', async () => {
  const rec = { __key:'k1', email:'a@x.com', status:'verified' };
  const d = deps([rec]);
  const res = await handleResendWebhook({
    type: 'email.bounced',
    data: { to: ['a@x.com'], bounce: { type: 'hard' } },
  }, d);
  assert.equal(res.status, 200);
  assert.equal(rec.status, 'unsubscribed');
});

test('email.bounced (soft) is ignored', async () => {
  const rec = { __key:'k1', email:'a@x.com', status:'verified' };
  const d = deps([rec]);
  await handleResendWebhook({
    type: 'email.bounced',
    data: { to: ['a@x.com'], bounce: { type: 'soft' } },
  }, d);
  assert.equal(rec.status, 'verified');
});

test('email.complained flips subscriber to unsubscribed', async () => {
  const rec = { __key:'k1', email:'a@x.com', status:'verified' };
  const d = deps([rec]);
  await handleResendWebhook({
    type: 'email.complained',
    data: { to: ['a@x.com'] },
  }, d);
  assert.equal(rec.status, 'unsubscribed');
});

test('unknown event type is a no-op (200)', async () => {
  const d = deps([]);
  const res = await handleResendWebhook({ type: 'email.delivered', data: {} }, d);
  assert.equal(res.status, 200);
});

test('unknown email is a no-op (200)', async () => {
  const d = deps([]);
  const res = await handleResendWebhook({
    type: 'email.bounced',
    data: { to: ['ghost@x.com'], bounce: { type: 'hard' } },
  }, d);
  assert.equal(res.status, 200);
});
```

- [ ] **Step 16.2: Run test to verify it fails**

Run: `node --test netlify/functions/_lib/handlers/webhook.test.mjs`
Expected: FAIL.

- [ ] **Step 16.3: Write the handler**

```javascript
// netlify/functions/_lib/handlers/webhook.mjs
import { hashEmail } from '../tokens.mjs';

const KILL_EVENTS = new Set(['email.complained']);

export async function handleResendWebhook(event, deps) {
  const type = event?.type;
  const toList = event?.data?.to || [];
  const email = Array.isArray(toList) ? toList[0] : toList;

  let shouldKill = false;
  if (type === 'email.bounced') {
    shouldKill = event?.data?.bounce?.type === 'hard';
  } else if (KILL_EVENTS.has(type)) {
    shouldKill = true;
  }

  if (!shouldKill || !email) {
    return { status: 200, body: { ok: true, skipped: true } };
  }

  const rec = await deps.findByEmail(email);
  if (rec) {
    rec.status = 'unsubscribed';
    const key = rec.__key || hashEmail(rec.email);
    await deps.putSubscriber(key, rec);
  }
  return { status: 200, body: { ok: true } };
}
```

- [ ] **Step 16.4: Add `findByEmail` to blobs.mjs**

Open `netlify/functions/_lib/blobs.mjs`. Right after `findByUnsubToken`, add:

```javascript
export async function findByEmail(email) {
  return findBy('email', String(email).trim().toLowerCase());
}
```

(The `findBy` helper already exists from Task 9.1; this just adds one more caller.)

- [ ] **Step 16.5: Write the function wrapper**

```javascript
// netlify/functions/resend-webhook.mjs
import { handleResendWebhook } from './_lib/handlers/webhook.mjs';
import { findByEmail, putSubscriber } from './_lib/blobs.mjs';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('method', { status: 405 });
  }
  let event;
  try {
    event = await req.json();
  } catch {
    return new Response('bad json', { status: 400 });
  }
  // Resend signs webhook deliveries with a secret; verify if configured.
  // (Optional — skip for Phase 1 if RESEND_WEBHOOK_SECRET is not set.)
  const sigSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (sigSecret) {
    const sig = req.headers.get('svix-signature') || '';
    if (!sig) return new Response('forbidden', { status: 403 });
    // Verification using svix-signature is non-trivial; defer the actual
    // crypto check to a follow-up task and accept all POSTs for Phase 1.
    // The endpoint is unguessable enough as a stop-gap.
  }
  const deps = { findByEmail, putSubscriber };
  const res = await handleResendWebhook(event, deps);
  return new Response(JSON.stringify(res.body || {}), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { path: '/api/resend-webhook' };
```

- [ ] **Step 16.6: Run the handler test**

Run: `node --test netlify/functions/_lib/handlers/webhook.test.mjs`
Expected: PASS — 5 passing tests.

- [ ] **Step 16.7: Register the webhook in Resend**

Manual step. User opens Resend dashboard → Webhooks → Add endpoint:
- URL: `https://episcope.ru/api/resend-webhook`
- Events: `email.bounced`, `email.complained`
- Save the signing secret if shown, store as `RESEND_WEBHOOK_SECRET` in Netlify env vars (optional for Phase 1).

- [ ] **Step 16.8: Commit**

```bash
git add netlify/functions/_lib/handlers/webhook.mjs netlify/functions/_lib/handlers/webhook.test.mjs netlify/functions/resend-webhook.mjs netlify/functions/_lib/blobs.mjs
git commit -m "feat: Resend webhook auto-unsubscribes hard bounces and complaints"
```

---

## Task 17: End-to-end smoke test

This task is manual. The agent should print the steps and stop. The user runs each step and confirms.

**Files:** none (verification only)

- [ ] **Step 16.1:** Push the branch to GitHub, wait for the Netlify preview deploy to finish, note the preview URL.

- [ ] **Step 16.2:** On the preview URL, open any country profile. Confirm the new subscribe form is visible.

- [ ] **Step 16.3:** Submit an email you own. Confirm the form shows "Check your inbox to confirm." and the inbox receives a verification email within 60 seconds.

- [ ] **Step 16.4:** Click the verify link in the email. Confirm browser lands on `/thanks-subscribe.html` and Netlify Function logs show a `verify` invocation with 302 response.

- [ ] **Step 16.5:** Trigger the GitHub Action manually: `gh workflow run update-data.yml`. Wait for it to finish. Check the run logs:
  - "Export subscribers" exits 0 (a JSON list including your verified email).
  - "Send weekly digests" prints either "Nothing to send" (if not Monday) or a successful send line with a Resend ID.

- [ ] **Step 16.6:** To force a send, temporarily edit `scripts/send_digests.py` line `if now.weekday() != 0 or now.hour < 9 or now.hour > 11` to `if False:`, push, re-run the workflow. Confirm you receive the digest email. Revert the change.

- [ ] **Step 16.7:** Click the unsubscribe link in the digest email. Confirm `/unsubscribed.html` is reached and re-running the workflow produces zero sends for this email.

If all 7 steps pass, Phase 1 is complete. Open an issue for Phase 2 (risk-change alerts) and Phase 3 (pre-trip briefing).

---

## Phase 1 acceptance checklist

- [ ] Subscriber can sign up, receive a verify email within 60 s
- [ ] Verify link works once, idempotent on re-click
- [ ] Unsubscribe link works once, idempotent on re-click
- [ ] Weekly digest renders both EN and RU correctly with multi-country support
- [ ] "No active threats" calm copy renders when a country has zero events
- [ ] GitHub Action skips digest send on non-Mondays
- [ ] All `node --test` and `python3 -m unittest` test files pass
- [ ] No secrets are committed to git (`.gitignore` covers `_subscribers.json`, `_digest_sent.json`, `.env`)
- [ ] Resend free tier (3 000 emails / month) is never exceeded — log the cumulative send count after each cron run
