# EpiScope Email Subscriptions — Design Spec

**Date:** 2026-05-14
**Status:** Draft, pending user approval
**Scope:** Email-based subscription system. No accounts, no login, no push notifications, no premium tier.

---

## 1. Why this exists

The user research (informal, drawn from existing market context) points to three audience segments where EpiScope can be genuinely useful, not just a curiosity:

- **Frequent travelers** — need a calm pre-trip briefing 7 days before travel, sourced from WHO/ECDC/GDACS
- **Expat families** — want to follow conditions in one or two specific countries without doom-scrolling
- **General "watch a topic"** — willing to give an email in exchange for a quiet, sourced weekly digest

The unique positioning vs. Twitter/news/dashboards: **calm tone, weekly cadence, sourced summaries, easy unsubscribe.** Anti-panic by design.

No login wall. Email is the entire account. This is also the right call for GDPR — minimum data, clear consent, one-click unsubscribe.

---

## 2. Three phases (ship in order)

| Phase | Feature | Ship signal |
|---|---|---|
| **1 — MVP** | "Watch a country" → weekly digest | Have ≥ 1 verified subscriber, ≥ 1 country-week digest sent successfully |
| **2** | Risk-change alerts | Country risk-level escalation triggers email within 12 h |
| **3** | Pre-trip briefing | User submits country + travel date → one email 7 days before |

Phase 1 must ship completely (frontend form + backend function + cron + verification + unsubscribe) before Phase 2 starts. Each phase is a separate implementation cycle.

---

## 3. Architecture (Phase 1)

```
┌────────────────┐    ┌────────────────────────┐    ┌─────────────────┐
│  Frontend form │───▶│ /.netlify/functions/    │───▶│ Netlify Blobs   │
│  Country page  │    │   subscribe             │    │   subs.json     │
│  /api/sub-watch│    │                          │    └─────────────────┘
└────────────────┘    │   Side effect: send      │
                      │   verification email     │
                      │   via Resend API         │
                      └────────────────────────┘
                                                            ▲
                                                            │
                      ┌────────────────────────────────────┴────┐
                      │  GitHub Action update-data.yml (12 h)   │
                      │    1. fetch latest WHO/ECDC/GDACS data  │
                      │    2. write public/events.json          │
                      │    3. if it is Monday 09:00 UTC ±6h:    │
                      │       render digest per country,         │
                      │       loop over verified subscribers,    │
                      │       POST email through Resend         │
                      │    4. update lastDigestSentAt in Blobs  │
                      └─────────────────────────────────────────┘
```

### Tech choices

| Concern | Pick | Why |
|---|---|---|
| Email API | **Resend** | 3 000 emails/month free; clean JSON API |
| Sender domain | **`noreply@episcope.ru`** | DNS is on Netlify; SPF + DKIM + DMARC records cost nothing |
| Storage | **Netlify Blobs** | KV store built into the Netlify plan; no extra service |
| Forms / endpoints | **Netlify Functions** (Node 20) | Already on Netlify; serverless, free tier |
| Cron | **Existing GitHub Action** | Already runs every 12 h; just one extra step |
| Frontend | Plain HTML/JS in existing `index.html` / `ru/index.html` | Same stack as the rest of the site |

### Cost

| Volume | Monthly cost |
|---|---|
| 0 – 3 000 emails | **$0** (Resend free) |
| 3 001 – 50 000 emails | $20 / mo (Resend Pro) |
| Netlify Functions, Blobs | $0 within free tier |

---

## 4. Data model

One record per email address in Netlify Blobs.

Key: `subscribers/{sha256(email)}` (avoids storing raw email as the lookup key; the email itself is in the body).

Body:

```json
{
  "email": "user@example.com",
  "countries": ["Brazil", "Vietnam"],
  "lang": "ru",
  "status": "pending | verified | unsubscribed",
  "verifyToken": "32-char-url-safe-random",
  "unsubToken":  "32-char-url-safe-random",
  "createdAt":   "2026-05-14T10:23:00Z",
  "verifiedAt":  null,
  "lastDigestSentAt": null,
  "ipHash": "first-byte-only, for abuse rate-limit"
}
```

