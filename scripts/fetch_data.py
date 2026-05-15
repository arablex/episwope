#!/usr/bin/env python3
"""
EpiScope data fetcher — runs every 12 hours via GitHub Actions.

Sources (in priority order):
  1. ReliefWeb API        — structured health/disease reports, JSON, no key needed
  2. WHO DON JSON         — WHO Disease Outbreak News (internal Sitefinity endpoint)
  3. HealthMap API        — global alerts (optional, HEALTHMAP_API_KEY)
  4. Rospotrebnadzor RSS  — Russian federal epidemiology service (Russian text → AI)
  5. China CDC Weekly     — monthly Notifiable Infectious Diseases report (scraped)
  6. Eurosurveillance RSS — European CDC surveillance journal
  7. Outbreak News Today  — curated daily outbreak reports
  8. ECDC / Africa CDC / PAHO / CDC-HAN RSS feeds
  9. GDACS               — Orange/Red disaster alerts (disease-risk triggers)

AI extraction (optional, free tiers):
  GEMINI_API_KEY    → gemini-2.0-flash (1500 req/day free, multilingual)
  GROQ_API_KEY      → llama-3.3-70b (14400 req/day free)
  ANTHROPIC_API_KEY → claude-haiku-4-5 (~$1-2/month)

Cost: $0/month in regex mode. ~$0-2/month with AI keys.
"""

import json, os, re, time, xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from pathlib import Path
import urllib.request, urllib.error, urllib.parse

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

MAX_EVENT_AGE_DAYS = 90   # skip events older than this
MAX_EVENTS         = 80   # cap total output
MAX_PER_FEED       = 20

OUTPUT_DIR = Path(__file__).parent.parent / "public"

RSS_FEEDS = [
    # WHO: main disease outbreak news RSS
    {"name": "WHO News",         "url": "https://www.who.int/feeds/entity/csr/don/en/rss.xml",              "tag": "WHO"},
    # Outbreak News Today — curated daily outbreak reports (confirmed working)
    {"name": "OutbreakNewsToday","url": "https://outbreaknewstoday.com/feed/",                              "tag": "ONT"},
    # Eurosurveillance — European disease surveillance journal (covers Russia-adjacent outbreaks)
    {"name": "Eurosurveillance", "url": "https://www.eurosurveillance.org/rss/content/all/latest?fmt=rss",  "tag": "ESurv"},
    # ECDC surveillance news
    {"name": "ECDC",             "url": "https://www.ecdc.europa.eu/en/news-events/rss",                    "tag": "ECDC"},
    # Africa CDC
    {"name": "Africa CDC",       "url": "https://africacdc.org/feed/",                                      "tag": "AfricaCDC"},
    # PAHO news (Americas)
    {"name": "PAHO",             "url": "https://www.paho.org/hq/index.php?format=feed&type=rss",           "tag": "PAHO"},
    # CDC Health Alert Network
    {"name": "CDC HAN",          "url": "https://emergency.cdc.gov/han/feed/atom.xml",                      "tag": "CDC-HAN"},
]

KEYWORDS = [
    "outbreak","disease","virus","epidemic","infection","alert","emergency",
    "cholera","dengue","ebola","mpox","monkeypox","influenza","avian flu","h5n1","h5n2",
    "malaria","measles","polio","rabies","typhoid","lassa","marburg","yellow fever",
    "meningitis","plague","hantavirus","covid","sars","mers","rift valley fever",
    "listeria","salmonella","e. coli","brucellosis","anthrax","tularemia",
    "diphtheria","pertussis","whooping cough","hepatitis","hiv","tuberculosis","tb",
    "zika","chikungunya","west nile","nipah","hendra","crimean-congo",
    "cases","deaths","fatalities","surveillance","zoonotic","spillover",
    "flood","earthquake","cyclone","drought","tsunami","humanitarian",
]

# ---------------------------------------------------------------------------
# Country → (ISO alpha-2, lat, lng, WHO region)
# ---------------------------------------------------------------------------

