"""
risk_aggregate.py — B2B Risk Intelligence batch aggregator.

Runs in the same GitHub Actions cron as fast_signals.py. Pulls
non-health risk categories from GDELT DOC API + Google News, classifies
them deterministically (free keyword taxonomy — no per-request AI),
geo-resolves, scores per country, and writes:

  public/risk_events.json   — flat verified event feed
  public/risk_index.json    — per-country composite + category breakdown

The /api/v1/risk Netlify function only reads/filters these blobs.
Health events are imported from the existing signals.json so the B2B
composite spans all 7 categories without duplicating the health engine.

Spec: docs/specs/2026-05-17-b2b-risk-intelligence-api-design.md
"""

from __future__ import annotations

import json
import re
import sys
import hashlib
from pathlib import Path
from datetime import datetime, timezone

SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))

# Reuse battle-tested helpers from the health engine
from fast_signals import (  # noqa: E402
    fetch_url, detect_country, log, Article, _strip_html,
    COUNTRY_DB, LANDMARK_DB,
)
from risk_scoring import score_geo, composite_score, CATEGORIES  # noqa: E402
from inform import load_fragility  # noqa: E402

# ISO-2 → (lat, lng) centroid lookup, built from the name-keyed COUNTRY_DB
# (+ landmark coords). Used to backfill geolocation for events that have a
# country but null coordinates, so the lat/lng radius API mode stops
# silently dropping them.
ISO_CENTROID: dict[str, tuple[float, float]] = {}
for _name, _t in {**COUNTRY_DB, **LANDMARK_DB}.items():
    _iso, _lat, _lng = _t[0], _t[1], _t[2]
    ISO_CENTROID.setdefault(_iso, (_lat, _lng))

OUTPUT_DIR  = SCRIPT_DIR.parent / "public"
EVENTS_OUT  = OUTPUT_DIR / "risk_events.json"
INDEX_OUT   = OUTPUT_DIR / "risk_index.json"
SIGNALS_IN  = OUTPUT_DIR / "signals.json"

HISTORY_DAYS = 21  # rolling event retention
MAX_EVENTS_PER_ISO_CAT = 8  # max globe markers per (iso, category) — prevents Gaza/UA marker flood

# ── Risk taxonomy ────────────────────────────────────────────────────────
# Each category: GDELT DOC queries + a keyword→(type,severity) classifier.
# severity 0–5; deterministic, auditable, zero AI cost.

TAXONOMY = {
    "conflict": {
        "gdelt": ['theme:WB_2433_CONFLICT', 'theme:KILL'],
        "gnews_multi": [
            "armed clash OR shelling OR airstrike military offensive",
            "missile strike OR rocket attack OR drone strike casualties",
            "insurgent attack OR militant ambush OR car bomb",
            "ceasefire collapse OR cross-border escalation troops",
        ],
        "gnews": "armed conflict OR shelling OR airstrike OR missile strike OR offensive military",
        "rules": [
            (r"missile|airstrike|air strike|shelling|bombard", "kinetic_strike", 5),
            (r"armed clash|firefight|gun battle|offensive|incursion", "armed_clash", 4),
            (r"insurgen|militant attack|ambush|ied\b|car bomb", "insurgent_attack", 4),
            (r"ceasefire collaps|escalat|cross-border", "escalation", 4),
            (r"troop|deployment|mobiliz", "military_buildup", 3),
        ],
    },
    "civil_unrest": {
        "gdelt": ['theme:PROTEST'],
        "gnews_multi": [
            "riot OR violent protest OR looting clashes police",
            "state of emergency OR martial law OR curfew imposed",
            "mass protest OR general strike OR nationwide uprising",
        ],
        "gnews": "riot OR mass protest OR violent demonstration OR state of emergency curfew",
        "rules": [
            (r"riot|violent (protest|clash|demonstration)|looting", "violent_unrest", 4),
            (r"state of emergency|martial law|curfew", "emergency_declared", 4),
            (r"mass protest|general strike|nationwide|uprising", "mass_protest", 3),
            (r"protest|demonstration|rally|march", "protest", 2),
        ],
    },
    "transport": {
        "gdelt": ['"air traffic control" strike'],
        "gnews_multi": [
            "air traffic controllers strike OR aviation strike airport",
            "airport closed OR airspace closed OR flights grounded",
            "rail strike OR port strike OR transit strike disruption",
        ],
        "gnews": "air traffic controllers strike OR airport closure OR flights cancelled OR rail strike OR port strike",
        "rules": [
            (r"air traffic control(ler)?s? strike|aviation strike", "aviation_strike", 4),
            (r"airport (closed|shut|closure)|airspace closed", "airport_closure", 4),
            (r"flights (cancelled|grounded|suspended)|ground stop", "flight_disruption", 3),
            (r"rail strike|port strike|dock strike|transit strike", "transport_strike", 3),
            (r"fuel shortage|logistics disrupt", "logistics_disruption", 3),
        ],
    },
    "border": {
        "gdelt": ['theme:BORDER'],
        "gnews_multi": [
            "border closed OR border closure sealed",
            "entry ban OR travel ban OR visa suspended",
            "border crossing shut OR restricted checkpoint",
        ],
        "gnews": "border closure OR border closed OR entry ban OR travel ban OR crossing shut",
        "rules": [
            (r"border (closed|closure|shut|seal)", "border_closure", 4),
            (r"entry ban|travel ban|visa suspend", "entry_restriction", 3),
            (r"crossing (shut|closed|restrict)", "crossing_restriction", 3),
        ],
    },
    "infrastructure": {
        "gdelt": ['theme:INFRASTRUCTURE'],
        "gnews_multi": [
            "nationwide blackout OR grid failure OR mass power outage",
            "internet shutdown OR communications blackout outage",
            "water supply cut OR fuel shortage crisis",
        ],
        "gnews": "nationwide blackout OR power outage OR grid failure OR internet shutdown OR water supply cut",
        "rules": [
            (r"nationwide blackout|grid (failure|collapse)|mass power", "grid_failure", 4),
            (r"internet (shutdown|blackout|cut)|comms? (down|cut)", "comms_outage", 4),
            (r"power outage|blackout|water (supply )?cut", "utility_outage", 3),
        ],
    },
    "climate": {
        "gdelt": ['theme:NATURAL_DISASTER'],
        "gnews_multi": [
            "major earthquake OR magnitude quake damage",
            "cyclone OR hurricane OR typhoon landfall",
            "severe flooding OR flash flood OR dam burst",
            "wildfire emergency OR drought disaster famine",
        ],
        "gnews": "severe flooding OR major earthquake OR cyclone hurricane OR wildfire emergency OR drought disaster",
        "rules": [
            (r"earthquake|magnitude \d", "earthquake", 4),
            (r"cyclone|hurricane|typhoon|super storm", "tropical_cyclone", 4),
            (r"severe flood|flash flood|dam burst", "flooding", 3),
            (r"wildfire|bushfire", "wildfire", 3),
            (r"drought|heatwave|famine", "climate_stress", 2),
        ],
    },
}

