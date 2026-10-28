"""Build components/ui/signature.tsx from the traced sketch, in the stroke order and rhythm of a pen take.

Shapes: centre lines skeletonised from the paper sketch (art/signature/sketch-clean.png, see trace-sketch.py).
Order and rhythm: a take drawn at /dev/signature (art/signature/take-*.json).

Each pen stroke is a list of waypoints (ends, loop sides, peaks) in the order the take was written, joined by the
shortest route along the sketch's ink, so retraces (up to a peak and back down the same line) come out naturally
and nothing is drawn where there is no ink.

Run: python3 art/build-signature.py [take.json] [debug.png]
"""
import glob
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy.interpolate import splev, splprep
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra
from scipy.spatial import cKDTree
from skimage.morphology import skeletonize

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'components', 'ui', 'signature.tsx')
SKETCH = os.path.join(HERE, 'signature', 'sketch-clean.png')
TRACE = os.path.join(HERE, 'signature', 'trace.json')  # from trace-sketch.py; only its ink thickness is used here
TOTAL_SECONDS = 3.2
SEGMENTS_PER_SECOND = 18  # pieces each stroke is cut into so the replay keeps the hand's speed changes
SMOOTHING = 2.4   # px of wobble the spline may smooth away; higher = smoother, softer
CUSP_DEGREES = 100  # direction changes sharper than this (the peaks, retraces) stay sharp

# Pen strokes in the take's order, as waypoints in sketch-clean.png pixels. Consecutive waypoints are joined along
# the ink, so loops need a waypoint on each side to be drawn the right way round, and retraces revisit a point.
STROKES = [
    # Lead-in, I (top loop, stem, left loop), u and r with their peaks and spur, the downstroke, the l loop, then the
    # big closing loop and the swash sweeping back left into the hook.
    [(307, 349), (460, 314), (497, 285), (540, 235), (615, 185), (560, 252), (497, 285), (460, 314), (350, 440),
     (232, 555), (165, 575), (120, 577), (100, 585), (130, 598), (165, 575), (232, 557), (350, 527), (455, 460),
     (350, 527), (320, 582), (455, 540), (500, 507), (455, 540), (460, 572), (570, 510), (625, 470), (642, 450),
     (625, 470), (680, 460), (580, 570), (680, 460), (712, 490), (812, 445), (890, 362), (929, 300), (982, 250),
     (955, 300), (890, 362), (812, 445), (760, 520), (720, 617), (750, 662), (815, 655), (920, 575), (890, 557),
     (720, 617), (440, 740), (200, 785), (25, 712)],
    [(307, 393), (263, 430), (272, 446), (312, 410), (307, 393)],  # little circle before the I
    [(855, 315), (812, 352), (825, 372), (857, 327), (855, 315)],  # dot
    [(952, 205), (660, 102), (357, 37)],  # overline, right to left
    [(952, 205), (955, 120), (900, 45), (800, 17), (700, 50), (660, 100)],  # flag, right end up and over
]


take_path = sys.argv[1] if len(sys.argv) > 1 else sorted(glob.glob(os.path.join(HERE, 'signature', 'take-*.json')))[-1]
debug_path = sys.argv[2] if len(sys.argv) > 2 else None
take = json.load(open(take_path))
width = json.load(open(TRACE))['width']  # median ink thickness of the sketch, in px
assert len(take['strokes']) == len(STROKES), f"take has {len(take['strokes'])} strokes, STROKES lists {len(STROKES)}"

# Skeleton of the sketch.
ink = np.array(Image.open(SKETCH).convert('L')) < 128
ys, xs = np.nonzero(skeletonize(ink))
px = np.column_stack([xs, ys]).astype(float)

# 8-connected pixel graph over the skeleton.
index = {(int(x), int(y)): i for i, (x, y) in enumerate(px)}
rows, cols, weights = [], [], []
for i, (x, y) in enumerate(px):
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            j = index.get((int(x) + dx, int(y) + dy))
            if j is not None and j != i:
                rows.append(i); cols.append(j); weights.append(np.hypot(dx, dy))
graph = coo_matrix((weights, (rows, cols)), shape=(len(px), len(px))).tocsr()
pixel_tree = cKDTree(px)