COUNTRY_DB = {
    "democratic republic of the congo": ("CD", -4.0,  21.7,  "AFRO"),
    "dr congo":    ("CD", -4.0,  21.7,  "AFRO"),
    "drc":         ("CD", -4.0,  21.7,  "AFRO"),
    "congo":       ("CD", -4.0,  21.7,  "AFRO"),
    "nigeria":     ("NG",  9.1,   8.7,  "AFRO"),
    "ethiopia":    ("ET",  9.1,  40.5,  "AFRO"),
    "sudan":       ("SD", 15.5,  32.5,  "EMRO"),
    "south sudan": ("SS",  7.9,  29.7,  "AFRO"),
    "kenya":       ("KE", -1.3,  36.8,  "AFRO"),
    "uganda":      ("UG",  1.4,  32.3,  "AFRO"),
    "tanzania":    ("TZ", -6.4,  34.9,  "AFRO"),
    "ghana":       ("GH",  7.9,  -1.0,  "AFRO"),
    "cameroon":    ("CM",  3.9,  11.5,  "AFRO"),
    "guinea":      ("GN", 11.0, -10.9,  "AFRO"),
    "sierra leone":("SL",  8.5, -11.8,  "AFRO"),
    "liberia":     ("LR",  6.4,  -9.4,  "AFRO"),
    "mali":        ("ML", 17.6,  -4.0,  "AFRO"),
    "niger":       ("NE", 17.6,   8.1,  "AFRO"),
    "chad":        ("TD", 15.5,  18.7,  "AFRO"),
    "angola":      ("AO",-11.2,  17.9,  "AFRO"),
    "mozambique":  ("MZ",-18.7,  35.5,  "AFRO"),
    "zambia":      ("ZM",-13.1,  27.8,  "AFRO"),
    "zimbabwe":    ("ZW",-20.0,  30.0,  "AFRO"),
    "somalia":     ("SO",  6.0,  46.2,  "AFRO"),
    "senegal":     ("SN", 14.5, -14.5,  "AFRO"),
    "ivory coast": ("CI",  7.5,  -5.5,  "AFRO"),
    "cote d'ivoire":("CI", 7.5, -5.5,  "AFRO"),
    "burkina faso":("BF", 12.4,  -1.6,  "AFRO"),
    "guinea-bissau":("GW",12.0, -15.0,  "AFRO"),
    "rwanda":      ("RW", -1.9,  29.9,  "AFRO"),
    "burundi":     ("BI", -3.4,  30.0,  "AFRO"),
    "malawi":      ("MW",-13.3,  34.3,  "AFRO"),
    "south africa":("ZA",-30.6,  22.9,  "AFRO"),
    "madagascar":  ("MG",-20.0,  47.0,  "AFRO"),
    "gabon":       ("GA", -0.8,  11.6,  "AFRO"),
    "central african republic":("CF", 7.0, 21.0, "AFRO"),
    "equatorial guinea":("GQ", 1.7, 10.3, "AFRO"),
    "togo":        ("TG",  8.6,   0.8,  "AFRO"),
    "benin":       ("BJ",  9.3,   2.3,  "AFRO"),
    "brazil":      ("BR",-14.2, -51.9,  "AMRO"),
    "colombia":    ("CO",  4.6, -74.3,  "AMRO"),
    "peru":        ("PE", -9.2, -75.0,  "AMRO"),
    "haiti":       ("HT", 19.0, -72.3,  "AMRO"),
    "bolivia":     ("BO",-16.3, -63.6,  "AMRO"),
    "argentina":   ("AR",-38.4, -63.6,  "AMRO"),
    "mexico":      ("MX", 23.6,-102.6,  "AMRO"),
    "venezuela":   ("VE",  6.4, -66.6,  "AMRO"),
    "ecuador":     ("EC", -1.8, -78.2,  "AMRO"),
    "guatemala":   ("GT", 15.8, -90.2,  "AMRO"),
    "honduras":    ("HN", 15.2, -86.2,  "AMRO"),
    "nicaragua":   ("NI", 12.9, -85.2,  "AMRO"),
    "panama":      ("PA",  8.5, -80.8,  "AMRO"),
    "cuba":        ("CU", 21.5, -79.5,  "AMRO"),
    "united states":("US", 37.1, -95.7, "AMRO"),
    "usa":         ("US", 37.1, -95.7,  "AMRO"),
    "canada":      ("CA", 56.1,-106.3,  "AMRO"),
    "trinidad and tobago":("TT", 10.7, -61.2, "AMRO"),
    "pakistan":    ("PK", 30.4,  69.3,  "EMRO"),
    "afghanistan": ("AF", 33.9,  67.7,  "EMRO"),
    "iran":        ("IR", 32.4,  53.7,  "EMRO"),
    "iraq":        ("IQ", 33.2,  43.7,  "EMRO"),
    "syria":       ("SY", 34.8,  38.9,  "EMRO"),
    "yemen":       ("YE", 15.6,  48.5,  "EMRO"),
    "egypt":       ("EG", 26.8,  30.8,  "EMRO"),
    "saudi arabia":("SA", 24.0,  45.0,  "EMRO"),
    "jordan":      ("JO", 31.0,  36.5,  "EMRO"),
    "libya":       ("LY", 26.3,  17.2,  "EMRO"),
    "morocco":     ("MA", 31.8,  -7.1,  "EMRO"),
    "tunisia":     ("TN", 34.0,   9.0,  "EMRO"),
    "algeria":     ("DZ", 28.0,   3.0,  "EMRO"),
    "india":       ("IN", 20.6,  78.9,  "SEARO"),
    "bangladesh":  ("BD", 23.7,  90.4,  "SEARO"),
    "indonesia":   ("ID", -0.8, 113.9,  "SEARO"),
    "myanmar":     ("MM", 16.9,  96.1,  "SEARO"),
    "thailand":    ("TH", 15.9, 100.9,  "SEARO"),
    "nepal":       ("NP", 28.4,  84.1,  "SEARO"),
    "sri lanka":   ("LK",  7.9,  80.8,  "SEARO"),
    "vietnam":     ("VN", 14.1, 108.3,  "WPRO"),
    "philippines": ("PH", 12.9, 121.8,  "WPRO"),
    "china":       ("CN", 35.9, 104.2,  "WPRO"),
    "cambodia":    ("KH", 12.6, 104.9,  "WPRO"),
    "papua new guinea":("PG", -6.3, 143.9, "WPRO"),
    "laos":        ("LA", 18.2, 103.9,  "WPRO"),
    "malaysia":    ("MY",  4.2, 108.0,  "WPRO"),
    "vanuatu":     ("VU",-17.7, 168.3,  "WPRO"),
    "solomon islands":("SB", -9.5, 160.2, "WPRO"),
    "france":      ("FR", 46.2,   2.2,  "EURO"),
    "germany":     ("DE", 51.2,  10.5,  "EURO"),
    "italy":       ("IT", 41.9,  12.6,  "EURO"),
    "ukraine":     ("UA", 48.4,  31.2,  "EURO"),
    "turkey":      ("TR", 38.9,  35.2,  "EURO"),
    "russia":          ("RU", 61.5, 105.3,  "EURO"),
    "kazakhstan":      ("KZ", 48.0,  68.0,  "EURO"),
    "uzbekistan":      ("UZ", 41.4,  64.6,  "EURO"),
    "tajikistan":      ("TJ", 38.9,  71.3,  "EURO"),
    "kyrgyzstan":      ("KG", 41.2,  74.8,  "EURO"),
    "turkmenistan":    ("TM", 40.0,  59.5,  "EURO"),
    "belarus":         ("BY", 53.7,  28.0,  "EURO"),
    "georgia":         ("GE", 42.3,  43.4,  "EURO"),
    "azerbaijan":      ("AZ", 40.1,  47.6,  "EURO"),
    "armenia":         ("AM", 40.1,  45.0,  "EURO"),
    "moldova":         ("MD", 47.4,  28.4,  "EURO"),
    "mongolia":        ("MN", 46.8, 103.8,  "WPRO"),
    "north korea":     ("KP", 40.3, 127.5,  "WPRO"),
    "south korea":     ("KR", 36.0, 127.8,  "WPRO"),
    "japan":           ("JP", 36.2, 138.3,  "WPRO"),
    "taiwan":          ("TW", 23.7, 121.0,  "WPRO"),
    "singapore":       ("SG",  1.4, 103.8,  "WPRO"),
    "australia":       ("AU",-25.3, 133.8,  "WPRO"),
    "new zealand":     ("NZ",-40.9, 174.9,  "WPRO"),
    "poland":          ("PL", 51.9,  19.1,  "EURO"),
    "romania":     ("RO", 45.9,  24.9,  "EURO"),
    "spain":       ("ES", 40.5,  -3.7,  "EURO"),
    "united kingdom":("GB", 55.4,  -3.4, "EURO"),
    "uk":          ("GB", 55.4,  -3.4,  "EURO"),
    "netherlands": ("NL", 52.3,   5.3,  "EURO"),
    "belgium":     ("BE", 50.5,   4.5,  "EURO"),
    "austria":     ("AT", 47.5,  14.6,  "EURO"),
}

ISO2_NUM = {
    "CD":180,"NG":566,"ET":231,"SD":729,"SS":728,"KE":404,"UG":800,"TZ":834,
    "GH":288,"CM":120,"GN":324,"SL":694,"LR":430,"ML":466,"NE":562,"TD":148,
    "AO":24,"MZ":508,"ZM":894,"ZW":716,"SO":706,"SN":686,"CI":384,"BF":854,
    "RW":646,"BI":108,"MW":454,"ZA":710,"MG":450,"GA":266,"CF":140,"GQ":226,
    "TG":768,"BJ":204,"BR":76,"CO":170,"PE":604,"HT":332,"BO":68,"AR":32,
    "MX":484,"VE":862,"EC":218,"GT":320,"HN":340,"NI":558,"PA":591,"CU":192,
    "US":840,"CA":124,"TT":780,"PK":586,"AF":4,"IR":364,"IQ":368,"SY":760,
    "YE":887,"EG":818,"SA":682,"JO":400,"LY":434,"MA":504,"TN":788,"DZ":12,
    "IN":356,"BD":50,"ID":360,"MM":104,"TH":764,"NP":524,"LK":144,"VN":704,
    "PH":608,"CN":156,"KH":116,"PG":598,"LA":418,"MY":458,"VU":548,"SB":90,
    "FR":250,"DE":276,"IT":380,"UA":804,"TR":792,"RU":643,"KZ":398,"UZ":860,
    "TJ":762,"KG":417,"TM":795,"BY":112,"GE":268,"AZ":31,"AM":51,"MD":498,
    "MN":496,"KP":408,"KR":410,"JP":392,"TW":158,"SG":702,"AU":36,"NZ":554,
    "PL":616,"RO":642,"ES":724,"GB":826,"NL":528,"BE":56,"AT":40,
}

# ---------------------------------------------------------------------------
# Disease patterns for regex extraction
# ---------------------------------------------------------------------------

