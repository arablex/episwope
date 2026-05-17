#!/usr/bin/env python3
"""
Vigilo Fast Signals Engine — runs every 5-15 minutes.
Detects disease outbreak signals 24-72 hours before mainstream TV news.

Sources (sub-5 min latency):
  1. GDELT GKG v2 API        — 15-min rolling data, no key
  2. Google News RSS          — real-time, no key
  3. ProMED Mail RSS          — fastest official surveillance
  4. Reddit RSS               — crowd signal aggregator

Sources (15-30 min latency):
  5. Wikipedia Recent Changes — detects edits on disease articles
  6. GDELT DOC API (themes)   — HEALTH_PANDEMIC / DISEASE_OUTBREAK
  7. ReliefWeb API            — epidemic-tagged reports
  8. GDELT GKG themes         — Global Incident Map equivalent

AI enhancement (optional, degrades gracefully):
  GROQ_API_KEY   → llama-3.3-70b, fastest free inference (30 req/min)
  GEMINI_API_KEY → gemini-2.0-flash, multilingual NLP

Outputs:
  public/signals.json         — current active signals
  public/signals_history.json — rolling 30-day baseline per (iso, disease)
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import hashlib
import argparse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib import request, error, parse

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SCRIPT_DIR  = Path(__file__).parent
OUTPUT_DIR  = SCRIPT_DIR.parent / "public"
SIGNALS_OUT = OUTPUT_DIR / "signals.json"
HISTORY_OUT = OUTPUT_DIR / "signals_history.json"

HISTORY_WINDOW_DAYS  = 30   # rolling baseline window
DEDUP_WINDOW_HOURS   = 6    # suppress re-emitting same (iso, disease) signal
SPIKE_RATIO_THRESHOLD = 2.5
SPIKE_MIN_COUNT       = 3   # must see at least this many raw mentions
CONFIDENCE_EMIT_LOW   = 0.40
CONFIDENCE_EMIT_HIGH  = 0.60

GROQ_RATE_LIMIT_SLEEP = 2.0  # seconds between Groq calls (free: 30 req/min)
GROQ_MAX_CALLS        = 20   # cap AI calls per run
HTTP_TIMEOUT          = 18   # seconds

HEADERS = {
    "User-Agent": "Vigilo/3.0 (vigilo.cc; outbreak-monitoring; contact@vigilo.cc)",
    "Accept": "application/json, application/xml, text/xml, application/rss+xml, */*",
}

# ---------------------------------------------------------------------------
# Country DB (imported from fetch_data.py patterns)
# ---------------------------------------------------------------------------

COUNTRY_DB = {
    "democratic republic of the congo": ("CD", -4.0,  21.7,  "AFRO"),
    "dr congo":         ("CD", -4.0,  21.7,  "AFRO"),
    "drc":              ("CD", -4.0,  21.7,  "AFRO"),
    "congo":            ("CD", -4.0,  21.7,  "AFRO"),
    "nigeria":          ("NG",  9.1,   8.7,  "AFRO"),
    "ethiopia":         ("ET",  9.1,  40.5,  "AFRO"),
    "sudan":            ("SD", 15.5,  32.5,  "EMRO"),
    "south sudan":      ("SS",  7.9,  29.7,  "AFRO"),
    "kenya":            ("KE", -1.3,  36.8,  "AFRO"),
    "uganda":           ("UG",  1.4,  32.3,  "AFRO"),
    "tanzania":         ("TZ", -6.4,  34.9,  "AFRO"),
    "ghana":            ("GH",  7.9,  -1.0,  "AFRO"),
    "cameroon":         ("CM",  3.9,  11.5,  "AFRO"),
    "guinea":           ("GN", 11.0, -10.9,  "AFRO"),
    "sierra leone":     ("SL",  8.5, -11.8,  "AFRO"),
    "liberia":          ("LR",  6.4,  -9.4,  "AFRO"),
    "mali":             ("ML", 17.6,  -4.0,  "AFRO"),
    "niger":            ("NE", 17.6,   8.1,  "AFRO"),
    "chad":             ("TD", 15.5,  18.7,  "AFRO"),
    "angola":           ("AO",-11.2,  17.9,  "AFRO"),
    "mozambique":       ("MZ",-18.7,  35.5,  "AFRO"),
    "zambia":           ("ZM",-13.1,  27.8,  "AFRO"),
    "zimbabwe":         ("ZW",-20.0,  30.0,  "AFRO"),
    "somalia":          ("SO",  6.0,  46.2,  "AFRO"),
    "senegal":          ("SN", 14.5, -14.5,  "AFRO"),
    "ivory coast":      ("CI",  7.5,  -5.5,  "AFRO"),
    "cote d'ivoire":    ("CI",  7.5,  -5.5,  "AFRO"),
    "burkina faso":     ("BF", 12.4,  -1.6,  "AFRO"),
    "guinea-bissau":    ("GW", 12.0, -15.0,  "AFRO"),
    "rwanda":           ("RW", -1.9,  29.9,  "AFRO"),
    "burundi":          ("BI", -3.4,  30.0,  "AFRO"),
    "malawi":           ("MW",-13.3,  34.3,  "AFRO"),
    "south africa":     ("ZA",-30.6,  22.9,  "AFRO"),
    "madagascar":       ("MG",-20.0,  47.0,  "AFRO"),
    "gabon":            ("GA", -0.8,  11.6,  "AFRO"),
    "central african republic": ("CF", 7.0, 21.0, "AFRO"),
    "equatorial guinea":("GQ",  1.7,  10.3,  "AFRO"),
    "togo":             ("TG",  8.6,   0.8,  "AFRO"),
    "benin":            ("BJ",  9.3,   2.3,  "AFRO"),
    "brazil":           ("BR",-14.2, -51.9,  "AMRO"),
    "colombia":         ("CO",  4.6, -74.3,  "AMRO"),
    "peru":             ("PE", -9.2, -75.0,  "AMRO"),
    "haiti":            ("HT", 19.0, -72.3,  "AMRO"),
    "bolivia":          ("BO",-16.3, -63.6,  "AMRO"),
    "argentina":        ("AR",-38.4, -63.6,  "AMRO"),
    "mexico":           ("MX", 23.6,-102.6,  "AMRO"),
    "venezuela":        ("VE",  6.4, -66.6,  "AMRO"),
    "ecuador":          ("EC", -1.8, -78.2,  "AMRO"),
    "guatemala":        ("GT", 15.8, -90.2,  "AMRO"),
    "honduras":         ("HN", 15.2, -86.2,  "AMRO"),
    "nicaragua":        ("NI", 12.9, -85.2,  "AMRO"),
    "panama":           ("PA",  8.5, -80.8,  "AMRO"),
    "cuba":             ("CU", 21.5, -79.5,  "AMRO"),
    "united states":    ("US", 37.1, -95.7,  "AMRO"),
    "usa":              ("US", 37.1, -95.7,  "AMRO"),
    "canada":           ("CA", 56.1,-106.3,  "AMRO"),
    "trinidad and tobago": ("TT", 10.7, -61.2, "AMRO"),
    "pakistan":         ("PK", 30.4,  69.3,  "EMRO"),
    "afghanistan":      ("AF", 33.9,  67.7,  "EMRO"),
    "iran":             ("IR", 32.4,  53.7,  "EMRO"),
    "iraq":             ("IQ", 33.2,  43.7,  "EMRO"),
    "syria":            ("SY", 34.8,  38.9,  "EMRO"),
    "yemen":            ("YE", 15.6,  48.5,  "EMRO"),
    "egypt":            ("EG", 26.8,  30.8,  "EMRO"),
    "saudi arabia":     ("SA", 24.0,  45.0,  "EMRO"),
    "jordan":           ("JO", 31.0,  36.5,  "EMRO"),
    "libya":            ("LY", 26.3,  17.2,  "EMRO"),
    "morocco":          ("MA", 31.8,  -7.1,  "EMRO"),
    "tunisia":          ("TN", 34.0,   9.0,  "EMRO"),
    "algeria":          ("DZ", 28.0,   3.0,  "EMRO"),
    "india":            ("IN", 20.6,  78.9,  "SEARO"),
    "bangladesh":       ("BD", 23.7,  90.4,  "SEARO"),
    "indonesia":        ("ID", -0.8, 113.9,  "SEARO"),
    "myanmar":          ("MM", 16.9,  96.1,  "SEARO"),
    "thailand":         ("TH", 15.9, 100.9,  "SEARO"),
    "nepal":            ("NP", 28.4,  84.1,  "SEARO"),
    "sri lanka":        ("LK",  7.9,  80.8,  "SEARO"),
    "vietnam":          ("VN", 14.1, 108.3,  "WPRO"),
    "philippines":      ("PH", 12.9, 121.8,  "WPRO"),
    "china":            ("CN", 35.9, 104.2,  "WPRO"),
    "cambodia":         ("KH", 12.6, 104.9,  "WPRO"),
    "papua new guinea": ("PG", -6.3, 143.9,  "WPRO"),
    "laos":             ("LA", 18.2, 103.9,  "WPRO"),
    "malaysia":         ("MY",  4.2, 108.0,  "WPRO"),
    "vanuatu":          ("VU",-17.7, 168.3,  "WPRO"),
    "solomon islands":  ("SB", -9.5, 160.2,  "WPRO"),
    "france":           ("FR", 46.2,   2.2,  "EURO"),
    "germany":          ("DE", 51.2,  10.5,  "EURO"),
    "italy":            ("IT", 41.9,  12.6,  "EURO"),
    "ukraine":          ("UA", 48.4,  31.2,  "EURO"),
    "turkey":           ("TR", 38.9,  35.2,  "EURO"),
    "russia":           ("RU", 61.5, 105.3,  "EURO"),
    "kazakhstan":       ("KZ", 48.0,  68.0,  "EURO"),
    "uzbekistan":       ("UZ", 41.4,  64.6,  "EURO"),
    "tajikistan":       ("TJ", 38.9,  71.3,  "EURO"),
    "kyrgyzstan":       ("KG", 41.2,  74.8,  "EURO"),
    "turkmenistan":     ("TM", 40.0,  59.5,  "EURO"),
    "belarus":          ("BY", 53.7,  28.0,  "EURO"),
    "georgia":          ("GE", 42.3,  43.4,  "EURO"),
    "azerbaijan":       ("AZ", 40.1,  47.6,  "EURO"),
    "armenia":          ("AM", 40.1,  45.0,  "EURO"),
    "moldova":          ("MD", 47.4,  28.4,  "EURO"),
    "mongolia":         ("MN", 46.8, 103.8,  "WPRO"),
    "north korea":      ("KP", 40.3, 127.5,  "WPRO"),
    "south korea":      ("KR", 36.0, 127.8,  "WPRO"),
    "japan":            ("JP", 36.2, 138.3,  "WPRO"),
    "taiwan":           ("TW", 23.7, 121.0,  "WPRO"),
    "singapore":        ("SG",  1.4, 103.8,  "WPRO"),
    "australia":        ("AU",-25.3, 133.8,  "WPRO"),
    "new zealand":      ("NZ",-40.9, 174.9,  "WPRO"),
    "poland":           ("PL", 51.9,  19.1,  "EURO"),
    "romania":          ("RO", 45.9,  24.9,  "EURO"),
    "spain":            ("ES", 40.5,  -3.7,  "EURO"),
    "united kingdom":   ("GB", 55.4,  -3.4,  "EURO"),
    "uk":               ("GB", 55.4,  -3.4,  "EURO"),
    "netherlands":      ("NL", 52.3,   5.3,  "EURO"),
    "belgium":          ("BE", 50.5,   4.5,  "EURO"),
    "austria":          ("AT", 47.5,  14.6,  "EURO"),
}

# Russian-language disease keywords (for RU news sources)
DISEASE_PATTERNS_RU = [
    (r"эбола|эболавирус",                          "Ebola virus disease",  "critical"),
    (r"марбург",                                    "Marburg virus disease","critical"),
    (r"нипах",                                      "Nipah virus",          "critical"),
    (r"чума|иерсиния",                              "Plague",               "critical"),
    (r"птичий грипп|h5n1|h5n2|авиарный грипп",      "Avian influenza",      "alert"),
    (r"холера",                                     "Cholera",              "alert"),
    (r"дифтерия",                                   "Diphtheria",           "warning"),
    (r"корь|коревой",                               "Measles",              "warning"),
    (r"полиомиелит|полиовирус",                     "Polio",                "warning"),
    (r"лихорадка эбола|геморрагическая лихорадка",  "Ebola virus disease",  "critical"),
    (r"сибирская язва|антракс",                     "Anthrax",              "warning"),
    (r"бруцеллёз|бруцеллез",                        "Brucellosis",          "warning"),
    (r"туляремия",                                  "Tularemia",            "warning"),
    (r"менингит|менингококк",                       "Meningitis",           "alert"),
    (r"денге|денгу",                                "Dengue fever",         "alert"),
    (r"оспа обезьян|мпокс",                         "Mpox",                 "warning"),
    (r"желтая лихорадка|жёлтая лихорадка",          "Yellow fever",         "warning"),
    (r"covid|ковид|коронавирус",                    "COVID-19",             "monitoring"),
    (r"грипп(?! птичий)",                           "Influenza",            "monitoring"),
    (r"сальмонелл",                                 "Salmonellosis",        "warning"),
    (r"листери",                                    "Listeriosis",          "alert"),
    (r"гепатит",                                    "Hepatitis",            "alert"),
    (r"туберкулёз|туберкулез|\bтбк?\b",             "Tuberculosis",         "monitoring"),
    (r"крымская.конго|ккгл",                        "Crimean-Congo HF",     "warning"),
    (r"лихорадка западного нила",                   "West Nile virus",      "warning"),
    (r"хантавирус|хантан",                          "Hantavirus",           "warning"),
    (r"бешенство",                                  "Rabies",               "monitoring"),
    (r"малярия",                                    "Malaria",              "alert"),
    (r"брюшной тиф|тиф",                            "Typhoid fever",        "warning"),
]

# Chinese-language disease keywords
DISEASE_PATTERNS_ZH = [
    (r"埃博拉",                     "Ebola virus disease",  "critical"),
    (r"马尔堡",                     "Marburg virus disease","critical"),
    (r"尼帕|尼帕病毒",              "Nipah virus",          "critical"),
    (r"鼠疫|黑死病",                "Plague",               "critical"),
    (r"禽流感|h5n1|h5n2|鸟流感",   "Avian influenza",      "alert"),
    (r"霍乱",                       "Cholera",              "alert"),
    (r"猴痘",                       "Mpox",                 "warning"),
    (r"麻疹",                       "Measles",              "warning"),
    (r"脊髓灰质炎|脊灰",            "Polio",                "warning"),
    (r"登革|登革热",                "Dengue fever",         "alert"),
    (r"黄热病",                     "Yellow fever",         "warning"),
    (r"新冠|冠状病毒|covid",        "COVID-19",             "monitoring"),
    (r"流感(?!禽)",                  "Influenza",            "monitoring"),
    (r"甲肝|乙肝|肝炎",             "Hepatitis",            "alert"),
    (r"结核|肺结核",                "Tuberculosis",         "monitoring"),
    (r"炭疽",                       "Anthrax",              "warning"),
    (r"布鲁氏菌|布氏杆菌",          "Brucellosis",          "warning"),
    (r"疟疾",                       "Malaria",              "alert"),
]

# Russian country names (Cyrillic → ISO)
COUNTRY_DB_RU = {
    "россия":           ("RU",  61.5, 105.3, "EURO"),
    "российской":       ("RU",  61.5, 105.3, "EURO"),
    "казахстан":        ("KZ",  48.0,  68.0, "EURO"),
    "казахстане":       ("KZ",  48.0,  68.0, "EURO"),
    "узбекистан":       ("UZ",  41.4,  64.6, "EURO"),
    "кыргызстан":       ("KG",  41.2,  74.8, "EURO"),
    "таджикистан":      ("TJ",  38.9,  71.3, "EURO"),
    "туркменистан":     ("TM",  40.0,  59.5, "EURO"),
    "беларусь":         ("BY",  53.7,  28.0, "EURO"),
    "белоруссия":       ("BY",  53.7,  28.0, "EURO"),
    "украина":          ("UA",  48.4,  31.2, "EURO"),
    "грузия":           ("GE",  42.3,  43.4, "EURO"),
    "азербайджан":      ("AZ",  40.1,  47.6, "EURO"),
    "армения":          ("AM",  40.1,  45.0, "EURO"),
    "молдова":          ("MD",  47.4,  28.4, "EURO"),
    "монголия":         ("MN",  46.8, 103.8, "WPRO"),
    "китай":            ("CN",  35.9, 104.2, "WPRO"),
    "индия":            ("IN",  20.6,  78.9, "SEARO"),
    "иран":             ("IR",  32.4,  53.7, "EMRO"),
    "нигерия":          ("NG",   9.1,   8.7, "AFRO"),
    "конго":            ("CD",  -4.0,  21.7, "AFRO"),
    "эфиопия":          ("ET",   9.1,  40.5, "AFRO"),
    "судан":            ("SD",  15.5,  32.5, "EMRO"),
    "сибирь":           ("RU",  61.5, 105.3, "EURO"),
    "урал":             ("RU",  57.0,  60.0, "EURO"),
    "поволжье":         ("RU",  55.0,  49.0, "EURO"),
    "дальний восток":   ("RU",  60.0, 140.0, "EURO"),
    "северный кавказ":  ("RU",  43.5,  44.0, "EURO"),
}

# Chinese country names
COUNTRY_DB_ZH = {
    "中国":   ("CN",  35.9, 104.2, "WPRO"),
    "印度":   ("IN",  20.6,  78.9, "SEARO"),
    "巴基斯坦":("PK", 30.4,  69.3, "EMRO"),
    "孟加拉":  ("BD", 23.7,  90.4, "SEARO"),
    "越南":   ("VN",  14.1, 108.3, "WPRO"),
    "菲律宾": ("PH",  12.9, 121.8, "WPRO"),
    "印尼":   ("ID",  -0.8, 113.9, "SEARO"),
    "泰国":   ("TH",  15.9, 100.9, "SEARO"),
    "日本":   ("JP",  36.2, 138.3, "WPRO"),
    "韩国":   ("KR",  36.0, 127.8, "WPRO"),
    "刚果":   ("CD",  -4.0,  21.7, "AFRO"),
    "尼日利亚":("NG",  9.1,   8.7, "AFRO"),
    "埃塞俄比亚":("ET",9.1,  40.5, "AFRO"),
    "香港":   ("HK",  22.3, 114.2, "WPRO"),
}

# Disease patterns: (regex, canonical name, severity)
DISEASE_PATTERNS = [
    (r"ebola|ebolavirus",                            "Ebola virus disease",  "critical"),
    (r"marburg",                                     "Marburg virus disease","critical"),
    (r"nipah|niv",                                   "Nipah virus",          "critical"),
    (r"plague|yersinia pestis",                      "Plague",               "critical"),
    (r"lassa",                                       "Lassa fever",          "warning"),
    (r"mpox|monkeypox",                              "Mpox",                 "warning"),
    (r"cholera",                                     "Cholera",              "alert"),
    (r"dengue",                                      "Dengue fever",         "alert"),
    (r"h5n1|h5n2|h5n6|h5n8|h7n9|avian influenza|avian flu|bird flu",
                                                     "Avian influenza",      "alert"),
    (r"yellow fever",                                "Yellow fever",         "warning"),
    (r"meningitis|meningococcal",                    "Meningitis",           "alert"),
    (r"rift valley",                                 "Rift Valley fever",    "warning"),
    (r"measles|rubeola",                             "Measles",              "warning"),
    (r"polio|poliovirus",                            "Polio",                "warning"),
    (r"typhoid|salmonella typhi",                    "Typhoid fever",        "warning"),
    (r"malaria|plasmodium",                          "Malaria",              "alert"),
    (r"rabies",                                      "Rabies",               "monitoring"),
    (r"crimean.congo|cchf",                          "Crimean-Congo HF",     "warning"),
    (r"covid|sars-cov-2",                            "COVID-19",             "monitoring"),
    (r"hendra",                                      "Hendra virus",         "critical"),
    (r"anthrax|bacillus anthracis",                  "Anthrax",              "warning"),
    (r"brucellosis|brucella",                        "Brucellosis",          "warning"),
    (r"tularemia|francisella",                       "Tularemia",            "warning"),
    (r"listeria|listeriosis",                        "Listeriosis",          "alert"),
    (r"salmonella(?! typhi)",                        "Salmonellosis",        "warning"),
    (r"e\.?\s*coli|escherichia coli",                "E. coli",              "warning"),
    (r"hepatitis\s*[ae]",                            "Hepatitis",            "alert"),
    (r"zika",                                        "Zika virus",           "warning"),
    (r"chikungunya",                                 "Chikungunya",          "warning"),
    (r"west nile",                                   "West Nile virus",      "warning"),
    (r"diphtheria",                                  "Diphtheria",           "warning"),
    (r"pertussis|whooping cough",                    "Pertussis",            "warning"),
    (r"hanta",                                       "Hantavirus",           "warning"),
    (r"tuberculosis|\btb\b",                         "Tuberculosis",         "monitoring"),
    (r"\bflu\b|influenza(?! a\(h5)",                 "Influenza",            "monitoring"),
]

# Wikipedia article titles that indicate an ongoing outbreak or disease page
WIKI_DISEASE_TITLES = set([
    "ebola", "marburg", "nipah", "plague", "cholera", "dengue", "mpox", "monkeypox",
    "avian influenza", "h5n1", "yellow fever", "meningitis", "rift valley fever",
    "measles", "polio", "typhoid", "malaria", "crimean-congo", "covid-19",
    "lassa fever", "anthrax", "brucellosis", "listeria", "salmonella", "zika",
    "chikungunya", "west nile", "diphtheria", "pertussis", "hantavirus",
    "tuberculosis", "hepatitis", "outbreak", "epidemic", "pandemic",
])

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)

# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------

def fetch_url(
    url: str,
    timeout: int = HTTP_TIMEOUT,
    extra_headers: dict = None,
    retries: int = 1,
    retry_wait: float = 3.0,
) -> bytes | None:
    """Fetch URL, return raw bytes or None on any error.
    Follows redirects independently from retries (up to 10 hops).
    Retries are only for rate-limits and transient network errors.
    """
    import urllib.request as _ureq
    hdrs = dict(HEADERS)
    if extra_headers:
        hdrs.update(extra_headers)

    # Ensure URL is ASCII-safe (encode non-ASCII path/query chars)
    try:
        _p = parse.urlparse(url)
        safe_path  = parse.quote(_p.path,  safe="/:@!$&'()*+,;=")
        safe_query = parse.quote(_p.query, safe="=&+%:/@!$'()*,;")
        url = parse.urlunparse(_p._replace(path=safe_path, query=safe_query))
    except Exception:
        pass

    def _try_fetch(target_url: str) -> bytes:
        """Fetches one URL following up to 10 redirects. Raises on error."""
        current = target_url
        for _ in range(11):  # max 10 hops
            req = _ureq.Request(current, headers=hdrs)
            try:
                with _ureq.urlopen(req, timeout=timeout) as resp:
                    return resp.read()
            except error.HTTPError as exc:
                if exc.code in (301, 302, 307, 308):
                    loc = exc.headers.get("Location") or exc.headers.get("location") or ""
                    if loc:
                        if loc.startswith("/"):
                            p = parse.urlparse(current)
                            loc = f"{p.scheme}://{p.netloc}{loc}"
                        log(f"  Following {exc.code} redirect → {loc[:80]}")
                        current = loc
                        continue
                raise  # not a redirect — propagate
        raise RuntimeError("Too many redirects")

    for attempt in range(retries + 1):
        try:
            return _try_fetch(url)
        except error.HTTPError as e:
            if e.code == 429 and attempt < retries:
                log(f"  Rate-limited (429) on attempt {attempt+1}, waiting {retry_wait:.0f}s…")
                time.sleep(retry_wait)
                retry_wait *= 2
                continue
            log(f"  HTTP {e.code} fetching {url[:80]}")
            return None
        except error.URLError as e:
            log(f"  URL error fetching {url[:80]}: {e.reason}")
            return None
        except Exception as e:
            log(f"  Error fetching {url[:80]}: {e}")
            return None
    return None

# ---------------------------------------------------------------------------
# History I/O
# ---------------------------------------------------------------------------

def load_history() -> dict:
    """
    Load signals_history.json.
    Structure:
      {
        "baseline": { "<iso>_<disease_slug>": [{"ts": ISO, "count": int}, ...] },
        "emitted":  { "<iso>_<disease_slug>": ISO_timestamp_last_emitted }
      }
    """
    if HISTORY_OUT.exists():
        try:
            return json.loads(HISTORY_OUT.read_text(encoding="utf-8"))
        except Exception as e:
            log(f"  Warning: could not load history: {e}")
    return {"baseline": {}, "emitted": {}}


def save_history(history: dict) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    HISTORY_OUT.write_text(json.dumps(history, indent=2, ensure_ascii=False), encoding="utf-8")


def prune_history(history: dict) -> dict:
    """Remove baseline entries older than HISTORY_WINDOW_DAYS."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=HISTORY_WINDOW_DAYS)).isoformat()
    for key in list(history["baseline"].keys()):
        history["baseline"][key] = [
            e for e in history["baseline"][key] if e.get("ts", "") >= cutoff
        ]
    return history


