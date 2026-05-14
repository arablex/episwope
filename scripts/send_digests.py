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
            print(f"  OK: {sub['email']} -> {r.get('id')}")
        except Exception as e:
            print(f"  ERR: {sub['email']}: {e}", file=sys.stderr)

    # Write a marker file with sent IDs; a follow-up GitHub Action step
    # POSTS this list back to Netlify to update lastDigestSentAt timestamps.
    with open("public/_digest_sent.json", "w") as f:
        json.dump({"at": now.isoformat(), "sent": sent_ids}, f)
    return 0


if __name__ == "__main__":
    sys.exit(main())
