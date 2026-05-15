#!/usr/bin/env python3
"""
EpiScope data fetcher — runs every 6 hours via GitHub Actions.
Fetches WHO DON + ProMED + ECDC RSS feeds, extracts structured outbreak data.

Mode A (free, default): regex + keyword pattern matching on RSS titles
Mode B (optional):      Claude Haiku for richer extraction if ANTHROPIC_API_KEY is set

Cost: $0/month in Mode A. ~$1-2/month in Mode B.
"""

import json, os, re, time, xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
import urllib.request, urllib.error

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

FEEDS = [
    {"name": "WHO DON",  "url": "https://www.who.int/rss-feeds/news.rss",            "tag": "who"},
    {"name": "ProMED",   "url": "https://promedmail.org/promed-rss/",                 "tag": "promed"},
    {"name": "ECDC",     "url": "https://www.ecdc.europa.eu/en/rss.xml",             "tag": "ecdc"},
]

KEYWORDS = [
    "outbreak","disease","virus","epidemic","pandemic","infection",
    "cholera","dengue","ebola","mpox","monkeypox","influenza","avian flu","avian influenza",
    "malaria","measles","polio","rabies","typhoid","lassa","marburg","yellow fever",
    "meningitis","plague","hantavirus","covid","sars","mers","rift valley",
    "alert","cases","deaths","fatalities","surveillance",
]

MAX_ITEMS_PER_FEED = 15
OUTPUT_DIR = Path(__file__).parent.parent / "public"

# ---------------------------------------------------------------------------
# Free extraction: pattern matching on WHO/ECDC structured titles
# WHO DON titles follow: "Disease Name – Country" or "Disease Name - Country"
# ---------------------------------------------------------------------------

DISEASE_PATTERNS = [
    (r"ebola|ebolavirus|ebv",                       "Ebola virus disease",      "critical"),
    (r"marburg",                                     "Marburg virus disease",    "critical"),
    (r"lassa",                                       "Lassa fever",              "warning"),
    (r"mpox|monkeypox",                              "Mpox",                     "warning"),
    (r"cholera",                                     "Cholera",                  "alert"),
    (r"dengue",                                      "Dengue fever",             "alert"),
    (r"h5n1|avian influenza|avian flu|bird flu",     "Avian influenza A(H5N1)",  "high"),
    (r"yellow fever",                                "Yellow fever",             "warning"),
    (r"meningitis|meningococcal",                    "Meningitis",               "alert"),
    (r"plague|yersinia",                             "Plague",                   "critical"),
    (r"rift valley",                                 "Rift Valley fever",        "warning"),
    (r"measles|morbillivirus",                       "Measles",                  "warning"),
    (r"polio|poliovirus",                            "Polio",                    "warning"),
    (r"typhoid|salmonella typhi",                    "Typhoid fever",            "warning"),
    (r"malaria|plasmodium",                          "Malaria",                  "alert"),
    (r"rabies",                                      "Rabies",                   "monitoring"),
    (r"crimean.congo|cchf",                          "Crimean–Congo HF",         "warning"),
    (r"covid|sars-cov|coronavirus",                  "COVID-19",                 "monitoring"),
    (r"influenza|flu\b",                             "Influenza",                "low"),
]