DISEASE_PATTERNS = [
    (r"ebola|ebolavirus|ebv",                          "Ebola virus disease",     "critical"),
    (r"marburg",                                        "Marburg virus disease",   "critical"),
    (r"lassa",                                          "Lassa fever",             "warning"),
    (r"mpox|monkeypox",                                 "Mpox",                    "warning"),
    (r"cholera",                                        "Cholera",                 "alert"),
    (r"dengue",                                         "Dengue fever",            "alert"),
    (r"h5n1|h5n2|h5n6|h5n8|h7n9|avian influenza|avian flu|bird flu", "Avian influenza", "alert"),
    (r"yellow fever",                                   "Yellow fever",            "warning"),
    (r"meningitis|meningococcal",                       "Meningitis",              "alert"),
    (r"plague|yersinia pestis",                         "Plague",                  "critical"),
    (r"rift valley",                                    "Rift Valley fever",       "warning"),
    (r"measles|rubeola",                                "Measles",                 "warning"),
    (r"polio|poliovirus",                               "Polio",                   "warning"),
    (r"typhoid|salmonella typhi",                       "Typhoid fever",           "warning"),
    (r"malaria|plasmodium",                             "Malaria",                 "alert"),
    (r"rabies",                                         "Rabies",                  "monitoring"),
    (r"crimean.congo|cchf",                             "Crimean–Congo HF",        "warning"),
    (r"covid|sars-cov-2|coronavirus",                   "COVID-19",                "monitoring"),
    (r"\bflu\b|influenza(?! a\(h5)",                   "Influenza",               "monitoring"),
    (r"nipah|niv",                                      "Nipah virus",             "critical"),
    (r"hendra",                                         "Hendra virus",            "critical"),
    (r"anthrax|bacillus anthracis",                     "Anthrax",                 "warning"),
    (r"brucellosis|brucella",                           "Brucellosis",             "warning"),
    (r"tularemia|francisella",                          "Tularemia",               "warning"),
    (r"listeria|listeriosis",                           "Listeriosis",             "alert"),
    (r"salmonella(?! typhi)",                           "Salmonellosis",           "warning"),
    (r"e\.?\s*coli|escherichia coli",                   "E. coli",                 "warning"),
    (r"hepatitis\s*[ae]",                               "Hepatitis",               "alert"),
    (r"zika",                                           "Zika virus",              "warning"),
    (r"chikungunya",                                    "Chikungunya",             "warning"),
    (r"west nile",                                      "West Nile virus",         "warning"),
    (r"diphtheria",                                     "Diphtheria",              "warning"),
    (r"pertussis|whooping cough",                       "Pertussis",               "warning"),
    (r"hanta",                                          "Hantavirus",              "warning"),
    (r"monkeypox",                                      "Mpox",                    "warning"),
    (r"tuberculosis|\btb\b",                            "Tuberculosis",            "monitoring"),
    (r"hiv|aids",                                       "HIV/AIDS",                "monitoring"),
]

GDACS_NAMES = {
    "FL": "Catastrophic Flood",
    "TC": "Tropical Cyclone",
    "EQ": "Earthquake",
    "VO": "Volcanic Eruption",
    "DR": "Severe Drought",
    "TS": "Tsunami",
}

GDACS_DISEASE_RISK = {
    "FL": "Flood → elevated risk of waterborne diseases (cholera, typhoid, leptospirosis)",
    "TC": "Tropical cyclone → dengue/cholera risk after landfall; infrastructure damage",
    "EQ": "Earthquake → waterborne disease risk from damaged infrastructure",
    "VO": "Volcanic eruption → respiratory hazard; population displacement",
    "DR": "Drought → malnutrition, meningitis and cholera spread risk",
    "TS": "Tsunami → waterborne disease risk in affected coastal communities",
}

# ---------------------------------------------------------------------------
# AI extraction — tries providers in priority order
# ---------------------------------------------------------------------------

EXTRACTION_PROMPT = """Extract disease outbreak information from this text. Return ONLY valid JSON.

Text: {text}

JSON structure:
{{"disease":string_or_null,"country":string_or_null,"region":"AFRO|AMRO|EMRO|EURO|SEARO|WPRO|null","iso":"ISO alpha-2 or null","cases":integer_or_null,"deaths":integer_or_null,"severity":"low|medium|high|critical","summary":"1-2 sentence plain English summary of the outbreak","summary_ru":"Russian translation of summary","lat":number_or_null,"lng":number_or_null}}

Severity guide: critical=Ebola/Marburg/Plague/Nipah, high=cholera/dengue outbreak/avian flu, medium=measles/polio/yellow fever, low=endemic monitoring.
If not a disease outbreak or disaster with health impact, return {{"disease":null}}"""


_gemini_disabled = False   # set True on first 429 to skip remaining calls


def _parse_ai_json(raw: str) -> dict:
    raw = re.sub(r"^```[a-z]*\n?", "", raw.strip())
    raw = re.sub(r"\n?```$", "", raw)
    try:
        return json.loads(raw)
    except Exception:
        return None


def call_gemini(text: str) -> dict:
    global _gemini_disabled
    if _gemini_disabled:
        return None
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        return None
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={key}"
    payload = json.dumps({
        "contents": [{"parts": [{"text": EXTRACTION_PROMPT.format(text=text[:2000])}]}],
        "generationConfig": {"maxOutputTokens": 500, "temperature": 0}
    }).encode()
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = json.loads(resp.read())
            result = _parse_ai_json(body["candidates"][0]["content"]["parts"][0]["text"])
            time.sleep(4)  # stay under 15 RPM free-tier limit
            return result
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print(f"  ⚠ Gemini rate limit — switching to regex for remaining items", flush=True)
            _gemini_disabled = True
            return None
        print(f"  ⚠ Gemini: {e}", flush=True)
        return None
    except Exception as e:
        print(f"  ⚠ Gemini: {e}", flush=True)
        return None


def call_groq(text: str) -> dict:
    key = os.environ.get("GROQ_API_KEY", "")
    if not key:
        return None
    payload = json.dumps({
        "model": "llama-3.3-70b-versatile",
        "max_tokens": 500,
        "temperature": 0,
        "messages": [{"role": "user", "content": EXTRACTION_PROMPT.format(text=text[:2000])}]
    }).encode()
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions", data=payload,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = json.loads(resp.read())
            return _parse_ai_json(body["choices"][0]["message"]["content"])
    except Exception as e:
        print(f"  ⚠ Groq: {e}", flush=True)
        return None


def call_haiku(text: str) -> dict:
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        return None
    payload = json.dumps({
        "model": "claude-haiku-4-5", "max_tokens": 500,
        "messages": [{"role": "user", "content": EXTRACTION_PROMPT.format(text=text[:2000])}]
    }).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages", data=payload,
        headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = json.loads(resp.read())
            return _parse_ai_json(body["content"][0]["text"])
    except Exception as e:
        print(f"  ⚠ Haiku: {e}", flush=True)
        return None


def call_ai(text: str) -> dict:
    return call_gemini(text) or call_groq(text) or call_haiku(text)


def detect_ai_mode() -> str:
    if os.environ.get("GEMINI_API_KEY"):    return "gemini (free)"
    if os.environ.get("GROQ_API_KEY"):      return "groq (free)"
    if os.environ.get("ANTHROPIC_API_KEY"): return "haiku (paid)"
    return "regex (free)"

# ---------------------------------------------------------------------------
# Regex extraction — free, no API needed
# ---------------------------------------------------------------------------

def extract_free(title: str, description: str) -> dict:
    text = (title + " " + description).lower()
    disease_name, severity = None, "monitoring"
    for pattern, name, sev in DISEASE_PATTERNS:
        if re.search(pattern, text, re.I):
            disease_name = name
            severity = sev
            break
    if not disease_name:
        return None

    country_name = iso = lat = lng = region = None
    segments = re.split(r"\s[–—\-]\s", title)
    for seg in segments[1:]:
        seg_clean = re.sub(r"\s*[–—\-].*$", "", seg.strip()).lower()
        seg_clean = re.sub(r"\s*\(.*?\)", "", seg_clean).strip()
        if seg_clean in COUNTRY_DB:
            iso, lat, lng, region = COUNTRY_DB[seg_clean]
            country_name = seg.strip().split("–")[0].split("—")[0].strip().title()
            break
    if not country_name:
        for cname, (c_iso, c_lat, c_lng, c_reg) in COUNTRY_DB.items():
            if re.search(r'\b' + re.escape(cname) + r'\b', text, re.I):
                country_name = cname.title()
                iso, lat, lng, region = c_iso, c_lat, c_lng, c_reg
                break

    cases  = _extract_number(text, r"(\d[\d,\.]+)\s*(?:confirmed\s*)?cases?")
    deaths = _extract_number(text, r"(\d[\d,\.]+)\s*deaths?")
    summary = re.sub(r"<[^>]+>", " ", (description or title)[:300]).strip()

    return {
        "disease": disease_name, "country": country_name,
        "iso": iso, "region": region, "lat": lat, "lng": lng,
        "cases": cases, "deaths": deaths, "severity": severity,
        "summary": summary, "summary_ru": "",
    }