def record_mention(history: dict, iso: str, disease: str, count: int = 1) -> None:
    key = f"{iso}_{_slug(disease)}"
    if key not in history["baseline"]:
        history["baseline"][key] = []
    history["baseline"][key].append({
        "ts": datetime.now(timezone.utc).isoformat(),
        "count": count,
    })


def compute_baseline(history: dict, iso: str, disease: str) -> float:
    """Return mean mentions per 15-min window over the last 30 days."""
    key = f"{iso}_{_slug(disease)}"
    entries = history["baseline"].get(key, [])
    if not entries:
        return 0.0
    # Total mentions / number of 15-min windows in the period
    total = sum(e.get("count", 1) for e in entries)
    # How many 15-min windows in the observation period?
    now = datetime.now(timezone.utc)
    oldest_ts = entries[0].get("ts", now.isoformat())
    try:
        oldest = datetime.fromisoformat(oldest_ts)
        if oldest.tzinfo is None:
            oldest = oldest.replace(tzinfo=timezone.utc)
        elapsed_minutes = max((now - oldest).total_seconds() / 60.0, 15.0)
    except Exception:
        elapsed_minutes = HISTORY_WINDOW_DAYS * 24 * 60
    windows = elapsed_minutes / 15.0
    return total / windows


def was_recently_emitted(history: dict, iso: str, disease: str) -> bool:
    key = f"{iso}_{_slug(disease)}"
    last = history["emitted"].get(key)
    if not last:
        return False
    try:
        last_dt = datetime.fromisoformat(last)
        if last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - last_dt).total_seconds() < DEDUP_WINDOW_HOURS * 3600
    except Exception:
        return False


def mark_emitted(history: dict, iso: str, disease: str) -> None:
    key = f"{iso}_{_slug(disease)}"
    history["emitted"][key] = datetime.now(timezone.utc).isoformat()

# ---------------------------------------------------------------------------
# Regex extraction helpers
# ---------------------------------------------------------------------------