# Country name → (ISO alpha-2, lat, lng, WHO region)
COUNTRY_DB = {
    "democratic republic of the congo": ("CD", -4.0,  21.7,  "AFRO"),
    "dr congo": ("CD", -4.0, 21.7, "AFRO"),
    "drc":      ("CD", -4.0, 21.7, "AFRO"),
    "congo":    ("CD", -4.0, 21.7, "AFRO"),
    "nigeria":  ("NG",  9.1,  8.7, "AFRO"),
    "ethiopia": ("ET",  9.1, 40.5, "AFRO"),
    "sudan":    ("SD", 15.5, 32.5, "EMRO"),
    "south sudan": ("SS", 7.9, 29.7, "AFRO"),
    "kenya":    ("KE", -1.3, 36.8, "AFRO"),
    "uganda":   ("UG",  1.4, 32.3, "AFRO"),
    "tanzania": ("TZ", -6.4, 34.9, "AFRO"),
    "ghana":    ("GH",  7.9, -1.0, "AFRO"),
    "cameroon": ("CM",  3.9, 11.5, "AFRO"),
    "guinea":   ("GN", 11.0,-10.9, "AFRO"),
    "sierra leone": ("SL", 8.5,-11.8, "AFRO"),
    "liberia":  ("LR",  6.4,-9.4,  "AFRO"),
    "mali":     ("ML", 17.6,-4.0,  "AFRO"),
    "niger":    ("NE", 17.6,  8.1, "AFRO"),
    "chad":     ("TD", 15.5, 18.7, "AFRO"),
    "angola":   ("AO", -11.2,17.9, "AFRO"),
    "mozambique": ("MZ",-18.7, 35.5,"AFRO"),
    "zambia":   ("ZM", -13.1, 27.8,"AFRO"),
    "zimbabwe": ("ZW", -20.0, 30.0,"AFRO"),
    "somalia":  ("SO",  6.0, 46.2, "AFRO"),
    "brazil":   ("BR", -14.2,-51.9,"AMRO"),
    "colombia": ("CO",   4.6,-74.3,"AMRO"),
    "peru":     ("PE",  -9.2,-75.0,"AMRO"),
    "haiti":    ("HT",  19.0,-72.3,"AMRO"),
    "bolivia":  ("BO", -16.3,-63.6,"AMRO"),
    "argentina":("AR", -38.4,-63.6,"AMRO"),
    "mexico":   ("MX",  23.6,-102.6,"AMRO"),
    "united states": ("US", 37.1,-95.7,"AMRO"),
    "usa":      ("US", 37.1,-95.7,"AMRO"),
    "canada":   ("CA", 56.1,-106.3,"AMRO"),
    "pakistan": ("PK", 30.4, 69.3,"EMRO"),
    "afghanistan": ("AF", 33.9, 67.7,"EMRO"),
    "iran":     ("IR", 32.4, 53.7,"EMRO"),
    "iraq":     ("IQ", 33.2, 43.7,"EMRO"),
    "syria":    ("SY", 34.8, 38.9,"EMRO"),
    "yemen":    ("YE", 15.6, 48.5,"EMRO"),
    "egypt":    ("EG", 26.8, 30.8,"EMRO"),
    "india":    ("IN", 20.6, 78.9,"SEARO"),
    "bangladesh": ("BD", 23.7, 90.4,"SEARO"),
    "indonesia": ("ID", -0.8,113.9,"SEARO"),
    "myanmar":  ("MM", 16.9, 96.1,"SEARO"),
    "thailand": ("TH", 15.9, 100.9,"SEARO"),
    "vietnam":  ("VN", 14.1,108.3,"WPRO"),
    "philippines": ("PH", 12.9,121.8,"WPRO"),
    "china":    ("CN", 35.9,104.2,"WPRO"),
    "cambodia": ("KH", 12.6,104.9,"WPRO"),
    "papua new guinea": ("PG", -6.3,143.9,"WPRO"),
    "france":   ("FR", 46.2,  2.2,"EURO"),
    "germany":  ("DE", 51.2, 10.5,"EURO"),
    "italy":    ("IT", 41.9, 12.6,"EURO"),
    "ukraine":  ("UA", 48.4, 31.2,"EURO"),
    "turkey":   ("TR", 38.9, 35.2,"EURO"),
    "russia":   ("RU", 61.5, 105.3,"EURO"),
    "kazakhstan": ("KZ", 48.0, 68.0,"EURO"),
}

SEV_ORDER = {"critical":4,"alert":3,"warning":2,"high":2,"low":1,"monitoring":0}

def extract_free(title: str, description: str) -> dict | None:
    """Extract outbreak data using regex + keyword patterns. No API needed."""
    text = (title + " " + description).lower()

    # Match disease
    disease_name, severity = None, "monitoring"
    for pattern, name, sev in DISEASE_PATTERNS:
        if re.search(pattern, text, re.I):
            disease_name = name
            severity = sev
            break
    if not disease_name:
        return None

    # Extract country from title (WHO format: "Disease – Country – DON")
    country_name, iso, lat, lng, region = None, None, None, None, None
    # Try dash-separated segments first
    segments = re.split(r"\s[–—-]\s", title)
    for seg in segments[1:]:
        seg_clean = seg.strip().lower()
        seg_clean = re.sub(r"\s*–.*$","", seg_clean).strip()
        seg_clean = re.sub(r"\s*\(.*?\)","", seg_clean).strip()
        if seg_clean in COUNTRY_DB:
            iso, lat, lng, region = COUNTRY_DB[seg_clean]
            country_name = seg.strip().split("–")[0].strip().title()
            break
    # Fallback: scan full text for country names
    if not country_name:
        for cname, (c_iso, c_lat, c_lng, c_reg) in COUNTRY_DB.items():
            if cname in text:
                country_name = cname.title()
                iso, lat, lng, region = c_iso, c_lat, c_lng, c_reg
                break

    # Extract numbers
    cases  = _extract_number(text, r"(\d[\d,\.]+)\s*(?:confirmed\s*)?cases?")
    deaths = _extract_number(text, r"(\d[\d,\.]+)\s*deaths?")

    summary = (description[:200] if description else title)
    summary = re.sub(r"<[^>]+>", " ", summary).strip()[:200]

    return {
        "disease": disease_name,
        "country": country_name,
        "iso":     iso,
        "region":  region,
        "lat":     lat,
        "lng":     lng,
        "cases":   cases,
        "deaths":  deaths,
        "severity": severity,
        "summary": summary or title[:200],
    }