def _extract_number(text: str, pattern: str):
    m = re.search(pattern, text, re.I)
    if not m:
        return None
    try:
        return int(m.group(1).replace(",", "").replace(".", ""))
    except Exception:
        return None

# ---------------------------------------------------------------------------
# Russian-language extraction helpers (Rospotrebnadzor)
# ---------------------------------------------------------------------------

# Keywords to filter Rospotrebnadzor RSS items (epidemiology-relevant)
RU_EPIDEMIC_KEYWORDS = [
    "вспышка", "эпидемия", "эпидемиолог", "заболева", "инфекц",
    "вирус", "бактери", "холера", "грипп", "корь", "гепатит",
    "туберкулёз", "туберкулез", "чума", "сибирская язва", "менингит",
    "коклюш", "полиомиелит", "лихорадка", "ботулизм", "сальмонелл",
    "дизентерия", "энцефалит", "боррелиоз", "малярия", "клещевой",
    "бруцеллёз", "бруцеллез", "листериоз", "легионелл", "карантин",
    "очаг заболева", "санитарно-эпидемиологическ", "геморрагическ",
    "бешенство", "лептоспироз", "трихинелл", "иерсиниоз",
]

# Russian disease names → (English name, severity)
RU_DISEASE_MAP = [
    (r"эбола",                             ("Ebola virus disease",     "critical")),
    (r"марбург",                           ("Marburg virus disease",   "critical")),
    (r"нипах",                             ("Nipah virus",             "critical")),
    (r"чума",                              ("Plague",                  "critical")),
    (r"геморрагическая лихорадка конго|кгл",("Crimean-Congo HF",       "warning")),
    (r"геморрагическ",                     ("Hemorrhagic fever",       "warning")),
    (r"лихорадка западного нила",          ("West Nile virus",         "warning")),
    (r"лихорадка денге|денге",             ("Dengue fever",            "alert")),
    (r"зика",                              ("Zika virus",              "warning")),
    (r"оспа обезьян|оспа обезь",           ("Mpox",                   "warning")),
    (r"холера",                            ("Cholera",                 "alert")),
    (r"малярия",                           ("Malaria",                 "alert")),
    (r"менингит|менингококк",              ("Meningitis",              "alert")),
    (r"сибирская язва|антракс",            ("Anthrax",                 "warning")),
    (r"бруцеллёз|бруцеллез",              ("Brucellosis",             "warning")),
    (r"лептоспироз",                       ("Leptospirosis",           "warning")),
    (r"листериоз",                         ("Listeriosis",             "alert")),
    (r"ботулизм",                          ("Botulism",                "warning")),
    (r"корь",                              ("Measles",                 "warning")),
    (r"коклюш",                            ("Pertussis",               "warning")),
    (r"дифтерия",                          ("Diphtheria",              "warning")),
    (r"полиомиелит|полиовирус",            ("Polio",                   "warning")),
    (r"бешенство",                         ("Rabies",                  "monitoring")),
    (r"клещевой энцефалит",               ("Tick-borne encephalitis", "warning")),
    (r"энцефалит",                         ("Encephalitis",            "warning")),
    (r"боррелиоз|болезнь лайма",          ("Lyme disease",            "warning")),
    (r"гепатит\s*а|гепатит\s*е",          ("Hepatitis",               "alert")),
    (r"гепатит",                           ("Hepatitis",               "monitoring")),
    (r"туберкулёз|туберкулез|\bтб\b",     ("Tuberculosis",            "monitoring")),
    (r"грипп\s*[aahн]\s*\(?[hн]5",        ("Avian influenza",         "alert")),
    (r"птичий грипп",                      ("Avian influenza",         "alert")),
    (r"грипп",                             ("Influenza",               "monitoring")),
    (r"сальмонелл",                        ("Salmonellosis",           "warning")),
    (r"дизентерия",                        ("Dysentery",               "warning")),
    (r"иерсиниоз",                         ("Yersiniosis",             "warning")),
    (r"трихинелл",                         ("Trichinellosis",          "warning")),
    (r"легионелл",                         ("Legionellosis",           "warning")),
    (r"ковид|covid|коронавирус",           ("COVID-19",                "monitoring")),
    (r"орви|острые респираторн",           ("ARVI",                    "monitoring")),
    (r"инфекц",                            ("Infectious disease",      "monitoring")),
]

# Russian country names → English (subset for Rospotrebnadzor news)
RU_COUNTRY_MAP = {
    "россий": "russia", "в рф": "russia", "по рф": "russia",
    "китай": "china", "китае": "china",
    "украин": "ukraine",
    "казахстан": "kazakhstan",
    "узбекистан": "uzbekistan",
    "таджикистан": "tajikistan",
    "кыргызстан": "kyrgyzstan", "киргиз": "kyrgyzstan",
    "беларус": "belarus", "белоруссии": "belarus",
    "азербайджан": "azerbaijan",
    "армени": "armenia",
    "грузи": "georgia",
    "турци": "turkey",
    "иран": "iran",
    "афганистан": "afghanistan",
    "индии": "india", "индия": "india",
}


def extract_russian(title: str, description: str) -> dict | None:
    """Fallback extractor for Russian-language text (Rospotrebnadzor).
    Maps Russian disease terms to English equivalents."""
    text = (title + " " + description).lower()

    disease_name, severity = None, "monitoring"
    for ru_pattern, (en_name, sev) in RU_DISEASE_MAP:
        if re.search(ru_pattern, text, re.I):
            disease_name = en_name
            severity = sev
            break

    if not disease_name:
        return None

    # Country detection
    country_key = "russia"  # default: Rospotrebnadzor is Russian federal service
    for ru_frag, en_key in RU_COUNTRY_MAP.items():
        if ru_frag in text:
            country_key = en_key
            break

    coords = COUNTRY_DB.get(country_key)
    if not coords:
        coords = COUNTRY_DB["russia"]

    iso, lat, lng, region = coords
    country_name = country_key.title()

    # Numeric extraction (Russian patterns)
    cases  = _extract_number(text, r"(\d[\d\s]*)\s*(?:случа|заболев|инфицирован)")
    deaths = _extract_number(text, r"(\d[\d\s]*)\s*(?:смерт|погибш|летальн)")

    summary_ru = re.sub(r"<[^>]+>", " ", (title + ". " + description)[:250]).strip()

    return {
        "disease": disease_name, "country": country_name,
        "iso": iso, "region": region, "lat": lat, "lng": lng,
        "cases": cases, "deaths": deaths, "severity": severity,
        "summary": f"Russia epidemiology alert: {disease_name} in {country_name}. "
                   + re.sub(r"<[^>]+>", " ", description[:180]).strip(),
        "summary_ru": summary_ru,
    }

# ---------------------------------------------------------------------------
# Source 1: ReliefWeb API — structured health/disease reports
# ---------------------------------------------------------------------------

def fetch_reliefweb() -> list:
    """ReliefWeb v2 API — health/epidemic reports, no auth needed."""
    print("Fetching ReliefWeb API …", flush=True)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=MAX_EVENT_AGE_DAYS)).strftime("%Y-%m-%dT00:00:00+00:00")

    # Use GET with query params — simpler and avoids 400 errors
    params = urllib.parse.urlencode([
        ("appname", "episcope"),
        ("filter[field]", "primary_type.name"),
        ("filter[value]", "Epidemic"),
        ("limit", "30"),
        ("sort[]", "date.created:desc"),
        ("fields[include][]", "title"),
        ("fields[include][]", "body"),
        ("fields[include][]", "country"),
        ("fields[include][]", "date"),
        ("fields[include][]", "source"),
        ("fields[include][]", "disease"),
        ("fields[include][]", "url"),
    ])
    req = urllib.request.Request(
        f"https://api.reliefweb.int/v2/reports?{params}",
        headers={"User-Agent": "EpiScope/2.0 (episcope.ru)", "Accept": "application/json"},
    )
    results = []
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read())
        items = data.get("data", [])
        print(f"  → {len(items)} ReliefWeb reports", flush=True)
        for item in items:
            f = item.get("fields", {})
            title = f.get("title", "")
            body  = re.sub(r"<[^>]+>", " ", f.get("body", ""))[:600]
            countries = f.get("country", [{}])
            country_name = countries[0].get("name", "") if countries else ""
            country_iso  = countries[0].get("iso3", "")[:2].upper() if countries else ""
            date_str     = f.get("date", {}).get("created", "")
            link         = f.get("url", item.get("href", ""))
            source_list  = f.get("source", [{}])
            source_name  = source_list[0].get("name", "ReliefWeb") if source_list else "ReliefWeb"
            diseases     = f.get("disease", [])
            disease_name = diseases[0].get("name", "") if diseases else ""

            results.append({
                "source": "ReliefWeb",
                "source_detail": source_name,
                "title": title,
                "description": (body or title)[:600],
                "disease_hint": disease_name,
                "country_hint": country_name,
                "iso_hint": country_iso,
                "link": link,
                "pub_date": date_str,
            })
    except Exception as e:
        print(f"  ✗ ReliefWeb: {e}", flush=True)
    return results

