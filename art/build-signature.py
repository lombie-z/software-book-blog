"""Build components/ui/signature.tsx from the traced sketch, in the stroke order and rhythm of a pen take.

Shapes: centre lines skeletonised from the paper sketch (art/signature/sketch-clean.png).
Order and rhythm: a take drawn at /dev/signature (art/signature/take-*.json).

Each pen stroke is a list of waypoints (fragment ends, loop tops, peaks) in the order the take was written.
Waypoints on the same traced fragment follow it exactly (so loops stay loops); hops between fragments take the
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
from scipy import ndimage
from scipy.ndimage import gaussian_filter1d
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra
from scipy.spatial import cKDTree
from skimage.morphology import disk, remove_small_objects, skeletonize

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'components', 'ui', 'signature.tsx')
SKETCH = os.path.join(HERE, 'signature', 'sketch-clean.png')
TRACE = os.path.join(HERE, 'signature', 'trace.json')  # named fragments, used to place waypoints
# Trace fragments that are the inlay box's edge from the sketch, not the signature.
NOT_SIGNATURE = [6, 7, 10, 13, 19, 24, 25]
TOTAL_SECONDS = 3.2
SEGMENTS_PER_SECOND = 18  # pieces each stroke is cut into so the replay keeps the hand's speed changes

# Pen strokes in the take's order. (fragment, where): 's' start, 'e' end, or a fraction along the fragment.
STROKES = [
    # Lead-in, I (top loop, stem, bottom loop), w, r, l loop, final loop, then the underline swash back to the left.
    [(1, 's'), (1, 'e'), (9, 's'), (9, 0.5), (9, 'e'), (4, 'e'), (4, 0.5), (4, 0.2), (4, 's'), (8, 's'), (8, 'e'),
     (11, 's'), (11, 'e'), (12, 'e'), (12, 's'), (14, 'e'), (14, 0.5), (14, 's'), (16, 's'), (16, 'e'), (17, 'e'),
     (17, 's'), (18, 's'), (18, 'e'), (23, 'e'), (23, 's'), (21, 's'), (21, 'e'), (22, 's'), (22, 0.33), (22, 0.66),
     (22, 'e'), (0, 'e'), (0, 0.5), (0, 's')],
    [(3, 's'), (3, 0.5), (3, 'e'), (5, 's'), (5, 'e')],  # little circle before the I
    [(20, 's'), (20, 0.33), (20, 0.66), (20, 'e')],  # dot above the r
    [(2, 's'), (2, 'e')],  # overline, right to left
    [(15, 's'), (15, 'e')],  # its flag, right to left
]

take_path = sys.argv[1] if len(sys.argv) > 1 else sorted(glob.glob(os.path.join(HERE, 'signature', 'take-*.json')))[-1]
debug_path = sys.argv[2] if len(sys.argv) > 2 else None
take = json.load(open(take_path))
fragments = json.load(open(TRACE))['strokes']
width = json.load(open(TRACE))['width']  # median ink thickness of the sketch, in px
assert len(take['strokes']) == len(STROKES), f"take has {len(take['strokes'])} strokes, STROKES lists {len(STROKES)}"

# Skeleton of the sketch, without the box edge.
ink = np.array(Image.open(SKETCH).convert('L')) < 128
ink = ndimage.binary_closing(ink, structure=disk(2))
ink = remove_small_objects(ink, 60)
skel = skeletonize(ink)
box = np.array([p for i in NOT_SIGNATURE for p in fragments[i]], float)
ys, xs = np.nonzero(skel)
px = np.column_stack([xs, ys]).astype(float)
near_box = cKDTree(box).query(px)[0] < 3
px = px[~near_box]

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


def waypoint(frag, where):
    """Index into a fragment's points."""
    n = len(fragments[frag])
    return 0 if where == 's' else n - 1 if where == 'e' else int(where * (n - 1))


def follow(frag, i, j):
    """Along one traced fragment, in either direction (keeps loops intact)."""
    f = np.array(fragments[frag], float)
    return list(f[i : j + 1]) if i <= j else list(f[j : i + 1][::-1])


def route(a, b):
    """Shortest path along the ink between two points on different fragments (bridges junctions, retraces)."""
    a, b = int(pixel_tree.query(a)[1]), int(pixel_tree.query(b)[1])
    dist, pred = dijkstra(graph, indices=a, return_predecessors=True)
    if not np.isfinite(dist[b]):
        return [px[a], px[b]]  # no ink between them: straight hop
    path = [b]
    while path[-1] != a:
        path.append(pred[path[-1]])
    return [px[i] for i in reversed(path)]


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
    p = rdp(p, 0.6)
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
    stops = [(f, waypoint(f, w)) for f, w in spec]
    path = [np.array(fragments[stops[0][0]][stops[0][1]], float)]
    for (fa, ia), (fb, ib) in zip(stops[:-1], stops[1:]):
        if fa == fb:
            path += follow(fa, ia, ib)[1:]
        else:
            path += route(fragments[fa][ia], fragments[fb][ib])[1:]
    path = resample(np.array(path))
    if len(path) > 7:
        path[:, 0] = gaussian_filter1d(path[:, 0], 1.8, mode='nearest')
        path[:, 1] = gaussian_filter1d(path[:, 1], 1.8, mode='nearest')
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
