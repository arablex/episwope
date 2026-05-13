#!/usr/bin/env python3
"""
EpiScope data fetcher — runs every 6 hours via GitHub Actions.
Fetches WHO DON + ProMED RSS feeds, extracts structured outbreak data
using Claude Haiku, writes public/events.json + public/alerts.json.

Cost estimate: ~30-50 Haiku API calls per run × $0.00025/1k tokens ≈ < $0.02/day
"""

import json
import os
import re
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
import urllib.request
import urllib.error

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

FEEDS = [
    {
        "name": "WHO DON",
        "url": "https://www.who.int/rss-feeds/news.rss",
        "tag": "who",
    },
    {
        "name": "ProMED",
        "url": "https://promedmail.org/promed-rss/",
        "tag": "promed",
    },
    {
        "name": "ECDC",
        "url": "https://www.ecdc.europa.eu/en/rss.xml",
        "tag": "ecdc",
    },
]

# Outbreak-related keywords to pre-filter RSS items (case-insensitive)
KEYWORDS = [
    "outbreak", "disease", "virus", "epidemic", "pandemic", "infection",
    "cholera", "dengue", "ebola", "mpox", "monkeypox", "influenza", "avian flu",
    "malaria", "measles", "polio", "rabies", "typhoid", "lassa", "marburg",
    "covid", "sars", "mers", "yellow fever", "meningitis", "plague",
    "hantavirus", "rickettsia", "leishmaniasis", "brucellosis",
    "alert", "cases", "deaths", "fatalities", "surveillance",
]

MAX_ITEMS_PER_FEED = 15   # cap to control Haiku cost
OUTPUT_DIR = Path(__file__).parent.parent / "public"

# ---------------------------------------------------------------------------
# Haiku extraction
# ---------------------------------------------------------------------------

def call_haiku(text: str) -> dict | None:
    """Send text to Claude Haiku, return parsed JSON or None on failure."""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        print("  ⚠ No ANTHROPIC_API_KEY — skipping AI extraction", flush=True)
        return None

    prompt = f"""Extract disease outbreak information from this text and return ONLY valid JSON.

Text:
{text[:2000]}

Return this exact JSON structure (no markdown, no explanation):
{{
  "disease": "disease name or null",
  "country": "country name or null",
  "region": "WHO region (AFRO/AMRO/EMRO/EURO/SEARO/WPRO) or null",
  "iso": "ISO-3166 alpha-2 code or null",
  "cases": number_or_null,
  "deaths": number_or_null,
  "severity": "low|medium|high|critical",
  "summary": "1-2 sentence plain English summary",
  "lat": number_or_null,
  "lng": number_or_null
}}

If this is not about a disease outbreak, return {{"disease": null}}.
"""

    payload = json.dumps({
        "model": "claude-haiku-4-5",
        "max_tokens": 400,
        "messages": [{"role": "user", "content": prompt}]
    }).encode()

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = json.loads(resp.read())
            raw = body["content"][0]["text"].strip()
            # Strip markdown code fences if present
            raw = re.sub(r"^```[a-z]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw)
            return json.loads(raw)
    except Exception as e:
        print(f"  ⚠ Haiku error: {e}", flush=True)
        return None


# ---------------------------------------------------------------------------
# RSS fetch
# ---------------------------------------------------------------------------

def fetch_feed(feed: dict) -> list[dict]:
    """Fetch RSS feed, return list of {title, link, description, pub_date}."""
    print(f"Fetching {feed['name']} …", flush=True)
    try:
        req = urllib.request.Request(
            feed["url"],
            headers={"User-Agent": "EpiScope/1.0 (github.com/arablex/episwope)"},
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            content = resp.read()
    except urllib.error.URLError as e:
        print(f"  ✗ fetch failed: {e}", flush=True)
        return []

    try:
        root = ET.fromstring(content)
    except ET.ParseError as e:
        print(f"  ✗ XML parse error: {e}", flush=True)
        return []

    ns = ""
    items = root.findall(".//item") or root.findall(".//{http://www.w3.org/2005/Atom}entry")
    results = []
    for item in items:
        def text(tag):
            el = item.find(tag) or item.find(f"{{{ns}}}{tag}")
            return (el.text or "").strip() if el is not None else ""

        title = text("title")
        desc  = text("description") or text("summary") or text("content")
        link  = text("link") or text("guid")
        pub   = text("pubDate") or text("updated") or text("published")

        combined = (title + " " + desc).lower()
        if not any(kw in combined for kw in KEYWORDS):
            continue

        results.append({
            "source": feed["tag"],
            "title": title,
            "link": link,
            "description": re.sub(r"<[^>]+>", " ", desc)[:800],
            "pub_date": pub,
        })

        if len(results) >= MAX_ITEMS_PER_FEED:
            break

    print(f"  → {len(results)} outbreak items", flush=True)
    return results


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    all_raw = []
    for feed in FEEDS:
        items = fetch_feed(feed)
        all_raw.extend(items)
        time.sleep(1)   # polite delay between fetches

    print(f"\nTotal candidate items: {len(all_raw)}", flush=True)
    print("Running Haiku extraction …\n", flush=True)

    events = []
    alerts = []
    seen_diseases = set()

    for raw in all_raw:
        text = raw["title"] + "\n\n" + raw["description"]
        extracted = call_haiku(text)
        time.sleep(0.3)  # avoid hammering API

        if not extracted or not extracted.get("disease"):
            continue

        event = {
            "id": f"{raw['source']}-{len(events)}",
            "disease": extracted.get("disease"),
            "country": extracted.get("country"),
            "iso": extracted.get("iso"),
            "region": extracted.get("region"),
            "lat": extracted.get("lat"),
            "lng": extracted.get("lng"),
            "cases": extracted.get("cases"),
            "deaths": extracted.get("deaths"),
            "severity": extracted.get("severity", "low"),
            "summary": extracted.get("summary", raw["title"]),
            "source": raw["source"].upper(),
            "link": raw["link"],
            "date": raw["pub_date"],
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
        events.append(event)

        # High-severity → alerts panel
        if extracted.get("severity") in ("high", "critical"):
            key = (extracted.get("disease", ""), extracted.get("country", ""))
            if key not in seen_diseases:
                seen_diseases.add(key)
                alerts.append({
                    "disease": extracted.get("disease"),
                    "country": extracted.get("country"),
                    "severity": extracted.get("severity"),
                    "summary": extracted.get("summary", raw["title"]),
                    "link": raw["link"],
                    "date": raw["pub_date"],
                })

    meta = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "total_events": len(events),
        "total_alerts": len(alerts),
    }

    events_out = {"meta": meta, "events": events}
    alerts_out = {"meta": meta, "alerts": alerts}

    (OUTPUT_DIR / "events.json").write_text(
        json.dumps(events_out, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (OUTPUT_DIR / "alerts.json").write_text(
        json.dumps(alerts_out, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"\n✓ Wrote {len(events)} events + {len(alerts)} alerts")
    print(f"  → {OUTPUT_DIR}/events.json")
    print(f"  → {OUTPUT_DIR}/alerts.json")


if __name__ == "__main__":
    main()
