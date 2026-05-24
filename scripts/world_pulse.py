#!/usr/bin/env python3
"""
Vigilo World Pulse — a single, transparent "planetary risk temperature".

Reads public/risk_index.json (current composite per country) and computes:
  - pulse (0-100): mean composite across countries WITH active risk (score>0),
    scaled by /6*100. Defined on the active set so it's meaningful (a global
    mean over ~190 countries is dominated by calm ones and never moves).
  - breadth: how many countries are active / elevated+ / severe+.
  - top hotspots and top movers (vs risk_history prior value).
  - 24h delta vs the previous run, via a self-contained rolling pulse_history.

Writes public/pulse.json (+ appends public/pulse_history.json).
Transparent by design — the formula is published; no black box.
"""
import json, statistics
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
PUB  = ROOT / "public"

BAND_RANK = {"minimal":0,"low":1,"moderate":2,"elevated":3,"severe":4,"critical":5}
ELEVATED_PLUS = {"elevated","severe","critical"}

# ISO2 -> readable name (covers risk-active + major countries; falls back to ISO).
NAMES = {
 "PS":"Palestinian Territories","MM":"Myanmar","YE":"Yemen","IR":"Iran","CD":"DR Congo",
 "SD":"Sudan","UA":"Ukraine","RU":"Russia","NG":"Nigeria","ET":"Ethiopia","SS":"South Sudan",
 "SO":"Somalia","ML":"Mali","BF":"Burkina Faso","NE":"Niger","TD":"Chad","CF":"Central African Rep.",
 "LY":"Libya","SY":"Syria","IQ":"Iraq","AF":"Afghanistan","PK":"Pakistan","BD":"Bangladesh",
 "IN":"India","CN":"China","LB":"Lebanon","IL":"Israel","EG":"Egypt","TR":"Turkey","CO":"Colombia",
 "MX":"Mexico","VE":"Venezuela","HT":"Haiti","BR":"Brazil","CM":"Cameroon","MZ":"Mozambique",
 "CG":"Congo","KE":"Kenya","UG":"Uganda","TZ":"Tanzania","ZW":"Zimbabwe","RW":"Rwanda","BI":"Burundi",
 "PH":"Philippines","ID":"Indonesia","TH":"Thailand","MM2":"Myanmar","KP":"North Korea","TW":"Taiwan",
 "US":"United States","GB":"United Kingdom","FR":"France","DE":"Germany","ES":"Spain","IT":"Italy",
 "GR":"Greece","PL":"Poland","RO":"Romania","SA":"Saudi Arabia","AE":"UAE","QA":"Qatar","JO":"Jordan",
 "DZ":"Algeria","TN":"Tunisia","MA":"Morocco","MR":"Mauritania","SN":"Senegal","GN":"Guinea",
 "CI":"Ivory Coast","GH":"Ghana","TG":"Togo","BJ":"Benin","EC":"Ecuador","PE":"Peru","AR":"Argentina",
 "CL":"Chile","BO":"Bolivia","CU":"Cuba","NI":"Nicaragua","GT":"Guatemala","HN":"Honduras",
 "JP":"Japan","KR":"South Korea","VN":"Vietnam","KH":"Cambodia","LK":"Sri Lanka","NP":"Nepal",
 "MM3":"Myanmar","AM":"Armenia","AZ":"Azerbaijan","GE":"Georgia","KZ":"Kazakhstan","UZ":"Uzbekistan",
 "ZA":"South Africa","AO":"Angola","NA":"Namibia","ZM":"Zambia","MW":"Malawi","MG":"Madagascar",
 "CA":"Canada","AU":"Australia",
}
def cname(iso): return NAMES.get(iso, iso)

def load(p, default):
    try: return json.load(open(p))
    except Exception: return default

def pulse_band(p):
    if p >= 50: return "crisis"
    if p >= 35: return "tense"
    if p >= 20: return "unsettled"
    return "calm"

def name_map():
    # ISO2 -> name, from country-structural or fall back to ISO.
    # risk_index uses ISO2 keys; we want readable names for cards.
    return {}

def main():
    ri = load(PUB/"risk_index.json", {"index":{}})
    idx = ri.get("index", {})
    hist = load(PUB/"risk_history.json", {})

    rows = []
    for iso, v in idx.items():
        cr = v.get("composite_risk") or {}
        s = cr.get("score")
        if not isinstance(s,(int,float)): continue
        rows.append((iso, float(s), cr.get("band","minimal"), cr.get("dominant_category")))

    active = [r for r in rows if r[1] > 0]
    elevated = [r for r in rows if r[2] in ELEVATED_PLUS]
    severe   = [r for r in rows if r[2] in ("severe","critical")]

    mean_active = statistics.mean([r[1] for r in active]) if active else 0.0
    pulse = round(mean_active / 6 * 100)

    # Top hotspots
    hot = sorted(rows, key=lambda r: r[1], reverse=True)[:6]
    hotspots = [{"iso":i,"name":cname(i),"score":round(s,2),"band":b,"domain":d} for i,s,b,d in hot]

    # Top movers: compare current score vs the latest NON-ZERO prior value in history
    movers = []
    for iso, s, b, d in rows:
        h = hist.get(iso) or []
        prior = None
        for entry in reversed(h[:-1] if len(h) > 1 else h):  # skip latest (today)
            c = entry.get("c")
            if isinstance(c,(int,float)) and c > 0:
                prior = c; break
        if prior is not None:
            delta = round(s - prior, 2)
            if abs(delta) >= 0.3:
                movers.append({"iso":iso,"name":cname(iso),"score":round(s,2),"band":b,"delta":delta})
    movers.sort(key=lambda m: abs(m["delta"]), reverse=True)
    movers = movers[:6]

    # 24h pulse delta via rolling log
    ph = load(PUB/"pulse_history.json", [])
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    prev = ph[-1]["pulse"] if ph else pulse
    # de-dupe same-day: replace today's row if present
    ph = [r for r in ph if r.get("d") != today]
    ph.append({"d": today, "pulse": pulse})
    ph = ph[-120:]  # keep ~4 months
    delta = pulse - prev

    out = {
        "meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "method": "mean composite risk across countries with active risk (score>0), indexed /6*100",
            "countries_monitored": len(rows),
        },
        "pulse": pulse,
        "band": pulse_band(pulse),
        "delta": delta,
        "breadth": {
            "active": len(active),
            "elevated_plus": len(elevated),
            "severe_plus": len(severe),
            "monitored": len(rows),
        },
        "hotspots": hotspots,
        "movers": movers,
    }
    (PUB/"pulse.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    (PUB/"pulse_history.json").write_text(json.dumps(ph, ensure_ascii=False), encoding="utf-8")
    print(f"pulse={pulse} band={out['band']} delta={delta} active={len(active)} elevated+={len(elevated)}")

if __name__ == "__main__":
    main()
