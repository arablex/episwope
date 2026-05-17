"""
build_exposure_graph.py — curated risk-propagation graph.

Spec: docs/specs/2026-05-17-predictive-risk-intelligence.md §4.

Static, auditable reference data (same discipline as pathogen_params):
  - land adjacency  → spillover of conflict / unrest / health
  - logistics corridors (maritime/air hubs) → MOBILITY / CONTINUITY /
    supply-chain dependency of member economies

Run once (and whenever the curation changes) → public/exposure_graph.json
consumed at request time by /api/v1/simulate (pure-Python cascade,
no infra, sandboxed — synthetic triggers never touch the live index).
"""
from __future__ import annotations
import json
from pathlib import Path
from datetime import datetime, timezone

OUT = Path(__file__).parent.parent / "public" / "exposure_graph.json"

# Curated land adjacency for tracked geographies (factual reference).
ADJ = {
    "RU": ["UA","BY","GE","AZ","KZ","CN","MN","FI","EE","LV","LT","PL"],
    "UA": ["RU","BY","PL","RO","MD","HU","SK"],
    "BY": ["RU","UA","PL","LT","LV"],
    "PL": ["DE","CZ","SK","UA","BY","LT","RU"],
    "DE": ["FR","NL","BE","PL","CZ","AT","CH","DK"],
    "FR": ["DE","BE","CH","IT","ES","LU"],
    "TR": ["GR","BG","GE","AM","AZ","IR","IQ","SY"],
    "IR": ["IQ","TR","AM","AZ","TM","AF","PK"],
    "IQ": ["IR","TR","SY","JO","SA","KW"],
    "SY": ["TR","IQ","JO","IL","LB"],
    "IL": ["LB","SY","JO","EG"],
    "SA": ["IQ","JO","KW","AE","OM","YE","QA"],
    "AE": ["SA","OM","QA"],
    "YE": ["SA","OM"],
    "EG": ["LY","SD","IL"],
    "SD": ["EG","ET","SS","TD","LY"],
    "ET": ["SD","SS","KE","SO","ER","DJ"],
    "KE": ["ET","SO","SS","UG","TZ"],
    "TZ": ["KE","UG","RW","BI","CD","ZM","MZ","MW"],
    "CD": ["CG","CF","SS","UG","RW","BI","TZ","ZM","AO"],
    "NG": ["BJ","NE","TD","CM"],
    "MZ": ["TZ","MW","ZM","ZW","ZA"],
    "ZA": ["MZ","ZW","BW","NA"],
    "IN": ["PK","CN","NP","BD","MM","LK"],
    "PK": ["IN","AF","IR","CN"],
    "AF": ["PK","IR","TM","CN"],
    "CN": ["RU","MN","KZ","IN","PK","AF","MM","VN","LA","NP","KP"],
    "MM": ["CN","IN","TH","LA","BD"],
    "TH": ["MM","LA","KH","MY"],
    "KH": ["TH","LA","VN"],
    "VN": ["CN","LA","KH"],
    "MY": ["TH","ID","SG"],
    "ID": ["MY","PG"],
    "BR": ["AR","CO","PE","BO","PY","VE"],
    "MX": ["US"],
    "US": ["MX","CA"],
    "HT": ["DO"],
}

# Logistics / connectivity corridors. weight = exposure of members to a
# shock at the hub; type drives category transmissibility.
CORRIDORS = [
    {"id":"shanghai_mfg","hub":"CN","type":"trade",
     "name":"China manufacturing & Shanghai/Ningbo ports","w":0.55,
     "members":["US","DE","JP","KR","VN","IN","SG","NL","GB","FR","IT","BR","TR","AE"]},
    {"id":"malacca","hub":"SG","type":"maritime",
     "name":"Strait of Malacca / Singapore transhipment","w":0.5,
     "members":["CN","JP","KR","IN","TH","VN","ID","MY","AE","SA"]},
    {"id":"suez","hub":"EG","type":"maritime",
     "name":"Suez Canal Europe–Asia lane","w":0.55,
     "members":["NL","DE","IT","FR","GB","ES","IN","CN","SG","SA","TR"]},
    {"id":"hormuz","hub":"IR","type":"maritime",
     "name":"Strait of Hormuz energy lane","w":0.6,
     "members":["AE","SA","QA","KW","IN","CN","JP","KR"]},
    {"id":"bosphorus","hub":"TR","type":"maritime",
     "name":"Bosphorus / Black Sea grain corridor","w":0.5,
     "members":["UA","RU","EG","TR","RO","BG"]},
    {"id":"rotterdam","hub":"NL","type":"trade",
     "name":"Rotterdam / NW-Europe gateway","w":0.45,
     "members":["DE","FR","BE","GB","PL","IT","ES"]},
    {"id":"panama","hub":"PA","type":"maritime",
     "name":"Panama Canal","w":0.45,
     "members":["US","CN","MX","BR","CO","PE"]},
    {"id":"gulf_air","hub":"AE","type":"air",
     "name":"Gulf aviation super-hub (DXB/DOH)","w":0.4,
     "members":["IN","PK","GB","DE","FR","SA","EG","TH","SG","KE","NG"]},
    {"id":"sea_air","hub":"SG","type":"air",
     "name":"Singapore/Bangkok aviation hub","w":0.38,
     "members":["TH","ID","MY","VN","PH","IN","CN","AU","JP"]},
]


def main():
    edges = {}
    def add(a, b, w, kind):
        edges.setdefault(a, []).append({"to": b, "w": round(w, 3), "type": kind})

    for a, ns in ADJ.items():
        for b in ns:
            add(a, b, 0.5, "land")            # land spillover (symmetric)
            add(b, a, 0.5, "land")
    for c in CORRIDORS:
        for m in c["members"]:
            if m == c["hub"]:
                continue
            add(c["hub"], m, c["w"], c["type"])      # shock at hub → member
            add(m, c["hub"], c["w"] * 0.6, c["type"])  # weaker reverse

    # dedupe (keep max weight per (a,to,type))
    for a in edges:
        best = {}
        for e in edges[a]:
            k = (e["to"], e["type"])
            if k not in best or e["w"] > best[k]["w"]:
                best[k] = e
        edges[a] = sorted(best.values(), key=lambda x: -x["w"])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "model": "curated exposure graph v0 (land adjacency + logistics corridors)",
            "nodes": len(edges),
            "corridors": [c["id"] for c in CORRIDORS],
            "note": "Auditable reference graph. Cascade is a scenario "
                    "simulation, not a forecast.",
        },
        "edges": edges,
        "corridors": {c["id"]: {k: c[k] for k in ("hub","type","name","w","members")}
                      for c in CORRIDORS},
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    tot = sum(len(v) for v in edges.values())
    print(f"exposure_graph.json: {len(edges)} nodes, {tot} edges, "
          f"{len(CORRIDORS)} corridors")


if __name__ == "__main__":
    main()
