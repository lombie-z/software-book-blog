import Image from 'next/image';
import { SITE_URL, cn } from '@/lib/utils';

type FrameProps = { type?: string | null; image?: string | null; title: string; date: string };

const shade = (a: number) => `oklch(0.24 0.012 60 / ${a})`;
// A crisp edge and a lit top, plus whatever lift the parent sets in --lift (it rises on hover).
const EDGE = `0 0 0 1px ${shade(0.06)}, inset 0 1px 0 oklch(1 0 0 / 0.7), var(--lift, 0 0 #0000)`;

/** Shadow the frame casts on the plaster, resting nearly flush and raised on hover. Set on the hover target. */
export const LIFT = { rest: `0 1px 2px ${shade(0.1)}, 0 3px 8px -4px ${shade(0.14)}`, raised: `0 2px 4px ${shade(0.06)}, 0 20px 30px -16px ${shade(0.34)}` };

function Media({ image, title, className }: { image?: string | null; title: string; className?: string }) {
  return (
    <div className={cn('relative overflow-hidden bg-plaster-shade', className)}>
      {image && <Image src={image} alt={title} fill sizes='(max-width: 640px) 100vw, 24rem' className='object-cover' />}
    </div>
  );
}

// Browser window: the title sits in the address bar.
function SiteFrame({ image, title }: FrameProps) {
  const host = SITE_URL.replace(/^https?:\/\/(www\.)?/, '');
  return (
    <div className='flex h-full flex-col overflow-hidden rounded-lg bg-plaster transition-shadow duration-300' style={{ boxShadow: EDGE }}>
      <div className='flex items-center gap-3 px-3 py-2'>
        <span className='flex gap-1' aria-hidden='true'>
          {[0, 1, 2].map((i) => (
            <span key={i} className='size-2 rounded-full bg-rule' />
          ))}
        </span>
        <span className='min-w-0 flex-1 truncate rounded-md bg-plaster-shade px-2.5 py-1 text-[0.7rem] text-muted-foreground'>
          {host}/ <span className='text-ink'>{title}</span>
        </span>
      </div>
      <Media image={image} title={title} className='aspect-[16/10] grow' />
    </div>
  );
}

// Everything else is a print on a mat, crop marks off each corner, handwritten title along the bottom with the date.
function MatFrame({ image, title, date }: FrameProps) {
  const marks = [
    'top-0 -left-3 h-px w-2',
    '-top-3 left-0 h-2 w-px',
    'top-0 -right-3 h-px w-2',
    '-top-3 right-0 h-2 w-px',
    'bottom-0 -left-3 h-px w-2',
    '-bottom-3 left-0 h-2 w-px',
    'bottom-0 -right-3 h-px w-2',
    '-bottom-3 right-0 h-2 w-px',
  ];
  return (
    <div className='relative rounded-[2px] bg-plaster p-7 pb-12 transition-shadow duration-300' style={{ boxShadow: EDGE }}>
      <div className='relative'>
        {marks.map((m) => (
          <span key={m} className={cn('absolute bg-muted-foreground/60', m)} aria-hidden='true' />
        ))}
        <Media image={image} title={title} className='aspect-[4/3]' />
      </div>
      <div className='absolute inset-x-4 bottom-2 flex items-baseline gap-2.5'>
        <span className='truncate font-script text-xl leading-none text-ink'>{title}</span>
        {date && <span className='shrink-0 text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground tabular-nums'>{date}</span>}
      </div>
    </div>
  );
}

export function ConceptFrame(props: FrameProps) {
  return props.type === 'site' ? <SiteFrame {...props} /> : <MatFrame {...props} />;
}