# ---------------------------------------------------------------------------
# Source 2: WHO DON internal JSON endpoint
# ---------------------------------------------------------------------------

def fetch_who_don_json() -> list:
    """WHO Disease Outbreak News — Sitefinity CMS internal endpoint."""
    print("Fetching WHO DON JSON …", flush=True)
    endpoints = [
        "https://www.who.int/api/news/diseaseoutbreaknews?sf_culture=en&$top=50&$orderby=PublicationDateAndTime+desc",
        "https://www.who.int/api/emergencies/diseaseoutbreaknews?sf_culture=en&$top=50",
    ]
    for url in endpoints:
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 EpiScope/2.0",
                "Accept": "application/json",
            })
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw = resp.read()
                data = json.loads(raw)
            items = data if isinstance(data, list) else data.get("value", data.get("Items", []))
            if not items:
                continue
            results = []
            for item in items[:50]:
                title   = item.get("Title", item.get("ItemDefaultTitle", ""))
                country = item.get("TitleSuffix", item.get("Countries", ""))
                link    = item.get("ItemDefaultUrl", item.get("Url", ""))
                date    = item.get("PublicationDateAndTime", item.get("Date", ""))
                summary = re.sub(r"<[^>]+>", " ", item.get("Summary", item.get("Content", title)))[:400]
                if not title:
                    continue
                if isinstance(link, str) and not link.startswith("http"):
                    link = "https://www.who.int" + link
                results.append({
                    "source": "WHO-DON",
                    "title": title,
                    "description": summary,
                    "country_hint": country if isinstance(country, str) else "",
                    "link": link,
                    "pub_date": date,
                })
            print(f"  → {len(results)} WHO DON items (JSON)", flush=True)
            return results
        except Exception as e:
            print(f"  ⚠ WHO DON JSON ({url[:50]}…): {e}", flush=True)
            continue
    print("  ✗ WHO DON JSON: all endpoints failed, falling back to RSS", flush=True)
    return []

# ---------------------------------------------------------------------------
# Source 3: HealthMap API (optional — requires free API key)
# Register at: https://healthmap.org/surveillance/  →  HEALTHMAP_API_KEY
# ---------------------------------------------------------------------------

def fetch_healthmap() -> list:
    key = os.environ.get("HEALTHMAP_API_KEY", "")
    if not key:
        return []
    print("Fetching HealthMap API …", flush=True)
    url = (
        f"https://healthmap.org/surveillance/index.php"
        f"?auth={key}&cn=1&striphtml=1&geo=1&count=50&speciesid=1"
        f"&startrow=0&feed=1"
    )
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "EpiScope/2.0 (episcope.ru)",
            "Accept": "application/json",
        })
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read()
        data = json.loads(raw)
        items = data if isinstance(data, list) else data.get("alerts", data.get("data", []))
        results = []
        for item in items[:50]:
            title   = item.get("summary", item.get("title", ""))
            country = item.get("country", item.get("place_name", ""))
            disease = item.get("disease", item.get("diseasename", ""))
            link    = item.get("link",    item.get("url", ""))
            date    = item.get("date",    item.get("event_date", ""))
            lat     = item.get("lat")
            lng     = item.get("lng",     item.get("lon"))
            if not title:
                continue
            try: lat = float(lat)
            except (TypeError, ValueError): lat = None
            try: lng = float(lng)
            except (TypeError, ValueError): lng = None
            results.append({
                "source": "HealthMap",
                "title":  title,
                "description": title,
                "disease_hint": disease,
                "country_hint": country,
                "lat_hint": lat,
                "lng_hint": lng,
                "link":  link,
                "pub_date": date,
            })
        print(f"  → {len(results)} HealthMap alerts", flush=True)
        return results
    except Exception as e:
        print(f"  ✗ HealthMap: {e}", flush=True)
        return []

# ---------------------------------------------------------------------------
# Source 4: Rospotrebnadzor RSS (Russia / CIS)
# ---------------------------------------------------------------------------

def fetch_rospotrebnadzor() -> list:
    """Rospotrebnadzor RSS — Russian federal epidemiology/consumer-protection service.
    Content is in Russian; filtered by epidemic keywords, then passed to AI or
    Russian-regex fallback extractor."""
    print("Fetching Rospotrebnadzor RSS …", flush=True)
    url = "https://www.rospotrebnadzor.ru/region/rss/rss.php?rss=y"
    try:
        opener = urllib.request.build_opener(urllib.request.HTTPRedirectHandler())
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 EpiScope/2.0 (episcope.ru)",
            "Accept": "application/rss+xml,application/xml,text/xml,*/*",
        })
        with opener.open(req, timeout=15) as resp:
            content = resp.read()
    except Exception as e:
        print(f"  ✗ Rospotrebnadzor: {e}", flush=True)
        return []

    try:
        root = ET.fromstring(content)
    except ET.ParseError:
        try:
            cleaned = re.sub(rb'&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);)', rb'&amp;', content)
            root = ET.fromstring(cleaned)
        except ET.ParseError as e2:
            print(f"  ✗ Rospotrebnadzor XML: {e2}", flush=True)
            return []

    items  = root.findall(".//item")
    cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_EVENT_AGE_DAYS)
    results = []

    for item in items:
        def t(tag):
            el = item.find(tag)
            return (el.text or "").strip() if el is not None else ""

        title = t("title")
        desc  = re.sub(r"<[^>]+>", " ", t("description") or "")
        link  = t("link") or t("guid")
        pub   = t("pubDate") or ""

        try:
            from email.utils import parsedate_to_datetime
            pub_dt = parsedate_to_datetime(pub).astimezone(timezone.utc) if pub else None
            if pub_dt and pub_dt < cutoff:
                continue
        except Exception:
            pass

        combined = (title + " " + desc).lower()
        if not any(kw in combined for kw in RU_EPIDEMIC_KEYWORDS):
            continue

        results.append({
            "source": "ROSP",
            "title": title,
            "description": (title + " " + desc)[:600],
            "link": link,
            "pub_date": pub,
        })
        if len(results) >= MAX_PER_FEED:
            break

    print(f"  → {len(results)} Rospotrebnadzor epidemic items", flush=True)
    return results


# ---------------------------------------------------------------------------
# Source 5: China CDC Weekly — monthly Notifiable Infectious Diseases
# ---------------------------------------------------------------------------

# Only include diseases that meet case/death thresholds (avoids noise)
_CHINA_CDC_MIN_CASES = 50
_CHINA_CDC_ALWAYS = {  # include regardless of case count (dangerous pathogens)
    "plague", "cholera", "ebola", "marburg", "nipah", "anthrax", "avian",
}