def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def _strip_html(s: str) -> str:
    return re.sub(r"<[^>]+>", " ", s or "").strip()


def _extract_number(text: str, pattern: str):
    m = re.search(pattern, text, re.I)
    if not m:
        return None
    try:
        return int(re.sub(r"[,\.]", "", m.group(1)))
    except Exception:
        return None


def detect_disease(text: str) -> tuple[str | None, str]:
    """Return (canonical_disease_name, severity) or (None, 'monitoring').
    Checks EN, RU, and ZH disease pattern tables."""
    lower = text.lower()
    for patterns in (DISEASE_PATTERNS, DISEASE_PATTERNS_RU, DISEASE_PATTERNS_ZH):
        for pat, name, sev in patterns:
            if re.search(pat, lower, re.I | re.UNICODE):
                return name, sev
    return None, "monitoring"


def detect_country(text: str) -> tuple[str | None, str | None, float | None, float | None]:
    """Return (country_name, iso, lat, lng) scanning EN, RU, and ZH name tables."""
    lower = text.lower()
    # Merge all country dicts, longer names first (specificity)
    all_dbs = [
        (cname, *COUNTRY_DB[cname])       for cname in COUNTRY_DB
    ] + [
        (cname, *COUNTRY_DB_RU[cname])    for cname in COUNTRY_DB_RU
    ] + [
        (cname, *COUNTRY_DB_ZH[cname])    for cname in COUNTRY_DB_ZH
    ]
    for entry in sorted(all_dbs, key=lambda x: len(x[0]), reverse=True):
        cname, iso, lat, lng, _ = entry
        # Use word-boundary for ASCII; substring match for CJK/Cyrillic
        if any(ord(c) > 127 for c in cname):
            if cname in lower:
                return cname, iso, lat, lng
        else:
            if re.search(r"\b" + re.escape(cname) + r"\b", lower, re.I):
                return cname.title(), iso, lat, lng
    return None, None, None, None


def make_signal_id(disease: str, iso: str) -> str:
    raw = f"{disease}:{iso}:{datetime.now(timezone.utc).strftime('%Y%m%d%H')}"
    return "sig-" + hashlib.sha1(raw.encode()).hexdigest()[:10]

# ---------------------------------------------------------------------------
# AI extraction (Tier 3 — optional)
# ---------------------------------------------------------------------------

_groq_calls_this_run = 0
_gemini_disabled = False

SIGNAL_PROMPT = """Analyze this text and extract disease outbreak signal information. Return ONLY valid JSON.

Text: {text}

JSON:
{{"is_outbreak_signal": true_or_false, "disease": "string or null", "country": "string or null", "iso": "ISO alpha-2 or null", "cases": integer_or_null, "deaths": integer_or_null, "credibility": 0.0_to_1.0, "summary": "1-2 sentence summary or null"}}

Rules: is_outbreak_signal=true only if text describes a real disease outbreak or unusual disease cluster. credibility: 0.9=WHO/official source, 0.7=ProMED/established news, 0.5=social media/Reddit, 0.3=unverified rumour."""


def _parse_ai_json(raw: str) -> dict | None:
    raw = re.sub(r"^```[a-z]*\n?", "", raw.strip())
    raw = re.sub(r"\n?```$", "", raw)
    try:
        return json.loads(raw)
    except Exception:
        return None


def ai_classify(text: str) -> dict | None:
    """Try Groq → Gemini → None. Respects rate limits and caps."""
    global _groq_calls_this_run, _gemini_disabled

    prompt = SIGNAL_PROMPT.format(text=text[:1800])

    # Try Groq first
    groq_key = os.environ.get("GROQ_API_KEY", "")
    if groq_key and _groq_calls_this_run < GROQ_MAX_CALLS:
        payload = json.dumps({
            "model": "llama-3.3-70b-versatile",
            "max_tokens": 300,
            "temperature": 0,
            "messages": [{"role": "user", "content": prompt}],
        }).encode()
        req = request.Request(
            "https://api.groq.com/openai/v1/chat/completions",
            data=payload,
            headers={
                "Authorization": f"Bearer {groq_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=20) as resp:
                body = json.loads(resp.read())
            _groq_calls_this_run += 1
            time.sleep(GROQ_RATE_LIMIT_SLEEP)
            return _parse_ai_json(body["choices"][0]["message"]["content"])
        except error.HTTPError as e:
            if e.code == 429:
                log("  Groq rate limit — switching to Gemini")
            else:
                log(f"  Groq HTTP {e.code}")
        except Exception as e:
            log(f"  Groq error: {e}")

    # Try Gemini
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    if gemini_key and not _gemini_disabled:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"gemini-2.0-flash:generateContent?key={gemini_key}"
        )
        payload = json.dumps({
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"maxOutputTokens": 300, "temperature": 0},
        }).encode()
        req = request.Request(
            url, data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=20) as resp:
                body = json.loads(resp.read())
            time.sleep(1.0)
            return _parse_ai_json(body["candidates"][0]["content"]["parts"][0]["text"])
        except error.HTTPError as e:
            if e.code == 429:
                log("  Gemini rate limit — disabling for this run")
                _gemini_disabled = True
            else:
                log(f"  Gemini HTTP {e.code}")
        except Exception as e:
            log(f"  Gemini error: {e}")

    return None

# ---------------------------------------------------------------------------
# Raw article collector — unified format
# ---------------------------------------------------------------------------

class Article:
    __slots__ = ("source", "title", "body", "url", "pub_date", "domain")

    def __init__(self, source: str, title: str, body: str, url: str, pub_date: str = ""):
        self.source = source
        self.title = title
        self.body = _strip_html(body)[:600]
        self.url = url
        self.pub_date = pub_date
        try:
            self.domain = parse.urlparse(url).netloc.lstrip("www.")
        except Exception:
            self.domain = source.lower()

# ---------------------------------------------------------------------------
# Source 1: GDELT GKG v2 API (15-min rolling)
# ---------------------------------------------------------------------------

def fetch_gdelt_gkg() -> list[Article]:
    log("Fetching GDELT GKG v2 (15-min)...")
    url = (
        "https://api.gdeltproject.org/api/v2/doc/doc"
        "?query=disease+outbreak+epidemic"
        "&mode=artlist&maxrecords=250&format=json&timespan=15min"
    )
    raw = fetch_url(url)
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except Exception as e:
        log(f"  GDELT GKG parse error: {e}")
        return []
    articles = []
    for item in (data.get("articles") or []):
        title = item.get("title", "")
        url_  = item.get("url", "")
        seendate = item.get("seendate", "")
        if not title:
            continue
        articles.append(Article("gdelt", title, title, url_, seendate))
    log(f"  -> {len(articles)} GDELT GKG articles")
    return articles

# ---------------------------------------------------------------------------
# Source 2: GDELT DOC API — theme-filtered (HEALTH_PANDEMIC, DISEASE_OUTBREAK)
# ---------------------------------------------------------------------------

def fetch_gdelt_themes() -> list[Article]:
    log("Fetching GDELT DOC API (themes)...")
    results = []
    themes = ["HEALTH_PANDEMIC", "DISEASE_OUTBREAK", "HEALTH_DISEASE_OUTBREAK"]
    for theme in themes:
        url = (
            f"https://api.gdeltproject.org/api/v2/doc/doc"
            f"?query=theme:{theme}&mode=artlist&maxrecords=100&format=json&timespan=30min"
        )
        raw = fetch_url(url)
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except Exception:
            continue
        for item in (data.get("articles") or []):
            title = item.get("title", "")
            url_  = item.get("url", "")
            if not title:
                continue
            results.append(Article("gdelt_theme", title, title, url_, item.get("seendate", "")))
    log(f"  -> {len(results)} GDELT theme articles")
    return results

# ---------------------------------------------------------------------------
# Source 3: Google News RSS
# ---------------------------------------------------------------------------

GOOGLE_NEWS_QUERIES = [
    "disease outbreak",
    "epidemic cases deaths",
    "virus outbreak confirmed",
    "cholera dengue ebola mpox",
]

GOOGLE_NEWS_QUERIES_RU = [
    "вспышка заболевания эпидемия",
    "вирус заражение случаи смерти",
    "холера чума лихорадка вспышка",
    "Роспотребнадзор эпидемия предупреждение",
]

GOOGLE_NEWS_QUERIES_ZH = [
    "疾病爆发 病例",
    "病毒 感染 疫情",
    "禽流感 霍乱 鼠疫 爆发",
]

def _fetch_gnews_batch(source_id: str, queries: list[str], hl: str, gl: str, ceid: str) -> list[Article]:
    results = []
    for q in queries:
        encoded = parse.quote(q)
        url = f"https://news.google.com/rss/search?q={encoded}&hl={hl}&gl={gl}&ceid={ceid}"
        raw = fetch_url(url, extra_headers={"Accept": "application/rss+xml, text/xml"})
        if not raw:
            continue
        try:
            root = ET.fromstring(raw)
        except ET.ParseError:
            continue
        for item in root.findall(".//item"):
            title   = (item.findtext("title") or "").strip()
            link    = (item.findtext("link") or "").strip()
            desc    = (item.findtext("description") or "").strip()
            pubdate = (item.findtext("pubDate") or "").strip()
            if title:
                results.append(Article(source_id, title, desc or title, link, pubdate))
    return results


def fetch_google_news() -> list[Article]:
    log("Fetching Google News RSS (EN)...")
    results = _fetch_gnews_batch("google_news", GOOGLE_NEWS_QUERIES, "en", "US", "US:en")
    log(f"  -> {len(results)} Google News EN items")
    return results

# ---------------------------------------------------------------------------
# Source 4: ProMED Mail RSS
# ---------------------------------------------------------------------------

def fetch_promed() -> list[Article]:
    log("Fetching ProMED Mail RSS...")
    # ProMED migrated to Next.js SPA in 2025 — RSS is gone.
    # Use ProMED's internal Payload CMS JSON API, then Google News fallback.
    results = []

    raw = fetch_url(
        "https://www.promedmail.org/api/posts?page=1&limit=20",
        extra_headers={"Accept": "application/json"},
        retries=1,
    )
    if raw and raw.strip().startswith(b"{"):
        try:
            data = json.loads(raw)
            for doc in (data.get("docs") or [])[:20]:
                title   = (doc.get("title") or "").strip()
                slug    = doc.get("slug") or str(doc.get("id") or "")
                link    = f"https://www.promedmail.org/promed-post/{slug}" if slug else ""
                excerpt = (doc.get("excerpt") or "").strip()
                pubdate = doc.get("publishedAt") or doc.get("createdAt") or ""
                if title:
                    results.append(Article("promed", title, excerpt or title, link, pubdate))
        except Exception:
            pass

    if not results:
        # Google News fallback — picks up ProMED posts indexed by Google
        url = (
            "https://news.google.com/rss/search?q=ProMED+outbreak+disease+alert"
            "&hl=en&gl=US&ceid=US:en"
        )
        raw = fetch_url(url, retries=1)
        if raw:
            results.extend(_parse_feed_items(raw, "promed"))

    log(f"  -> {len(results)} ProMED items")
    return results

# ---------------------------------------------------------------------------
# Source 5: Reddit RSS (outbreak-relevant subreddits)
# ---------------------------------------------------------------------------

def fetch_reddit() -> list[Article]:
    log("Fetching Reddit RSS...")
    url = (
        "https://www.reddit.com/r/outbreaks+pandemics+worldnews+medicine"
        ".rss?limit=100"
    )
    raw = fetch_url(url, extra_headers={
        "Accept": "application/rss+xml, text/xml",
        "User-Agent": "Vigilo/3.0 outbreak-monitoring bot (contact@vigilo.cc)",
    })
    if not raw:
        return []
    try:
        root = ET.fromstring(raw)
    except ET.ParseError as e:
        log(f"  Reddit XML parse error: {e}")
        return []

    results = []
    ns = {
        "atom": "http://www.w3.org/2005/Atom",
        "media": "http://search.yahoo.com/mrss/",
    }
    # Atom feed
    for entry in root.findall("atom:entry", ns):
        title   = (entry.findtext("atom:title", namespaces=ns) or "").strip()
        link_el = entry.find("atom:link", ns)
        link    = (link_el.get("href", "") if link_el is not None else "").strip()
        content = entry.findtext("atom:content", namespaces=ns) or ""
        updated = entry.findtext("atom:updated", namespaces=ns) or ""
        if title:
            results.append(Article("reddit", title, content or title, link, updated))
    log(f"  -> {len(results)} Reddit items")
    return results

# ---------------------------------------------------------------------------
# Source 6: Wikipedia Recent Changes API
# ---------------------------------------------------------------------------

def fetch_wikipedia_changes() -> list[Article]:
    log("Fetching Wikipedia Recent Changes...")
    url = (
        "https://en.wikipedia.org/w/api.php"
        "?action=query&list=recentchanges&rcnamespace=0&rclimit=500"
        "&rctype=edit&rcprop=title|timestamp|comment&format=json"
    )
    raw = fetch_url(url)
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except Exception as e:
        log(f"  Wikipedia parse error: {e}")
        return []

    results = []
    changes = data.get("query", {}).get("recentchanges", [])
    for change in changes:
        title = change.get("title", "")
        title_lower = title.lower()
        # Check if the article title matches a disease-relevant term
        matched = any(
            kw in title_lower
            for kw in WIKI_DISEASE_TITLES
        )
        if not matched:
            # Also check comment field for outbreak context
            comment = change.get("comment", "").lower()
            matched = any(kw in comment for kw in ["outbreak", "cases", "epidemic", "deaths", "virus"])
        if matched:
            ts = change.get("timestamp", "")
            wiki_url = f"https://en.wikipedia.org/wiki/{parse.quote(title)}"
            results.append(Article(
                "wikipedia",
                f"Wikipedia edit: {title}",
                change.get("comment", title),
                wiki_url,
                ts,
            ))
    log(f"  -> {len(results)} Wikipedia disease-related edits")
    return results

