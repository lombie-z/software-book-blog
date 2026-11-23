"""Build components/ui/signature.tsx from the traced sketch, in the stroke order of a pen take.

Shapes: centre lines skeletonised from the paper sketch (art/signature/sketch-clean.png, see trace-sketch.py).
Order: a take drawn at /dev/signature (art/signature/take-*.json).
Pace: worked out from the shape itself, the way a hand moves: slow through tight turns, quick along the open runs,
never changing speed in an instant. (The take's own timing can't be laid over the sketch: the two shapes differ, so
its slow corners land on the sketch's straights.)

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
from scipy.ndimage import gaussian_filter1d
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra
from scipy.spatial import cKDTree
from skimage.morphology import skeletonize

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'components', 'ui', 'signature.tsx')
SKETCH = os.path.join(HERE, 'signature', 'sketch-clean.png')
TRACE = os.path.join(HERE, 'signature', 'trace.json')  # from trace-sketch.py; only its ink thickness is used here
TOTAL_SECONDS = 3.2
# Pace. Speed is proportional to (radius of the curve) ^ POWER. A real hand sits near 1/3 (the two-thirds power law);
# higher exaggerates it, so the open runs fly and the turns hold back.
POWER = 0.46
STRAIGHT_RADIUS = 520  # px; anything gentler than this counts as straight, which caps the top speed
MOMENTUM_MS = 32  # the pen can't change speed in an instant: its speed is smoothed over about this long
ATTACK = (0.09, 0.25)  # each stroke starts from near rest: (seconds to get up to speed, starting fraction of speed)
RELEASE = (0.07, 0.55)  # and eases off before the pen lifts, less so: (seconds, final fraction of speed)
PEN_LIFT = (0.07, 5200)  # between strokes: seconds to lift and land, plus the gap crossed at this many px a second
SMOOTHING = 2.4   # px of wobble the spline may smooth away; higher = smoother, softer
CUSP_DEGREES = 100  # direction changes sharper than this (the peaks, retraces) stay sharp
# The "hat" (overline and flag, the last two strokes) sits closer to the letters than in the sketch: (dx, dy) px.
HAT_OFFSET = (-55, 48)
HAT_STROKES = (3, 4)

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


def pace(path):
    """Speed at each sample of a stroke, from how tightly it turns there (unscaled)."""
    k = 3
    d = path[k:] - path[:-k]
    heading = np.unwrap(np.arctan2(d[:, 1], d[:, 0]))
    spacing = np.linalg.norm(np.diff(path, axis=0), axis=1).mean()
    turn = np.abs(np.diff(heading)) / spacing  # radians per px, between samples i and i + k + 1
    curvature = np.interp(np.arange(len(path)), np.arange(len(turn)) + (k + 1) / 2, turn)
    curvature = gaussian_filter1d(curvature, 2, mode='nearest')
    return (curvature + 1 / STRAIGHT_RADIUS) ** -POWER


def ease(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


# Route each stroke through its waypoints and smooth it.
cleaned = []
for spec in STROKES:
    path = [px[int(pixel_tree.query(spec[0])[1])]]
    for a, b in zip(spec[:-1], spec[1:]):
        path += route(a, b)[1:]
    path = resample(smooth(resample(np.array(path))))
    if len(cleaned) in HAT_STROKES:
        path = path + np.array(HAT_OFFSET)
    cleaned.append(path)

# Time each stroke by its shape, then scale the lot (pen lifts aside) to TOTAL_SECONDS.
speeds = [pace(p) for p in cleaned]
unscaled = []  # time at each sample, before scaling
for p, v in zip(cleaned, speeds):
    seg = np.linalg.norm(np.diff(p, axis=0), axis=1)
    unscaled.append(np.concatenate([[0], np.cumsum(seg / ((v[:-1] + v[1:]) / 2))]))
lifts = [PEN_LIFT[0] + np.linalg.norm(b[0] - a[-1]) / PEN_LIFT[1] for a, b in zip(cleaned[:-1], cleaned[1:])]
scale = (TOTAL_SECONDS - sum(lifts)) / sum(u[-1] for u in unscaled)

strokes = []  # (path, start s, duration s, linear() easing)
timed = []  # per stroke: (seconds, x, y) every millisecond, for the debug image
start = 0.0
for i, (p, v, u) in enumerate(zip(cleaned, speeds, unscaled)):
    duration = u[-1] * scale
    t = np.linspace(0, duration, max(2, int(duration * 1000)))
    speed = np.interp(t, u * scale, v)
    speed *= ATTACK[1] + (1 - ATTACK[1]) * ease(t / ATTACK[0])
    speed *= RELEASE[1] + (1 - RELEASE[1]) * ease((duration - t) / RELEASE[0])
    speed = gaussian_filter1d(speed, MOMENTUM_MS / (t[1] * 1000), mode='nearest')
    done = np.concatenate([[0], np.cumsum((speed[:-1] + speed[1:]) / 2)])
    done /= done[-1]  # fraction of the stroke written at each millisecond
    length = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(p, axis=0), axis=1))])
    timed.append(np.column_stack([start + t, *(np.interp(done * length[-1], length, p[:, k]) for k in (0, 1))]))
    # As a CSS linear() easing: the fewest stops that keep the pen within about a pixel of where it should be.
    stops = rdp(np.column_stack([t / duration, done]), min(0.002, 1.0 / length[-1]))
    assert np.all(np.diff(stops, axis=0) >= 0), 'the pen only moves forward, in time and along the stroke'
    easing = ', '.join(['0'] + [f'{y:.4f}'.lstrip('0') + f' {x * 100:.2f}%' for x, y in stops[1:-1]] + ['1'])
    strokes.append((to_path(p), round(start, 3), round(duration, 3), f'linear({easing})'))
    print(f'stroke {i}: {length[-1]:5.0f}px in {duration:.2f}s from {start:.2f}s, {len(stops)} stops')
    start += duration + (lifts[i] if i < len(lifts) else 0)

all_xy = np.vstack(cleaned)
pad = 14
x0, y0 = all_xy.min(0) - pad
x1, y1 = all_xy.max(0) + pad
stroke_width = round(width * 1.2, 1)  # trace 'width' is the sketch's ink thickness; a touch heavier reads better small

rows = '\n'.join(f"  ['{d}', {s}, {dur}, '{pace_css}']," for d, s, dur, pace_css in strokes)
groove = stroke_width * 1.7
src = f"""'use client';
import {{ useId }} from 'react';
import {{ cn }} from '@/lib/utils';