def _parse_china_cdc_notifiable(html: str, article_url: str) -> list:
    """Parse a China CDC Weekly HTML article table into raw event dicts."""
    # Extract report period from heading
    date_m = re.search(r'(?:China|china)[,\s—\-]+([A-Z][a-z]+\s+\d{4})', html)
    report_date = date_m.group(1) if date_m else ""

    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.S | re.I)
    results = []
    header_found = False
    cases_col, deaths_col = 2, 3  # default column indices

    for row in rows:
        cells_raw = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.S | re.I)
        cells = [re.sub(r'<[^>]+>', ' ', c).replace('\xa0', ' ').strip() for c in cells_raw]
        cells = [re.sub(r'\s+', ' ', c).strip() for c in cells]
        if not cells:
            continue

        first = cells[0].lower()

        # Detect header row
        if any(h in first for h in ('disease', 'diseases')):
            header_found = True
            for i, h in enumerate(cells):
                hl = h.lower()
                if 'cases' in hl and i != 0:
                    cases_col = i
                elif 'death' in hl and i != 0:
                    deaths_col = i
            continue

        if not header_found:
            continue
        if first in ('total', 'sum', 'all', '合计', ''):
            continue

        disease_raw = cells[0].strip()
        if not disease_raw:
            continue

        def parse_num(s):
            s = s.replace(',', '').replace(' ', '').strip()
            if s in ('', '-', '−', '–'):
                return 0
            try:
                return int(float(s))
            except ValueError:
                return None

        cases  = parse_num(cells[cases_col])  if len(cells) > cases_col  else None
        deaths = parse_num(cells[deaths_col]) if len(cells) > deaths_col else None
        if cases is None:
            cases = 0
        if deaths is None:
            deaths = 0

        # Filter low-activity rows
        disease_lower = disease_raw.lower()
        always_include = any(k in disease_lower for k in _CHINA_CDC_ALWAYS)
        if not always_include and cases < _CHINA_CDC_MIN_CASES and deaths == 0:
            continue

        # Map to our disease taxonomy
        mapped_name = disease_raw
        severity    = "monitoring"
        for pattern, name, sev in DISEASE_PATTERNS:
            if re.search(pattern, disease_lower, re.I):
                mapped_name = name
                severity    = sev
                break

        summary = (
            f"China CDC monthly report: {cases:,} cases, {deaths} deaths of "
            f"{mapped_name} in China"
        )
        if report_date:
            summary += f" ({report_date} data)"
        summary += "."

        results.append({
            "source":        "ChinaCDC",
            "title":         f"{mapped_name} — China",
            "description":   summary,
            "disease_hint":  mapped_name,
            "country_hint":  "China",
            "iso_hint":      "CN",
            "cases_direct":  cases if cases > 0 else None,
            "deaths_direct": deaths if deaths > 0 else None,
            "severity_hint": severity,
            "link":          article_url,
            "pub_date":      report_date,
        })

    print(f"  → {len(results)} China CDC disease records", flush=True)
    return results


def fetch_china_cdc_weekly() -> list:
    """China CDC Weekly — scrape the homepage for the latest Notifiable
    Infectious Diseases article, then parse the data table."""
    print("Fetching China CDC Weekly …", flush=True)

    home_html = ""
    for home_url in ["https://weekly.chinacdc.cn/en/", "https://weekly.chinacdc.cn/"]:
        try:
            req = urllib.request.Request(home_url, headers={
                "User-Agent": "Mozilla/5.0 EpiScope/2.0",
                "Accept": "text/html,*/*",
            })
            with urllib.request.urlopen(req, timeout=12) as resp:
                home_html = resp.read().decode("utf-8", errors="replace")
            break
        except Exception as e:
            print(f"  ⚠ China CDC home ({home_url}): {e}", flush=True)

    # Collect candidate article paths from homepage
    all_paths = re.findall(r'href="(/en/article/doi/10\.46234/ccdcw[^"]+)"', home_html)
    all_paths = list(dict.fromkeys(all_paths))  # dedupe, preserve order

    # Prioritise links where surrounding text mentions "Notifiable"
    notif_paths = [
        m.group(1)
        for m in re.finditer(
            r'href="(/en/article/doi/[^"]+)"[^>]*>[^<]*[Nn]otifiable[^<]*<', home_html
        )
    ]
    candidates = notif_paths + [p for p in all_paths if p not in notif_paths]

    # Fallback: probe recent article numbers for current year + previous year
    if not candidates:
        year = datetime.now().year
        max_week = min((datetime.now().timetuple().tm_yday // 7) + 4, 55)
        for y in [year, year - 1]:
            for w in range(max_week if y == year else 55, 0, -1):
                candidates.append(f"/en/article/doi/10.46234/ccdcw{y}.{w:03d}")

    # Fetch candidates until we find a "Notifiable Infectious Diseases" article
    article_html = None
    article_url  = None
    checked = 0
    for path in candidates[:40]:  # hard cap: 40 candidates max
        url = f"https://weekly.chinacdc.cn{path}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 EpiScope/2.0"})
            with urllib.request.urlopen(req, timeout=7) as resp:
                html = resp.read().decode("utf-8", errors="replace")
            checked += 1
            if "Notifiable" in html and "Infectious" in html:
                article_html = html
                article_url  = url
                print(f"  → China CDC article: {url} (checked {checked})", flush=True)
                break
        except urllib.error.HTTPError:
            continue  # 404 / 403 — skip silently
        except Exception:
            continue

    if not article_html:
        print(f"  ✗ China CDC Weekly: no article found (checked {checked})", flush=True)
        return []

    return _parse_china_cdc_notifiable(article_html, article_url)


# ---------------------------------------------------------------------------
# Source 6: RSS feeds
# ---------------------------------------------------------------------------

def fetch_rss(feed: dict) -> list:
    print(f"Fetching {feed['name']} RSS …", flush=True)
    try:
        # Follow redirects (urllib handles 301/302 but not always 308)
        opener = urllib.request.build_opener(urllib.request.HTTPRedirectHandler())
        req = urllib.request.Request(feed["url"], headers={
            "User-Agent": "Mozilla/5.0 EpiScope/2.0 (episcope.ru)",
            "Accept": "application/rss+xml,application/xml,text/xml,*/*",
        })
        with opener.open(req, timeout=15) as resp:
            content = resp.read()
    except Exception as e:
        print(f"  ✗ {e}", flush=True)
        return []
    try:
        root = ET.fromstring(content)
    except ET.ParseError:
        # Strip non-XML entities and retry
        try:
            cleaned = re.sub(rb'&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);)', rb'&amp;', content)
            root = ET.fromstring(cleaned)
        except ET.ParseError as e2:
            print(f"  ✗ XML: {e2}", flush=True)
            return []

    items = root.findall(".//item") or root.findall(".//{http://www.w3.org/2005/Atom}entry")
    results = []
    cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_EVENT_AGE_DAYS)
    for item in items:
        def t(tag):
            el = item.find(tag)
            return (el.text or "").strip() if el is not None else ""
        title   = t("title")
        desc    = re.sub(r"<[^>]+>", " ", t("description") or t("summary") or "")
        link    = t("link") or t("guid")
        pub     = t("pubDate") or t("updated") or ""

        # Date filter
        try:
            from email.utils import parsedate_to_datetime
            pub_dt = parsedate_to_datetime(pub).astimezone(timezone.utc) if pub else None
            if pub_dt and pub_dt < cutoff:
                continue
        except Exception:
            pass

        combined = (title + " " + desc).lower()
        if not any(kw in combined for kw in KEYWORDS):
            continue

        results.append({
            "source": feed["tag"],
            "title": title,
            "description": desc[:600],
            "link": link,
            "pub_date": pub,
        })
        if len(results) >= MAX_PER_FEED:
            break
    print(f"  → {len(results)} items", flush=True)
    return results

# ---------------------------------------------------------------------------
# Source 4: GDACS
# ---------------------------------------------------------------------------

