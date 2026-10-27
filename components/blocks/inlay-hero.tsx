'use client';

import type { Template } from 'tinacms';
import { useLayout } from '@/components/layout/layout-context';
import { Signature } from '@/components/ui/signature';
import type { PageBlocksInlayHero } from '@/tina/__generated__/types';
import { cn } from '@/lib/utils';

// Niche proportions (width / height) taken from the sketch: tall, short, mid.
const NICHES = [
  { id: 'top', aspect: 'aspect-[4/3]' },
  { id: 'middle', aspect: 'aspect-[2/1]' },
  { id: 'bottom', aspect: 'aspect-[16/9]' },
] as const;

function SideText({ text, className }: { text?: string | null; className?: string }) {
  if (!text) return null;
  return (
    <div className={cn('pointer-events-none absolute hidden items-start gap-3 md:flex', className)} aria-hidden="true">
      <span className="text-[0.8rem] font-medium uppercase leading-[1.55] tracking-[0.3em] text-ink [text-orientation:upright] [writing-mode:vertical-rl]">
        {text}
      </span>
      <span className="w-px self-stretch bg-ink/70" />
    </div>
  );
}

export function InlayHero({ data }: { data: PageBlocksInlayHero }) {
  const { globalSettings } = useLayout();
  const site = globalSettings?.site;

  return (
    <section className="relative mx-auto w-full max-w-[min(560px,78vw)] pt-10 md:pt-16" aria-label="Intro">
      <h1 className="sr-only">{site?.name}</h1>
      <Signature className="relative z-10 -mb-8 ml-[-6%] w-[min(300px,60vw)] text-ink" />

      <SideText text={site?.name} className="-left-24 top-32 h-[46%] flex-row-reverse" />
      <SideText text={site?.tagline} className="-right-24 top-[44%] h-[54%]" />

      <div className="flex flex-col gap-10 md:gap-14">
        {NICHES.map((niche) => (
          <div
            key={niche.id}
            data-niche={niche.id}
            className={cn(
              niche.aspect,
              'relative w-full bg-plaster-shade',
              // CSS stand-in for the lit recess; the WebGL niche draws over this box.
              'shadow-[inset_18px_22px_28px_-6px_oklch(0.55_0.02_70/0.55),inset_-2px_-2px_0_oklch(1_0_0/0.6)]'
            )}
          />
        ))}
      </div>
      <p className="sr-only">{data.showCactus ? 'A small potted cactus sits in the lowest niche.' : ''}</p>
    </section>
  );
}

export const inlayHeroBlockSchema: Template = {
  name: 'inlayHero',
  label: 'Inlay Hero',
  ui: {
    defaultItem: { showCactus: true },
  },
  fields: [
    {
      type: 'boolean',
      label: 'Show cactus',
      name: 'showCactus',
      description: 'The clay cactus in the lowest niche.',
    },
  ],
};
