#!/usr/bin/env python3
"""
gen_weekly_brief.py — Weekly Global Risk Brief DRAFT generator.

Reads public/risk_index.json (the scored, source-traceable layer) and produces:
  1. intel/_drafts/weekly-brief-YYYY-MM-DD.html  — a review-ready report draft
     (data filled: hotspot table, KPIs; prose left as marked placeholders).
  2. intel/_drafts/linkedin-YYYY-MM-DD.md         — a LinkedIn post draft.

Drafts are NOINDEX and never linked from the site — publication is a manual,
reviewed step (move to intel/<slug>.html, add to sitemap + listing, post to
LinkedIn). This keeps the quality gate: the script does the tedious data
assembly; a human adds the editorial judgment before anything goes live.

Run:  python3 scripts/gen_weekly_brief.py
CI:   .github/workflows/weekly-brief.yml (Mondays)
"""
from __future__ import annotations

import json
import datetime as dt
from pathlib import Path

ROOT       = Path(__file__).resolve().parent.parent
INDEX_IN   = ROOT / "public" / "risk_index.json"
DRAFTS_DIR = ROOT / "intel" / "_drafts"

# Composite score (0–6) cutoff for inclusion, and a hard cap on rows.
SCORE_MIN  = 1.9
MAX_ROWS   = 10
# Below this event count a high score may be a transient news spike — flag for review.
THIN_EVENTS = 2

DOMAIN_LABEL = {
    "health": "Health", "conflict": "Conflict", "civil_unrest": "Civil unrest",
    "climate": "Climate", "infrastructure": "Infrastructure",
    "transport": "Transport", "border": "Border",
}

# band -> (display label, css class). Unknown bands fall back to moderate styling.
BAND = {
    "catastrophic": ("Catastrophic", "severe"),
    "critical":     ("Critical", "severe"),
    "severe":       ("Severe", "severe"),
    "elevated":     ("Elevated", "elevated"),
    "high":         ("Elevated", "elevated"),
    "moderate":     ("Moderate", "moderate"),
    "low":          ("Low", "moderate"),
    "minimal":      ("Minimal", "moderate"),
}

# ISO-3166 alpha-2 -> display name. Covers every country the engine scores
# (and common others). Self-contained on purpose: no import of the heavy
# fetch pipeline, no third-party dependency, version-safe across Python 3.9+.
ISO_NAME = {
    "AE": "United Arab Emirates", "AF": "Afghanistan", "AM": "Armenia",
    "AO": "Angola", "AR": "Argentina", "AT": "Austria", "AU": "Australia",
    "AZ": "Azerbaijan", "BD": "Bangladesh", "BE": "Belgium",
    "BF": "Burkina Faso", "BI": "Burundi", "BJ": "Benin", "BO": "Bolivia",
    "BR": "Brazil", "BY": "Belarus", "CA": "Canada", "CD": "DR Congo",
    "CF": "Central African Republic", "CI": "Côte d'Ivoire", "CM": "Cameroon",
    "CN": "China", "CO": "Colombia", "CU": "Cuba", "DE": "Germany",
    "DZ": "Algeria", "EC": "Ecuador", "EG": "Egypt", "ES": "Spain",
    "ET": "Ethiopia", "FR": "France", "GA": "Gabon", "GB": "United Kingdom",
    "GE": "Georgia", "GH": "Ghana", "GN": "Guinea", "GQ": "Equatorial Guinea",
    "GT": "Guatemala", "GW": "Guinea-Bissau", "HN": "Honduras", "HT": "Haiti",
    "ID": "Indonesia", "IN": "India", "IQ": "Iraq", "IR": "Iran", "IT": "Italy",
    "JO": "Jordan", "JP": "Japan", "KE": "Kenya", "KG": "Kyrgyzstan",
    "KH": "Cambodia", "KP": "North Korea", "KR": "South Korea",
    "KZ": "Kazakhstan", "LA": "Laos", "LB": "Lebanon", "LK": "Sri Lanka",
    "LR": "Liberia", "LY": "Libya", "MA": "Morocco", "MD": "Moldova",
    "MG": "Madagascar", "ML": "Mali", "MM": "Myanmar", "MN": "Mongolia",
    "MW": "Malawi", "MX": "Mexico", "MY": "Malaysia", "MZ": "Mozambique",
    "NE": "Niger", "NG": "Nigeria", "NI": "Nicaragua", "NL": "Netherlands",
    "NP": "Nepal", "NZ": "New Zealand", "PA": "Panama", "PE": "Peru",
    "PG": "Papua New Guinea", "PH": "Philippines", "PK": "Pakistan",
    "PL": "Poland", "PS": "Palestinian Territories", "RO": "Romania",
    "RU": "Russia", "RW": "Rwanda", "SA": "Saudi Arabia",
    "SB": "Solomon Islands", "SD": "Sudan", "SG": "Singapore",
    "SL": "Sierra Leone", "SN": "Senegal", "SO": "Somalia", "SS": "South Sudan",
    "SY": "Syria", "TD": "Chad", "TG": "Togo", "TH": "Thailand",
    "TJ": "Tajikistan", "TM": "Turkmenistan", "TN": "Tunisia", "TR": "Türkiye",
    "TT": "Trinidad and Tobago", "TW": "Taiwan", "TZ": "Tanzania",
    "UA": "Ukraine", "UG": "Uganda", "US": "United States", "UZ": "Uzbekistan",
    "VE": "Venezuela", "VN": "Vietnam", "VU": "Vanuatu", "YE": "Yemen",
    "ZA": "South Africa", "ZM": "Zambia", "ZW": "Zimbabwe",
}


