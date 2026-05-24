#!/usr/bin/env python3
"""
Vigilo infographic generator — branded "Top Risk Hotspots" chart (WEF-style
horizontal bars, coloured by risk band) from the live risk_index.json.
Reusable across /intel posts and social. Output: infographics/<slug>.png
Run locally (uses system fonts). 1080x1350 portrait (LinkedIn/IG friendly).
"""
import json, sys
from pathlib import Path
from datetime import datetime, timezone
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUB  = ROOT / "public"
OUT  = ROOT / "infographics"
OUT.mkdir(exist_ok=True)

W, H = 1080, 1350
INK = (20, 17, 12); PAPER = (244, 242, 238); AMBER = (232, 89, 12)
MUT = (122, 114, 99); LINE = (224, 221, 213); NIGHT = (13, 16, 21)
BAND_C = {"minimal":(154,160,166),"low":(228,181,20),"moderate":(232,137,12),
          "elevated":(216,83,30),"severe":(201,42,42),"critical":(139,26,26)}
NAMES = {"PS":"Palestinian Terr.","MM":"Myanmar","YE":"Yemen","IR":"Iran","CD":"DR Congo","SD":"Sudan",
 "UA":"Ukraine","RU":"Russia","NG":"Nigeria","ET":"Ethiopia","SS":"South Sudan","SO":"Somalia","ML":"Mali",
 "BF":"Burkina Faso","NE":"Niger","TD":"Chad","CF":"Central African Rep.","LY":"Libya","SY":"Syria","IQ":"Iraq",
 "AF":"Afghanistan","PK":"Pakistan","BD":"Bangladesh","IN":"India","CN":"China","LB":"Lebanon","IL":"Israel",
 "EG":"Egypt","CO":"Colombia","MX":"Mexico","VE":"Venezuela","HT":"Haiti","CM":"Cameroon","MZ":"Mozambique",
 "PH":"Philippines","ID":"Indonesia","TR":"Turkey","TH":"Thailand","KP":"North Korea","CU":"Cuba","US":"USA",
 "DE":"Germany","FR":"France","GB":"United Kingdom","IT":"Italy","ES":"Spain","PL":"Poland","GR":"Greece",
 "BR":"Brazil","AR":"Argentina","PE":"Peru","EC":"Ecuador","BO":"Bolivia","KE":"Kenya","UG":"Uganda",
 "TZ":"Tanzania","ZA":"South Africa","ZW":"Zimbabwe","DZ":"Algeria","TN":"Tunisia","MA":"Morocco",
 "JO":"Jordan","SA":"Saudi Arabia","YT":"Mayotte","MR":"Mauritania","SN":"Senegal","GH":"Ghana"}
DOM = {"health":"Health","conflict":"Conflict","civil_unrest":"Civil unrest","climate":"Climate",
       "infrastructure":"Infrastructure","transport":"Transport","border":"Border"}

# Cross-platform font resolution: macOS (local dev) → Liberation / DejaVu
# (Ubuntu CI runners) → PIL default. Liberation Sans is metric-compatible with
# Arial; DejaVu ships on every GitHub-hosted runner, so CI never crashes.
_MAC = "/System/Library/Fonts/Supplemental/"
_LIB = "/usr/share/fonts/truetype/liberation/"
_DEJ = "/usr/share/fonts/truetype/dejavu/"
def _find(cands):
    for p in cands:
        try:
            ImageFont.truetype(p, 12); return p
        except Exception:
            continue
    return None
FONT = {
    "bold":   _find([_MAC+"Arial Bold.ttf", _LIB+"LiberationSans-Bold.ttf",   _DEJ+"DejaVuSans-Bold.ttf"]),
    "reg":    _find([_MAC+"Arial.ttf",      _LIB+"LiberationSans-Regular.ttf", _DEJ+"DejaVuSans.ttf"]),
    "italic": _find([_MAC+"Georgia Italic.ttf", _LIB+"LiberationSerif-Italic.ttf", _DEJ+"DejaVuSerif-Italic.ttf"]),
}
def fnt(role, s):
    p = FONT.get(role)
    return ImageFont.truetype(p, s) if p else ImageFont.load_default()