def _extract_number(text: str, pattern: str) -> int | None:
    m = re.search(pattern, text, re.I)
    if not m: return None
    try:
        return int(m.group(1).replace(",","").replace(".",""))
    except: return None

# ---------------------------------------------------------------------------
# AI extraction — tries providers in priority order, first available wins
# Priority: GEMINI_API_KEY → GROQ_API_KEY → ANTHROPIC_API_KEY → skip (free mode)
# ---------------------------------------------------------------------------

EXTRACTION_PROMPT = """Extract disease outbreak info from this text. Return ONLY valid JSON, no markdown, no explanation.

Text: {text}

JSON structure:
{{"disease":string_or_null,"country":string_or_null,"region":"AFRO|AMRO|EMRO|EURO|SEARO|WPRO|null","iso":"ISO alpha-2 or null","cases":integer_or_null,"deaths":integer_or_null,"severity":"low|medium|high|critical","summary":"1-2 sentence plain English summary","summary_ru":"1-2 sentence Russian translation of summary","lat":number_or_null,"lng":number_or_null}}

If not a disease outbreak return {{"disease":null}}"""


def _parse_ai_json(raw: str) -> dict | None:
    raw = re.sub(r"^```[a-z]*\n?", "", raw.strip())
    raw = re.sub(r"\n?```$", "", raw)
    try:
        return json.loads(raw)
    except Exception:
        return None