def fetch_gdacs() -> list:
    print("Fetching GDACS …", flush=True)
    url = "https://www.gdacs.org/xml/rss.xml"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "EpiScope/2.0 (episcope.ru)"})
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

    GDACS_NS = "http://www.gdacs.org"
    GEO_NS   = "http://www.w3.org/2003/01/geo/wgs84_pos#"
    results  = []
    cutoff   = datetime.now(timezone.utc) - timedelta(days=MAX_EVENT_AGE_DAYS)

    for item in root.findall(".//item"):
        def gn(tag, ns):
            el = item.find(f"{{{ns}}}{tag}")
            return (el.text or "").strip() if el is not None else ""

        alert_level  = gn("alertlevel", GDACS_NS)
        if alert_level not in ("Orange", "Red"):
            continue

        pub_el   = item.find("pubDate")
        pub_date = (pub_el.text or "").strip() if pub_el is not None else ""
        try:
            from email.utils import parsedate_to_datetime
            pub_dt = parsedate_to_datetime(pub_date).astimezone(timezone.utc) if pub_date else None
            if pub_dt and pub_dt < cutoff:
                continue
        except Exception:
            pass

        event_type = gn("eventtype", GDACS_NS)
        country    = gn("country",   GDACS_NS)
        title_el   = item.find("title")
        title      = (title_el.text or "").strip() if title_el is not None else ""
        link_el    = item.find("link")
        link       = (link_el.text or "").strip() if link_el is not None else ""

        try:
            lat = float(gn("lat", GEO_NS))
            lng = float(gn("long", GEO_NS))
        except (ValueError, TypeError):
            lat = lng = None

        country_lower = country.lower()
        if lat is None and country_lower in COUNTRY_DB:
            _, lat, lng, _ = COUNTRY_DB[country_lower]

        iso = None
        if country_lower in COUNTRY_DB:
            iso = COUNTRY_DB[country_lower][0]

        sev  = "critical" if alert_level == "Red" else "alert"
        note = GDACS_DISEASE_RISK.get(event_type, "Natural disaster — potential health impact")

        results.append({
            "source":        "GDACS",
            "disaster_type": event_type,
            "title":         title,
            "country":       country,
            "iso":           iso,
            "lat":           lat,
            "lng":           lng,
            "severity":      sev,
            "description":   note,
            "link":          link,
            "pub_date":      pub_date,
        })

    print(f"  → {len(results)} GDACS Orange/Red alerts", flush=True)
    return results

# ---------------------------------------------------------------------------
# Normalise + deduplicate
# ---------------------------------------------------------------------------

SEV_ORDER = {"critical": 4, "alert": 3, "warning": 2, "monitoring": 1, "low": 0}
SEV_MAP   = {"high": "alert", "medium": "warning", "low": "monitoring"}


def normalise_sev(s: str) -> str:
    return SEV_MAP.get(s, s) if s not in SEV_ORDER else s