# ---------------------------------------------------------------------------
# Source 7: ReliefWeb API — epidemic-tagged reports
# ---------------------------------------------------------------------------

def fetch_reliefweb() -> list[Article]:
    log("Fetching ReliefWeb API...")
    # ReliefWeb API requires app registration (returns 403 without it).
    # Use Google News targeting reliefweb.int epidemic reports as primary source.
    results = []
    url = (
        "https://news.google.com/rss/search?q=epidemic+disease+outbreak+"
        "site:reliefweb.int&hl=en&gl=US&ceid=US:en"
    )
    raw = fetch_url(url, retries=1)
    if raw:
        results.extend(_parse_feed_items(raw, "reliefweb"))
    log(f"  -> {len(results)} ReliefWeb reports")
    return results

# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Source 8: CIDRAP — Center for Infectious Disease Research and Policy
# ---------------------------------------------------------------------------

def fetch_cidrap() -> list[Article]:
    log("Fetching CIDRAP RSS...")
    raw = fetch_url("https://www.cidrap.umn.edu/rss.xml", retries=1)
    if not raw:
        return []
    try:
        root = ET.fromstring(raw)
    except ET.ParseError:
        return []
    results = []
    for item in root.findall(".//item"):
        title   = (item.findtext("title") or "").strip()
        link    = (item.findtext("link") or "").strip()
        desc    = (item.findtext("description") or "").strip()
        pubdate = (item.findtext("pubDate") or "").strip()
        if title:
            results.append(Article("cidrap", title, desc or title, link, pubdate))
    log(f"  -> {len(results)} CIDRAP items")
    return results


# ---------------------------------------------------------------------------
# Source 9: Outbreak News Today
# ---------------------------------------------------------------------------

def fetch_outbreak_news_today() -> list[Article]:
    log("Fetching Outbreak News Today RSS...")
    raw = fetch_url("https://outbreaknewstoday.com/feed/", retries=1)
    if not raw:
        return []
    try:
        root = ET.fromstring(raw)
    except ET.ParseError:
        return []
    results = []
    for item in root.findall(".//item"):
        title   = (item.findtext("title") or "").strip()
        link    = (item.findtext("link") or "").strip()
        desc    = (item.findtext("description") or "").strip()
        pubdate = (item.findtext("pubDate") or "").strip()
        if title:
            results.append(Article("outbreak_news_today", title, desc or title, link, pubdate))
    log(f"  -> {len(results)} Outbreak News Today items")
    return results


# ---------------------------------------------------------------------------
# Source 10: HealthMap (Harvard) — global disease alerting RSS
# ---------------------------------------------------------------------------

def fetch_healthmap() -> list[Article]:
    log("Fetching HealthMap RSS...")
    # HealthMap public RSS — high-signal, includes local language sources
    results = []
    urls = [
        "https://healthmap.org/en/rss/40",    # All disease alerts
        "https://healthmap.org/en/rss/1",     # Respiratory
        "https://healthmap.org/rss/",         # General feed
        "https://www.healthmap.org/en/rss/40",
    ]
    for url in urls:
        raw = fetch_url(url, retries=1, extra_headers={"Accept": "application/rss+xml, text/xml"})
        if not raw:
            continue
        items = _parse_feed_items(raw, "healthmap")
        if items:
            results.extend(items)
            break
    log(f"  -> {len(results)} HealthMap items")
    return results


# ---------------------------------------------------------------------------
# Source 11: Africa CDC news feed
# ---------------------------------------------------------------------------

def fetch_africa_cdc() -> list[Article]:
    log("Fetching Africa CDC RSS...")
    raw = fetch_url("https://africacdc.org/feed/", retries=1)
    if not raw:
        return []
    try:
        root = ET.fromstring(raw)
    except ET.ParseError:
        return []
    results = []
    for item in root.findall(".//item"):
        title   = (item.findtext("title") or "").strip()
        link    = (item.findtext("link") or "").strip()
        desc    = (item.findtext("description") or "").strip()
        pubdate = (item.findtext("pubDate") or "").strip()
        if title:
            results.append(Article("africa_cdc", title, desc or title, link, pubdate))
    log(f"  -> {len(results)} Africa CDC items")
    return results


# ---------------------------------------------------------------------------
# Source 12: ECDC Communicable Disease Threats Report
# ---------------------------------------------------------------------------

def fetch_ecdc_cdtr() -> list[Article]:
    log("Fetching ECDC CDTR RSS...")
    raw = fetch_url(
        "https://www.ecdc.europa.eu/en/taxonomy/term/2942/feed",
        retries=1,
    )
    if not raw:
        return []
    try:
        root = ET.fromstring(raw)
    except ET.ParseError:
        return []
    results = []
    for item in root.findall(".//item"):
        title   = (item.findtext("title") or "").strip()
        link    = (item.findtext("link") or "").strip()
        desc    = (item.findtext("description") or "").strip()
        pubdate = (item.findtext("pubDate") or "").strip()
        if title:
            results.append(Article("ecdc_cdtr", title, desc or title, link, pubdate))
    log(f"  -> {len(results)} ECDC CDTR items")
    return results


# ---------------------------------------------------------------------------
# Source 13: WHO DON (Disease Outbreak News) — JSON endpoint
# ---------------------------------------------------------------------------

def fetch_who_don() -> list[Article]:
    log("Fetching WHO DON JSON...")
    # WHO internal endpoint — used by fetch_data.py already
    url = "https://www.who.int/api/news/diseaseoutbreaknews"
    raw = fetch_url(url, retries=1)
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except Exception:
        return []
    results = []
    items = data if isinstance(data, list) else data.get("value") or data.get("items") or []
    for item in items[:30]:
        title = (item.get("Title") or item.get("title") or "").strip()
        link  = (item.get("Url")   or item.get("url")   or "").strip()
        desc  = (item.get("Summary") or item.get("description") or "").strip()
        if title:
            results.append(Article("who_don", title, desc or title, link, ""))
    log(f"  -> {len(results)} WHO DON items")
    return results


# ---------------------------------------------------------------------------
# Source 14: Google News RU — Russian-language disease surveillance
# ---------------------------------------------------------------------------

def fetch_google_news_ru() -> list[Article]:
    log("Fetching Google News RSS (RU)...")
    results = _fetch_gnews_batch("google_news_ru", GOOGLE_NEWS_QUERIES_RU, "ru", "RU", "RU:ru")
    log(f"  -> {len(results)} Google News RU items")
    return results


# ---------------------------------------------------------------------------
# Source 15: Google News ZH — Chinese-language disease surveillance
# ---------------------------------------------------------------------------

def fetch_google_news_zh() -> list[Article]:
    log("Fetching Google News RSS (ZH)...")
    results = _fetch_gnews_batch("google_news_zh", GOOGLE_NEWS_QUERIES_ZH, "zh-CN", "CN", "CN:zh-Hans")
    log(f"  -> {len(results)} Google News ZH items")
    return results


# ---------------------------------------------------------------------------
# Source 16: Rospotrebnadzor — Russian Federal Service for Epidemiological
#            Surveillance (main government authority — fills Russia blind spot)
# ---------------------------------------------------------------------------

def fetch_rospotrebnadzor() -> list[Article]:
    log("Fetching Rospotrebnadzor...")
    results = []
    # Rospotrebnadzor RSS — site may require Russian IP or block bots
    rosp_headers = {
        "Accept": "application/rss+xml, text/xml, */*",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    }
    for url in [
        "https://www.rospotrebnadzor.ru/rss.xml",
        "https://www.rospotrebnadzor.ru/about/info/news/rss.xml",
        "https://www.rospotrebnadzor.ru/news/rss.xml",
        "https://rospotrebnadzor.ru/rss.xml",
    ]:
        raw = fetch_url(url, retries=1, extra_headers=rosp_headers)
        if not raw:
            continue
        items = _parse_feed_items(raw, "rospotrebnadzor")
        if items:
            results.extend(items)
            break
    if not results:
        # Google News fallback — Rospotrebnadzor announcements indexed by Google
        url = (
            "https://news.google.com/rss/search?q=Роспотребнадзор+эпидемия+вспышка"
            "&hl=ru&gl=RU&ceid=RU:ru"
        )
        raw = fetch_url(url, retries=1)
        if raw:
            results.extend(_parse_feed_items(raw, "rospotrebnadzor"))
    log(f"  -> {len(results)} Rospotrebnadzor items")
    return results


# ---------------------------------------------------------------------------
# Source 17: Hong Kong CHP — Centre for Health Protection
#            English-language, real-time Asia/China signals; first to report
#            novel pathogens crossing from mainland China
# ---------------------------------------------------------------------------

def fetch_hk_chp() -> list[Article]:
    log("Fetching HK CHP RSS...")
    results = []
    for url in [
        "https://www.chp.gov.hk/en/rss/enhanced-surveillance.xml",
        "https://www.chp.gov.hk/files/rss/cda_alert.xml",
        "https://www.chp.gov.hk/en/rss/cda_alert.xml",
        "https://www.chp.gov.hk/files/rss/surveillance.xml",
        "https://www.chp.gov.hk/en/guideline1/index.html",
    ]:
        raw = fetch_url(url, retries=1, extra_headers={"Accept": "application/rss+xml, text/xml"})
        if not raw:
            continue
        items = _parse_feed_items(raw, "hk_chp")
        if items:
            results.extend(items)
            break
    if not results:
        # Google News Hong Kong CHP disease alerts
        url = (
            "https://news.google.com/rss/search?q=Hong+Kong+CHP+infectious+disease+alert"
            "&hl=en-HK&gl=HK&ceid=HK:en"
        )
        raw = fetch_url(url, retries=1)
        if raw:
            results.extend(_parse_feed_items(raw, "hk_chp"))
    log(f"  -> {len(results)} HK CHP items")
    return results


# ---------------------------------------------------------------------------
# Source 18: WOAH (World Organisation for Animal Health) — Disease Events
#            Zoonosis early warning: bird flu, anthrax, brucellosis, rabies
#            appear in animals 2-6 weeks before human cases confirmed
# ---------------------------------------------------------------------------

def fetch_woah() -> list[Article]:
    log("Fetching WOAH animal disease events...")
    results = []
    # WAHIS v3 public events API (updated endpoint)
    urls_to_try = [
        "https://wahis.woah.org/api/v1/public/event?pageNumber=1&pageSize=25&sortBy=reportDate&sortDirection=DESC",
        "https://wahis.woah.org/api/v1/public/event/search?pageSize=25&pageNumber=1",
        "https://wahis.woah.org/api/v1/public/report/immediate-notification?pageNumber=1&pageSize=25",
    ]
    for url in urls_to_try:
        raw = fetch_url(url, retries=1, extra_headers={
            "Accept": "application/json",
            "Origin": "https://wahis.woah.org",
            "Referer": "https://wahis.woah.org/",
        })
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except Exception:
            continue
        # Handle various response shapes
        items = (data.get("data") or data.get("content") or
                 data.get("reportList") or data.get("eventList") or
                 (data if isinstance(data, list) else []))
        if not items:
            continue
        for item in items[:30]:
            # Nested objects may hold disease/country
            dis_obj = item.get("disease") or {}
            cty_obj = item.get("country") or {}
            disease = (item.get("diseaseName") or dis_obj.get("name") or
                       item.get("diseaseEn") or "").strip()
            country = (item.get("countryName") or cty_obj.get("name") or
                       item.get("countryEn") or "").strip()
            date    = item.get("reportDate") or item.get("startDate") or item.get("date") or ""
            if disease:
                title = f"[WOAH Animal Alert] {disease}" + (f" — {country}" if country else "")
                results.append(Article("woah", title, title, "", str(date)))
        if results:
            break
    log(f"  -> {len(results)} WOAH animal disease events")
    return results


# ---------------------------------------------------------------------------
# Source 19: Taiwan CDC — English-language, excellent early signals for
#            East Asian pathogens; caught SARS 2003, H7N9 before WHO
# ---------------------------------------------------------------------------

def fetch_taiwan_cdc() -> list[Article]:
    log("Fetching Taiwan CDC...")
    results = []
    for url in [
        "https://www.cdc.gov.tw/En/RSS/rss.aspx?topic=1",    # infectious disease news
        "https://www.cdc.gov.tw/En/RSS/rss.aspx?topic=14",   # alert notices
        "https://www.cdc.gov.tw/En/RSS/rss.aspx?topic=2",    # statistics
        "https://www.cdc.gov.tw/rss/news.xml",
    ]:
        raw = fetch_url(url, retries=1, extra_headers={"Accept": "application/rss+xml, text/xml"})
        if not raw:
            continue
        items = _parse_feed_items(raw, "taiwan_cdc")
        if items:
            results.extend(items)
            break
    if not results:
        # Google News Taiwan CDC fallback
        url = (
            "https://news.google.com/rss/search?q=Taiwan+CDC+infectious+disease+outbreak"
            "&hl=zh-TW&gl=TW&ceid=TW:zh-Hant"
        )
        raw = fetch_url(url, retries=1)
        if raw:
            results.extend(_parse_feed_items(raw, "taiwan_cdc"))
    log(f"  -> {len(results)} Taiwan CDC items")
    return results


# ---------------------------------------------------------------------------
# Source 20: GDELT RU/ZH language-filtered — same powerful 15-min pipeline
#            but restricted to Russian and Chinese sources
# ---------------------------------------------------------------------------