def generate(slug):
    idx = json.load(open(PUB/"risk_index.json")).get("index", {})
    rows = []
    for iso, v in idx.items():
        cr = v.get("composite_risk") or {}
        s = cr.get("score")
        if isinstance(s,(int,float)) and s > 0:
            rows.append((iso, float(s), cr.get("band","minimal"), cr.get("dominant_category","")))
    rows.sort(key=lambda r: r[1], reverse=True)
    rows = rows[:10]

    im = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(im)
    f_eye=fnt("bold",26); f_h=fnt("bold",60); f_serif=fnt("italic",46)
    f_ctry=fnt("bold",30); f_score=fnt("bold",30); f_dom=fnt("reg",21); f_foot=fnt("reg",22)

    # Header band
    d.rectangle([0,0,W,250], fill=NIGHT)
    # logo
    d.rounded_rectangle([60,56,112,108], radius=13, fill=AMBER)
    d.line([(74,73),(86,93),(98,73)], fill="white", width=5, joint="curve")
    d.text((124,64),"Vigilo",font=f_h,fill=(244,242,238))
    def tracked(x,y,t,f,fill,tr=2):
        for ch in t: d.text((x,y),ch,font=f,fill=fill); x+=d.textlength(ch,font=f)+tr
    tracked(62,150,"LIVE GLOBAL RISK · SOURCE-TRACEABLE",f_eye,AMBER,2)
    date_h = datetime.now(timezone.utc).strftime("%d %b %Y")
    d.text((62,190),f"Top risk hotspots · {date_h}",font=fnt("reg",26),fill=(156,163,176))

    # Bars
    top = 300; rowh = 92; x0 = 62; barx = 360; barw_max = W - barx - 110
    maxs = 6.0
    for i,(iso,s,band,dom) in enumerate(rows):
        y = top + i*rowh
        c = BAND_C.get(band,(150,150,150))
        name = NAMES.get(iso, iso)
        d.text((x0,y+8),name,font=f_ctry,fill=INK)
        if dom in DOM: d.text((x0,y+44),DOM[dom],font=f_dom,fill=MUT)
        bw = max(24, int(barw_max * min(s,maxs)/maxs))
        d.rounded_rectangle([barx,y+10,barx+bw,y+54], radius=9, fill=c)
        d.text((barx+bw+14,y+16),f"{s:.1f}",font=f_score,fill=INK)
    # gradient legend
    ly = top + len(rows)*rowh + 16
    d.text((x0,ly),"LOW",font=f_dom,fill=MUT)
    d.text((W-150,ly),"HIGH",font=f_dom,fill=MUT)
    grad_x0, grad_x1 = x0+60, W-160
    for gx in range(grad_x0, grad_x1):
        t=(gx-grad_x0)/(grad_x1-grad_x0)
        # green→yellow→amber→red
        stops=[(0,(0,165,111)),(.4,(228,181,20)),(.7,(232,89,12)),(1,(201,42,42))]
        for j in range(len(stops)-1):
            t0,c0=stops[j]; t1,c1=stops[j+1]
            if t0<=t<=t1:
                k=(t-t0)/(t1-t0); col=tuple(int(c0[m]+(c1[m]-c0[m])*k) for m in range(3)); break
        else: col=(201,42,42)
        d.line([(gx,ly+4),(gx,ly+18)],fill=col)

    # Footer
    d.line([(62,H-86),(W-62,H-86)],fill=LINE,width=1)
    d.text((62,H-66),"vigilo.cc",font=f_foot,fill=INK)
    foot_r = "Composite risk 0–6 · 44 verified feeds"
    d.text((W-62-d.textlength(foot_r,font=f_foot),H-66),foot_r,font=f_foot,fill=MUT)

    path = OUT/f"{slug}.png"
    im.save(path, quality=92)
    print("wrote", path)
    # Stable alias — emails and any "always current" embed point here so they
    # never need to know the dated slug. Standard: every publication + email
    # carries an infographic; this is the canonical live asset.
    latest = OUT/"hotspots-latest.png"
    im.save(latest, quality=92)
    print("wrote", latest)
    return path

def main():
    slug = sys.argv[1] if len(sys.argv) > 1 else "hotspots-" + datetime.now(timezone.utc).strftime("%Y-%m-%d")
    generate(slug)

if __name__ == "__main__":
    main()