# Crisis-zone targeted queries — generic global queries ('armed clash...')
# don't reliably surface every active hotspot (the global mix is dominated by
# the biggest stories), so a war like Sudan scored conflict=0. These name the
# country/landmarks explicitly so it's always queried; the existing classifier
# rules + landmark detect_country still gate and geolocate the results.
# Keyed by category. Refresh the list as conflicts evolve.
CRISIS_WATCH = {
    "conflict": [
        "Sudan RSF OR El Fasher OR Khartoum fighting OR shelling OR airstrike",
        "Gaza OR Rafah airstrike OR shelling OR offensive",
        "Myanmar military OR Rakhine clashes OR junta offensive",
        "DR Congo OR Goma OR M23 clashes OR offensive",
        "Yemen Houthi OR Marib OR Hodeidah strike OR clashes",
        "Sahel Mali OR Burkina Faso militant attack OR jihadist",
        "Somalia al-Shabaab attack OR Mogadishu blast",
        "Syria Idlib OR Aleppo airstrike OR shelling",
    ],
    "civil_unrest": [
        "Sudan protest OR unrest OR civilians killed Darfur",
        "Haiti gang violence OR Port-au-Prince unrest",
        "Sahel coup OR junta protest unrest",
        "Venezuela protest OR crackdown OR unrest",
    ],
    "infrastructure": [
        "Sudan OR Yemen OR Gaza power OR water OR telecom outage collapse",
        "Cuba blackout OR grid collapse nationwide",
    ],
    "border": [
        "Sudan OR Chad OR South Sudan border crossing closed refugees",
        "Gaza Rafah crossing closed OR border shut",
    ],
}

# Source-class inference from domain / feed origin → trust tier
TIER1 = ("who.int", "reliefweb.int", "europa.eu", "un.org", "icrc.org",
         "acleddata.com", "gov", "reuters.com", "apnews.com")
TIER3 = ("bbc.", "aljazeera.", "ft.com", "bloomberg.", "economist.")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _to_iso(date_str: str) -> str | None:
    """Normalise a date string to ISO-8601. Handles Google News RFC-822
    ('Wed, 20 May 2026 10:00:00 GMT') and already-ISO inputs. Returns None
    if unparseable — caller falls back to now(). Without this, gnews dates
    failed datetime.fromisoformat() downstream and every event aged to the
    1.0-day default, defeating recency decay."""
    if not date_str:
        return None
    s = date_str.strip()
    # Already ISO?
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except (ValueError, TypeError):
        pass
    # RFC-822 (email/RSS date)
    try:
        from email.utils import parsedate_to_datetime
        dt = parsedate_to_datetime(s)
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except (ValueError, TypeError, IndexError):
        return None