def build_dedup_key(disease: str, country: str) -> str:
    d = re.sub(r"\s+", " ", (disease or "").lower().strip())
    c = re.sub(r"\s+", " ", (country or "").lower().strip())
    return f"{d}|{c}"

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    mode   = detect_ai_mode()
    has_ai = mode != "regex (free)"
    print(f"Mode: {mode}\n", flush=True)

    events = []
    alerts = []
    seen_dedup = set()
    event_id_counter = [0]

    def add_event(ev: dict):
        key = build_dedup_key(ev.get("disease", ""), ev.get("country", ""))
        if key and key in seen_dedup:
            return  # skip duplicate
        if key:
            seen_dedup.add(key)
        ev["fetched_at"] = datetime.now(timezone.utc).isoformat()
        events.append(ev)
        if ev.get("severity") in ("alert", "critical"):
            alerts.append({k: ev[k] for k in ("disease","country","severity","summary","link","date") if k in ev})
        event_id_counter[0] += 1

    # ── 1. ReliefWeb API ──────────────────────────────────────────────────
    rw_items = fetch_reliefweb()
    time.sleep(1)
    for raw in rw_items:
        text = raw["title"] + "\n\n" + raw["description"]
        extracted = None
        if has_ai:
            extracted = call_ai(text)
        if not extracted or not extracted.get("disease"):
            extracted = extract_free(raw["title"], raw["description"])

        country_hint = raw.get("country_hint", "")
        iso_hint     = raw.get("iso_hint", "")
        disease_hint = raw.get("disease_hint", "")

        if extracted and extracted.get("disease"):
            sev = normalise_sev(extracted.get("severity", "monitoring"))
            # Use API country hint if regex didn't find one
            if not extracted.get("country") and country_hint:
                extracted["country"] = country_hint
                if iso_hint and iso_hint in ISO2_NUM:
                    extracted["iso"] = iso_hint
                    extracted["region"] = next(
                        (v[3] for k,v in COUNTRY_DB.items() if v[0] == iso_hint), None)
                c_lower = country_hint.lower()
                if c_lower in COUNTRY_DB and not extracted.get("lat"):
                    _, extracted["lat"], extracted["lng"], _ = COUNTRY_DB[c_lower]

            add_event({
                "id":         f"rw-{event_id_counter[0]}",
                "type":       "epidemic",
                "disease":    extracted.get("disease") or disease_hint or "Unknown",
                "country":    extracted.get("country") or country_hint,
                "iso":        extracted.get("iso") or iso_hint,
                "region":     extracted.get("region"),
                "lat":        extracted.get("lat"),
                "lng":        extracted.get("lng"),
                "cases":      extracted.get("cases"),
                "deaths":     extracted.get("deaths"),
                "severity":   sev,
                "summary":    extracted.get("summary", raw["title"])[:300],
                "summary_ru": extracted.get("summary_ru", "")[:300],
                "source":     f"ReliefWeb / {raw.get('source_detail','')}",
                "link":       raw.get("link", ""),
                "date":       raw.get("pub_date", ""),
            })
        elif disease_hint and country_hint:
            # ReliefWeb gave us disease+country directly — use them
            c_lower = country_hint.lower()
            coords = COUNTRY_DB.get(c_lower, ("", None, None, None))
            add_event({
                "id":       f"rw-{event_id_counter[0]}",
                "type":     "epidemic",
                "disease":  disease_hint,
                "country":  country_hint,
                "iso":      iso_hint or coords[0],
                "region":   coords[3],
                "lat":      coords[1],
                "lng":      coords[2],
                "cases":    None,
                "deaths":   None,
                "severity": "warning",
                "summary":  re.sub(r"<[^>]+>", " ", raw["description"][:300]).strip() or raw["title"],
                "summary_ru": "",
                "source":   "ReliefWeb",
                "link":     raw.get("link", ""),
                "date":     raw.get("pub_date", ""),
            })

    # ── 2. WHO DON JSON ───────────────────────────────────────────────────
    who_json = fetch_who_don_json()
    time.sleep(1)
    for raw in who_json:
        text = raw["title"] + "\n\n" + raw["description"]
        extracted = None
        if has_ai:
            extracted = call_ai(text)
        if not extracted or not extracted.get("disease"):
            extracted = extract_free(raw["title"], raw["description"])
        if not extracted or not extracted.get("disease"):
            continue
        # Use WHO's country hint if extraction missed it
        if not extracted.get("country") and raw.get("country_hint"):
            c = raw["country_hint"].strip().lower()
            if c in COUNTRY_DB:
                extracted["country"] = raw["country_hint"].title()
                extracted["iso"], extracted["lat"], extracted["lng"], extracted["region"] = COUNTRY_DB[c]

        sev = normalise_sev(extracted.get("severity", "monitoring"))
        add_event({
            "id":         f"who-{event_id_counter[0]}",
            "type":       "epidemic",
            "disease":    extracted.get("disease"),
            "country":    extracted.get("country"),
            "iso":        extracted.get("iso"),
            "region":     extracted.get("region"),
            "lat":        extracted.get("lat"),
            "lng":        extracted.get("lng"),
            "cases":      extracted.get("cases"),
            "deaths":     extracted.get("deaths"),
            "severity":   sev,
            "summary":    extracted.get("summary", raw["title"])[:300],
            "summary_ru": extracted.get("summary_ru", "")[:300],
            "source":     "WHO DON",
            "link":       raw.get("link", ""),
            "date":       raw.get("pub_date", ""),
        })

    # ── 3. HealthMap API (optional) ───────────────────────────────────────
    for raw in fetch_healthmap():
        text = raw["title"] + "\n\n" + raw["description"]
        extracted = None
        if has_ai:
            extracted = call_ai(text)
        if not extracted or not extracted.get("disease"):
            extracted = extract_free(raw["title"], raw["description"])
        disease_hint = raw.get("disease_hint", "")
        country_hint = raw.get("country_hint", "")
        lat_hint     = raw.get("lat_hint")
        lng_hint     = raw.get("lng_hint")
        if extracted and extracted.get("disease"):
            if not extracted.get("lat") and lat_hint: extracted["lat"] = lat_hint
            if not extracted.get("lng") and lng_hint: extracted["lng"] = lng_hint
            if not extracted.get("country") and country_hint: extracted["country"] = country_hint
            sev = normalise_sev(extracted.get("severity", "monitoring"))
            add_event({
                "id": f"hm-{event_id_counter[0]}", "type": "epidemic",
                "disease": extracted.get("disease"), "country": extracted.get("country") or country_hint,
                "iso": extracted.get("iso"), "region": extracted.get("region"),
                "lat": extracted.get("lat"), "lng": extracted.get("lng"),
                "cases": extracted.get("cases"), "deaths": extracted.get("deaths"),
                "severity": sev,
                "summary": extracted.get("summary", raw["title"])[:300],
                "summary_ru": extracted.get("summary_ru", "")[:300],
                "source": "HealthMap", "link": raw.get("link", ""), "date": raw.get("pub_date", ""),
            })
        elif disease_hint and country_hint:
            c_lower = country_hint.lower()
            coords = COUNTRY_DB.get(c_lower, ("", None, None, None))
            add_event({
                "id": f"hm-{event_id_counter[0]}", "type": "epidemic",
                "disease": disease_hint, "country": country_hint,
                "iso": coords[0], "region": coords[3],
                "lat": lat_hint or coords[1], "lng": lng_hint or coords[2],
                "cases": None, "deaths": None, "severity": "warning",
                "summary": raw["title"][:300], "summary_ru": "",
                "source": "HealthMap", "link": raw.get("link", ""), "date": raw.get("pub_date", ""),
            })
    time.sleep(1)

    # ── 4. Rospotrebnadzor RSS (Russia / CIS) ────────────────────────────
    for raw in fetch_rospotrebnadzor():
        text = raw["title"] + "\n\n" + raw["description"]
        extracted = None
        if has_ai:
            extracted = call_ai(text)   # Gemini handles Russian natively
        if not extracted or not extracted.get("disease"):
            extracted = extract_russian(raw["title"], raw["description"])
        if not extracted or not extracted.get("disease"):
            extracted = extract_free(raw["title"], raw["description"])  # last resort
        if not extracted or not extracted.get("disease"):
            continue
        # If country not detected, default to Russia (Rospotrebnadzor is Russian federal)
        if not extracted.get("country"):
            extracted["country"] = "Russia"
            extracted["iso"], extracted["lat"], extracted["lng"], extracted["region"] = COUNTRY_DB["russia"]
        sev = normalise_sev(extracted.get("severity", "monitoring"))
        add_event({
            "id":         f"rosp-{event_id_counter[0]}",
            "type":       "epidemic",
            "disease":    extracted.get("disease"),
            "country":    extracted.get("country"),
            "iso":        extracted.get("iso"),
            "region":     extracted.get("region"),
            "lat":        extracted.get("lat"),
            "lng":        extracted.get("lng"),
            "cases":      extracted.get("cases"),
            "deaths":     extracted.get("deaths"),
            "severity":   sev,
            "summary":    extracted.get("summary", raw["title"])[:300],
            "summary_ru": extracted.get("summary_ru", "")[:300],
            "source":     "Роспотребнадзор",
            "link":       raw.get("link", ""),
            "date":       raw.get("pub_date", ""),
        })
    time.sleep(1)

    # ── 5. China CDC Weekly ───────────────────────────────────────────────
    for raw in fetch_china_cdc_weekly():
        disease = raw.get("disease_hint", "")
        if not disease:
            continue
        add_event({
            "id":         f"cdc-cn-{event_id_counter[0]}",
            "type":       "epidemic",
            "disease":    disease,
            "country":    "China",
            "iso":        "CN",
            "region":     "WPRO",
            "lat":        COUNTRY_DB["china"][1],
            "lng":        COUNTRY_DB["china"][2],
            "cases":      raw.get("cases_direct"),
            "deaths":     raw.get("deaths_direct"),
            "severity":   raw.get("severity_hint", "monitoring"),
            "summary":    raw["description"][:300],
            "summary_ru": "",
            "source":     "China CDC Weekly",
            "link":       raw.get("link", ""),
            "date":       raw.get("pub_date", ""),
        })
    time.sleep(1)

    # ── 6. RSS feeds ─────────────────────────────────────────────────────
    for feed in RSS_FEEDS:
        rss_items = fetch_rss(feed)
        time.sleep(0.5)
        for raw in rss_items:
            text = raw["title"] + "\n\n" + raw["description"]
            extracted = None
            if has_ai:
                extracted = call_ai(text)
            if not extracted or not extracted.get("disease"):
                extracted = extract_free(raw["title"], raw["description"])
            if not extracted or not extracted.get("disease"):
                continue
            sev = normalise_sev(extracted.get("severity", "monitoring"))
            add_event({
                "id":         f"{feed['tag'].lower()}-{event_id_counter[0]}",
                "type":       "epidemic",
                "disease":    extracted.get("disease"),
                "country":    extracted.get("country"),
                "iso":        extracted.get("iso"),
                "region":     extracted.get("region"),
                "lat":        extracted.get("lat"),
                "lng":        extracted.get("lng"),
                "cases":      extracted.get("cases"),
                "deaths":     extracted.get("deaths"),
                "severity":   sev,
                "summary":    extracted.get("summary", raw["title"])[:300],
                "summary_ru": extracted.get("summary_ru", "")[:300],
                "source":     feed["tag"],
                "link":       raw.get("link", ""),
                "date":       raw.get("pub_date", ""),
            })
        if len(events) >= MAX_EVENTS:
            break

    # ── 7. GDACS ─────────────────────────────────────────────────────────
    for gev in fetch_gdacs():
        iso = gev.get("iso")
        add_event({
            "id":            f"gdacs-{gev.get('disaster_type','?')}-{event_id_counter[0]}",
            "type":          "disaster",
            "disaster_type": gev.get("disaster_type", ""),
            "disease":       GDACS_NAMES.get(gev.get("disaster_type", ""), "Disaster"),
            "country":       gev.get("country", ""),
            "iso":           iso,
            "region":        COUNTRY_DB.get((gev.get("country") or "").lower(), ("","","","UNKNOWN"))[3],
            "lat":           gev.get("lat"),
            "lng":           gev.get("lng"),
            "cases":         None,
            "deaths":        None,
            "severity":      gev.get("severity", "warning"),
            "summary":       gev.get("description", "")[:300],
            "summary_ru":    "",
            "source":        "GDACS",
            "link":          gev.get("link", ""),
            "date":          gev.get("pub_date", ""),
        })

    # ── Output ────────────────────────────────────────────────────────────
    if not events:
        print("⚠ 0 events — preserving existing data", flush=True)
        import sys; sys.exit(0)

    # Sort: critical first, then by date
    def sort_key(e):
        return (-(SEV_ORDER.get(e.get("severity","monitoring"), 0)), e.get("date",""))
    events.sort(key=sort_key)
    events = events[:MAX_EVENTS]

    meta = {
        "updated_at":   datetime.now(timezone.utc).isoformat(),
        "total_events": len(events),
        "total_alerts": len(alerts),
        "mode":         mode,
        "sources":      list({e["source"] for e in events}),
    }

    (OUTPUT_DIR / "events.json").write_text(
        json.dumps({"meta": meta, "events": events}, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUTPUT_DIR / "alerts.json").write_text(
        json.dumps({"meta": meta, "alerts": alerts}, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n✓ {len(events)} events · {len(alerts)} alerts · sources: {meta['sources']}")


if __name__ == "__main__":
    main()