def fetch_gdelt_cis_china() -> list[Article]:
    log("Fetching GDELT (RU/ZH sources)...")
    results = []
    for (lang, query_raw) in [
        ("rus", "болезнь вспышка эпидемия"),
        ("zho", "疾病 爆发 病例"),
    ]:
        # Build URL with properly encoded query string
        full_query = f"{query_raw} sourcelang:{lang}"
        qs = parse.urlencode({
            "query": full_query,
            "mode": "artlist",
            "maxrecords": "100",
            "format": "json",
            "timespan": "30min",
        })
        url = f"https://api.gdeltproject.org/api/v2/doc/doc?{qs}"
        raw = fetch_url(url, retries=1)
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except Exception:
            continue
        for item in (data.get("articles") or []):
            title = item.get("title", "")
            if title:
                src_id = "gdelt_ru" if lang == "rus" else "gdelt_zh"
                results.append(Article(src_id, title, title, item.get("url", ""), item.get("seendate", "")))
    log(f"  -> {len(results)} GDELT RU/ZH articles")
    return results


# ---------------------------------------------------------------------------
# Source 21: medRxiv/bioRxiv RSS — preprints 2-4 weeks ahead of WHO
#            Novel pathogen papers surface here before any official report.
#            COVID-19 preprint appeared Dec 31 2019; WHO alert Jan 30 2020.
# ---------------------------------------------------------------------------

def _parse_feed_items(raw: bytes, src_id: str, prefix: str = "") -> list[Article]:
    """Parse RSS 1.0/2.0 or Atom feed bytes → list of Articles.
    Handles: BOM, RSS 2.0, RSS 1.0 (RDF/purl.org), Atom 1.0.
    """
    try:
        # Strip UTF-8 BOM and decode
        raw_str = raw.lstrip(b"\xef\xbb\xbf").decode("utf-8", errors="replace")
        root = ET.fromstring(raw_str)
    except ET.ParseError:
        return []

    results = []

    # ── RSS 2.0 (no default namespace) ─────────────────────────────────────
    items = root.findall(".//item")
    if items:
        for item in items:
            title   = (item.findtext("title") or "").strip()
            link    = (item.findtext("link") or "").strip()
            desc    = (item.findtext("description") or "").strip()
            pubdate = (item.findtext("pubDate") or "").strip()
            if title:
                results.append(Article(src_id, f"{prefix}{title}", desc or title, link, pubdate))
        return results

    # ── RSS 1.0 / RDF (default namespace http://purl.org/rss/1.0/) ─────────
    rss1_ns  = "http://purl.org/rss/1.0/"
    dc_ns    = "http://purl.org/dc/elements/1.1/"
    items = root.findall(f"{{{rss1_ns}}}item")
    if items:
        for item in items:
            title   = (item.findtext(f"{{{rss1_ns}}}title") or "").strip()
            link    = (item.findtext(f"{{{rss1_ns}}}link") or "").strip()
            desc    = (item.findtext(f"{{{rss1_ns}}}description") or "").strip()
            pubdate = (item.findtext(f"{{{dc_ns}}}date") or "").strip()
            if title:
                results.append(Article(src_id, f"{prefix}{title}", desc or title, link, pubdate))
        return results

    # ── Atom 1.0 ────────────────────────────────────────────────────────────
    atom_ns = "http://www.w3.org/2005/Atom"
    entries = root.findall(f"{{{atom_ns}}}entry") or root.findall(".//entry")
    for entry in entries:
        title   = (entry.findtext(f"{{{atom_ns}}}title") or entry.findtext("title") or "").strip()
        link_el = entry.find(f"{{{atom_ns}}}link") or entry.find("link")
        link    = (link_el.get("href") or link_el.text or "") if link_el is not None else ""
        summary = (entry.findtext(f"{{{atom_ns}}}summary") or entry.findtext("summary") or
                   entry.findtext(f"{{{atom_ns}}}content") or entry.findtext("content") or "").strip()
        pubdate = (entry.findtext(f"{{{atom_ns}}}updated") or entry.findtext(f"{{{atom_ns}}}published") or
                   entry.findtext("updated") or entry.findtext("published") or "").strip()
        if title:
            results.append(Article(src_id, f"{prefix}{title}", summary or title, link, pubdate))
    return results


def fetch_medrxiv() -> list[Article]:
    log("Fetching medRxiv/bioRxiv RSS...")
    results = []
    feeds = [
        ("medrxiv",  "https://connect.medrxiv.org/medrxiv_xml.php?subject=infectious_diseases"),
        ("medrxiv",  "https://connect.medrxiv.org/medrxiv_xml.php?subject=epidemiology"),
        ("biorxiv",  "https://connect.biorxiv.org/biorxiv_xml.php?subject=microbiology"),
    ]
    for src_id, url in feeds:
        raw = fetch_url(url, retries=1, extra_headers={"Accept": "application/rss+xml, application/atom+xml, text/xml"})
        if not raw:
            continue
        results.extend(_parse_feed_items(raw, src_id, prefix="[Preprint] "))
    log(f"  -> {len(results)} medRxiv/bioRxiv preprints")
    return results


# ---------------------------------------------------------------------------
# Source 22: Japan NIID — National Institute of Infectious Diseases
#            Weekly Infectious Disease Surveillance, published in English.
#            First to flag unusual East-Asian pathogen activity.
# ---------------------------------------------------------------------------

def fetch_japan_niid() -> list[Article]:
    log("Fetching Japan NIID...")
    results = []
    for url in [
        "https://www.niid.go.jp/niid/en/feed/english-news.html",
        "https://www.niid.go.jp/niid/en/rss.xml",
        "https://www.niid.go.jp/niid/ja/rss.xml",  # Japanese-language fallback
        "https://www.niid.go.jp/niid/en/diseases/topic-e.html",
    ]:
        raw = fetch_url(url, retries=1, extra_headers={"Accept": "application/rss+xml, text/xml, text/html"})
        if not raw:
            continue
        items = _parse_feed_items(raw, "japan_niid")
        if items:
            results.extend(items)
            break
    if not results:
        # Google News Japan / NIID disease surveillance
        url = (
            "https://news.google.com/rss/search?q=NIID+Japan+infectious+disease+outbreak"
            "&hl=ja&gl=JP&ceid=JP:ja"
        )
        raw = fetch_url(url, retries=1)
        if raw:
            results.extend(_parse_feed_items(raw, "japan_niid"))
    log(f"  -> {len(results)} Japan NIID items")
    return results


# ---------------------------------------------------------------------------
# Source 23: Nigeria NCDC — West Africa Ebola/Lassa/Mpox hotspot
#            Publishes situation reports faster than Africa CDC
# ---------------------------------------------------------------------------

def fetch_nigeria_ncdc() -> list[Article]:
    log("Fetching Nigeria NCDC...")
    results = []
    # ncdc.gov.ng consistently times out — go straight to Google News
    url = (
        "https://news.google.com/rss/search?q=Nigeria+NCDC+outbreak+Lassa+Ebola+Mpox"
        "&hl=en-NG&gl=NG&ceid=NG:en"
    )
    raw = fetch_url(url, retries=1)
    if raw:
        results.extend(_parse_feed_items(raw, "nigeria_ncdc"))
    log(f"  -> {len(results)} Nigeria NCDC items")
    return results


# ---------------------------------------------------------------------------
# Source 24: South Africa NICD — best Southern Africa surveillance
#            Covers mpox, Rift Valley, CCHF, cholera for sub-Saharan Africa
# ---------------------------------------------------------------------------

def fetch_sa_nicd() -> list[Article]:
    log("Fetching South Africa NICD...")
    results = []
    for url in [
        "https://www.nicd.ac.za/feed/",
        "https://www.nicd.ac.za/diseases/feed/",
    ]:
        raw = fetch_url(url, retries=1)
        if not raw:
            continue
        try:
            root = ET.fromstring(raw)
            for item in root.findall(".//item"):
                title   = (item.findtext("title") or "").strip()
                link    = (item.findtext("link") or "").strip()
                desc    = (item.findtext("description") or "").strip()
                pubdate = (item.findtext("pubDate") or "").strip()
                if title:
                    results.append(Article("sa_nicd", title, desc or title, link, pubdate))
            if results:
                break
        except ET.ParseError:
            continue
    log(f"  -> {len(results)} SA NICD items")
    return results


# ---------------------------------------------------------------------------
# Source 25: India IDSP — Integrated Disease Surveillance Programme
#            1.4B people, main source of Nipah/avian flu/cholera signals.
#            Publishes weekly Outbreak Monitor.
# ---------------------------------------------------------------------------

def fetch_india_idsp() -> list[Article]:
    log("Fetching India IDSP / MoHFW...")
    results = []
    # IDSP doesn't have RSS — use Google News India health + MoHFW press releases
    queries = [
        "site:mohfw.gov.in OR site:ncdc.gov.in disease outbreak",
        "India IDSP outbreak epidemic cases",
        "India Nipah avian flu cholera outbreak cases",
    ]
    for q in queries[:2]:   # limit to 2 to avoid rate limits
        encoded = parse.quote(q)
        url = f"https://news.google.com/rss/search?q={encoded}&hl=en&gl=IN&ceid=IN:en"
        raw = fetch_url(url, extra_headers={"Accept": "application/rss+xml, text/xml"})
        if not raw:
            continue
        try:
            root = ET.fromstring(raw)
        except ET.ParseError:
            continue
        for item in root.findall(".//item"):
            title   = (item.findtext("title") or "").strip()
            link    = (item.findtext("link") or "").strip()
            desc    = (item.findtext("description") or "").strip()
            pubdate = (item.findtext("pubDate") or "").strip()
            if title:
                results.append(Article("india_idsp", title, desc or title, link, pubdate))
    log(f"  -> {len(results)} India IDSP/MoHFW items")
    return results


# ---------------------------------------------------------------------------
# Source 26: PAHO — Pan American Health Organization (WHO Americas)
#            Brazil/Latin America dengue, cholera, yellow fever outbreaks
# ---------------------------------------------------------------------------

def fetch_paho() -> list[Article]:
    log("Fetching PAHO alerts...")
    results = []
    paho_headers = {
        "Accept": "application/rss+xml, application/atom+xml, text/xml, */*",
        "User-Agent": "Mozilla/5.0 (compatible; Vigilo/3.0; outbreak-monitor)",
        "Referer": "https://www.paho.org/",
    }
    for url in [
        "https://www.paho.org/en/rss-feeds/epidemiological-alerts-updates",
        "https://www.paho.org/en/feed/alerts",
        "https://iris.paho.org/feed",
        "https://www.paho.org/en/news/feed",
    ]:
        raw = fetch_url(url, retries=1, extra_headers=paho_headers)
        if not raw:
            continue
        items = _parse_feed_items(raw, "paho")
        if items:
            results.extend(items)
            break

    if not results:
        # Fallback: Google News targeting PAHO epidemiological alerts
        url = "https://news.google.com/rss/search?q=PAHO+epidemiological+alert+outbreak&hl=en&gl=US&ceid=US:en"
        raw = fetch_url(url, retries=1)
        if raw:
            results.extend(_parse_feed_items(raw, "paho"))

    log(f"  -> {len(results)} PAHO items")
    return results


# ---------------------------------------------------------------------------
# Source 27: WHO FluNet — global influenza surveillance, 120 countries
#            Best early warning for pandemic flu strains; weekly data
# ---------------------------------------------------------------------------

def fetch_flunet() -> list[Article]:
    log("Fetching WHO FluNet / FluID...")
    results = []
    # Multiple WHO/CDC influenza feeds — try each until one works
    feeds = [
        ("flunet",       "https://www.who.int/feeds/entity/influenza/en/rss.xml"),
        ("flunet",       "https://www.who.int/news/item/feed?topic=influenza&format=rss"),
        ("flunet",       "https://www.who.int/rss-feeds/news-releases.xml"),
        ("flu_news_asia","https://iris.wpro.who.int/bitstream/handle/10665.1/14752/rss.xml"),
    ]
    for src_id, url in feeds:
        raw = fetch_url(url, retries=1, extra_headers={"Accept": "application/rss+xml, application/atom+xml, text/xml"})
        if not raw:
            continue
        items = _parse_feed_items(raw, src_id)
        # Filter to flu-relevant items from general WHO feeds
        flu_kw = re.compile(r"influenza|flu\b|avian|h5n1|h7n9|h3n2|pandemic|fluvirus", re.I)
        if src_id == "flunet" and "news-releases" in url:
            items = [a for a in items if flu_kw.search(a.title + " " + a.body)]
        if items:
            results.extend(items)
            break

    if not results:
        # Final fallback: Google News flu search
        url = "https://news.google.com/rss/search?q=influenza+outbreak+WHO+avian+flu&hl=en&gl=US&ceid=US:en"
        raw = fetch_url(url, retries=1)
        if raw:
            for art in _parse_feed_items(raw, "flunet"):
                results.append(art)

    log(f"  -> {len(results)} FluNet items")
    return results


# ---------------------------------------------------------------------------
# Source 28: Robert Koch Institute — Germany/Europe surveillance
#            RKI Epidemiologisches Bulletin; deep Europe coverage
# ---------------------------------------------------------------------------

def fetch_rki() -> list[Article]:
    log("Fetching Robert Koch Institute (RKI)...")
    results = []
    # Try direct RKI RSS feeds (URLs change with site redesigns)
    for url in [
        "https://www.rki.de/SiteGlobals/Functions/RSSFeed/RSSGenerator_nid.xml?nn=2370598",
        "https://www.rki.de/SiteGlobals/Functions/RSSFeed/RSSGenerator_nid.xml?nn=2374918",
        "https://www.rki.de/SiteGlobals/Functions/RSSFeed/RSSGenerator_nid.xml?nn=2374930",
        "https://www.rki.de/rss/infektionskrankheiten.xml",
    ]:
        raw = fetch_url(url, retries=1, extra_headers={"Accept": "application/rss+xml, text/xml"})
        if not raw:
            continue
        items = _parse_feed_items(raw, "rki")
        if items:
            results.extend(items)
            break
    if not results:
        # Fallback: Google News targeting RKI publications
        gnews_url = (
            "https://news.google.com/rss/search?q=RKI+Infektionskrankheiten+Ausbruch"
            "+site:rki.de&hl=de&gl=DE&ceid=DE:de"
        )
        raw = fetch_url(gnews_url, retries=1)
        if raw:
            for art in _parse_feed_items(raw, "rki"):
                results.append(art)
    log(f"  -> {len(results)} RKI items")
    return results