// Generated by art/build-signature.py from the traced sketch (shapes) and {os.path.basename(take_path)}
// (stroke order). One path per pen stroke: [path, start (s), duration (s), pace]. The pace is how far along the
// stroke the pen is at each moment, worked out from the shape: slow through the turns, quick along the open runs.
const STROKES: [string, number, number, string][] = [
{rows}
];

const INK_WIDTH = {stroke_width};
// Etched: a wider groove, so its walls have room to catch the light.
const GROOVE_WIDTH = {round(groove, 1)};
const WALL = {round(groove * 0.24, 2)};
// 0.7px at the hero's 260px width, matching the carved side lines.
const SOFTEN = {round(0.7 * round(x1 - x0) / 260, 2)};
// Seconds after first paint before the pen touches down.
const WRITE_DELAY = 0.3;

interface SignatureProps {{
  className?: string;
  /** Write the signature out stroke by stroke (~{TOTAL_SECONDS}s), from first paint. */
  animate?: boolean;
  /** 'ink' draws a pen line; 'etched' carves it into the plaster, lit from the top left like the niches. */
  variant?: 'ink' | 'etched';
  /** Etched only: scales the groove and its walls. Small signatures need a relatively deeper cut to read as carved. */
  depth?: number;
}}

export function Signature({{ className, animate = true, variant = 'ink', depth = 1 }}: SignatureProps) {{
  const filterId = `etch-${{useId().replace(/[^a-zA-Z0-9]/g, '')}}`;
  const etched = variant === 'etched';
  // Pure CSS: the strokes start hidden and write from first paint, before any JavaScript runs, so there's no
  // flash of the finished signature. Reduced motion shows it fully drawn (styles.css).
  const writing = animate;

  return (
    <svg viewBox="{x0:.0f} {y0:.0f} {x1 - x0:.0f} {y1 - y0:.0f}" role="img" aria-label="Isaac's signature" className={{cn('h-auto overflow-visible', className)}}>
      {{etched && (
        <defs>
          <filter id={{filterId}} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
            {{/* Top-left inner wall in shadow: the groove minus itself shifted down-right. */}}
            <feOffset in="SourceAlpha" dx={{WALL * depth}} dy={{WALL * depth}} result="down" />
            <feGaussianBlur in="down" stdDeviation={{SOFTEN * depth}} result="downSoft" />
            <feComposite in="SourceAlpha" in2="downSoft" operator="out" result="upperWall" />
            <feFlood floodColor="#3b322b" floodOpacity="0.7" />
            <feComposite in2="upperWall" operator="in" result="shade" />
            {{/* Bottom-right inner wall faces the sun. */}}
            <feOffset in="SourceAlpha" dx={{-WALL * depth}} dy={{-WALL * depth}} result="up" />
            <feGaussianBlur in="up" stdDeviation={{SOFTEN * depth}} result="upSoft" />
            <feComposite in="SourceAlpha" in2="upSoft" operator="out" result="lowerWall" />
            <feFlood floodColor="#ffffff" floodOpacity="0.9" />
            <feComposite in2="lowerWall" operator="in" result="light" />
            <feMerge>
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="shade" />
              <feMergeNode in="light" />
            </feMerge>
          </filter>
        </defs>
      )}}
      <g
        fill="none"
        stroke={{etched ? 'var(--plaster-shade)' : 'currentColor'}}
        strokeWidth={{etched ? GROOVE_WIDTH * depth : INK_WIDTH}}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={{etched ? `url(#${{filterId}})` : undefined}}
      >
        {{STROKES.map(([d, start, duration, pace]) => (
          <path
            key={{d}}
            d={{d}}
            pathLength={{1}}
            className={{writing ? 'signature-stroke' : undefined}}
            style={{
              writing
                ? // Browsers without linear() easing drop the pace and keep the stylesheet's plain ease.
                  {{ animationDelay: `${{start + WRITE_DELAY}}s`, animationDuration: `${{duration}}s`, animationTimingFunction: pace }}
                : undefined
            }}
          />
        ))}}
      </g>
    </svg>
  );
}}
"""
open(OUT, 'w').write(src)
print(f'{len(strokes)} strokes, viewBox {x0:.0f} {y0:.0f} {x1 - x0:.0f} {y1 - y0:.0f}')

if debug_path:
    # The ink in grey, with the pen's position every 60th of a second: wide gaps are fast, bunched dots are slow.
    from PIL import ImageDraw
    W, H = int(x1 - x0) + 20, int(y1 - y0) + 20
    img = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(img)
    for p in cleaned:
        d.line([(x - x0 + 10, y - y0 + 10) for x, y in p], fill=(205, 205, 205), width=4)
    for pen in timed:
        frames = np.arange(pen[0, 0], pen[-1, 0], 1 / 60)
        for x, y in zip(np.interp(frames, pen[:, 0], pen[:, 1]), np.interp(frames, pen[:, 0], pen[:, 2])):
            d.ellipse((x - x0 + 7, y - y0 + 7, x - x0 + 13, y - y0 + 13), fill=(200, 40, 40))
    img.save(debug_path)
