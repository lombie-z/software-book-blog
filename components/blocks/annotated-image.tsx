'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'motion/react';
import type { Template } from 'tinacms';

type Mark = 'circle' | 'arrow' | 'underline';
type Side = 'left' | 'right' | 'top' | 'bottom';
export type Note = { text?: string | null; x?: number | null; y?: number | null; mark?: string | null; side?: string | null; size?: number | null };
export type AnnotatedImageData = {
  src?: string | null;
  alt?: string | null;
  caption?: string | null;
  aspect?: string | null;
  marker?: string | null;
  notes?: (Note | null)[] | null;
};

// Felt-tip colours, each with a halo that lifts the handwriting off a busy screenshot: red on light pages, yellow on dark.
const MARKERS = {
  red: { stroke: 'oklch(0.6 0.19 35)', halo: '0 0 2px var(--plaster), 0 0 4px var(--plaster), 0 0 6px var(--plaster)' },
  yellow: { stroke: 'oklch(0.9 0.16 98)', halo: '0 1px 2px oklch(0.2 0.02 20 / 0.55), 0 0 6px oklch(0.2 0.02 20 / 0.35)' },
};
const W = 1000;

// Small deterministic wobble so every mark looks hand drawn but renders the same on server and client.
const wobble = (i: number, t: number) => Math.sin(t * 3 + i * 1.7) * 0.05 + Math.sin(t * 7 + i) * 0.02;

// A loop that goes round a little more than once, like a quick marker circle.
function circlePath(cx: number, cy: number, r: number, i: number) {
  const start = -2.3 + i * 0.4;
  const steps = 56;
  let d = '';
  for (let s = 0; s <= steps; s++) {
    const t = start + (s / steps) * Math.PI * 2 * 1.12;
    const k = 1 + wobble(i, t) + (s / steps) * 0.08;
    d += `${s ? 'L' : 'M'}${(cx + Math.cos(t) * r * k).toFixed(1)} ${(cy + Math.sin(t) * r * 0.78 * k).toFixed(1)}`;
  }
  return d;
}

function underlinePath(cx: number, cy: number, r: number, i: number) {
  const y = cy + r * 0.45;
  const a = `M${cx - r} ${y} Q${cx} ${y + 8 + (i % 3)} ${cx + r} ${y - 4}`;
  const b = `M${cx - r * 0.85} ${y + 9} Q${cx} ${y + 14} ${cx + r * 0.9} ${y + 5}`;
  return `${a} ${b}`;
}

// A curved stroke from the label to the point, with an open arrowhead.
function arrowPath(fx: number, fy: number, tx: number, ty: number) {
  const mx = (fx + tx) / 2;
  const my = (fy + ty) / 2;
  const nx = -(ty - fy) * 0.25;
  const ny = (tx - fx) * 0.25;
  const cx = mx + nx;
  const cy = my + ny;
  const angle = Math.atan2(ty - cy, tx - cx);
  const head = (da: number) => `M${tx} ${ty} L${(tx - Math.cos(angle + da) * 22).toFixed(1)} ${(ty - Math.sin(angle + da) * 22).toFixed(1)}`;
  return `M${fx} ${fy} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${tx} ${ty} ${head(0.45)} ${head(-0.45)}`;
}

const LABEL_SHIFT: Record<Side, string> = {
  right: 'translate(0, -50%)',
  left: 'translate(-100%, -50%)',
  top: 'translate(-50%, -100%)',
  bottom: 'translate(-50%, 0)',
};

