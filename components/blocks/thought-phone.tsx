'use client';

import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { useLayout } from '@/components/layout/layout-context';
import { cn } from '@/lib/utils';

/** Who writes what: my photo for my thoughts, the clay robot (art/robot.blend) for AIsaac's. */
export const AVATARS = { isaac: '/images/isaac-grey.webp', aisaac: '/images/ai-robot.webp' };

/** My first name from the site settings, as it heads my phone and my posts. */
export function useFirstName() {
  const { globalSettings } = useLayout();
  return (globalSettings?.site?.name ?? '')
    .split(' ')[0]
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

export type ThoughtItem = { id: string; href: string; title: string; excerpt: string; date?: string | null };

/** How many of the newest thoughts arrive as fresh messages when the phone comes into view. */
const ARRIVING = 3;
const BUBBLE = 'oklch(0.915 0.012 78)';
const shade = (a: number) => `oklch(0.24 0.012 60 / ${a})`;

// Client clock, so relative stamps only appear after hydration (the server can't know the reader's day or zone).
function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  return now;
}

// Message-app stamps: "Today 4:30 pm", "Yesterday …", "Thursday …", "Thu 16 Jul, …", then the year once it's not this one.
function messageStamp(value: string | null | undefined, now: Date | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  // UTC until hydrated so server and browser agree.
  if (!now) return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const time = date.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Yesterday ${time}`;
  if (days > 1 && days < 7) return `${date.toLocaleDateString('en-GB', { weekday: 'long' })} ${time}`;
  const sameYear = date.getFullYear() === now.getFullYear();
  const day = date.toLocaleDateString(
    'en-GB',
    sameYear ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }
  );
  return `${day}, ${time}`;
}

function Tail() {
  return (
    <svg viewBox='0 0 10 14' className='absolute bottom-0 -left-1.5 h-3 w-2' style={{ fill: BUBBLE }} aria-hidden='true'>
      <path d='M10 0 C10 7 7 12 0 14 L10 14 Z' />
    </svg>
  );
}

// A thought reads as a message: the title becomes its opening sentence, no heading.
function Bubble({ item, now, fresh }: { item: ThoughtItem; now: Date | null; fresh: boolean }) {
  const title = item.title.trim();
  const lead = /[.!?…]$/.test(title) ? title : `${title}.`;
  return (
    <motion.li
      className='pt-3'
      initial={fresh ? { opacity: 0, y: 10, scale: 0.85 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      style={{ transformOrigin: 'bottom left' }}
    >
      <time dateTime={item.date ?? undefined} className='block text-center text-[0.6rem] text-muted-foreground tabular-nums'>
        {messageStamp(item.date, now)}
      </time>
      <Link
        href={item.href}
        className='group relative mt-1.5 block w-fit max-w-[84%] rounded-[1.1rem] rounded-bl-none px-3 py-2 text-ink'
        style={{ background: BUBBLE }}
      >
        <Tail />
        <p className='line-clamp-5 text-[0.8rem] leading-snug'>
          <span className='font-medium'>{lead}</span> {item.excerpt}
        </p>
        <span className='mt-1 block text-[0.65rem] text-muted-foreground transition-colors group-hover:text-ink'>
          Show more <span aria-hidden='true'>→</span>
        </span>
      </Link>
    </motion.li>
  );
}

function Typing() {
  return (
    <motion.li className='pt-3' initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }}>
      <span className='relative mt-1.5 flex w-fit gap-1 rounded-[1.1rem] rounded-bl-none px-3.5 py-3' style={{ background: BUBBLE }} aria-label='Typing'>
        <Tail />
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className='size-1.5 rounded-full bg-muted-foreground'
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, delay: i * 0.18 }}
          />
        ))}
      </span>
    </motion.li>
  );
}

function StatusBar() {
  return (
    <div className='flex items-center justify-between px-6 pt-3 text-[0.65rem] font-semibold text-ink tabular-nums' aria-hidden='true'>
      <span>9:41</span>
      <span className='flex items-center gap-1'>
        <svg viewBox='0 0 16 10' className='h-2 w-3.5 fill-ink'>
          <rect x='0' y='6' width='3' height='4' rx='0.6' />
          <rect x='4.3' y='4' width='3' height='6' rx='0.6' />
          <rect x='8.6' y='2' width='3' height='8' rx='0.6' />
          <rect x='12.9' y='0' width='3' height='10' rx='0.6' />
        </svg>
        <span className='relative h-2.5 w-5 rounded-[3px] border border-ink/50 p-px'>
          <span className='block h-full w-3/4 rounded-[1px] bg-ink' />
        </span>
      </span>
    </div>
  );
}

type PhoneProps = { items: ThoughtItem[]; name: ReactNode; subtitle: string; avatar: ReactNode; active: boolean };

/**
 * One phone showing a message thread. The thread scrolls inside the screen; the newest few arrive one by one, after
 * a typing indicator, the first time the phone is in front and in view.
 */
function Phone({ items, name, subtitle, avatar, active }: PhoneProps) {
  const now = useNow();
  const still = useReducedMotion();
  const phone = useRef<HTMLDivElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  const inView = useInView(phone, { once: true, amount: 0.6 });
  const live = inView && active;
  // Oldest at the top, like a chat.
  const ordered = [...items].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  // Always leave at least one showing, so a phone waiting at the back isn't blank.
  const held = Math.min(ARRIVING, Math.max(0, ordered.length - 1));
  const [shown, setShown] = useState(ordered.length - held);
  const [typing, setTyping] = useState(false);
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    if (still) setShown(ordered.length);
  }, [still, ordered.length]);

  // Deliver the held messages one at a time.
  useEffect(() => {
    if (!live || still || arrived) {
      // Sent to the back mid-delivery: drop the dots, carry on when it's in front again.
      setTyping(false);
      return;
    }
    if (shown >= ordered.length) {
      setArrived(true);
      return;
    }
    setTyping(true);
    const delivered = setTimeout(() => {
      setTyping(false);
      setShown((n) => n + 1);
    }, 1100);
    return () => clearTimeout(delivered);
  }, [live, still, arrived, shown, ordered.length]);

  // Keep the thread pinned to the latest message as they arrive.
  useLayoutEffect(() => {
    const el = thread.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: live ? 'smooth' : 'auto' });
  }, [shown, typing, live]);

  return (
    <div className='relative [perspective:1800px]'>
      {/* Its shadow on the plaster below. */}
      <div className='absolute inset-x-[12%] -bottom-6 h-10 rounded-[50%] blur-xl' style={{ background: shade(0.3) }} aria-hidden='true' />
      <div
        ref={phone}
        className='relative h-[min(600px,78svh)] w-[min(290px,78vw)] rounded-[3rem] p-[11px] transition-transform duration-700 ease-out [transform-style:preserve-3d] [transform:rotateY(-14deg)_rotateX(5deg)_rotateZ(1.5deg)] hover:[transform:rotateY(-6deg)_rotateX(2deg)_rotateZ(0.5deg)]'
        style={{
          background: 'linear-gradient(135deg, oklch(0.36 0.01 60), oklch(0.24 0.01 60) 45%, oklch(0.3 0.01 60))',
          boxShadow: `inset 0 0 0 1.5px oklch(0.5 0.01 60), inset 0 0 0 3px oklch(0.2 0.008 60), 0 40px 60px -30px ${shade(0.5)}`,
        }}
      >
        {/* The frame's thickness along its near side. */}
        <span
          className='absolute top-[3.5rem] right-0 bottom-[3.5rem] w-2.5 origin-right [transform:rotateY(-90deg)]'
          style={{ background: 'linear-gradient(to bottom, oklch(0.3 0.01 60), oklch(0.2 0.008 60))' }}
          aria-hidden='true'
        />
        {/* Side buttons. */}
        <span className='absolute top-28 -left-[3px] h-8 w-[3px] rounded-l-sm bg-[oklch(0.3_0.01_60)]' aria-hidden='true' />
        <span className='absolute top-40 -left-[3px] h-12 w-[3px] rounded-l-sm bg-[oklch(0.3_0.01_60)]' aria-hidden='true' />
        <span className='absolute top-36 -right-[3px] h-16 w-[3px] rounded-r-sm bg-[oklch(0.3_0.01_60)]' aria-hidden='true' />

        <div className='relative flex size-full flex-col overflow-hidden rounded-[2.35rem] bg-plaster'>
          <div className='absolute top-2.5 left-1/2 h-6 w-20 -translate-x-1/2 rounded-full bg-[oklch(0.16_0.006_60)]' aria-hidden='true' />
          <StatusBar />
          <div className='flex flex-col items-center gap-1 border-b border-rule/70 pt-5 pb-2.5'>
            {avatar}
            <span className='text-[0.7rem] font-medium leading-tight text-ink'>{name}</span>
            <span className='-mt-1 text-[0.6rem] text-muted-foreground'>{subtitle}</span>
          </div>
          <div ref={thread} data-lenis-prevent className='flex-1 overflow-y-auto overscroll-contain px-3.5 pb-3 [scrollbar-width:none]'>
            {ordered.length === 0 && <p className='pt-8 text-center text-[0.65rem] text-muted-foreground'>No messages yet</p>}
            <ol>
              {ordered.slice(0, shown).map((item, i) => (
                <Bubble key={item.id} item={item} now={now} fresh={live && i >= ordered.length - held} />
              ))}
              <AnimatePresence>{typing && <Typing key='typing' />}</AnimatePresence>
            </ol>
            {/* Messages still to arrive stay in the markup, hidden, so the text is there without JS. */}
            {ordered.slice(shown).map((item) => (
              <p key={item.id} hidden>
                {item.title} {item.excerpt}
              </p>
            ))}
          </div>
          {/* Look only: it's my thread, so you can't write in it. */}
          <div className='flex items-center gap-2 border-t border-rule/70 px-3 pt-2 pb-5' aria-hidden='true'>
            <input
              disabled
              tabIndex={-1}
              placeholder='Message'
              className='min-w-0 flex-1 cursor-not-allowed rounded-full border border-rule bg-transparent px-3 py-1.5 text-[0.65rem] placeholder:text-muted-foreground/60'
            />
            <button
              type='button'
              disabled
              tabIndex={-1}
              className='grid size-6 cursor-not-allowed place-items-center rounded-full bg-rule text-[0.7rem] text-muted-foreground'
            >
              ↑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function useWide() {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 640px)');
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return wide;
}

/**
 * Thoughts on my phone, with my AI's notes on a second phone set behind it and off to one side. Clicking the back
 * phone shuffles it to the front: each slides out sideways, they cross at the widest point, and settle in swapped.
 */
export function ThoughtPhones({ mine, ai, aiName }: { mine: ThoughtItem[]; ai: ThoughtItem[]; aiName?: string | null }) {
  const firstName = useFirstName();
  const phones = [
    {
      key: 'mine',
      label: firstName || 'Thoughts',
      name: firstName || 'Thoughts',
      subtitle: 'Human to human stuff',
      avatar: <Image src={AVATARS.isaac} alt='' width={40} height={40} className='size-10 rounded-full bg-plaster-shade object-cover' />,
      items: mine,
    },
    {
      key: 'ai',
      label: aiName || 'AIsaac',
      // AI + the greyed-out rest of my name.
      name: aiName || (
        <>
          AI<span className='text-muted-foreground'>saac</span>
        </>
      ),
      subtitle: 'AI to AI stuff',
      avatar: <Image src={AVATARS.aisaac} alt='' width={40} height={40} className='size-10 rounded-full bg-plaster-shade object-contain' />,
      items: ai,
    },
  ];
  const [front, setFront] = useState(0);
  const wide = useWide();
  const still = useReducedMotion();
  const stacked = phones.length > 1;
  // Where the back phone sits, and how far each slides out mid-swap (far enough on wide screens that they never overlap
  // as they pass, so the change in stacking order can't be seen).
  const back = wide ? { x: 120, y: -28 } : { x: 32, y: -20 };
  const out = wide ? 170 : 90;

  return (
    <div
      className={cn(
        'relative mx-auto',
        stacked
          ? 'h-[calc(min(600px,78svh)+20px)] w-[calc(min(290px,78vw)+32px)] sm:h-[calc(min(600px,78svh)+28px)] sm:w-[calc(min(290px,78vw)+120px)]'
          : 'w-fit'
      )}
    >
      {phones.map((phone, i) => {
        const isFront = i === front;
        const swap = still ? { duration: 0 } : { duration: 0.75, ease: [0.4, 0, 0.2, 1] as const, times: [0, 0.45, 1] };
        // Keyframes from wherever it is now (null), out to the side, to its new place. Initial render jumps to the end.
        // The back phone fades as a whole, so the plaster shows through its tilted edges and buttons too.
        const animate = isFront
          ? { x: [null, back.x + out, 0], y: [null, back.y, 0], scale: [null, 0.92, 1], opacity: [null, 0.65, 1], zIndex: [1, 1, 2, 2] }
          : { x: [null, -out * 0.6, back.x], y: [null, 0, back.y], scale: [null, 1, 0.92], opacity: [null, 1, 0.65], zIndex: [2, 2, 1, 1] };
        const show = () => setFront(i);
        return (
          <motion.div
            key={phone.key}
            className={cn(stacked && 'absolute bottom-0 left-0 origin-bottom', !isFront && 'cursor-pointer')}
            initial={false}
            animate={animate}
            transition={{ ...swap, zIndex: { duration: swap.duration, times: [0, 0.44, 0.45, 1] } }}
            whileHover={isFront || still ? undefined : { y: back.y - 8, transition: { duration: 0.25 } }}
            {...(isFront
              ? {}
              : {
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': `Show ${phone.label}`,
                  onClick: show,
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      show();
                    }
                  },
                })}
          >
            {/* The phone behind can't be used until it's brought forward. */}
            <div {...(isFront ? {} : { inert: true })}>
              <Phone items={phone.items} name={phone.name} subtitle={phone.subtitle} avatar={phone.avatar} active={isFront} />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
