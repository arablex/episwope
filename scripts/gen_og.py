#!/usr/bin/env python3
"""Generate the branded social/OG card (1200x630) — new globe-V seal,
wordmark and tagline. Output: og-intel.jpg. Pure PIL (runs in CI)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_infographic as G          # reuse draw_mark + fnt
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
W, H = 1200, 630
NIGHT = (13, 16, 21); PAPER = (244, 242, 238); AMBER = (232, 89, 12); MUT = (156, 163, 176)

im = Image.new("RGB", (W, H), NIGHT)
d = ImageDraw.Draw(im)

# brand row — seal + wordmark
G.draw_mark(d, 110, 96, 48, AMBER, PAPER, NIGHT)
d.text((182, 54), "Vigilo", font=G.fnt("bold", 80), fill=PAPER)

def tracked(x, y, t, f, fill, tr=2):
    for ch in t:
        d.text((x, y), ch, font=f, fill=fill); x += d.textlength(ch, font=f) + tr

tracked(66, 214, "LIVE GLOBAL RISK · SOURCE-TRACEABLE", G.fnt("bold", 24), AMBER, 2)

# tagline (brand voice)
d.text((62, 262), "Real-time risk intelligence.", font=G.fnt("bold", 66), fill=PAPER)
d.text((62, 344), "Source-traceable.",            font=G.fnt("italic", 64), fill=AMBER)

# one substantive subline
d.text((64, 452), "Live across health · conflict · disasters · climate · borders",
       font=G.fnt("reg", 27), fill=MUT)

# footer
d.line([(62, 540), (W-62, 540)], fill=(40, 44, 52), width=1)
d.text((62, 560), "vigilo.cc", font=G.fnt("bold", 26), fill=PAPER)
foot = "44 verified feeds · composite risk 0–5"
d.text((W-62-d.textlength(foot, font=G.fnt("reg", 24)), 562), foot, font=G.fnt("reg", 24), fill=MUT)

out = ROOT / "og-intel.jpg"
im.save(out, quality=90)
print("wrote", out)
