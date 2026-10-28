"""Trace a cleaned signature sketch (black ink on white) into centre-line fragments for build-signature.py.

Writes art/signature/trace.json ({width: ink thickness px, strokes: [[x, y], ...]}) and, if given, a contact
sheet showing each fragment with its index, start (green) and end (blue), for writing the STROKES waypoints.
Run: python3 art/trace-sketch.py [sheet.png]
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from skimage.morphology import skeletonize

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'signature', 'sketch-clean.png')
OUT = os.path.join(HERE, 'signature', 'trace.json')
N8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

ink = np.array(Image.open(SRC).convert('L')) < 128
dist = ndimage.distance_transform_edt(ink)
pts = set(zip(*np.nonzero(skeletonize(ink))))


def nb(p):
    return [(p[0] + dy, p[1] + dx) for dy, dx in N8 if (p[0] + dy, p[1] + dx) in pts]


deg = {p: len(nb(p)) for p in pts}
nodes = {p for p in pts if deg[p] != 2}
visited, edges = set(), []
for n in nodes:
    for q in nb(n):
        if (n, q) in visited:
            continue
        path, prev, cur = [n, q], n, q
        visited |= {(n, q), (q, n)}
        while cur not in nodes:
            nxt = [r for r in nb(cur) if r != prev and (cur, r) not in visited]
            if not nxt:
                break
            r = nxt[0]
            visited |= {(cur, r), (r, cur)}
            path.append(r)
            prev, cur = cur, r
        edges.append(path)
rest = pts - {p for e in edges for p in e}
while rest:  # closed loops with no junctions
    start = next(iter(rest))
    path, prev, cur = [start], None, start
    while True:
        nxt = [r for r in nb(cur) if r != prev and r in rest and r not in path]
        if not nxt:
            break
        prev, cur = cur, nxt[0]
        path.append(cur)
    rest -= set(path)
    edges.append(path + [start])


def plen(p):
    return sum(math.dist(p[i], p[i + 1]) for i in range(len(p) - 1))


edges = [e for e in edges if not ((deg[e[0]] == 1 or deg[e[-1]] == 1) and plen(e) < 12)]  # skeleton spurs
strokes = sorted(([[int(p[1]), int(p[0])] for p in e] for e in edges if plen(e) > 6), key=lambda s: (min(p[1] for p in s), min(p[0] for p in s)))
width = float(np.median([dist[p] for p in pts])) * 2
json.dump({'width': width, 'strokes': strokes}, open(OUT, 'w'))
print(f'{len(strokes)} fragments, ink {width:.1f}px')

if len(sys.argv) > 1:
    base = Image.open(SRC).convert('RGB').point(lambda v: 225 if v < 128 else 255)
    cols, scale = 6, 0.3
    tw, th = int(base.width * scale), int(base.height * scale)
    sheet = Image.new('RGB', (cols * tw, ((len(strokes) + cols - 1) // cols) * th), 'white')
    for k, s in enumerate(strokes):
        im = base.copy()
        d = ImageDraw.Draw(im)
        d.line([tuple(p) for p in s], fill=(220, 30, 60), width=8)
        d.ellipse([s[0][0] - 14, s[0][1] - 14, s[0][0] + 14, s[0][1] + 14], fill=(0, 150, 60))
        d.ellipse([s[-1][0] - 10, s[-1][1] - 10, s[-1][0] + 10, s[-1][1] + 10], fill=(30, 60, 220))
        d.text((12, 8), str(k), fill=(0, 0, 0), font_size=72)
        sheet.paste(im.resize((tw, th)), ((k % cols) * tw, (k // cols) * th))
    sheet.save(sys.argv[1])