def _source_class(domain: str, source: str) -> tuple[str, str]:
    d = (domain or "").lower()
    if any(t in d for t in TIER1):
        return "tier1_official", "official_agency"
    if any(t in d for t in TIER3):
        return "tier3_pro", "media_ai_signal"
    if source == "gdelt":
        return "tier4_media", "media_ai_signal"
    return "tier4_media", "media_ai_signal"


_ENTERTAINMENT_RE = re.compile(
    r"lineup|festival|music fest|concert|band|headliner|tour\b|"
    r"performers?|setlist|ticket sales|album release|world tour",
    re.IGNORECASE,
)

# Finance/tech context patterns — "Riot" in these contexts is a company ticker
# or product name, not civil unrest (e.g. "Riot Platforms surfs AI wave").
_FINANCE_TECH_RE = re.compile(
    r"\b(?:platforms?|technologies|corp|inc\b|ltd\b|nasdaq|nyse|stock|shares?|"
    r"investors?|earnings|revenue|ai\s+infra|blockchain|crypto|bitcoin|mining\s+co|"
    r"surfing\s+the|infrastructure\s+wave|market\s+cap|ipo\b|ticker)\b",
    re.IGNORECASE,
)

# Encyclopedic / reference domains — articles about historical events
# (Britannica, Wikipedia, etc.) should not appear in a live threat feed.
_ENCYCLOPEDIC_DOMAINS = frozenset({
    "britannica.com", "wikipedia.org", "en.wikipedia.org",
    "britannica-", "encyclopedia", "history.com", "thoughtco.com",
})

def _classify(text: str, rules: list) -> tuple[str | None, int]:
    low = text.lower()
    for pat, typ, sev in rules:
        if re.search(pat, low):
            # Suppress civil_unrest false positives from entertainment news
            if typ in ("violent_unrest", "mass_protest", "protest") and \
               _ENTERTAINMENT_RE.search(text):
                continue
            # Suppress "Riot Platforms", "Riot Games" → civil_unrest
            if typ in ("violent_unrest",) and _FINANCE_TECH_RE.search(text):
                continue
            return typ, sev
    return None, 0


_STOPWORDS = {"the", "a", "an", "of", "in", "on", "at", "to", "and", "or",
              "as", "by", "for", "with", "from", "amid", "after", "over",
              "into", "near", "say", "says", "said", "new", "more"}


def _norm_key(headline: str) -> str:
    """Normalised token-set key for dedup. Collides the SAME headline picked
    up by different sources with word-order / punctuation / case / source-
    suffix differences ('X shelled - Reuters' vs 'x shelled | AP') — the
    common GDELT-vs-GoogleNews duplicate. Does NOT catch synonym rewrites
    ('shells'≠'shelled'); true semantic dedup needs embeddings (out of scope).
    Better than the old headline[:80] which broke on any reorder. No cap, to
    keep genuinely-distinct events (different key nouns) separate."""
    # Strip trailing " - Publisher" / " | Publisher" (Google News appends it)
    h = re.sub(r"\s+[-|]\s+[^-|]{1,40}$", "", headline)
    toks = re.findall(r"[a-z0-9]+", h.lower())
    sig = sorted({t for t in toks if len(t) >= 4 and t not in _STOPWORDS})
    return " ".join(sig) or h.lower()[:40]


def _event_id(category: str, iso: str, headline: str) -> str:
    raw = f"{category}:{iso}:{_norm_key(headline)}"
    return "evt_" + hashlib.sha1(raw.encode()).hexdigest()[:12]


# Per-run fetch health — surfaced in meta so a GDELT-wide 429 no longer
# produces a silently-thin "successful" feed with no flag.
_FETCH_STATS = {"ok": 0, "fail": 0}


def _fetch_gdelt(query: str, maxrec: int = 75) -> list[Article]:
    from urllib.parse import quote
    url = (
        "https://api.gdeltproject.org/api/v2/doc/doc"
        f"?query={quote(query)}&mode=artlist&maxrecords={maxrec}"
        "&format=json&timespan=10080min"  # 7d (was 48h; safe now persistence exists)
    )
    raw = fetch_url(url, retries=1)
    if not raw:
        _FETCH_STATS["fail"] += 1
        return []
    _FETCH_STATS["ok"] += 1
    try:
        data = json.loads(raw)
    except Exception:
        return []
    out = []
    for it in (data.get("articles") or []):
        t = it.get("title", "")
        if t:
            out.append(Article("gdelt", t, t, it.get("url", ""),
                                it.get("seendate", "")))
    return out