def route(a, b):
    """Shortest path along the ink between two points (a straight hop where the ink is broken)."""
    a, b = int(pixel_tree.query(a)[1]), int(pixel_tree.query(b)[1])
    dist, pred = dijkstra(graph, indices=a, return_predecessors=True)
    if not np.isfinite(dist[b]):
        return [px[a], px[b]]  # no ink between them: straight hop
    path = [b]
    while path[-1] != a:
        path.append(pred[path[-1]])
    return [px[i] for i in reversed(path)]


def smooth(p):
    """Smoothing spline per section between cusps, so curves lose the marker's wobble but peaks stay crisp."""
    if len(p) < 12:
        return p
    k = 4
    v = p[k:] - p[:-k]
    v /= np.maximum(np.linalg.norm(v, axis=1, keepdims=True), 1e-9)
    turn = np.degrees(np.arccos(np.clip((v[:-k] * v[k:]).sum(1), -1, 1)))  # turn across sample i+k
    cusps = []
    for i in np.where(turn > CUSP_DEGREES)[0] + k:
        if not cusps or i - cusps[-1] > 2 * k:
            cusps.append(int(i))
        elif turn[i - k] > turn[cusps[-1] - k]:
            cusps[-1] = int(i)
    # Tiny back-and-forth jogs where the route hops between traced lines aren't real corners: when two cusps
    # are closer than ~16px, cut out the jog between them; cusps right at the ends are ignored.
    MIN_SECTION = 8
    kept, removed = [], 0
    for c in cusps:
        c -= removed
        if kept and c - kept[-1] < MIN_SECTION:
            a = kept.pop()
            p = np.vstack([p[:a], p[c:]])
            removed += c - a
        elif MIN_SECTION <= c <= len(p) - 1 - MIN_SECTION:
            kept.append(c)
    cusps = [c for c in kept if c <= len(p) - 1 - MIN_SECTION]
    out = []
    for a, b in zip([0] + cusps, cusps + [len(p) - 1]):
        seg = p[a : b + 1]
        if len(seg) < 6:
            out.append(seg)
            continue
        tck, _ = splprep([seg[:, 0], seg[:, 1]], s=len(seg) * SMOOTHING**2, k=3)
        x, y = splev(np.linspace(0, 1, len(seg)), tck)
        fitted = np.column_stack([x, y])
        fitted[0], fitted[-1] = seg[0], seg[-1]  # keep cusps and ends exactly in place
        out.append(fitted)
    return np.vstack([out[0]] + [o[1:] for o in out[1:]])


def resample(p, step=2.0):
    seg = np.linalg.norm(np.diff(p[:, :2], axis=0), axis=1)
    keep = np.concatenate([[True], seg > 1e-6])
    p = p[keep]
    seg = np.linalg.norm(np.diff(p[:, :2], axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    if s[-1] < step:
        return p
    u = np.arange(0, s[-1], step)
    return np.stack([np.interp(u, s, p[:, k]) for k in range(p.shape[1])], 1)


def rdp(p, eps):
    if len(p) < 3:
        return p
    a, b = p[0], p[-1]
    ab = b - a
    n = np.linalg.norm(ab)
    d = np.abs(ab[0] * (p[:, 1] - a[1]) - ab[1] * (p[:, 0] - a[0])) / n if n else np.linalg.norm(p - a, axis=1)
    i = int(np.argmax(d))
    if d[i] > eps:
        return np.vstack([rdp(p[: i + 1], eps)[:-1], rdp(p[i:], eps)])
    return np.array([a, b])


def to_path(p):
    p = rdp(p, 0.35)
    out = f'M{p[0][0]:.1f} {p[0][1]:.1f}'
    for i in range(len(p) - 1):
        p0 = p[i - 1] if i > 0 else p[i]
        p1, p2 = p[i], p[i + 1]
        p3 = p[i + 2] if i + 2 < len(p) else p[i + 1]
        c1, c2 = p1 + (p2 - p0) / 6, p2 - (p3 - p1) / 6
        out += f'C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}'
    return out


# Route each stroke through its waypoints, smooth it, and give it the take's timing (by fraction of length).
cleaned = []
for spec, pen in zip(STROKES, take['strokes']):
    path = [px[int(pixel_tree.query(spec[0])[1])]]
    for a, b in zip(spec[:-1], spec[1:]):
        path += route(a, b)[1:]
    path = resample(smooth(resample(np.array(path))))
    pen = np.array(pen, float)
    pen_len = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(pen[:, :2], axis=0), axis=1))])
    our_len = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(path, axis=0), axis=1))])
    t = np.interp(our_len / max(our_len[-1], 1e-6), pen_len / max(pen_len[-1], 1e-6), pen[:, 2])
    cleaned.append(np.column_stack([path, t]))

