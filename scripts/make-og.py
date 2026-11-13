#!/usr/bin/env python3
"""Generate public/og.png (1200x630) and public/favicon.svg from the tokens, the copy deck and Geist.

usage: scripts/make-og.py --sans Geist-Variable.ttf --mono GeistMono-Variable.ttf
(the TTFs ship in the `geist` npm package under dist/fonts/; they are build inputs, not committed.)
needs: Pillow, fontTools. Colours are read from src/styles/tokens.css, the tagline from src/content/copy.ts.
"""
import argparse, re, pathlib
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = pathlib.Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument('--sans', required=True)
ap.add_argument('--mono', required=True)
a = ap.parse_args()

tok = dict(re.findall(r'--([\w-]+):\s*(#[0-9a-fA-F]{6})', (ROOT / 'src/styles/tokens.css').read_text()))
copy = (ROOT / 'src/content/copy.ts').read_text()
tagline = re.search(r"short:\s*'([^']+)'", copy).group(1)
origin = re.search(r"origin:\s*'https?://([^']+)'", copy).group(1)
brand = re.search(r"brand:\s*'([^']+)'", copy).group(1)

W, H, PAD = 1200, 630, 88
img = Image.new('RGB', (W, H), tok['bg'])
d = ImageDraw.Draw(img)

def font(path, size, wght):
    f = ImageFont.truetype(path, size)
    f.set_variation_by_axes([wght])
    return f

# wordmark, tracked -0.045em like the site
wm = font(a.sans, 220, 500)
x, y, track = PAD, 96, -0.045 * 220
for ch in brand:
    d.text((x, y), ch, font=wm, fill=tok['fg-1'])
    x += wm.getlength(ch) + track

# tagline, wrapped at 940px
body = font(a.sans, 44, 400)
lines, cur = [], ''
for w in tagline.split():
    t = (cur + ' ' + w).strip()
    if body.getlength(t) <= 940:
        cur = t
    else:
        lines.append(cur); cur = w
lines.append(cur)
ty = 380
for ln in lines:
    d.text((PAD, ty), ln, font=body, fill=tok['fg-2'])
    ty += 62

# footer: rule + origin in mono
d.line([(PAD, H - 112), (W - PAD, H - 112)], fill=tok['line-strong'], width=2)
d.text((PAD, H - 90), origin, font=font(a.mono, 30, 400), fill=tok['fg-3'])
img.save(ROOT / 'public/og.png', optimize=True)

# favicon: the "y" glyph outline of Geist Medium on the page background
tt = TTFont(a.sans)
from fontTools.varLib.instancer import instantiateVariableFont
tt = instantiateVariableFont(tt, {'wght': 500})
gs = tt.getGlyphSet(); gname = tt.getBestCmap()[ord(brand[0])]
pen = SVGPathPen(gs)
g = gs[gname]
# fit: glyph box -> 64x64 viewbox, flip y
from fontTools.pens.boundsPen import BoundsPen
bp = BoundsPen(gs); g.draw(bp); x0, y0, x1, y1 = bp.bounds
s = 38 / max(x1 - x0, y1 - y0)
tx = 32 - (x0 + x1) / 2 * s
ty_ = 32 + (y0 + y1) / 2 * s
g.draw(TransformPen(pen, (s, 0, 0, -s, tx, ty_)))
path_d = re.sub(r'(\d+\.\d)\d+', r'\1', pen.getCommands())
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
       f'<rect width="64" height="64" rx="14" fill="{tok["bg"]}"/>'
       f'<path d="{path_d}" fill="{tok["fg-1"]}"/></svg>\n')
(ROOT / 'public/favicon.svg').write_text(svg)
print('wrote public/og.png and public/favicon.svg')