def _fetch_gnews(query: str) -> list[Article]:
    from urllib.parse import quote
    url = (f"https://news.google.com/rss/search?q={quote(query)}+when:7d"  # was 2d
           "&hl=en-US&gl=US&ceid=US:en")
    raw = fetch_url(url, retries=1)
    if not raw:
        _FETCH_STATS["fail"] += 1
        return []
    _FETCH_STATS["ok"] += 1
    out = []
    for m in re.finditer(r"<item>(.*?)</item>", raw.decode("utf-8", "ignore"), re.S):
        block = m.group(1)
        tm = re.search(r"<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>", block, re.S)
        lm = re.search(r"<link>(.*?)</link>", block, re.S)
        dm = re.search(r"<pubDate>(.*?)</pubDate>", block, re.S)
        if not tm:
            continue
        title = _strip_html(tm.group(1)).strip()
        pub_iso = _to_iso(dm.group(1).strip()) if dm else None
        out.append(Article("google_news", title, title,
                            (lm.group(1).strip() if lm else ""),
                            (pub_iso or _now().isoformat())))
    return out


def collect_events() -> list[dict]:
    events: dict[str, dict] = {}
    now_iso = _now().isoformat()

    for cat, cfg in TAXONOMY.items():
        log(f"[risk] category: {cat}")
        arts: list[Article] = []
        # Google News is the reliable workhorse (GDELT free tier 429s hard)
        for q in cfg.get("gnews_multi", [cfg["gnews"]]):
            arts += _fetch_gnews(q)
        for q in cfg["gdelt"]:                      # best-effort enrichment
            arts += _fetch_gdelt(q)
        # Targeted crisis-zone queries: generic global queries don't reliably
        # surface every active hotspot (Sudan war scored conflict=0 because
        # 'armed clash...' returned a Ukraine/Gaza-heavy global mix). For
        # conflict & civil_unrest we also query each known crisis zone BY NAME
        # so it's always checked — landmark detection then geolocates it.
        for q in CRISIS_WATCH.get(cat, []):
            arts += _fetch_gnews(q)
        log(f"[risk]   {cat}: {len(arts)} raw articles")

        for a in arts:
            # Skip encyclopedic / reference sources — they surface historical
            # events from 2011, 2015 etc. as "current" threats (Britannica,
            # Wikipedia, History.com articles about past earthquakes/outbreaks).
            domain_lc = (a.domain or "").lower()
            if any(enc in domain_lc for enc in _ENCYCLOPEDIC_DOMAINS):
                continue
            # Skip articles older than 30 days — stale content that slipped
            # through the GNews time filter (e.g. 2023 measles case reports).
            if a.pub_date:
                try:
                    from email.utils import parsedate_to_datetime as _pdt
                    age_days = (_now() - _pdt(a.pub_date).replace(tzinfo=None)).days
                    if age_days > 30:
                        continue
                except Exception:
                    pass

            text = f"{a.title} {a.body}"
            # Strip source domain and outlet name from text so "lbc.co.uk",
            # "France 24", "Yahoo News UK" don't contaminate detect_country.
            if a.domain:
                text = text.replace(a.domain, " ")
            if a.source:
                text = text.replace(a.source, " ")
            typ, sev = _classify(text, cfg["rules"])
            if not typ:
                continue
            cname, iso, lat, lng = detect_country(text)
            if not iso:
                continue
            sclass, sverif = _source_class(a.domain, a.source)
            eid = _event_id(cat, iso, a.title)
            if eid in events:
                ex = events[eid]
                ex["source_count"] += 1
                if a.source not in ex["sources"]:
                    ex["sources"].append(a.source)
                # upgrade trust if a better source corroborates
                if sclass < ex["source_class"]:
                    ex["source_class"] = sclass
                    ex["source_verification"] = sverif
                continue
            conf = round(min(0.55 + 0.07 * sev
                             + (0.15 if sverif == "official_agency" else 0), 0.97), 2)
            events[eid] = {
                "id": eid,
                "category": cat,
                "type": typ,
                "headline": a.title[:180],
                "severity": sev,
                "confidence": conf,
                "source_verification": sverif,
                "source_class": sclass,
                "source_name": a.domain or a.source,
                "geo": {"lat": lat, "lng": lng, "place": cname,
                        "country": iso, "admin1": None},
                "country": iso,
                "first_seen": a.pub_date or now_iso,
                # last_updated drives recency decay (risk_scoring._age_days).
                # Was hardcoded now_iso → every event aged to ~0 → a 5-day-old
                # event scored like a fresh one. Use the article's real date.
                "last_updated": a.pub_date or now_iso,
                "lead_time_hours": 0,
                "source_count": 1,
                "sources": [a.source],
                "url": a.url,
                "is_new": True,
            }

    return list(events.values())


