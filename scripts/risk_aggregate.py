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
)
from risk_scoring import score_geo, CATEGORIES  # noqa: E402

OUTPUT_DIR  = SCRIPT_DIR.parent / "public"
EVENTS_OUT  = OUTPUT_DIR / "risk_events.json"
INDEX_OUT   = OUTPUT_DIR / "risk_index.json"
SIGNALS_IN  = OUTPUT_DIR / "signals.json"

HISTORY_DAYS = 21  # rolling event retention

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

# Source-class inference from domain / feed origin → trust tier
TIER1 = ("who.int", "reliefweb.int", "europa.eu", "un.org", "icrc.org",
         "acleddata.com", "gov", "reuters.com", "apnews.com")
TIER3 = ("bbc.", "aljazeera.", "ft.com", "bloomberg.", "economist.")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _source_class(domain: str, source: str) -> tuple[str, str]:
    d = (domain or "").lower()
    if any(t in d for t in TIER1):
        return "tier1_official", "official_agency"
    if any(t in d for t in TIER3):
        return "tier3_pro", "media_ai_signal"
    if source == "gdelt":
        return "tier4_media", "media_ai_signal"
    return "tier4_media", "media_ai_signal"


def _classify(text: str, rules: list) -> tuple[str | None, int]:
    low = text.lower()
    for pat, typ, sev in rules:
        if re.search(pat, low):
            return typ, sev
    return None, 0


def _event_id(category: str, iso: str, headline: str) -> str:
    raw = f"{category}:{iso}:{headline[:80]}"
    return "evt_" + hashlib.sha1(raw.encode()).hexdigest()[:12]


def _fetch_gdelt(query: str, maxrec: int = 75) -> list[Article]:
    from urllib.parse import quote
    url = (
        "https://api.gdeltproject.org/api/v2/doc/doc"
        f"?query={quote(query)}&mode=artlist&maxrecords={maxrec}"
        "&format=json&timespan=2880min"  # 48h
    )
    raw = fetch_url(url, retries=1)
    if not raw:
        return []
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
    url = (f"https://news.google.com/rss/search?q={quote(query)}+when:2d"
           "&hl=en-US&gl=US&ceid=US:en")
    raw = fetch_url(url, retries=1)
    if not raw:
        return []
    out = []
    for m in re.finditer(r"<item>(.*?)</item>", raw.decode("utf-8", "ignore"), re.S):
        block = m.group(1)
        tm = re.search(r"<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>", block, re.S)
        lm = re.search(r"<link>(.*?)</link>", block, re.S)
        dm = re.search(r"<pubDate>(.*?)</pubDate>", block, re.S)
        if not tm:
            continue
        title = _strip_html(tm.group(1)).strip()
        out.append(Article("google_news", title, title,
                            (lm.group(1).strip() if lm else ""),
                            (dm.group(1).strip() if dm else "")))
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
        log(f"[risk]   {cat}: {len(arts)} raw articles")

        for a in arts:
            text = f"{a.title} {a.body}"
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
                "last_updated": now_iso,
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
            "geo": {"lat": s.get("lat"), "lng": s.get("lng"),
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
                "geo": {"lat": None, "lng": None, "place": iso,
                        "country": iso, "admin1": None},
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


def build_index(events: list[dict]) -> dict:
    by_country: dict[str, list[dict]] = {}
    for e in events:
        by_country.setdefault(e["country"], []).append(e)

    now = _now()
    index = {}
    for iso, evs in by_country.items():
        scored = score_geo(evs, now)
        index[iso] = {
            "composite_risk": scored["composite_risk"],
            "category_breakdown": scored["category_breakdown"],
            "event_count": len(evs),
            "event_ids": [e["id"] for e in evs],
        }
    return index


def main() -> int:
    log("=== Risk aggregate: start ===")
    events = collect_events()
    log(f"[risk] non-health events: {len(events)}")
    events += import_health_events()
    clim = import_climate_leads()
    events += clim
    log(f"[risk] climate leading-indicators: {len(clim)}")
    log(f"[risk] total events (incl. health+climate): {len(events)}")

    index = build_index(events)
    log(f"[risk] countries scored: {len(index)}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    meta = {
        "generated_at": _now().isoformat(),
        "events_total": len(events),
        "countries": len(index),
        "categories": list(CATEGORIES),
        "schema": "1.0",
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