# ---------------------------------------------------------------------------
# Source 29: Singapore MOH — South-East Asia sentinel
#            Publishes weekly infectious disease stats; fast, English
# ---------------------------------------------------------------------------

def fetch_singapore_moh() -> list[Article]:
    log("Fetching Singapore MOH...")
    results = []
    for url in [
        "https://www.moh.gov.sg/news-highlights/feed",
        "https://www.moh.gov.sg/resources-statistics/infectious-disease-statistics/feed",
        "https://www.moh.gov.sg/feeds/news-highlights",
    ]:
        raw = fetch_url(url, retries=1, extra_headers={"Accept": "application/rss+xml, text/xml"})
        if not raw:
            continue
        items = _parse_feed_items(raw, "singapore_moh")
        if items:
            results.extend(items)
            break
    if not results:
        # Fallback: Google News — Singapore MOH disease alerts
        url = (
            "https://news.google.com/rss/search?q=Singapore+MOH+infectious+disease+outbreak"
            "&hl=en-SG&gl=SG&ceid=SG:en"
        )
        raw = fetch_url(url, retries=1)
        if raw:
            results.extend(_parse_feed_items(raw, "singapore_moh"))
    log(f"  -> {len(results)} Singapore MOH items")
    return results


# ---------------------------------------------------------------------------
# Source 30: CDC MMWR — Morbidity and Mortality Weekly Report
#            US gold standard surveillance; ~1 week lag but high authority
# ---------------------------------------------------------------------------

def fetch_cdc_mmwr() -> list[Article]:
    log("Fetching CDC MMWR...")
    results = []
    for url in [
        "https://www.cdc.gov/mmwr/rss/mmwr.rss",
        "https://www2c.cdc.gov/podcasts/rss/mmwr.rss",
        "https://tools.cdc.gov/api/v2/resources/media/403372.rss",
    ]:
        raw = fetch_url(url, retries=1, extra_headers={"Accept": "application/rss+xml, text/xml"})
        if not raw:
            continue
        try:
            root = ET.fromstring(raw)
            for item in root.findall(".//item"):
                title   = (item.findtext("title") or "").strip()
                link    = (item.findtext("link") or "").strip()
                desc    = (item.findtext("description") or "").strip()
                pubdate = (item.findtext("pubDate") or "").strip()
                if title:
                    results.append(Article("cdc_mmwr", title, desc or title, link, pubdate))
            if results:
                break
        except ET.ParseError:
            continue
    log(f"  -> {len(results)} CDC MMWR items")
    return results


# ---------------------------------------------------------------------------
# Source 31: FAO EMPRES-i — Emergency Prevention System for Animal Health
#            Complements WOAH; tracks avian flu, foot-and-mouth, anthrax
#            in livestock — zoonosis predictor 2-6 weeks ahead
# ---------------------------------------------------------------------------

def fetch_fao_empres() -> list[Article]:
    log("Fetching FAO EMPRES-i / GLEWS...")
    results = []
    ANIMAL_KW = re.compile(
        r"disease|avian|influenza|anthrax|outbreak|animal|livestock|zoonot|pathogen|"
        r"foot.and.mouth|fmd|newcastle|rift.valley|lumpy.skin|african.swine|asfv|hpai",
        re.I
    )
    for url in [
        "https://www.fao.org/newsroom/rss-feed/news/en/",        # FAO general news
        "https://www.fao.org/news/story/en/rss.xml",
        "https://www.fao.org/food-safety/news/en/rss.xml",
    ]:
        raw = fetch_url(url, retries=1, extra_headers={"Accept": "application/rss+xml, text/xml"})
        if not raw:
            continue
        items = _parse_feed_items(raw, "fao_empres")
        # Filter to animal health relevant
        filtered = [a for a in items if ANIMAL_KW.search(a.title + " " + a.body)]
        if filtered:
            results.extend(filtered)
            break
    if not results:
        # Google News: FAO avian flu animal disease
        url = "https://news.google.com/rss/search?q=FAO+avian+flu+animal+disease+outbreak&hl=en&gl=US&ceid=US:en"
        raw = fetch_url(url, retries=1)
        if raw:
            for art in _parse_feed_items(raw, "fao_empres"):
                if ANIMAL_KW.search(art.title + " " + art.body):
                    results.append(art)
    log(f"  -> {len(results)} FAO EMPRES items")
    return results


# ---------------------------------------------------------------------------
# Source 32: Google Trends — daily trending health searches (12 countries)
#            Detects population-level symptom search spikes 12-48h before news.
#            No API key required — uses Google Trends public RSS.
# ---------------------------------------------------------------------------

TRENDS_COUNTRIES = ["US", "RU", "IN", "NG", "ZA", "BR", "DE", "GB", "JP", "ID", "PH"]  # CN removed (400)

def fetch_google_trends() -> list[Article]:
    log("Fetching Google Trends RSS (12 countries)...")
    results = []
    try:
        health_kw_set = set(kw.lower() for kw in HEALTH_KEYWORDS)
        for geo in TRENDS_COUNTRIES:
            # New endpoint (2024+): /trending/rss replaces deprecated /trendingsearches/daily/rss
            url = f"https://trends.google.com/trending/rss?geo={geo}"
            raw = fetch_url(url, retries=1, extra_headers={
                "Accept": "application/rss+xml, text/xml",
                "Accept-Language": "en-US,en;q=0.9",
            })
            if not raw:
                continue
            items = _parse_feed_items(raw, "google_trends")
            for art in items:
                text_lower = (art.title + " " + art.body).lower()
                if any(kw in text_lower for kw in health_kw_set):
                    # Tag with country geo so pipeline can detect location
                    art.title = f"[Trending/{geo}] {art.title}"
                    results.append(art)
    except Exception as e:
        log(f"  Google Trends error: {e}")
        return []
    log(f"  -> {len(results)} Google Trends health-relevant items")
    return results


# ---------------------------------------------------------------------------
# Source 33: ClinicalTrials.gov — new infectious disease trial registrations
#            Researchers register trials when they have active outbreak cases;
#            appears 1-4 weeks before WHO formal alert for contained outbreaks.
# ---------------------------------------------------------------------------