def import_health_events() -> list[dict]:
    """Map existing health signals.json into the risk event schema."""
    if not SIGNALS_IN.exists():
        return []
    try:
        data = json.loads(SIGNALS_IN.read_text(encoding="utf-8"))
    except Exception:
        return []
    out = []
    for s in data.get("signals", []):
        iso = s.get("iso") or s.get("country_code")
        if not iso or iso == "XX":
            continue
        lvl = s.get("level", "watch")
        sev = {"urgent": 4, "alert": 3, "watch": 2}.get(lvl, 2)
        ti = s.get("threat_index")
        if isinstance(ti, (int, float)):
            sev = max(sev, min(5, round(ti / 20)))
        out.append({
            "id": "evt_h_" + str(s.get("id", ""))[:16],
            "category": "health",
            "type": s.get("disease", "outbreak"),
            "headline": s.get("headline") or s.get("disease", ""),
            "severity": sev,
            "confidence": round(float(s.get("confidence", 0.5)), 2),
            "source_verification": "official_agency"
                if any(x in (s.get("sources") or [])
                       for x in ("who_don", "who_ihr", "ecdc_cdtr", "cdc_mmwr"))
                else "media_ai_signal",
            "source_class": "tier1_official"
                if any(x in (s.get("sources") or []) for x in ("who_don", "who_ihr"))
                else "tier3_pro",
            "source_name": (s.get("sources") or ["vigilo"])[0],
            "geo": {**_geo_with_centroid(s.get("lat"), s.get("lng"), iso),
                    "place": s.get("country"), "country": iso, "admin1": None},
            "country": iso,
            "first_seen": s.get("detected_at", _now().isoformat()),
            "last_updated": s.get("detected_at", _now().isoformat()),
            "lead_time_hours": s.get("hours_ahead_estimate", 0),
            "source_count": s.get("source_count", len(s.get("sources") or [])),
            "sources": s.get("sources", []),
            "url": (s.get("links") or [""])[0],
            "is_new": bool(s.get("is_new", False)),
        })
    return out


CLIMATE_IN = OUTPUT_DIR / "climate_risk.json"

def import_climate_leads() -> list[dict]:
    """Predictive climate→bio leading indicators (model-derived, honest).

    Reads public/climate_risk.json (written by climate_signals.py) and
    emits forward-looking HEALTH events for countries where vector/
    water-borne suitability is elevated — 7–14 days before clinical
    reports. Clearly tagged source_verification='model'; severity
    capped (leading hazard, not a confirmed outbreak).
    """
    if not CLIMATE_IN.exists():
        return []
    try:
        data = json.loads(CLIMATE_IN.read_text(encoding="utf-8"))
    except Exception:
        return []
    THRESH = {"dengue": 0.55, "cholera": 0.50}
    DISEASE = {"dengue": "Dengue fever", "cholera": "Cholera"}
    out = []
    for iso, blk in (data.get("risk") or {}).items():
        for path in ("dengue", "cholera"):
            p = blk.get(path) or {}
            S = float(p.get("S", 0))
            if S < THRESH[path]:
                continue
            sev = 2 if S < 0.65 else 3 if S < 0.8 else 4
            seeding = p.get("confidence") == "low"
            conf = round(S * (0.6 if seeding else 0.85), 2)
            lead_h = int(p.get("lead_days", 10)) * 24
            out.append({
                "id": f"evt_clim_{path}_{iso}",
                "category": "health",
                "type": f"{path}_climate_lead",
                "headline": (f"Climate-elevated {DISEASE[path]} suitability "
                             f"({p.get('band','')}) — model leading indicator, "
                             f"~{p.get('lead_days',10)}d ahead of reports"),
                "severity": sev,
                "confidence": conf,
                "source_verification": "model",
                "source_class": "tier3_pro",
                "source_name": "Vigilo climate model",
                "geo": {**_geo_with_centroid(None, None, iso),
                        "place": iso, "country": iso, "admin1": None},
                "country": iso,
                "first_seen": _now().isoformat(),
                "last_updated": _now().isoformat(),
                "lead_time_hours": lead_h,
                "source_count": 1,
                "sources": ["climate_model"],
                "url": "",
                "is_new": False,
                "predictive": True,
            })
    return out


def _geo_with_centroid(lat, lng, iso: str) -> dict:
    """Return {lat, lng}, backfilling the country centroid when coords are
    null. Health & climate events arrived with lat=None and were silently
    dropped by the lat/lng radius API mode — a Tokyo query missed a Japan
    health signal. Centroid is a coarse but honest fallback."""
    if lat is None or lng is None:
        c = ISO_CENTROID.get(iso)
        if c:
            return {"lat": c[0], "lng": c[1], "geo_precision": "country_centroid"}
        return {"lat": None, "lng": None}
    return {"lat": lat, "lng": lng}


def _age_days_local(ts: str, now: datetime) -> float:
    iso = _to_iso(ts)
    if not iso:
        return 0.0  # unknown date → treat as fresh, keep it
    try:
        dt = datetime.fromisoformat(iso)
        return max((now - dt).total_seconds() / 86400.0, 0.0)
    except (ValueError, TypeError):
        return 0.0