/** A screenshot with handwritten marker notes drawn over it: circles, arrows and underlines that draw themselves in. */
export function AnnotatedImage({ data }: { data: AnnotatedImageData }) {
  const still = useReducedMotion();
  if (!data.src) return null;
  const marker = MARKERS[data.marker === 'yellow' ? 'yellow' : 'red'];
  const [aw, ah] = (data.aspect || '16/10').split('/').map(Number);
  const H = (W * (ah || 10)) / (aw || 16);
  const notes = (data.notes ?? []).filter((n): n is Note => !!n && n.x != null && n.y != null);

  const marks = notes.map((n, i) => {
    const px = (n.x! / 100) * W;
    const py = (n.y! / 100) * H;
    const r = ((n.size || 14) / 100) * W * 0.5;
    const mark = (n.mark || 'circle') as Mark;
    const side = (n.side || 'right') as Side;
    // Arrows start well away from the point; circles and underlines keep their note just outside the mark.
    const gap = mark === 'arrow' ? 150 : r + 18;
    const lx = px + (side === 'right' ? gap : side === 'left' ? -gap : 0);
    const ly = py + (side === 'bottom' ? (mark === 'underline' ? r * 0.45 + 24 : gap) : side === 'top' ? -gap : 0);
    const d =
      mark === 'arrow'
        ? arrowPath(lx + (side === 'left' ? 8 : side === 'right' ? -8 : 0), ly + (side === 'top' ? 8 : side === 'bottom' ? -8 : 0), px, py)
        : mark === 'underline'
          ? underlinePath(px, py, r, i)
          : circlePath(px, py, r, i);
    return { n, i, d, lx, ly, side };
  });

  return (
    <figure className='not-prose relative left-1/2 my-12 w-[min(48rem,calc(100vw-3rem))] -translate-x-1/2'>
      <div
        className='relative overflow-hidden rounded-lg bg-plaster-shade shadow-[0_0_0_1px_oklch(0.24_0.012_60/0.06),0_18px_40px_-24px_oklch(0.24_0.012_60/0.45)]'
        style={{ aspectRatio: `${aw || 16} / ${ah || 10}` }}
      >
        <Image src={data.src} alt={data.alt || ''} fill sizes='(max-width: 820px) 100vw, 768px' className='object-cover' />
        <svg viewBox={`0 0 ${W} ${H}`} className='pointer-events-none absolute inset-0 size-full' aria-hidden='true'>
          {marks.map(({ d, i }) => (
            <motion.path
              key={i}
              d={d}
              fill='none'
              stroke={marker.stroke}
              strokeWidth={5}
              strokeLinecap='round'
              strokeLinejoin='round'
              initial={still ? false : { pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 0.92 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.7, delay: 0.3 + i * 0.35, ease: 'easeOut' }}
            />
          ))}
        </svg>
        {marks.map(({ n, i, lx, ly, side }) =>
          n.text ? (
            <motion.span
              key={i}
              className='pointer-events-none absolute max-w-[16ch] font-script text-base leading-none sm:text-2xl'
              style={{
                left: `${(lx / W) * 100}%`,
                top: `${(ly / H) * 100}%`,
                transform: `${LABEL_SHIFT[side]} rotate(-2deg)`,
                color: marker.stroke,
                textShadow: marker.halo,
              }}
              initial={still ? false : { opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.4, delay: 0.7 + i * 0.35 }}
            >
              {n.text}
            </motion.span>
          ) : null
        )}
      </div>
      {data.caption && <figcaption className='mt-3 text-center text-sm text-muted-foreground'>{data.caption}</figcaption>}
    </figure>
  );
}

export const annotatedImageSchema: Template = {
  name: 'AnnotatedImage',
  label: 'Annotated screenshot',
  fields: [
    { type: 'image', name: 'src', label: 'Image' },
    { type: 'string', name: 'alt', label: 'Alt text' },
    { type: 'string', name: 'caption', label: 'Caption' },
    { type: 'string', name: 'aspect', label: 'Aspect ratio', description: 'Width/height of the image, e.g. 16/10 for a 1440×900 screenshot.' },
    {
      type: 'string',
      name: 'marker',
      label: 'Marker colour',
      description: 'Red reads best on light screenshots, yellow on dark ones.',
      options: ['red', 'yellow'],
    },
    {
      type: 'object',
      name: 'notes',
      label: 'Notes',
      list: true,
      ui: { itemProps: (item: Note) => ({ label: item?.text || 'Note' }) },
      fields: [
        { type: 'string', name: 'text', label: 'Text' },
        { type: 'number', name: 'x', label: 'X (% from left)' },
        { type: 'number', name: 'y', label: 'Y (% from top)' },
        { type: 'string', name: 'mark', label: 'Mark', options: ['circle', 'arrow', 'underline'] },
        { type: 'string', name: 'side', label: 'Note goes', options: ['right', 'left', 'top', 'bottom'] },
        { type: 'number', name: 'size', label: 'Size (% of width)', description: 'How big the circle or underline is. Defaults to 14.' },
      ],
    },
  ],
};