def country_name(iso: str) -> str:
    return ISO_NAME.get(iso, iso)


def load_index() -> dict:
    return json.loads(INDEX_IN.read_text(encoding="utf-8"))


def top_rows(index: dict) -> list[dict]:
    rows = []
    for iso, d in index.items():
        cr = d.get("composite_risk", {})
        score = cr.get("score", 0) or 0
        if score < SCORE_MIN:
            continue
        rows.append({
            "iso": iso,
            "name": country_name(iso),
            "score": score,
            "band": cr.get("band", "moderate"),
            "domain": cr.get("dominant_category", ""),
            "events": d.get("event_count", 0),
        })
    rows.sort(key=lambda r: r["score"], reverse=True)
    return rows[:MAX_ROWS]


# ── HTML rendering ──────────────────────────────────────────────────────────
HTML_HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>[DRAFT] Global Risk Brief — Week of {date_h} | Vigilo Intelligence</title>
<meta name="description" content="DRAFT — weekly highest-risk countries across 7 domains.">
<!-- DRAFT: noindex until reviewed and published to /intel/<slug>.html -->
<meta name="robots" content="noindex, nofollow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800;900&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<style>
  :root{
    --paper:#F4F2EE;--paper50:#FBF9F4;--ink:#14110C;--ink700:#332E26;--ink600:#544D42;--ink500:#7A7263;--ink400:#9F9685;
    --night:#0D1015;--night-muted:#9CA3B0;--amber:#E8590C;--red:#C92A2A;--yellow:#E4B514;--green:#00A56F;
    --rule:rgba(20,17,12,.10);--rule-strong:rgba(20,17,12,.18);
    --sans:'Geist',ui-sans-serif,system-ui,-apple-system,sans-serif;
    --mono:'Geist Mono',ui-monospace,SFMono-Regular,Menlo,monospace;--serif:'Instrument Serif',Georgia,serif;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--paper);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.65;-webkit-font-smoothing:antialiased;letter-spacing:-.003em}
  a{color:var(--amber);text-decoration:none}a:hover{text-decoration:underline}
  .h-it{font-family:var(--serif);font-style:italic;font-weight:400;color:var(--amber)}
  .mono{font-family:var(--mono);font-variant-numeric:tabular-nums}
  .draftbar{background:#1A1916;color:#fff;font-size:13px;padding:10px 16px;text-align:center;position:sticky;top:0;z-index:60}
  .draftbar b{color:var(--amber)}
  .article{max-width:760px;margin:0 auto;padding:0 24px}
  .eyebrow{font-size:11.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--amber);margin-top:34px;display:block}
  h1{font-size:clamp(30px,4.4vw,44px);line-height:1.08;letter-spacing:-.035em;font-weight:800;margin:14px 0 16px}
  .lede{font-size:19px;line-height:1.55;color:var(--ink700)}
  .byline{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin:22px 0 8px;font-size:13px;color:var(--ink500);border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:14px 0}
  .article h2{font-size:24px;letter-spacing:-.02em;font-weight:800;margin:42px 0 12px}
  .article h3{font-size:18px;letter-spacing:-.01em;font-weight:700;margin:28px 0 8px}
  .article p{margin:0 0 18px;color:var(--ink700)}
  .article strong{color:var(--ink);font-weight:700}
  .todo{background:#FFF7E6;border:1px dashed var(--amber);border-radius:10px;padding:12px 16px;margin:12px 0;font-size:14px;color:#8A5A00}
  .htable{width:100%;border-collapse:collapse;margin:8px 0 22px;font-size:14.5px}
  .htable th{text-align:left;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--ink500);padding:0 10px 10px;border-bottom:1px solid var(--rule-strong)}
  .htable td{padding:12px 10px;border-bottom:1px solid var(--rule);vertical-align:middle}
  .htable .rank{color:var(--ink400);font-weight:700;width:26px}
  .htable .ctry{font-weight:700;color:var(--ink)}
  .htable .score{font-family:var(--mono);font-weight:600}
  .band{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:3px 9px;border-radius:99px;white-space:nowrap}
  .band.severe{background:rgba(201,42,42,.12);color:#A11}
  .band.elevated{background:rgba(232,89,12,.13);color:#B8480C}
  .band.moderate{background:rgba(228,181,20,.18);color:#8A6A00}
  .dom{font-size:13px;color:var(--ink600)}
  figure.info-fig{margin:22px 0 8px}
  figure.info-fig img{width:100%;height:auto;display:block;border-radius:14px;border:1px solid var(--rule);box-shadow:0 18px 40px -24px rgba(20,17,12,.5)}
  figure.info-fig figcaption{font-size:13px;color:var(--ink500);margin-top:10px;text-align:center}
  .method{background:#fff;border:1px solid var(--rule);border-radius:14px;padding:20px 22px;margin:26px 0}
  .method .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:14px;margin-top:6px}
  .method .kpi{font-family:var(--mono);font-size:22px;font-weight:600;color:var(--ink)}
  .method .kpi-l{font-size:12px;color:var(--ink500);margin-top:2px}
  .disclaimer{font-size:12.5px;color:var(--ink400);line-height:1.6;margin:30px 0 60px;border-top:1px solid var(--rule);padding-top:18px}
</style>
</head>
<body>
<div class="draftbar"><b>DRAFT</b> — review &amp; add analysis, then publish to <span class="mono">/intel/global-risk-brief-{date}</span> (noindex until then)</div>
<article class="article">
  <span class="eyebrow">Global Risk Brief</span>
  <h1>The world's highest-risk countries, <span class="h-it">week of {date_h}</span></h1>
  <p class="lede">{lede}</p>
  <div class="byline"><span>Generated {date_h}</span><span>·</span><span>44 verified feeds · 7 domains</span><span>·</span><span>By Vigilo Intelligence</span></div>

  <h2>This week's top hotspots</h2>
  <p>The composite risk score (0–6) blends signal density, severity and structural fragility across all seven domains. Higher means more corroborated, more severe, or more sustained. These are the countries scoring {score_min} and above.</p>
  <table class="htable">
    <thead><tr><th>#</th><th>Country</th><th>Composite</th><th>Band</th><th>Lead domain</th></tr></thead>
    <tbody>
{rows}
    </tbody>
  </table>
{thin_note}
{infographic}
  <h2>What's driving the top of the table</h2>
  <div class="todo">DRAFT — write 2–4 short paragraphs of editorial analysis on the top movers below. Auto-generated factual stubs are provided as a starting point; rewrite with judgement, keep claims hedged and source-traceable.</div>
{drivers}
  <div class="method">
    <h3>How Vigilo scores risk</h3>
    <p style="margin-bottom:6px">Every composite is built from public, verifiable feeds and is traceable back to its sources — no black box, no single-source claims.</p>
    <div class="grid">
      <div><div class="kpi">{countries}</div><div class="kpi-l">countries scored</div></div>
      <div><div class="kpi">{events}</div><div class="kpi-l">active events</div></div>
      <div><div class="kpi">7</div><div class="kpi-l">risk domains</div></div>
      <div><div class="kpi">44</div><div class="kpi-l">verified feeds</div></div>
    </div>
    <p style="margin:14px 0 0;font-size:13.5px;color:var(--ink600)">Sources include WHO, ECDC, CDC, GDACS, GDELT, IODA and more — refreshed continuously. <a href="/methodology">Read the full methodology →</a></p>
  </div>
  <p class="disclaimer">Vigilo aggregates publicly available reporting and structural indicators into transparent, source-traceable risk scores. Scores describe measured signal density and structural fragility — they are decision-support, not guarantees. Country labels follow source-feed conventions and imply no political position. Figures reflect the data snapshot of {date_h}.</p>
</article>
<!-- Yandex.Metrika -->
<script type="text/javascript">
(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=109240834','ym');
ym(109240834,'init',{ssr:true,clickmap:true,accurateTrackBounce:true,trackLinks:true});
</script>
<noscript><div><img src="https://mc.yandex.ru/watch/109240834" style="position:absolute;left:-9999px;" alt=""/></div></noscript>
<!-- /Yandex.Metrika -->
<!-- Funnel: intel -> app click (Plausible + Yandex) -->
<script>
document.addEventListener('click',function(e){
  var a=e.target.closest&&e.target.closest('a[href^="/app"]');
  if(!a) return;
  try{ if(window.plausible) plausible('intel_open_app'); }catch(_){}
  try{ if(window.ym) ym(109240834,'reachGoal','intel_open_app'); }catch(_){}
});
</script>
</body>
</html>
"""


def render_html(rows: list[dict], meta: dict, date: str, date_h: str, infographic: str = "") -> str:
    lead_names = ", ".join(r["name"] for r in rows[:4])
    lede = (f"Vigilo scored {meta.get('countries', '—')} countries across seven risk "
            f"domains this week. The highest composite scores: {lead_names}. "
            f"Every score below is traceable to its source feeds.")

    row_html = []
    for i, r in enumerate(rows, 1):
        label, cls = BAND.get(r["band"], ("Moderate", "moderate"))
        dom = DOMAIN_LABEL.get(r["domain"], r["domain"].title() if r["domain"] else "—")
        row_html.append(
            f'      <tr><td class="rank">{i}</td><td class="ctry">{r["name"]}</td>'
            f'<td class="score">{r["score"]}</td>'
            f'<td><span class="band {cls}">{label}</span></td>'
            f'<td class="dom">{dom} · {r["events"]} events</td></tr>'
        )

    thin = [r for r in rows if r["events"] <= THIN_EVENTS]
    thin_note = ""
    if thin:
        names = ", ".join(f'{r["name"]} ({r["events"]})' for r in thin)
        thin_note = (f'  <div class="todo">VERIFY before publishing — high score on few events '
                     f'(possible transient news spike): {names}. Confirm these are real or drop them.</div>\n')

    drivers = []
    for r in rows[:4]:
        label, _ = BAND.get(r["band"], ("Moderate", "moderate"))
        dom = DOMAIN_LABEL.get(r["domain"], r["domain"]).lower()
        drivers.append(
            f'  <h3>{r["name"]} — {label.lower()} ({r["score"]})</h3>\n'
            f'  <p>{r["name"]} scores {r["score"]} on the {dom} domain across {r["events"]} '
            f'tracked event(s). <em>[DRAFT: add what is actually driving this — sources, recent '
            f'developments, why it matters for travellers / NGOs / teams.]</em></p>'
        )

    # .replace() (not .format()) so the CSS braces in the template are left alone.
    out = HTML_HEAD
    repl = {
        "{date_h}": date_h, "{date}": date, "{lede}": lede,
        "{score_min}": str(SCORE_MIN), "{rows}": "\n".join(row_html),
        "{thin_note}": thin_note, "{drivers}": "\n".join(drivers),
        "{infographic}": infographic,
        "{countries}": str(meta.get("countries", "—")),
        "{events}": str(meta.get("events_total", "—")),
    }
    for k, v in repl.items():
        out = out.replace(k, v)
    return out


def render_linkedin(rows: list[dict], meta: dict, date: str, date_h: str) -> str:
    url = f"https://vigilo.cc/intel/global-risk-brief-{date}"
    top = rows[:5]
    bullets = "\n".join(
        f"{i}. {r['name']} — {r['score']} ({BAND.get(r['band'], ('Moderate',''))[0]}, "
        f"{DOMAIN_LABEL.get(r['domain'], r['domain'])})"
        for i, r in enumerate(top, 1)
    )
    return f"""LINKEDIN DRAFT — {date_h}
(Review, tighten the hook, post manually. Link drives traffic to /intel.)

------------------------------------------------------------
This week's highest-risk countries, scored across 7 domains 🌍

[HOOK — one sharp line about the top finding, e.g. "Myanmar is the only
country in the 'severe' band this week — here's the full picture."]

Top of the table ({meta.get('countries','—')} countries scored, 44 verified feeds):

{bullets}

Every score is source-traceable — no black box. Full brief, live globe and
methodology here:
{url}

#riskintelligence #dutyofcare #travelrisk #OSINT #globalhealth
------------------------------------------------------------
"""


def main() -> None:
    today = dt.datetime.now(dt.timezone.utc).date()
    date = today.isoformat()
    date_h = today.strftime("%d %B %Y").lstrip("0")

    index_doc = load_index()
    index = index_doc.get("index", {})
    meta = index_doc.get("meta", {})
    rows = top_rows(index)

    # Standard: every publication carries an infographic. Generate the branded
    # "Top Risk Hotspots" chart for this brief's publish slug and embed it.
    # Non-fatal: if Pillow/fonts are unavailable the draft still generates.
    slug = f"global-risk-brief-{date}"
    infographic = ""
    try:
        import gen_infographic
        gen_infographic.generate(slug)
        infographic = (
            f'  <figure class="info-fig">\n'
            f'    <img src="/infographics/{slug}.png" alt="Vigilo top risk hotspots, {date_h} — '
            f'composite risk 0–6, coloured by band">\n'
            f'    <figcaption>Top risk hotspots, {date_h} — live composite scores. '
            f'Updates continuously on the <a href="/app">live globe</a>.</figcaption>\n'
            f'  </figure>'
        )
    except Exception as e:
        print(f"  ⚠ infographic generation skipped: {e}")

    DRAFTS_DIR.mkdir(parents=True, exist_ok=True)
    html_path = DRAFTS_DIR / f"weekly-brief-{date}.html"
    md_path   = DRAFTS_DIR / f"linkedin-{date}.md"
    html_path.write_text(render_html(rows, meta, date, date_h, infographic), encoding="utf-8")
    md_path.write_text(render_linkedin(rows, meta, date, date_h), encoding="utf-8")

    print(f"✓ Weekly brief draft → {html_path.relative_to(ROOT)}")
    print(f"✓ LinkedIn draft     → {md_path.relative_to(ROOT)}")
    print(f"  {len(rows)} countries ≥ {SCORE_MIN}: " +
          ", ".join(f"{r['name']} {r['score']}" for r in rows))
    thin = [r for r in rows if r["events"] <= THIN_EVENTS]
    if thin:
        print("  ⚠ verify (thin event count): " +
              ", ".join(f"{r['name']}({r['events']})" for r in thin))


if __name__ == "__main__":
    main()