def merge_persist(new_events: list[dict]) -> list[dict]:
    """Carry prior NEWS events forward within HISTORY_DAYS.

    The feed was rebuilt from a ~48h fetch window every run and never read
    its own prior output — so HISTORY_DAYS=21 was dead code and any country
    whose news went quiet for >2 days silently dropped to composite 0
    (Sudan, Yemen, etc). This restores real multi-day memory.

    Health events (id 'evt_h_*', owned by signals.json's own 21d rolling
    history) and climate-model leads (id 'evt_clim_*', regenerated each run)
    are NOT carried forward — their sources own retention. Only the
    news-derived events (conflict/unrest/transport/border/infra/disaster)
    are persisted, with the fresh version winning on re-sighting."""
    now = _now()
    new_by_id = {e["id"]: e for e in new_events}
    if not EVENTS_OUT.exists():
        return new_events
    try:
        prior = json.loads(EVENTS_OUT.read_text(encoding="utf-8")).get("events", [])
    except Exception:
        return new_events
    # Known bad fallback centroids produced by geocoding bugs.
    # Events carried forward with these coords are stale artifacts from
    # the pre-fix pipeline; purge them on next merge so they don't persist
    # for 21 days after the geocoding fix ships.
    _BAD_CENTROIDS = {
        (-1.798, 30.365),   # RW/Eastern province — was matched by bare "Eastern"
        (8.857, -12.175),   # SL/Northern province — was matched by bare "Northern"
    }

    # Explicit purge set — events confirmed to have wrong country attribution
    # due to aggressor-vs-victim bug (pre-fix pipeline tagged Russia instead of
    # Ukraine). Purged here so they don't persist 21 days; the aggressor fix
    # ensures new fetches produce correct attribution.
    _PURGE_IDS = {
        "evt_973d0cae1c75",  # Russia launched missile strike on Kryvyi Rih → should be UA
        "evt_828d95031113",  # Russia launched missile strike on Dnipro → should be UA
        "evt_6ac4bf1985f6",  # Russia strikes residential area (Kyiv) → should be UA
        "evt_20d0ee47b469",  # Russia launches drone/missile attack on Kyiv → should be UA
        "evt_3c938e8ad99e",  # Missile strikes pound Kyiv → should be UA
        "evt_eda3eb0c83c4",  # Russia Strikes Kyiv with Missiles → should be UA
        "evt_6cfad1e41a59",  # Russia strikes Kyiv with ballistic missiles → should be UA
        "evt_c4c9457760fa",  # Russia launches missile/drone strikes on Kyiv → should be UA
    }

    carried = 0
    for e in prior:
        eid = e.get("id", "")
        if eid in new_by_id:
            continue                                  # re-seen → fresh wins
        if eid in _PURGE_IDS:
            continue                                  # explicit purge: wrong attribution
        if eid.startswith("evt_h_") or eid.startswith("evt_clim_") \
           or eid.startswith("evt_ioda_") or eid.startswith("evt_gdacs_"):
            continue                                  # source owns retention
        # Drop events with known bad fallback centroid coords — these were
        # geocoded wrong by the old pipeline and should not persist.
        geo = e.get("geo") or {}
        elat = geo.get("lat")
        elng = geo.get("lng")
        if elat is not None and elng is not None:
            if any(abs(elat - blat) < 0.01 and abs(elng - blng) < 0.01
                   for blat, blng in _BAD_CENTROIDS):
                continue
        # Drop entertainment false positives (music festival "riot" etc.)
        headline_lc = (e.get("headline") or "").lower()
        if e.get("category") == "civil_unrest" and _ENTERTAINMENT_RE.search(headline_lc):
            continue
        # Carry forward only if the date is parseable AND within the window.
        # An unparseable first_seen would otherwise count as age 0 (fresh) and
        # never age out — a dateless orphan would persist forever.
        fs = e.get("first_seen", "")
        if _to_iso(fs) and _age_days_local(fs, now) <= HISTORY_DAYS:
            e["is_new"] = False
            new_events.append(e)
            carried += 1
    log(f"[risk] carried forward {carried} prior news events (≤{HISTORY_DAYS}d)")
    return new_events


# GDACS event-type → our (category, type) + label. GDACS is the authoritative
# disaster monitor (free, no key) and ships precise coordinates + ISO, so it
# also sidesteps the headline-geocoding errors of news-derived climate events.
_GDACS_TYPE = {
    "EQ": ("climate", "earthquake"),
    "TC": ("climate", "tropical_cyclone"),
    "FL": ("climate", "flooding"),
    "TS": ("climate", "tsunami"),
    "DR": ("climate", "drought"),
    "WF": ("climate", "wildfire"),
    "VO": ("climate", "volcano"),
}
_GDACS_SEV = {"green": 2, "orange": 3, "red": 4}


