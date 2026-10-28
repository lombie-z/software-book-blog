'use client';

import { Suspense, useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { Cactus } from '@/components/three/cactus';
import { PlasterNiche } from '@/components/three/plaster-niche';
import { useLayout } from '@/components/layout/layout-context';
import { Signature } from '@/components/ui/signature';
import type { PageBlocksInlayHero } from '@/tina/__generated__/types';
import { cn } from '@/lib/utils';

// Keeps "MICRO・BIOME" on one line: word joiners stop a break either side of the middle dot.
const unbreakable = (text?: string | null) => text?.replace(/・/g, '\u2060・\u2060');

// Niche proportions (width / height) taken from the sketch: tall, short, mid.
// The top niche's ceiling slopes down to the left (slope = fraction of its height), leaving room for the signature.
const NICHES = [
  { id: 'top', aspect: 'aspect-[4/3]', slope: 0.34 },
  { id: 'middle', aspect: 'aspect-[2/1]', slope: 0 },
  { id: 'bottom', aspect: 'aspect-[16/9]', slope: 0 },
] as const;

function SideText({ text, className, y }: { text?: string | null; className?: string; y: MotionValue<number> }) {
  if (!text) return null;
  return (
    <motion.div style={{ y }} className={cn('pointer-events-none absolute hidden items-start gap-3 md:flex', className)} aria-hidden="true">
      <span className="text-[0.8rem] font-medium uppercase leading-[1.55] tracking-[0.3em] text-ink [text-orientation:upright] [writing-mode:vertical-rl]">
        {text}
      </span>
      <span className="w-px self-stretch bg-ink/70" />
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
    <section ref={ref} className="relative mx-auto w-full max-w-[min(560px,78vw)] pt-10 md:pt-16" aria-label="Intro">
      <h1 className="sr-only">{site?.name}</h1>
      <Signature variant="etched" className="relative z-10 mb-[calc(min(560px,78vw)*-0.05)] ml-[-3%] w-[min(260px,56vw)] text-ink" />

      <SideText text={site?.name} y={leftY} className="-left-24 top-32 h-[46%] flex-row-reverse" />
      <SideText text={site?.tagline} y={rightY} className="-right-24 top-[44%] h-[54%]" />

      <div className="flex flex-col gap-10 md:gap-14">
        {NICHES.map((niche) => (
          <div
            key={niche.id}
            data-niche={niche.id}
            style={niche.slope ? { clipPath: `polygon(0 ${niche.slope * 100}%, 100% 0, 100% 100%, 0 100%)` } : undefined}
            className={cn(
              niche.aspect,
              'relative w-full bg-plaster-shade',
              // CSS stand-in for the lit recess; the WebGL niche draws over this box.
              'shadow-[inset_18px_22px_28px_-6px_oklch(0.55_0.02_70/0.55),inset_-2px_-2px_0_oklch(1_0_0/0.6)]'
            )}
          >
            <PlasterNiche slope={niche.slope}>
              {niche.id === 'bottom' && data.showCactus && (
                <Suspense fallback={null}>
                  {/* Back-left of the floor, as in the sketch. */}
                  <Cactus position={[-0.5, 0, -0.16]} rotation-y={0.5} />
                </Suspense>
              )}
            </PlasterNiche>
          </div>
        ))}
      </div>
      {/* The vertical side texts need gutters; on phones they sit under the niches instead. */}
      <p className="mt-8 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[0.7rem] uppercase tracking-[0.24em] text-ink md:hidden" aria-hidden="true">
        <span>{site?.name}</span>
        <span className="text-muted-foreground">{unbreakable(site?.tagline)}</span>
      </p>
    </section>
  );
}