t_first, t_last = cleaned[0][0, 2], cleaned[-1][-1, 2]
speed = TOTAL_SECONDS / ((t_last - t_first) / 1000)
pieces = []  # (path, start s, duration s)
for p in cleaned:
    ts = (p[:, 2] - t_first) / 1000 * speed
    n = max(1, round((ts[-1] - ts[0]) * SEGMENTS_PER_SECOND))
    bounds = np.linspace(ts[0], ts[-1], n + 1)
    for a, b in zip(bounds[:-1], bounds[1:]):
        sel = np.where((ts >= a - 1e-9) & (ts <= b + 1e-9))[0]
        if len(sel) < 2:
            continue
        lo, hi = sel[0], min(sel[-1] + 1, len(p) - 1)  # overlap one sample so pieces join seamlessly
        pieces.append((to_path(p[lo : hi + 1, :2]), round(float(ts[lo]), 3), round(float(max(ts[hi] - ts[lo], 0.01)), 3)))

all_xy = np.vstack([p[:, :2] for p in cleaned])
pad = 14
x0, y0 = all_xy.min(0) - pad
x1, y1 = all_xy.max(0) + pad
stroke_width = round(width * 0.9, 1)  # trace 'width' is the sketch's ink thickness

rows = '\n'.join(f"  ['{d}', {s}, {dur}]," for d, s, dur in pieces)
src = f"""'use client';
import {{ useEffect, useState }} from 'react';
import {{ cn }} from '@/lib/utils';

// Generated by art/build-signature.py from {os.path.basename(take_path)} (stroke order and rhythm) and the traced
// sketch (shapes). Each stroke is cut into short pieces so the replay keeps the hand's speed changes:
// [path, start (s), duration (s)].
const PIECES: [string, number, number][] = [
{rows}
];

interface SignatureProps {{
  className?: string;
  /** Write the signature out as it was drawn (~{TOTAL_SECONDS}s). */
  animate?: boolean;
}}

export function Signature({{ className, animate = true }}: SignatureProps) {{
  const [writing, setWriting] = useState(false);

  useEffect(() => {{
    if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setWriting(true);
  }}, [animate]);

  return (
    <svg viewBox="{x0:.0f} {y0:.0f} {x1 - x0:.0f} {y1 - y0:.0f}" role="img" aria-label="Isaac's signature" className={{cn('h-auto overflow-visible', className)}}>
      <g fill="none" stroke="currentColor" strokeWidth={{{stroke_width}}} strokeLinecap="round" strokeLinejoin="round">
        {{PIECES.map(([d, delay, duration]) => (
          <path
            key={{d}}
            d={{d}}
            pathLength={{1}}
            className={{writing ? 'signature-stroke' : undefined}}
            style={{writing ? {{ animationDelay: `${{delay + 0.3}}s`, animationDuration: `${{duration}}s` }} : undefined}}
          />
        ))}}
      </g>
    </svg>
  );
}}
"""
open(OUT, 'w').write(src)
print(f'{len(cleaned)} strokes -> {len(pieces)} pieces, viewBox {x0:.0f} {y0:.0f} {x1 - x0:.0f} {y1 - y0:.0f}')

if debug_path:
    from PIL import ImageDraw
    W, H = int(x1 - x0) + 20, int(y1 - y0) + 20
    img = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(img)
    for q in px:
        d.point((q[0] - x0 + 10, q[1] - y0 + 10), fill=(190, 190, 190))
    for p in cleaned:
        d.line([(x - x0 + 10, y - y0 + 10) for x, y in p[:, :2]], fill=(30, 30, 30), width=4)
    img.save(debug_path)
