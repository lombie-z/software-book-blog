'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { eyeFor, GROUND_FACTOR, NICHE_DEPTH, PLASTER_HEX, SKY, SKY_RGB, SUN, SUN_DIRECTION, SUN_RGB } from './niche-params';

// An SVG drawing of a niche from the same eye, walls, light and sun as its 3D room (plaster-niche.tsx), so the two
// crossfade without a visible change. Only the soft-shadow detail and the cactus arrive with the 3D.

type Vec3 = [number, number, number];
type Point = [number, number];

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const ALBEDO: Vec3 = [1, 3, 5].map((i) => toLinear(Number.parseInt(PLASTER_HEX.slice(i, i + 2), 16) / 255)) as Vec3;
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The colour three.js renders for this plaster under the hemisphere sky (and the sun, when lit). */
function shade(normal: Vec3, lit: boolean) {
  const up = 0.5 * normal[1] + 0.5;
  const hemi = GROUND_FACTOR + (1 - GROUND_FACTOR) * up;
  const sun = lit ? Math.max(0, dot(normal, SUN_DIRECTION)) * SUN : 0;
  const rgb = ALBEDO.map((a, i) => toSrgb(Math.min(1, (a * (SKY * SKY_RGB[i] * hemi + sun * SUN_RGB[i])) / Math.PI)));
  return `rgb(${rgb.map((c) => Math.round(c * 255)).join(' ')})`;
}

interface Geometry {
  width: number;
  height: number;
  surfaces: { key: string; quad: Point[]; dark: string; light: string; lit: Point[] | null }[];
  opening: Point[];
  blur: number;
}

function build(rect: DOMRect, slope: number): Geometry {
  const w = rect.width;
  const h = rect.height;
  const d = Math.min(w, h) * NICHE_DEPTH;
  const drop = h * slope;
  const eye = eyeFor(window.innerWidth, window.innerHeight);
  // Box-centred, y up, z out of the wall; the opening is at z = 0.
  const ex = eye.x - (rect.left + w / 2);
  const ey = -(eye.y - (rect.top + h / 2));
  const ez = eye.distance;
  const project = ([x, y, z]: Vec3): Point => {
    const t = ez / (ez - z);
    return [w / 2 + ex + (x - ex) * t, h / 2 - (ey + (y - ey) * t)];
  };

  const front: Vec3[] = [
    [-w / 2, -h / 2, 0],
    [w / 2, -h / 2, 0],
    [w / 2, h / 2, 0],
    [-w / 2, h / 2 - drop, 0],
  ];
  const back = front.map(([x, y]) => [x, y, -d] as Vec3);
  const [bl, br, tr, tl] = [0, 1, 2, 3];
  const ceilingLength = Math.hypot(w, drop);

  // Sunlight through the opening, carried back along the sun onto a surface plane (normal · X = c).
  const L = SUN_DIRECTION;
  const throughOpening = (normal: Vec3, c: number): Point[] =>
    front.map((p) => {
      const t = (dot(normal, p) - c) / dot(normal, L);
      return project([p[0] - L[0] * t, p[1] - L[1] * t, p[2] - L[2] * t]);
    });

  const surfaces: { key: string; corners: Vec3[]; normal: Vec3; plane: number }[] = [
    { key: 'back', corners: back, normal: [0, 0, 1], plane: -d },
    { key: 'floor', corners: [front[bl], front[br], back[br], back[bl]], normal: [0, 1, 0], plane: -h / 2 },
    { key: 'ceiling', corners: [front[tl], front[tr], back[tr], back[tl]], normal: [drop / ceilingLength, -w / ceilingLength, 0], plane: 0 },
    { key: 'left', corners: [front[bl], front[tl], back[tl], back[bl]], normal: [1, 0, 0], plane: -w / 2 },
    { key: 'right', corners: [front[br], front[tr], back[tr], back[br]], normal: [-1, 0, 0], plane: -w / 2 },
  ];

  return {
    width: w,
    height: h,
    opening: front.map(project),
    blur: d * 0.018,
    surfaces: surfaces.map(({ key, corners, normal, plane }) => {
      const faces = dot(normal, L) > 0;
      return {
        key,
        quad: corners.map(project),
        dark: shade(normal, false),
        light: shade(normal, true),
        lit: faces ? throughOpening(normal, plane) : null,
      };
    }),
  };
}

const points = (pts: Point[]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** Fills its (relatively positioned) parent. Redraws on scroll and resize while visible, like the 3D. */
export function NicheSketch({ slope = 0, active = true }: { slope?: number; active?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = ref.current?.parentElement;
        if (el) setGeometry(build(el.getBoundingClientRect(), slope));
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [slope, active]);

  return (
    <svg
      ref={ref}
      // Fades in when first drawn (just after the page becomes interactive) rather than snapping in.
      className={cn('absolute inset-0 h-full w-full transition-opacity duration-700 ease-out', !geometry && 'opacity-0')}
      viewBox={geometry ? `0 0 ${geometry.width} ${geometry.height}` : undefined} aria-hidden="true">
      {geometry && (
        <>
          <defs>
            <clipPath id={`${id}-opening`}>
              <polygon points={points(geometry.opening)} />
            </clipPath>
            {geometry.surfaces.map((s) => (
              <clipPath key={s.key} id={`${id}-${s.key}`}>
                <polygon points={points(s.quad)} />
              </clipPath>
            ))}
            <filter id={`${id}-soft`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation={geometry.blur} />
            </filter>
          </defs>
          <g clipPath={`url(#${id}-opening)`}>
            {geometry.surfaces.map((s) => (
              <g key={s.key} clipPath={`url(#${id}-${s.key})`}>
                {/* A little overdraw so neighbouring walls meet without hairline gaps. */}
                <polygon points={points(s.quad)} fill={s.dark} stroke={s.dark} strokeWidth={1} />
                {s.lit && <polygon points={points(s.lit)} fill={s.light} filter={`url(#${id}-soft)`} />}
              </g>
            ))}
          </g>
        </>
      )}
    </svg>
  );
}
