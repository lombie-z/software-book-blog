'use client';

import { useId, useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { useLayout } from '@/components/layout/layout-context';
import { Niche } from '@/components/three/niche';
import { Signature } from '@/components/ui/signature';
import type { PageBlocksInlayHero } from '@/tina/__generated__/types';
import { cn } from '@/lib/utils';

// Niche proportions (width / height) taken from the sketch: tall, short, mid.
// The top niche's ceiling slopes down to the left (slope = fraction of its height), leaving room for the signature.
const NICHES = [
  { id: 'top', aspect: 'aspect-[4/3]', slope: 0.34 },
  { id: 'middle', aspect: 'aspect-[2/1]', slope: 0 },
  { id: 'bottom', aspect: 'aspect-[16/9]', slope: 0 },
] as const;

const GROOVE_WIDTH = 6.5;
// How each line carries on under its text, heading across beneath the letters. In pixels, from the end of the run beside
// the text. The loop crosses itself and ends in a small flick, like the signature's pen.
const ENDINGS = {
  loop: 'M0 0C-2.6 44 12.8 70 38.8 66C66.8 62 70.8 24 46.8 20C24.8 16 18.8 54 36.8 80C46.8 94 60.8 98 66.8 88',
  flick: 'M0 0C3 44 0 70 -16 80C-26 86 -38 80 -42 66',
};
// The run beside the text wavers like a pen rather than ruling straight: x in pixels, y as a percentage of the text's height.
const RUNS = {
  loop: 'M2.5 0.5C-5 30 8 62 0 100',
  flick: 'M-2.5 0.5C5 30 -8 62 0 100',
};
// Above the run, in pixels from its top. The hero's layout is fixed from the md breakpoint up, where these lines show: the
// left line rises towards the end of the signature's tail, along the tail's own direction, and the right one hooks
// inward, so at the top of the page they imply one line. The gap at the tail leaves the left line free to drift.
const LEADS = {
  loop: 'M2.5 1.8C5 -32 14 -66 34 -68C42 -68.8 48 -63.5 54.85 -58.8',
  flick: 'M-2.5 3.2C-4 -14 -12 -26 -28 -28',
};

/**
 * One line carved like the etched signature, lit from the top left, beside the text and on under it. Wider and softer
 * than the signature's numbers, which read thin and tight on a long straight line. The run beside the text is as tall
 * as the text, and the filter treats the whole line as one shape.
 */
function CarvedLine({ line }: { line: keyof typeof ENDINGS }) {
  const filterId = `groove-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const x = GROOVE_WIDTH / 2;
  return (
    <svg className='shrink-0 self-stretch overflow-visible' width={GROOVE_WIDTH}>
      <defs>
        <filter id={filterId} x='-15%' y='-2%' width='130%' height='104%' colorInterpolationFilters='sRGB'>
          <feOffset in='SourceAlpha' dx={1.4} dy={1.4} result='down' />
          <feGaussianBlur in='down' stdDeviation={0.7} result='downSoft' />
          <feComposite in='SourceAlpha' in2='downSoft' operator='out' result='upperWall' />
          <feFlood floodColor='#3b322b' floodOpacity='0.7' />
          <feComposite in2='upperWall' operator='in' result='shade' />
          <feOffset in='SourceAlpha' dx={-1.1} dy={-1.1} result='up' />
          <feGaussianBlur in='up' stdDeviation={0.7} result='upSoft' />
          <feComposite in='SourceAlpha' in2='upSoft' operator='out' result='lowerWall' />
          <feFlood floodColor='#ffffff' floodOpacity='0.9' />
          <feComposite in2='lowerWall' operator='in' result='light' />
          <feMerge>
            <feMergeNode in='SourceGraphic' />
            <feMergeNode in='shade' />
            <feMergeNode in='light' />
          </feMerge>
        </filter>
      </defs>
      <g fill='none' stroke='var(--plaster-shade)' strokeWidth={GROOVE_WIDTH} strokeLinecap='round' strokeLinejoin='round' filter={`url(#${filterId})`}>
        <svg x={x} overflow='visible'>
          <path d={LEADS[line]} />
        </svg>
        {/* The run stretches to the text's height while the stroke keeps its width. */}
        <svg x={x} width={GROOVE_WIDTH} height='100%' viewBox={`0 0 ${GROOVE_WIDTH} 100`} preserveAspectRatio='none' overflow='visible'>
          <path d={RUNS[line]} vectorEffect='non-scaling-stroke' />
        </svg>
        {/* A nested svg anchors the ending to the end of the run, however tall the text is. */}
        <svg x={x} y='100%' overflow='visible'>
          <path d={ENDINGS[line]} />
        </svg>
      </g>
    </svg>
  );
}

function SideText({ text, className, line, y }: { text?: string | null; className?: string; line: keyof typeof ENDINGS; y: MotionValue<number> }) {
  if (!text) return null;
  return (
    // Its own layer, so drifting doesn't redraw the carved line's filter.
    <motion.div style={{ y }} className={cn('pointer-events-none absolute hidden items-start gap-3 will-change-transform md:flex', className)} aria-hidden='true'>
      <span className='text-[0.8rem] font-medium uppercase leading-[1.55] tracking-[0.3em] text-ink [text-orientation:upright] [writing-mode:vertical-rl]'>
        {text}
      </span>
      <CarvedLine line={line} />
    </motion.div>
  );
}

export function InlayHero({ data }: { data: PageBlocksInlayHero }) {
  const { globalSettings } = useLayout();
  const site = globalSettings?.site;
  const ref = useRef<HTMLElement>(null);
  // Side texts drift at different rates to the niches as the hero scrolls past.
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const drift = useReducedMotion() ? 0 : 1;
  const leftY = useTransform(scrollYProgress, [0, 1], [0, 260 * drift]);
  const rightY = useTransform(scrollYProgress, [0, 1], [0, -180 * drift]);

  return (
    <section ref={ref} className='relative mx-auto w-full max-w-[min(560px,78vw)] pt-10 md:pt-16' aria-label='Intro'>
      <h1 className='sr-only'>{site?.name}</h1>
      <Signature variant='etched' className='relative z-10 mb-[calc(min(560px,78vw)*-0.05)] ml-[-3%] w-[min(260px,56vw)] text-ink' />

      <SideText text={site?.name} y={leftY} line='loop' className='-left-24 top-[280px] flex-row-reverse' />
      <SideText text={site?.tagline} y={rightY} line='flick' className='-right-24 top-[44%]' />

      <div className='flex flex-col gap-10 md:gap-14'>
        {NICHES.map((niche) => (
          <Niche key={niche.id} id={niche.id} aspect={niche.aspect} slope={niche.slope} cactus={niche.id === 'bottom' && !!data.showCactus} />
        ))}
      </div>
      {/* The vertical side texts need gutters; on phones they sit under the niches instead. */}
      <p className='mt-8 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[0.7rem] uppercase tracking-[0.24em] text-ink md:hidden' aria-hidden='true'>
        <span>{site?.name}</span>
        <span className='text-muted-foreground'>{site?.tagline}</span>
      </p>
    </section>
  );
}