`countries` is a normalized list of English names from `ALL_COUNTRIES` (the country DB already in `globe.js`). The frontend resolves Russian names to canonical English before POST.

`lang` is set from the page the user subscribed on (`ru` for `/ru/`, `en` otherwise) and decides which template the cron uses.

Tokens are random 32-char URL-safe strings. They are part of the URL — no other auth needed.

---

## 5. User flows

### 5.1 Subscribe to a country

1. On a country profile in the right panel, button: **"Слежу за страной"** / **"Watch country"**
2. Click → inline form replaces the button: `[email input] [Subscribe →]`
3. Submit → POST `/.netlify/functions/subscribe` with `{email, country, lang}`
4. Function:
   - Validates email format
   - Looks up the existing record (if any) by `sha256(email)`
   - If new: creates `pending` record with that one country + new verifyToken + unsubToken
   - If existing `pending` or `verified`: appends the country to `countries`, re-sends a verification email **only if** status is `pending`
   - Sends verification email through Resend
5. Frontend shows: **"Проверь почту. Мы прислали ссылку для подтверждения."**
6. User clicks `https://episcope.ru/api/verify?t=<verifyToken>` → function marks `status: 'verified'`, redirects to a small thank-you page
7. From now on the email is included in the weekly digest for each country in `countries`

### 5.2 Weekly digest (cron, in GitHub Action)

Runs as part of `scripts/fetch_data.py` (or a new sibling `scripts/send_digests.py`), once the data refresh has completed:

```
if today is Monday and hour in [9, 10, 11] UTC and ENV == production:
    for each verified subscriber S:
        if S.lastDigestSentAt < 6 days ago:
            for each country C in S.countries:
                section = render_digest_section(C, events_snapshot)
            email_html = render_template(S.lang, sections, S.unsubToken)
            resend.send(to=S.email, subject=..., html=email_html)
            S.lastDigestSentAt = now()
```

Cron retries are safe because of the `lastDigestSentAt < 6 days ago` guard. If a run misses Monday for any reason, Tuesday's run picks up unsent subscribers.

### 5.3 Unsubscribe

GET `https://episcope.ru/api/unsubscribe?t=<unsubToken>` → mark `status: 'unsubscribed'`, render a "you have been unsubscribed" page, no confirmation step required (compliance: must be one-click).

---

## 6. Email templates

Two languages × two purposes (verify, digest) = 4 templates. Plain HTML + plain-text fallback. No external CSS, no JS, no images that fetch trackers.

### 6.1 Verification email

Subject (RU): «Подтверди подписку на EpiScope»
Subject (EN): "Confirm your EpiScope subscription"

Body has: the country name(s) the user just subscribed to, the verification link button, an explanation that no further emails will arrive until they click, and a "you didn't sign up?" line with the unsubscribe link.

### 6.2 Weekly digest

Subject (RU): «EpiScope · {Бразилия} — на этой неделе»
Subject (EN): "EpiScope · {Brazil} — this week"

Sections per country, simple structure:

```
[Country name + flag]
[Risk level + 1-line summary, calm tone]

ACTIVE THREATS (top 3)
  • Dengue (DENV-2) — Alert · 34.2k cases
  • Yellow Fever — Warning · 1.6k cases

WHAT CHANGED THIS WEEK
  • Case count up 18% week-over-week
  • New travel advisory from WHO

SOURCES
  WHO Disease Outbreak News · ECDC · GDACS

—

Footer:
  You receive this weekly because you subscribed to {countries}.
  Unsubscribe: https://episcope.ru/api/unsubscribe?t=...
```

No marketing copy. No "click to read more." Plain, sourced, finite.

---

## 7. Edge cases