def fetch_clinicaltrials() -> list[Article]:
    log("Fetching ClinicalTrials.gov (infectious disease)...")
    results = []
    try:
        # Primary: ClinicalTrials API v2 — recruiting trials for infectious diseases
        # Note: do NOT add &format=json — it causes 400; default response is JSON
        url = (
            "https://clinicaltrials.gov/api/v2/studies"
            "?query.cond=infectious+disease"
            "&filter.overallStatus=RECRUITING"
            "&pageSize=20"
            "&sort=LastUpdatePostDate:desc"
        )
        raw = fetch_url(url, retries=1, extra_headers={"Accept": "application/json"})
        if raw:
            try:
                data = json.loads(raw)
                studies = data.get("studies") or []
                cutoff = datetime.now(timezone.utc) - timedelta(days=30)
                for study in studies:
                    proto = study.get("protocolSection") or {}
                    id_mod = proto.get("identificationModule") or {}
                    status_mod = proto.get("statusModule") or {}
                    cond_mod = proto.get("conditionsModule") or {}

                    title = id_mod.get("officialTitle") or id_mod.get("briefTitle") or ""
                    nct_id = id_mod.get("nctId") or ""
                    conditions = cond_mod.get("conditions") or []
                    last_update = status_mod.get("lastUpdatePostDateStruct", {}).get("date") or ""
                    link = f"https://clinicaltrials.gov/study/{nct_id}" if nct_id else ""

                    # Check recency
                    if last_update:
                        try:
                            upd_dt = datetime.strptime(last_update, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                            if upd_dt < cutoff:
                                continue
                        except Exception:
                            pass

                    cond_str = ", ".join(conditions[:3])
                    body = f"Condition: {cond_str}" if cond_str else title
                    if title:
                        results.append(Article(
                            "clinicaltrials",
                            f"[ClinicalTrial] {title}",
                            body,
                            link,
                            last_update,
                        ))
            except Exception as e:
                log(f"  ClinicalTrials API v2 parse error: {e}")

        # Fallback: Atom feed search
        if not results:
            atom_url = (
                "https://clinicaltrials.gov/search"
                "?cond=Infectious+Disease&rslt=With&recrs=a&sort=Date&fmt=Atom"
            )
            raw = fetch_url(atom_url, retries=1, extra_headers={"Accept": "application/atom+xml, text/xml"})
            if raw:
                results.extend(_parse_feed_items(raw, "clinicaltrials", prefix="[ClinicalTrial] "))

    except Exception as e:
        log(f"  ClinicalTrials error: {e}")
        return []
    log(f"  -> {len(results)} ClinicalTrials items")
    return results


# ---------------------------------------------------------------------------
# Source 34: FDA Drug Shortages — antimicrobial shortages signal outbreak surge
#            Oseltamivir (Tamiflu), azithromycin, doxycycline shortages
#            correlate with outbreak-driven demand spikes 1-3 weeks before news.
# ---------------------------------------------------------------------------

ANTIMICROBIAL_KW = re.compile(
    r"antibiotic|antiviral|antifungal|antimicrobial|oseltamivir|tamiflu|"
    r"azithromycin|amoxicillin|doxycycline|ciprofloxacin|levofloxacin|"
    r"metronidazole|fluconazole|acyclovir|valacyclovir|remdesivir|"
    r"zanamivir|peramivir|ribavirin|chloroquine|hydroxychloroquine|"
    r"cephalexin|cefdinir|clindamycin|trimethoprim|sulfamethoxazole",
    re.I,
)

def fetch_drug_shortages() -> list[Article]:
    log("Fetching FDA Drug Shortages...")
    results = []
    try:
        # Primary: FDA CDER drug shortage database (JSON datatable)
        # Note: openFDA /drug/shortages doesn't exist; use the CDER static datatable
        url = "https://www.accessdata.fda.gov/scripts/drugshortages/dsp_exportResults.cfm?action=exportShortages&type=json"
        raw = fetch_url(url, retries=1, extra_headers={"Accept": "application/json, text/plain"})
        if raw:
            try:
                data = json.loads(raw)
                entries = data if isinstance(data, list) else (data.get("data") or data.get("shortages") or [])
                for entry in entries[:50]:
                    drug_name = (
                        entry.get("genericName") or entry.get("generic_name")
                        or entry.get("drugName") or entry.get("drug_name")
                        or ""
                    ).strip()
                    reason = (entry.get("shortageReason") or entry.get("reason") or "").strip()
                    date_added = (entry.get("dateAdded") or entry.get("date_added") or "").strip()
                    if not drug_name:
                        continue
                    if ANTIMICROBIAL_KW.search(drug_name) or ANTIMICROBIAL_KW.search(reason):
                        title = f"[Drug Shortage] {drug_name} — shortage reported"
                        body = reason or f"{drug_name} drug shortage listed by FDA"
                        results.append(Article(
                            "drug_shortages",
                            title,
                            body,
                            "https://www.fda.gov/drugs/drug-shortages",
                            date_added,
                        ))
            except Exception as e:
                log(f"  FDA CDER shortages parse error: {e}")

        # Fallback: Google News for antimicrobial drug shortages
        if not results:
            url = (
                "https://news.google.com/rss/search"
                "?q=drug+shortage+antibiotic+antiviral+FDA+ASHP&hl=en-US&gl=US&ceid=US:en"
            )
            raw = fetch_url(url, retries=1)
            if raw:
                items = _parse_feed_items(raw, "drug_shortages", prefix="[Drug Shortage] ")
                results.extend([a for a in items if ANTIMICROBIAL_KW.search(a.title + " " + a.body)])

    except Exception as e:
        log(f"  Drug shortages error: {e}")
        return []
    log(f"  -> {len(results)} antimicrobial drug shortage items")
    return results


# ---------------------------------------------------------------------------
# Source 35: EuroMOMO — European excess mortality monitoring
#            Z-score spikes in country mortality data signal unreported
#            outbreaks 2-4 weeks before official disease classification.
# ---------------------------------------------------------------------------

def fetch_euromomo() -> list[Article]:
    log("Fetching EuroMOMO excess mortality...")
    results = []
    try:
        # Primary: EuroMOMO JSON API (z-score by country)
        for url in [
            "https://www.euromomo.eu/api/v3/zscore/country?country=all&season=current",
            "https://www.euromomo.eu/api/v2/zscores?country=all",
        ]:
            raw = fetch_url(url, retries=1, extra_headers={"Accept": "application/json"})
            if not raw:
                continue
            try:
                data = json.loads(raw)
                # Handle list or dict response shapes
                entries = data if isinstance(data, list) else (
                    data.get("data") or data.get("zscores") or data.get("results") or []
                )
                for entry in entries:
                    country = (
                        entry.get("country") or entry.get("countryCode") or entry.get("name") or ""
                    ).strip()
                    zscore = entry.get("zscore") or entry.get("z_score") or entry.get("value") or 0
                    week = entry.get("week") or entry.get("ISOweek") or ""
                    try:
                        zscore_val = float(zscore)
                    except (TypeError, ValueError):
                        continue
                    if zscore_val >= 2.0:
                        title = f"[EuroMOMO] Excess mortality spike — {country} (z={zscore_val:.1f})"
                        body = f"EuroMOMO z-score {zscore_val:.1f} for {country}, week {week}. Threshold exceeded (z≥2)."
                        results.append(Article(
                            "euromomo",
                            title,
                            body,
                            "https://www.euromomo.eu/graphs-and-maps",
                            str(week),
                        ))
                if results:
                    break
            except Exception as e:
                log(f"  EuroMOMO parse error: {e}")
                continue

        # Fallback: Google News targeting EuroMOMO excess mortality spikes
        if not results:
            url = (
                "https://news.google.com/rss/search"
                "?q=EuroMOMO+excess+mortality+spike&hl=en&gl=EU&ceid=GB:en"
            )
            raw = fetch_url(url, retries=1)
            if raw:
                results.extend(_parse_feed_items(raw, "euromomo", prefix="[EuroMOMO] "))

    except Exception as e:
        log(f"  EuroMOMO error: {e}")
        return []
    log(f"  -> {len(results)} EuroMOMO excess mortality items")
    return results


# ---------------------------------------------------------------------------
# Source 36: Telegram public health channels (Russian) + Russian social signal
#            Russian MoH and Rospotrebnadzor Telegram channels publish alerts
#            faster than their official websites; also covers CIS neighbors.
#            Source ID: "telegram_ru"
# ---------------------------------------------------------------------------

TELEGRAM_CHANNELS = [
    ("https://t.me/s/minzdrav_ru",               "minzdrav_ru"),
    ("https://t.me/s/rospotrebnadzor_official",  "rospotrebnadzor_official"),
    ("https://t.me/s/rosminzdrav",               "rosminzdrav"),
]

def fetch_telegram_ru() -> list[Article]:
    log("Fetching Telegram RU health channels...")
    results = []
    try:
        health_kw_set = set(kw.lower() for kw in HEALTH_KEYWORDS)
        tg_headers = {
            "Accept": "text/html,application/xhtml+xml,*/*",
            "User-Agent": "Mozilla/5.0 (compatible; Vigilo/3.0; outbreak-monitor)",
            "Accept-Language": "ru,en;q=0.8",
        }

        for tg_url, channel_id in TELEGRAM_CHANNELS:
            raw = fetch_url(tg_url, retries=1, extra_headers=tg_headers)
            if not raw:
                continue
            try:
                raw_str = raw.decode("utf-8", errors="replace")
                # Extract message text blocks from Telegram preview page
                # Messages appear in <div class="tgme_widget_message_text"> elements
                msg_blocks = re.findall(
                    r'<div[^>]*class="[^"]*tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>',
                    raw_str, re.S | re.I,
                )
                # Also try og:description meta as fallback
                if not msg_blocks:
                    og_desc = re.search(r'<meta\s+property="og:description"\s+content="([^"]+)"', raw_str, re.I)
                    if og_desc:
                        msg_blocks = [og_desc.group(1)]

                for block in msg_blocks:
                    text = _strip_html(block).strip()
                    if not text or len(text) < 20:
                        continue
                    text_lower = text.lower()
                    if any(kw in text_lower for kw in health_kw_set):
                        title = f"[Telegram/{channel_id}] {text[:120]}"
                        results.append(Article(
                            "telegram_ru",
                            title,
                            text[:400],
                            tg_url,
                            "",
                        ))
            except Exception as e:
                log(f"  Telegram channel {channel_id} parse error: {e}")
                continue

        # Fallback: Google News search for Russian VK/Telegram disease posts
        if not results:
            url = (
                "https://news.google.com/rss/search"
                "?q=%D0%B2%D1%81%D0%BF%D1%8B%D1%88%D0%BA%D0%B0+%D0%B7%D0%B0%D0%B1%D0%BE%D0%BB%D0%B5%D0%B2%D0%B0%D0%BD%D0%B8%D0%B5+"
                "%D0%92%D0%9A%D0%BE%D0%BD%D1%82%D0%B0%D0%BA%D1%82%D0%B5+Telegram"
                "&hl=ru&gl=RU&ceid=RU:ru"
            )
            raw = fetch_url(url, retries=1)
            if raw:
                results.extend(_parse_feed_items(raw, "telegram_ru", prefix="[RU Social] "))

    except Exception as e:
        log(f"  Telegram RU error: {e}")
        return []
    log(f"  -> {len(results)} Telegram RU health items")
    return results


# ---------------------------------------------------------------------------
# Source 37: GitHub Epi Repos — computational epidemiologists push code when
#            working on active outbreaks, often weeks before publication.
#            Uses GitHub Search API (public, no auth required for basic use).
# ---------------------------------------------------------------------------

GITHUB_EPI_KW = re.compile(
    r"outbreak|epidemic|surveillance|pandemic|infectious|pathogen|"
    r"ebola|cholera|dengue|mpox|monkeypox|avian.flu|h5n1|nipah|"
    r"lassa|marburg|plague|covid|sars|zika|influenza|hantavirus",
    re.I,
)

def fetch_github_epi() -> list[Article]:
    log("Fetching GitHub epi repos (search API)...")
    results = []
    try:
        year = datetime.now(timezone.utc).year
        url = (
            "https://api.github.com/search/repositories"
            f"?q=outbreak+epidemic+{year}+in:description+in:readme"
            "&sort=updated&order=desc&per_page=15"
        )
        raw = fetch_url(url, retries=1, extra_headers={
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        })
        if not raw:
            # Fallback query without year restriction
            url = (
                "https://api.github.com/search/repositories"
                "?q=outbreak+epidemic+surveillance+in:description&sort=updated&order=desc&per_page=15"
            )
            raw = fetch_url(url, retries=1, extra_headers={
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            })
        if not raw:
            return []
        try:
            data = json.loads(raw)
        except Exception as e:
            log(f"  GitHub epi JSON parse error: {e}")
            return []

        for repo in (data.get("items") or []):
            full_name   = repo.get("full_name") or ""
            description = repo.get("description") or ""
            html_url    = repo.get("html_url") or ""
            updated_at  = repo.get("updated_at") or repo.get("pushed_at") or ""
            combined    = full_name + " " + description
            if not GITHUB_EPI_KW.search(combined):
                continue
            if not full_name:
                continue
            title = f"[GitHub Epi] {full_name}"
            body  = description or full_name
            results.append(Article(
                "github_epi",
                title,
                body,
                html_url,
                updated_at,
            ))

    except Exception as e:
        log(f"  GitHub epi error: {e}")
        return []
    log(f"  -> {len(results)} GitHub epi repo items")
    return results


# ---------------------------------------------------------------------------
# Source 38: WHO IHR / additional WHO feeds — IHR notifications precede DON
#            Country IHR reports appear 24-72h before formal WHO DON.
#            Also monitors WHO emergency and health-topics news feeds.
# ---------------------------------------------------------------------------

def fetch_who_ihr() -> list[Article]:
    log("Fetching WHO IHR / emergency feeds...")
    results = []
    try:
        who_headers = {
            "Accept": "application/rss+xml, application/atom+xml, text/xml, */*",
            "User-Agent": "Mozilla/5.0 (compatible; Vigilo/3.0; outbreak-monitor)",
            "Referer": "https://www.who.int/",
        }
        feeds_tried = [
            "https://www.who.int/csr/don/en/rss.xml",
            "https://www.who.int/emergencies/disease-outbreak-news/feed",
            "https://www.who.int/health-topics/disease-outbreaks/en/rss.xml",
            "https://www.who.int/news/item/feed?topic=emergencies&format=rss",
            "https://www.who.int/feeds/entity/csr/don/en/rss.xml",
            "https://www.who.int/rss-feeds/news-releases.xml",
        ]
        for url in feeds_tried:
            raw = fetch_url(url, retries=1, extra_headers=who_headers)
            if not raw:
                continue
            items = _parse_feed_items(raw, "who_ihr")
            if items:
                # For the general WHO news-releases feed, filter to outbreak-relevant
                if "news-releases" in url:
                    kw_re = re.compile(
                        r"outbreak|disease|epidemic|virus|infection|alert|emergency|"
                        r"cholera|dengue|ebola|mpox|influenza|avian|covid|plague|lassa",
                        re.I,
                    )
                    items = [a for a in items if kw_re.search(a.title + " " + a.body)]
                if items:
                    results.extend(items)
                    break

        # Fallback: Google News WHO IHR
        if not results:
            url = (
                "https://news.google.com/rss/search"
                "?q=WHO+IHR+disease+outbreak+notification&hl=en&gl=US&ceid=US:en"
            )
            raw = fetch_url(url, retries=1)
            if raw:
                results.extend(_parse_feed_items(raw, "who_ihr", prefix="[WHO IHR] "))

    except Exception as e:
        log(f"  WHO IHR error: {e}")
        return []
    log(f"  -> {len(results)} WHO IHR items")
    return results


# ---------------------------------------------------------------------------
# Aggregate all articles
# ---------------------------------------------------------------------------

def collect_all_articles() -> list[Article]:
    """Fetch from all sources; failures are logged and skipped."""
    all_articles: list[Article] = []
    fetchers = [
        # ── Core global feeds (sub-15 min latency) ──────────────────────────
        fetch_gdelt_gkg,
        fetch_gdelt_themes,
        fetch_google_news,
        fetch_google_news_ru,       # Russia/CIS Russian-language
        fetch_google_news_zh,       # China/Taiwan Chinese-language
        fetch_gdelt_cis_china,      # GDELT filtered to RU/ZH media

        # ── Official surveillance authorities ────────────────────────────────
        fetch_who_don,              # WHO Disease Outbreak News
        fetch_promed,               # Expert-curated (oldest, authoritative)
        fetch_ecdc_cdtr,            # Europe
        fetch_rki,                  # Robert Koch Institute — Germany/Europe deep
        fetch_paho,                 # WHO Americas — Brazil/LatAm
        fetch_africa_cdc,           # Africa CDC
        fetch_nigeria_ncdc,         # West Africa — Ebola/Lassa/Mpox hotspot
        fetch_sa_nicd,              # Southern Africa sentinel
        fetch_flunet,               # Global influenza + FluNews Asia
        fetch_cdc_mmwr,             # US CDC weekly surveillance

        # ── Asia-Pacific authorities ─────────────────────────────────────────
        fetch_rospotrebnadzor,      # Russia federal epidemiology authority
        fetch_hk_chp,               # HK — China/Asia gateway, caught SARS 2003
        fetch_taiwan_cdc,           # Taiwan — E.Asia early signals
        fetch_japan_niid,           # Japan NIID — East Asia sentinel
        fetch_singapore_moh,        # SE Asia sentinel
        fetch_india_idsp,           # India 1.4B — Nipah/avian flu source

        # ── Zoonosis early warning (animals → humans 2-6 weeks ahead) ────────
        fetch_woah,                 # World Animal Health
        fetch_fao_empres,           # FAO EMPRES — avian flu, anthrax livestock

        # ── Preprints — 2-4 weeks ahead of WHO ──────────────────────────────
        fetch_medrxiv,              # medRxiv/bioRxiv infectious disease preprints

        # ── Crowd & real-time signals ────────────────────────────────────────
        fetch_reddit,
        fetch_wikipedia_changes,

        # ── Specialized aggregators ──────────────────────────────────────────
        fetch_reliefweb,
        fetch_cidrap,
        fetch_outbreak_news_today,
        fetch_healthmap,

        # ── Unconventional / competitor-blind signals ─────────────────────────
        fetch_google_trends,        # Pop. symptom search spikes — 12 countries
        fetch_clinicaltrials,       # New infectious disease trial registrations
        fetch_drug_shortages,       # FDA antimicrobial shortage = outbreak surge
        fetch_euromomo,             # EU excess mortality z-score spikes
        fetch_telegram_ru,          # Russian MoH / Rospotrebnadzor Telegram
        fetch_github_epi,           # Epidemiologists pushing outbreak code on GitHub
        fetch_who_ihr,              # WHO IHR notifications — 24-72h before DON
    ]
    for fetcher in fetchers:
        try:
            articles = fetcher()
            all_articles.extend(articles)
        except Exception as e:
            log(f"  ERROR in {fetcher.__name__}: {e}")

    log(f"Total articles collected: {len(all_articles)}")
    return all_articles

# ---------------------------------------------------------------------------
# Filtering — keep only health-relevant articles
# ---------------------------------------------------------------------------

HEALTH_KEYWORDS = [
    # English
    "outbreak", "disease", "virus", "epidemic", "infection", "alert",
    "cholera", "dengue", "ebola", "mpox", "monkeypox", "influenza", "avian flu",
    "h5n1", "h5n2", "malaria", "measles", "polio", "rabies", "typhoid", "lassa",
    "marburg", "yellow fever", "meningitis", "plague", "hantavirus", "covid",
    "sars", "mers", "zika", "chikungunya", "west nile", "nipah", "hendra",
    "crimean-congo", "listeria", "salmonella", "brucellosis", "anthrax",
    "tularemia", "diphtheria", "pertussis", "hepatitis", "tuberculosis",
    "cases", "deaths", "fatalities", "surveillance", "zoonotic",
    "confirmed", "infected", "cluster", "quarantine",
    # Russian (key terms)
    "вспышка", "эпидемия", "инфекция", "заболевание", "вирус", "карантин",
    "роспотребнадзор", "минздрав", "заражение", "случаи", "смерти",
    "холера", "чума", "эбола", "корь", "грипп", "туберкулёз", "туберкулез",
    "птичий грипп", "лихорадка", "менингит", "бруцеллёз", "сибирская язва",
    # Chinese (key terms)
    "疫情", "爆发", "感染", "病例", "死亡", "病毒", "传染",
    "禽流感", "霍乱", "鼠疫", "麻疹", "流感", "肝炎", "结核",
]

def is_health_relevant(article: Article) -> bool:
    text = (article.title + " " + article.body).lower()
    return any(kw in text for kw in HEALTH_KEYWORDS)

# ---------------------------------------------------------------------------
# Signal aggregation and anomaly detection
# ---------------------------------------------------------------------------

class MentionBucket:
    """Tracks mentions of (iso, disease) in the current run window."""

    def __init__(self):
        # key -> list of Article
        self._buckets: dict[str, list[Article]] = {}

    def add(self, iso: str, disease: str, article: Article):
        key = f"{iso}|{disease}"
        if key not in self._buckets:
            self._buckets[key] = []
        self._buckets[key].append(article)

    def items(self):
        return self._buckets.items()


def compute_confidence(
    spike_ratio: float,
    source_domains: set,
    has_coords: bool,
    ai_score: float,
) -> float:
    source_diversity_score = min(len(source_domains) / 4.0, 1.0) * 0.30
    spike_ratio_score      = min((spike_ratio - 1.0) / 9.0, 1.0) * 0.35
    geo_precision_score    = (1.0 if has_coords else 0.5) * 0.15
    ai_confidence          = ai_score * 0.20
    return source_diversity_score + spike_ratio_score + geo_precision_score + ai_confidence


def level_from_confidence(c: float) -> str:
    if c >= 0.80:
        return "urgent"
    elif c >= 0.60:
        return "alert"
    else:
        return "watch"


def estimate_hours_ahead(sources: list[str]) -> int:
    """Rough estimate of how many hours ahead of mainstream TV this signal is."""
    if "promed" in sources:
        return 72
    if "reddit" in sources or "wikipedia" in sources:
        return 48
    if "gdelt" in sources or "gdelt_theme" in sources:
        return 36
    return 24


def build_signals(
    buckets: MentionBucket,
    history: dict,
) -> list[dict]:
    """
    For each (iso, disease) bucket:
    1. Compute spike ratio vs baseline
    2. Score confidence
    3. Optionally call AI
    4. Emit signal if threshold met and not recently emitted
    """
    signals = []
    use_ai = bool(os.environ.get("GROQ_API_KEY") or os.environ.get("GEMINI_API_KEY"))

    for key, articles in buckets.items():
        iso, disease = key.split("|", 1)
        current_count = len(articles)

        if current_count < SPIKE_MIN_COUNT:
            continue  # Not enough raw signal

        baseline_mean = compute_baseline(history, iso, disease)
        spike_ratio = current_count / (baseline_mean + 1.0)

        if spike_ratio < SPIKE_RATIO_THRESHOLD:
            # Not anomalous vs baseline — record and continue
            record_mention(history, iso, disease, current_count)
            continue

        # Determine geo from articles
        country_name, lat, lng = None, None, None
        for art in articles:
            cname, ciso, clat, clng = detect_country(art.title + " " + art.body)
            if ciso == iso and clat is not None:
                country_name = cname
                lat, lng = clat, clng
                break
        if not country_name:
            # Try COUNTRY_DB by ISO
            for cname, (ciso, clat, clng, _) in COUNTRY_DB.items():
                if ciso == iso:
                    country_name = cname.title()
                    lat, lng = clat, clng
                    break

        source_names  = list({a.source for a in articles})
        source_domains = {a.domain for a in articles}
        has_coords    = lat is not None and lng is not None
        ai_score      = 0.0
        ai_processed  = False
        ai_summary    = None

        # AI classification (optional)
        if use_ai:
            representative = articles[0]
            text_for_ai = f"{representative.title}\n{representative.body}"
            ai_result = ai_classify(text_for_ai)
            if ai_result:
                ai_processed = True
                if not ai_result.get("is_outbreak_signal", True):
                    # AI says this is NOT an outbreak signal — downgrade credibility
                    ai_score = 0.0
                else:
                    ai_score = float(ai_result.get("credibility", 0.5))
                    ai_summary = ai_result.get("summary")
                    # Refine geo from AI if we didn't have it
                    if not has_coords:
                        ai_country = ai_result.get("country", "")
                        if ai_country:
                            match_key = ai_country.lower()
                            if match_key in COUNTRY_DB:
                                c_iso, c_lat, c_lng, _ = COUNTRY_DB[match_key]
                                if c_iso == iso:
                                    lat, lng = c_lat, c_lng
                                    has_coords = True
        else:
            # No AI: use source credibility heuristic
            credibility_map = {
                "promed": 0.85,
                "reliefweb": 0.80,
                "google_news": 0.60,
                "gdelt": 0.55,
                "gdelt_theme": 0.55,
                "reddit": 0.40,
                "wikipedia": 0.50,
            }
            scores = [credibility_map.get(s, 0.5) for s in source_names]
            ai_score = sum(scores) / len(scores) if scores else 0.5

        confidence = compute_confidence(spike_ratio, source_domains, has_coords, ai_score)

        if confidence < CONFIDENCE_EMIT_LOW:
            record_mention(history, iso, disease, current_count)
            continue

        if was_recently_emitted(history, iso, disease):
            log(f"  Skip (recently emitted): {disease} / {iso}")
            continue

        # Build signal object
        headline = articles[0].title
        links    = list(dict.fromkeys(a.url for a in articles if a.url))[:5]
        summary  = ai_summary or _strip_html(articles[0].body)[:200]

        signal = {
            "id":                  make_signal_id(disease, iso),
            "detected_at":         datetime.now(timezone.utc).isoformat(),
            "disease":             disease,
            "country":             country_name or iso,
            "iso":                 iso,
            "lat":                 lat,
            "lng":                 lng,
            "confidence":          round(confidence, 3),
            "level":               level_from_confidence(confidence),
            "spike_ratio":         round(spike_ratio, 2),
            "source_count":        current_count,
            "sources":             source_names,
            "hours_ahead_estimate": estimate_hours_ahead(source_names),
            "headline":            headline,
            "summary":             summary,
            "links":               links,
            "ai_processed":        ai_processed,
        }
        signals.append(signal)

        record_mention(history, iso, disease, current_count)
        mark_emitted(history, iso, disease)
        log(
            f"  SIGNAL [{signal['level'].upper()}] {disease} / {iso} "
            f"confidence={confidence:.2f} spike={spike_ratio:.1f}x sources={source_names}"
        )

    return signals

# ---------------------------------------------------------------------------
# Article → mention bucket assignment
# ---------------------------------------------------------------------------

def process_articles(articles: list[Article]) -> MentionBucket:
    """Filter articles, extract disease+country, fill buckets."""
    buckets = MentionBucket()
    skipped = 0

    for art in articles:
        if not is_health_relevant(art):
            skipped += 1
            continue

        text = art.title + " " + art.body
        disease, _ = detect_disease(text)
        if not disease:
            skipped += 1
            continue

        _, iso, _, _ = detect_country(text)
        if not iso:
            # Generic signal without geo — use "XX" as placeholder
            iso = "XX"

        buckets.add(iso, disease, art)

    log(f"  Articles filtered: {len(articles) - skipped} relevant, {skipped} skipped")
    return buckets

# ---------------------------------------------------------------------------
# Output writer
# ---------------------------------------------------------------------------

def write_output(signals: list[dict], sources_checked: list[str], dry_run: bool) -> None:
    output = {
        "meta": {
            "generated_at":       datetime.now(timezone.utc).isoformat(),
            "sources_checked":    sources_checked,
            "signals_count":      len(signals),
            "next_run_in_seconds": 300,
        },
        "signals": sorted(signals, key=lambda s: s["confidence"], reverse=True),
    }

    if dry_run:
        print("\n--- DRY RUN OUTPUT ---")
        print(json.dumps(output, indent=2, ensure_ascii=False))
        print("--- END DRY RUN ---\n")
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    SIGNALS_OUT.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    log(f"Wrote {len(signals)} signals to {SIGNALS_OUT}")

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

SOURCE_NAMES = [
    "gdelt", "gdelt_theme", "google_news", "promed",
    "reddit", "wikipedia", "reliefweb",
]


def _tg_send_direct(token: str, chat_id: str | int, text: str) -> bool:
    """Send single Telegram message directly (no Netlify needed)."""
    import urllib.request as _ureq
    payload = json.dumps({
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }).encode("utf-8")
    req = _ureq.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        with _ureq.urlopen(req, timeout=15) as r:
            result = json.loads(r.read())
            return result.get("ok", False)
    except Exception:
        return False


def _build_tg_message(signals: list[dict]) -> str | None:
    """Format ALERT/URGENT signals into a Telegram HTML message."""
    lvl_order = {"urgent": 0, "alert": 1}
    top = sorted(
        [s for s in signals if s.get("level") in ("urgent", "alert")],
        key=lambda s: (lvl_order.get(s.get("level", ""), 9), -(s.get("confidence") or 0)),
    )[:8]
    if not top:
        return None

    emoji_map = {"urgent": "🆘", "alert": "🚨"}
    lines = []
    for sig in top:
        em      = emoji_map.get(sig.get("level", ""), "🚨")
        country = f" · <b>{sig['iso']}</b>" if sig.get("iso") and sig.get("iso") != "XX" else ""
        spike   = f" · {sig['spike_ratio']}×" if sig.get("spike_ratio") else ""
        conf    = f" {round((sig.get('confidence') or 0) * 100)}%" if sig.get("confidence") else ""
        srcs    = sig.get("sources", [])
        src_str = f" · {len(srcs)} src" if srcs else ""
        hl      = sig.get("headline") or ""
        hl_line = f"\n   <i>{hl[:100]}</i>" if hl else ""
        lines.append(f"{em} <b>{sig['disease']}</b>{country}{spike}{conf}{src_str}{hl_line}")

    urgents = sum(1 for s in top if s.get("level") == "urgent")
    alerts  = sum(1 for s in top if s.get("level") == "alert")
    if urgents:
        header = f"🆘 <b>Vigilo — {urgents} URGENT + {alerts} ALERT</b>"
    else:
        header = f"🚨 <b>Vigilo — {alerts} new ALERT signal{'s' if alerts>1 else ''}</b>"

    ts = datetime.now(timezone.utc).strftime("%d %b %H:%M UTC")
    return (
        f"{header}\n"
        f"<i>{ts}</i>\n\n"
        + "\n\n".join(lines)
        + "\n\n🌐 <a href=\"https://vigilo.cc/app.html\">vigilo.cc</a>  · /stop to unsubscribe"
    )


def notify_telegram(signals: list[dict], dry_run: bool = False) -> None:
    """Send ALERT/URGENT signals to Telegram.

    Two modes:
    1. Direct admin mode  — sends to TELEGRAM_ADMIN_CHAT_IDS (comma-separated, from env)
    2. Subscriber mode    — calls Netlify function which fans out to all /start subscribers

    Skips silently if TELEGRAM_BOT_TOKEN is not set.
    """
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        return

    message = _build_tg_message(signals)
    if not message:
        return

    if dry_run:
        alert_count = sum(1 for s in signals if s.get("level") in ("urgent", "alert"))
        log(f"  [dry-run] Would send {alert_count} Telegram alerts")
        return

    # ── Mode 1: Direct admin notifications ───────────────────────────────────
    admin_ids_raw = os.environ.get("TELEGRAM_ADMIN_CHAT_IDS", "").strip()
    if admin_ids_raw:
        sent_direct = 0
        for cid in admin_ids_raw.split(","):
            cid = cid.strip()
            if cid and _tg_send_direct(token, cid, message):
                sent_direct += 1
        if sent_direct:
            log(f"  Telegram direct: {sent_direct} admin chat(s) notified")

    # ── Mode 2: Netlify subscriber fan-out ────────────────────────────────────
    notify_url = os.environ.get("TELEGRAM_NOTIFY_URL", "").strip()
    if not notify_url:
        # Auto-detect: assume production Netlify URL
        notify_url = "https://vigilo.cc/.netlify/functions/telegram-notify"

    internal_secret = os.environ.get("INTERNAL_SECRET", "")
    payload = json.dumps({
        "signals": [s for s in signals if s.get("level") in ("urgent", "alert")],
        "secret": internal_secret,
    }).encode("utf-8")

    try:
        import urllib.request as _ureq
        req = _ureq.Request(
            notify_url,
            data=payload,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )
        with _ureq.urlopen(req, timeout=20) as r:
            result = json.loads(r.read())
            subs_notified = result.get("sent", 0)
            if subs_notified:
                log(f"  Telegram subscribers: {subs_notified} notified")
    except Exception as e:
        # Non-fatal — Netlify function might not be deployed yet
        log(f"  Telegram subscriber notify (non-fatal): {e}")


def run(dry_run: bool = False) -> int:
    log("=== Vigilo Fast Signals Engine starting ===")
    log(f"AI mode: {'groq' if os.environ.get('GROQ_API_KEY') else 'gemini' if os.environ.get('GEMINI_API_KEY') else 'regex/heuristic'}")

    # Load and prune history
    history = load_history()
    history = prune_history(history)

    # Collect articles from all sources
    articles = collect_all_articles()

    # Process into mention buckets
    buckets = process_articles(articles)

    # Anomaly detection + signal generation
    signals = build_signals(buckets, history)

    log(f"Signals generated: {len(signals)}")

    # Write output
    write_output(signals, SOURCE_NAMES, dry_run)

    # Send Telegram notifications for new ALERT/URGENT signals
    notify_telegram(signals, dry_run)

    # Persist updated history (always, even on dry run — baseline matters)
    if not dry_run:
        save_history(history)
        log(f"History saved to {HISTORY_OUT}")
    else:
        log("Dry run: history NOT saved")

    log("=== Done ===")
    return len(signals)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Vigilo Fast Signals Engine — early outbreak detection",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print signals to stdout instead of writing files",
    )
    args = parser.parse_args()

    try:
        count = run(dry_run=args.dry_run)
        sys.exit(0)
    except KeyboardInterrupt:
        log("Interrupted by user")
        sys.exit(130)
    except Exception as e:
        log(f"FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