def fetch_gdacs_climate() -> list[dict]:
    """GDACS recent natural-disaster events → climate-domain events.
    Authoritative (UN/EC), free, no key, precise coords + ISO — supplements
    the noisy news-derived climate signal and fixes its mis-geocoding."""
    out = []
    seen_gdacs_ids: set = set()
    try:
        raw = fetch_url("https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP",
                        retries=1)
        if not raw:
            return []
        data = json.loads(raw)
    except Exception:
        return []
    for f in (data.get("features") or []):
        p = f.get("properties") or {}
        et = str(p.get("eventtype") or "").upper()
        cat_type = _GDACS_TYPE.get(et)
        if not cat_type:
            continue
        cat, typ = cat_type
        sev = _GDACS_SEV.get(str(p.get("alertlevel") or "").lower(), 2)
        # resolve ISO-2 from country name (GDACS gives a name / iso3)
        cname = p.get("country") or ""
        _, iso, lat, lng = detect_country(cname) if cname else (None, None, None, None)
        geom = (f.get("geometry") or {}).get("coordinates") or []
        if len(geom) >= 2:
            lng, lat = geom[0], geom[1]   # GDACS coords are authoritative
        if not iso:
            continue
        eid = f"evt_gdacs_{p.get('eventid', '')}_{et}"
        # GDACS API can return the same event multiple times (multi-country events).
        # Dedup by event ID — keep the first occurrence.
        if eid in seen_gdacs_ids:
            continue
        seen_gdacs_ids.add(eid)
        out.append({
            "id": eid,
            "category": cat,
            "type": typ,
            "headline": (p.get("htmldescription") or p.get("name")
                         or f"{typ} — GDACS {p.get('alertlevel','')} alert"),
            "severity": sev,
            "confidence": 0.9,
            "source_verification": "official_agency",
            "source_class": "tier1_official",
            "source_name": "GDACS",
            "geo": {"lat": lat, "lng": lng, "place": cname, "country": iso,
                    "admin1": None},
            "country": iso,
            "first_seen": p.get("fromdate") or _now().isoformat(),
            "last_updated": p.get("todate") or _now().isoformat(),
            "lead_time_hours": 0,
            "source_count": 1,
            "sources": ["GDACS"],
            "url": p.get("url", {}).get("report", "") if isinstance(p.get("url"), dict) else "",
            "is_new": False,
        })
    return out


def build_index(events: list[dict]) -> dict:
    by_country: dict[str, list[dict]] = {}
    for e in events:
        by_country.setdefault(e["country"], []).append(e)

    now = _now()
    frag = load_fragility()
    index = {}
    for iso, evs in by_country.items():
        scored = score_geo(evs, now, fragility=frag.get(iso, 0.0))
        index[iso] = {
            "composite_risk": scored["composite_risk"],
            "category_breakdown": scored["category_breakdown"],
            "event_count": len(evs),
            "event_ids": [e["id"] for e in evs],
        }

    # Baseline seeding — every known country gets an entry even with no
    # events this window. Was: only countries surfaced by news existed
    # (~40), so a quiet country was ABSENT and the API fabricated an
    # all-zero record with no honesty marker. Now they carry baseline:true
    # → the API/UI can say "no active signals detected" rather than implying
    # we assessed it as calm. Marked distinctly from a real minimal score.
    def _empty_breakdown():
        # Fresh dict per country — must NOT share one object across all
        # baseline entries, or any later in-place mutation of one country's
        # breakdown would silently corrupt every other baseline country.
        return {c: {"score": 0.0, "band": "minimal", "active_events": 0,
                    "top_threat": None}
                for c in CATEGORIES}
    seeded = 0
    for iso in ISO_CENTROID:
        if iso in index:
            continue
        comp = composite_score({c: 0.0 for c in CATEGORIES}, fragility=frag.get(iso, 0.0))
        index[iso] = {
            "composite_risk": comp,
            "category_breakdown": _empty_breakdown(),
            "event_count": 0,
            "event_ids": [],
            "baseline": True,   # no active signals this window (≠ assessed-calm)
        }
        seeded += 1
    log(f"[risk] baseline-seeded {seeded} countries (total index {len(index)})")
    return index


# Countries worth polling IODA for internet-outage signals (crisis zones,
# authoritarian states prone to shutdowns, large/contested countries). Bounded
# list so the per-country IODA calls don't balloon the run.
IODA_WATCH = [
    "SD","YE","IR","MM","CU","SY","AF","ET","PK","RU","UA","IQ","LY","SO","SS",
    "VE","BD","IN","CN","KP","TM","BY","NG","CD","HT","PS","LB","TD","ML","BF",
    "NE","EG","KE","TZ","UG","ZW","MZ","GN","TR","KZ",
]