def call_gemini(text: str) -> dict | None:
    """Google Gemini Flash — FREE tier: 1500 req/day. Get key: aistudio.google.com"""
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        return None
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={key}"
    payload = json.dumps({
        "contents": [{"parts": [{"text": EXTRACTION_PROMPT.format(text=text[:1800])}]}],
        "generationConfig": {"maxOutputTokens": 400, "temperature": 0}
    }).encode()
    req = urllib.request.Request(url, data=payload,
        headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = json.loads(resp.read())
            raw = body["candidates"][0]["content"]["parts"][0]["text"]
            return _parse_ai_json(raw)
    except Exception as e:
        print(f"  ⚠ Gemini: {e}", flush=True)
        return None


def call_groq(text: str) -> dict | None:
    """Groq (Llama 3.3 70B) — FREE tier: ~14 400 req/day. Get key: console.groq.com"""
    key = os.environ.get("GROQ_API_KEY", "")
    if not key:
        return None
    payload = json.dumps({
        "model": "llama-3.3-70b-versatile",
        "max_tokens": 400,
        "temperature": 0,
        "messages": [{"role": "user", "content": EXTRACTION_PROMPT.format(text=text[:1800])}]
    }).encode()
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions", data=payload,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = json.loads(resp.read())
            raw = body["choices"][0]["message"]["content"]
            return _parse_ai_json(raw)
    except Exception as e:
        print(f"  ⚠ Groq: {e}", flush=True)
        return None


def call_haiku(text: str) -> dict | None:
    """Anthropic Claude Haiku — ~$1-2/month. Get key: console.anthropic.com"""
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        return None
    payload = json.dumps({
        "model": "claude-haiku-4-5", "max_tokens": 400,
        "messages": [{"role": "user", "content": EXTRACTION_PROMPT.format(text=text[:1800])}]
    }).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages", data=payload,
        headers={"x-api-key": key, "anthropic-version": "2023-06-01",
                 "content-type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = json.loads(resp.read())
            return _parse_ai_json(body["content"][0]["text"])
    except Exception as e:
        print(f"  ⚠ Haiku: {e}", flush=True)
        return None


def call_ai(text: str) -> dict | None:
    """Try AI providers in order: Gemini (free) → Groq (free) → Haiku (paid)."""
    return call_gemini(text) or call_groq(text) or call_haiku(text)


def detect_ai_mode() -> str:
    if os.environ.get("GEMINI_API_KEY"):   return "gemini (free)"
    if os.environ.get("GROQ_API_KEY"):     return "groq (free)"
    if os.environ.get("ANTHROPIC_API_KEY"):return "haiku (paid)"
    return "regex (free)"

# ---------------------------------------------------------------------------
# RSS fetch
# ---------------------------------------------------------------------------

def fetch_feed(feed: dict) -> list[dict]:
    print(f"Fetching {feed['name']} …", flush=True)
    try:
        req = urllib.request.Request(feed["url"],
            headers={"User-Agent":"EpiScope/1.0 (github.com/arablex/episwope)"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            content = resp.read()
    except Exception as e:
        print(f"  ✗ {e}", flush=True); return []
    try:
        root = ET.fromstring(content)
    except ET.ParseError as e:
        print(f"  ✗ XML: {e}", flush=True); return []

    items = root.findall(".//item") or root.findall(".//{http://www.w3.org/2005/Atom}entry")
    results = []
    for item in items:
        def t(tag):
            el = item.find(tag)
            return (el.text or "").strip() if el is not None else ""
        title = t("title"); desc = re.sub(r"<[^>]+>"," ", t("description") or t("summary") or "")
        link  = t("link") or t("guid"); pub = t("pubDate") or t("updated") or ""
        combined = (title+" "+desc).lower()
        if not any(kw in combined for kw in KEYWORDS): continue
        results.append({"source":feed["tag"],"title":title,"link":link,"description":desc[:600],"pub_date":pub})
        if len(results) >= MAX_ITEMS_PER_FEED: break
    print(f"  → {len(results)} items", flush=True)
    return results

# ---------------------------------------------------------------------------
# GDACS — Global Disaster Alert and Coordination System (free, no key needed)
# Orange/Red alerts = disease-risk triggers (floods→cholera, cyclones→dengue)
# ---------------------------------------------------------------------------

GDACS_DISEASE_RISK = {
    "FL": "Flood → elevated risk of waterborne diseases (cholera, typhoid, leptospirosis)",
    "TC": "Tropical cyclone → risk of dengue, cholera after landfall",
    "EQ": "Earthquake → risk of waterborne diseases if infrastructure damaged",
    "VO": "Volcanic eruption → respiratory hazard, population displacement risk",
    "DR": "Drought → malnutrition risk, potential meningitis and cholera spread",
    "TS": "Tsunami → waterborne disease risk in affected coastal communities",
}

GDACS_NAMES = {
    "FL": "Catastrophic Flood",
    "TC": "Tropical Cyclone",
    "EQ": "Earthquake",
    "VO": "Volcanic Eruption",
    "DR": "Severe Drought",
    "TS": "Tsunami",
}

def fetch_gdacs() -> list[dict]:
    """Fetch GDACS Orange/Red disaster alerts — direct disease-risk triggers."""
    print("Fetching GDACS …", flush=True)
    url = "https://www.gdacs.org/xml/rss.xml"
    try:
        req = urllib.request.Request(url,
            headers={"User-Agent": "EpiScope/1.0 (github.com/arablex/episwope)"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            content = resp.read()
    except Exception as e:
        print(f"  ✗ GDACS: {e}", flush=True)
        return []
    try:
        root = ET.fromstring(content)
    except ET.ParseError as e:
        print(f"  ✗ GDACS XML: {e}", flush=True)
        return []

    GDACS_NS  = "http://www.gdacs.org"
    GEO_NS    = "http://www.w3.org/2003/01/geo/wgs84_pos#"
    results   = []

    for item in root.findall(".//item"):
        def gn(tag, ns):
            el = item.find(f"{{{ns}}}{tag}")
            return (el.text or "").strip() if el is not None else ""

        alert_level = gn("alertlevel", GDACS_NS)
        if alert_level not in ("Orange", "Red"):
            continue

        event_type   = gn("eventtype",  GDACS_NS)
        country      = gn("country",    GDACS_NS)
        severity_txt = gn("severity",   GDACS_NS)
        title        = (item.find("title").text or "").strip() if item.find("title") is not None else ""
        link_el      = item.find("link")
        link         = (link_el.text or "").strip() if link_el is not None else ""
        pub_el       = item.find("pubDate")
        pub_date     = (pub_el.text or "").strip() if pub_el is not None else ""

        try:
            lat = float(gn("lat",  GEO_NS))
            lng = float(gn("long", GEO_NS))
        except (ValueError, TypeError):
            lat, lng = None, None

        country_lower = country.lower()
        if lat is None and country_lower in COUNTRY_DB:
            _, lat, lng, _ = COUNTRY_DB[country_lower]

        sev = "alert" if alert_level == "Red" else "warning"
        disease_note = GDACS_DISEASE_RISK.get(event_type, "Natural disaster — potential health impact on affected population")

        results.append({
            "source":        "gdacs",
            "disaster_type": event_type,
            "title":         title,
            "link":          link,
            "description":   disease_note,
            "pub_date":      pub_date,
            "country":       country,
            "lat":           lat,
            "lng":           lng,
            "severity":      sev,
        })

    print(f"  → {len(results)} GDACS alerts (Orange/Red only)", flush=True)
    return results

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    mode = detect_ai_mode()
    has_ai = mode != "regex (free)"
    print(f"Mode: {mode}", flush=True)

    all_raw = []
    for feed in FEEDS:
        all_raw.extend(fetch_feed(feed))
        time.sleep(1)

    # GDACS disaster alerts (disease-risk triggers)
    gdacs_raw = fetch_gdacs()
    time.sleep(1)

    print(f"\nTotal candidates: {len(all_raw)}", flush=True)

    events, alerts, seen = [], [], set()

    for raw in all_raw:
        text = raw["title"] + "\n\n" + raw["description"]

        # Try AI first (if available), fall back to free extraction
        extracted = None
        if has_ai:
            extracted = call_ai(text)
            time.sleep(0.25)
        if not extracted or not extracted.get("disease"):
            extracted = extract_free(raw["title"], raw["description"])
        if not extracted or not extracted.get("disease"):
            continue

        sev_raw = extracted.get("severity","monitoring")
        # normalise: "high" → "alert", "medium" → "warning"
        sev_map = {"high":"alert","medium":"warning","critical":"critical","low":"low","monitoring":"monitoring"}
        severity = sev_map.get(sev_raw, sev_raw)

        event = {
            "id": f"{raw['source']}-{len(events)}",
            "type":     "epidemic",
            "disease":  extracted.get("disease"),
            "country":  extracted.get("country"),
            "iso":      extracted.get("iso"),
            "region":   extracted.get("region"),
            "lat":      extracted.get("lat"),
            "lng":      extracted.get("lng"),
            "cases":    extracted.get("cases"),
            "deaths":   extracted.get("deaths"),
            "severity": severity,
            "summary":    extracted.get("summary", raw["title"])[:300],
            "summary_ru": extracted.get("summary_ru", "")[:300],
            "source":   raw["source"].upper(),
            "link":     raw["link"],
            "date":     raw["pub_date"],
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
        events.append(event)

        if severity in ("alert","critical"):
            key = (extracted.get("disease",""), extracted.get("country",""))
            if key not in seen:
                seen.add(key)
                alerts.append({k: event[k] for k in ("disease","country","severity","summary","link","date")})

    # Inject GDACS disaster events
    for gev in gdacs_raw:
        country_lower = (gev.get("country") or "").lower()
        coords = COUNTRY_DB.get(country_lower)
        if coords:
            iso, lat, lng, region = coords
        else:
            iso, lat, lng, region = None, gev.get("lat"), gev.get("lng"), "UNKNOWN"

        events.append({
            "id":            f"gdacs-{gev.get('disaster_type','?')}-{len(events)}",
            "type":          "disaster",
            "disaster_type": gev.get("disaster_type", ""),
            "disease":       GDACS_NAMES.get(gev.get('disaster_type',''), 'Disaster Alert'),
            "country":       gev.get("country", ""),
            "iso":           iso,
            "region":        region,
            "lat":           lat,
            "lng":           lng,
            "cases":         None,
            "deaths":        None,
            "severity":      gev.get("severity", "monitoring"),
            "summary":       gev.get("description", gev.get("title", ""))[:300],
            "source":        "GDACS",
            "link":          gev.get("link", ""),
            "date":          gev.get("pub_date", ""),
            "fetched_at":    datetime.now(timezone.utc).isoformat(),
        })

    if len(events) == 0:
        print("⚠ 0 events extracted — preserving existing data, skipping overwrite", flush=True)
        import sys; sys.exit(0)

    meta = {"updated_at": datetime.now(timezone.utc).isoformat(),
            "total_events": len(events), "total_alerts": len(alerts),
            "mode": mode}

    (OUTPUT_DIR/"events.json").write_text(
        json.dumps({"meta":meta,"events":events}, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUTPUT_DIR/"alerts.json").write_text(
        json.dumps({"meta":meta,"alerts":alerts}, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n✓ {len(events)} events · {len(alerts)} alerts · mode={meta['mode']}")

if __name__ == "__main__":
    main()