| Case | Behavior |
|---|---|
| Same email subscribes to many countries | Append to `countries`, no duplicate record |
| Email already verified, subscribes to a new country | Append silently; no second verification email |
| Pending verification > 7 days old | On next subscribe attempt or weekly cron sweep, delete the record |
| Verification link clicked twice | First click verifies, second redirects to "already verified" |
| Unsubscribe link clicked twice | Idempotent; both clicks land on "you are unsubscribed" |
| Country has zero active events that week | Digest still goes out, section reads: "No active threats this week. {Country} remains at {risk level}." This is **the value proposition** — calm is news. |
| User changes their mind, wants only some countries | Phase 1 doesn't ship a self-serve preference page. Unsubscribe + re-subscribe is the workaround. Phase 2 adds a `/preferences?t=...` page |
| Resend API down during cron run | Retry on next 12 h run; `lastDigestSentAt` only updates after a successful send |
| Subscriber's email bounces hard | Resend webhook (or polling their `/emails` endpoint on next run) → set `status: 'unsubscribed'` automatically |
| Spam complaints (Resend webhook) | Same: auto-unsubscribe, log incident |

---

## 8. Out of scope (Phase 1)

- Google login or any auth beyond an email + a token
- A user-facing preferences page (Phase 2)
- Pre-trip briefing form and the 7-day-out send logic (Phase 3)
- Risk-change alerts (Phase 2)
- Push notifications (will not ship; wrong UX for this audience)
- Premium / paid tier (not ready; no demand validated)
- Topic-based subscriptions like "Cholera worldwide" — too niche, defer
- Personal dashboard with stats — premature, defer until ≥ 1k subscribers

---

## 9. Implementation steps (high-level, to expand in the plan doc)

1. **Resend account + DNS** — sign up; add SPF, DKIM, DMARC records to Netlify DNS for `episcope.ru`; verify in Resend dashboard
2. **Netlify Blobs setup** — enable on the site; the blob store will be named `subscribers`
3. **`/.netlify/functions/subscribe`** — Node 20 function; validates input, writes to Blobs, sends verification email
4. **`/.netlify/functions/verify`** — Marks record verified; redirects to `/thanks-subscribe.html`
5. **`/.netlify/functions/unsubscribe`** — Marks record unsubscribed; renders inline "you're out"
6. **Frontend integration**:
   - In the country profile in the right panel, replace the placeholder "Watch region" button with a real subscribe form
   - Both `index.html` and `ru/index.html`
   - Inline form with email input, success/error states, language-aware copy
7. **Cron extension** in `update-data.yml`:
   - After data fetch, run a new `scripts/send_digests.py`
   - Reads Blobs, decides whether to send (Monday window + per-subscriber 6-day guard)
   - Renders Markdown → HTML via a template; sends via Resend API
8. **Static pages**:
   - `/thanks-subscribe.html` — "thanks, we're following these countries with you"
   - `/unsubscribed.html` — "you're out, no further emails"
9. **Bounces & complaints**:
   - Configure a Resend webhook → `/.netlify/functions/resend-webhook` → auto-unsubscribe on hard bounce or complaint
10. **Monitoring** — log to Netlify Function logs; sanity dashboard via the existing GitHub Action output (number subscribed, number of emails sent, number bounced)

---

## 10. Acceptance criteria (Phase 1)

- A new visitor can subscribe to a country from the country profile and receive a verification email within 60 seconds
- The verification link, when clicked, marks the record `verified` and shows a thank-you page
- On the next Monday in the 09:00–11:00 UTC window, that subscriber receives one digest email containing a section for each of their subscribed countries
- Clicking the unsubscribe link in any digest results in no further emails arriving on subsequent runs
- A subscriber who never clicks the verification link does **not** receive any digest emails
- The same email re-subscribing to a new country is silently merged into the existing record
- Cost stays at $0 for the first 3 000 emails per month (Resend free tier)

---

## 11. Open questions

None at the moment. All four input questions were answered by the user:

- Email provider — Resend, free tier
- Sender domain — `noreply@episcope.ru`, DNS configured on Netlify
- Language — match the page the user subscribed on
- Phasing — ship in 3 phases, starting with "Watch country"