def fetch_ioda_infra() -> list[dict]:
    """IODA internet-outage alerts → infrastructure events (free, no key).
    Already powers the OSINT shadow engine; wiring it into the main risk_index
    gives the infrastructure domain real connectivity-loss signal instead of
    relying only on news of blackouts."""
    import time as _t
    until = int(_t.time()); frm = until - 3 * 86400      # last 72h
    out = []
    for iso in IODA_WATCH:
        try:
            u = ("https://api.ioda.inetintel.cc.gatech.edu/v2/outages/alerts"
                 f"?from={frm}&until={until}&entityType=country&entityCode={iso}")
            raw = fetch_url(u, retries=1)
            if not raw:
                continue
            d = json.loads(raw)
            alerts = d.get("data") or d.get("alerts") or []
            n = len(alerts) if isinstance(alerts, list) else 0
            if n <= 0:
                continue
            sev = 4 if n >= 6 else 3 if n >= 3 else 2
            lat, lng = ISO_CENTROID.get(iso, (None, None))
            out.append({
                "id": f"evt_ioda_{iso}",
                "category": "infrastructure",
                "type": "internet_outage",
                "headline": f"IODA detected {n} internet-outage alert(s) in last 72h",
                "severity": sev,
                "confidence": 0.7,
                "source_verification": "media_ai_signal",
                "source_class": "tier3_pro",
                "source_name": "IODA (Georgia Tech)",
                "geo": {"lat": lat, "lng": lng, "place": iso, "country": iso,
                        "admin1": None,
                        "geo_precision": "country_centroid" if lat is not None else None},
                "country": iso,
                "first_seen": _now().isoformat(),
                "last_updated": _now().isoformat(),
                "lead_time_hours": 0,
                "source_count": 1,
                "sources": ["IODA"],
                "url": f"https://ioda.inetintel.cc.gatech.edu/country/{iso}",
                "is_new": False,
            })
        except Exception:
            continue
    return out


def main() -> int:
    log("=== Risk aggregate: start ===")
    events = collect_events()
    log(f"[risk] non-health events: {len(events)}")
    events += import_health_events()
    clim = import_climate_leads()
    events += clim
    log(f"[risk] climate leading-indicators: {len(clim)}")
    ioda = fetch_ioda_infra()
    events += ioda
    log(f"[risk] IODA internet-outage infra events: {len(ioda)}")
    gdacs = fetch_gdacs_climate()
    events += gdacs
    log(f"[risk] GDACS disaster (climate) events: {len(gdacs)}")
    log(f"[risk] total events (incl. health+climate+infra+gdacs): {len(events)}")

    # Persist prior news events within the retention window (real history)
    events = merge_persist(events)
    log(f"[risk] total events after persistence merge: {len(events)}")

    # Cap per (iso, category) to prevent hundreds of near-duplicate news articles
    # turning into a marker flood on the globe (e.g. 146 Gaza conflict events).
    # Keep the MAX_EVENTS_PER_ISO_CAT highest-severity (then newest) events.
    from collections import defaultdict
    _bucket: dict[tuple, list] = defaultdict(list)
    for ev in events:
        iso_key = ev.get("country") or (ev.get("geo") or {}).get("country") or "??"
        _bucket[(iso_key, ev.get("category", "??"))].append(ev)
    events_capped: list = []
    for evs in _bucket.values():
        top = sorted(evs, key=lambda e: (-e.get("severity", 0), str(e.get("first_seen", ""))))
        events_capped.extend(top[:MAX_EVENTS_PER_ISO_CAT])
    before_cap = len(events)
    events = events_capped
    log(f"[risk] events after per-(iso,cat) cap ({MAX_EVENTS_PER_ISO_CAT}): {len(events)} (was {before_cap})")

    index = build_index(events)
    log(f"[risk] countries scored: {len(index)}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    _total_fetch = _FETCH_STATS["ok"] + _FETCH_STATS["fail"]
    _fail_rate = round(_FETCH_STATS["fail"] / _total_fetch, 3) if _total_fetch else 0.0
    if _fail_rate > 0.3:
        log(f"[risk] ⚠️ HIGH fetch failure rate {_fail_rate:.0%} "
            f"({_FETCH_STATS['fail']}/{_total_fetch}) — feed may be thin")
    meta = {
        "generated_at": _now().isoformat(),
        "events_total": len(events),
        "countries": len(index),
        "categories": list(CATEGORIES),
        "schema": "1.0",
        # Fetch health — a GDELT-wide 429 used to yield a silently-thin
        # "successful" run; now the partial-failure is visible to consumers.
        "fetch_health": {
            "ok": _FETCH_STATS["ok"],
            "failed": _FETCH_STATS["fail"],
            "fail_rate": _fail_rate,
            "degraded": _fail_rate > 0.3,
        },
    }
    EVENTS_OUT.write_text(json.dumps(
        {"meta": meta, "events": events}, ensure_ascii=False, indent=2),
        encoding="utf-8")
    INDEX_OUT.write_text(json.dumps(
        {"meta": meta, "index": index}, ensure_ascii=False, indent=2),
        encoding="utf-8")
    log(f"[risk] wrote {EVENTS_OUT.name} + {INDEX_OUT.name}")
    log("=== Risk aggregate: done ===")
    return len(events)


if __name__ == "__main__":
    try:
        main()
        sys.exit(0)
    except KeyboardInterrupt:
        sys.exit(130)
