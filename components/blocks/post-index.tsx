'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { tinaField } from 'tinacms/dist/react';
import type { PageBlocksPostIndex, PostConnectionQuery } from '@/tina/__generated__/types';
import { cn } from '@/lib/utils';

export type PostEdges = NonNullable<PostConnectionQuery['postConnection']['edges']>;
type Post = NonNullable<NonNullable<PostEdges[number]>['node']>;

const VISIBLE = 3;

// Desert tones, low chroma and warm so they sit on the plaster: terracotta clay, dusty sage, sandy ochre.
const CONCEPT_PILLS: Record<string, { label: string; className: string }> = {
  model: { label: 'Model', className: 'bg-[oklch(0.9_0.024_45)] text-[oklch(0.47_0.055_42)]' },
  site: { label: 'Site', className: 'bg-[oklch(0.91_0.016_120)] text-[oklch(0.46_0.035_120)]' },
  graphic: { label: 'Graphic', className: 'bg-[oklch(0.92_0.028_80)] text-[oklch(0.5_0.055_75)]' },
};

export const sectionId = (category?: string | null) => (category === 'concept' ? 'concepts' : 'thoughts');

function plainText(node: any): string {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  if (Array.isArray(node.children)) return node.children.map(plainText).join('');
  return '';
}

function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  // UTC so server and browser agree across the date boundary.
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-[0.14em]', className)}>{children}</span>;
}

function Pills({ post }: { post: Post }) {
  if (post.category === 'concept') {
    const pill = post.conceptType ? CONCEPT_PILLS[post.conceptType] : undefined;
    return pill ? <Pill className={pill.className}>{pill.label}</Pill> : null;
  }
  const topics = (post.tags ?? []).map((t) => (t?.tag && 'name' in t.tag ? t.tag.name : null)).filter(Boolean);
  return (
    <>
      {topics.map((name) => (
        <Pill key={name} className="bg-plaster-shade text-muted-foreground">
          {name}
        </Pill>
      ))}
    </>
  );
}

function Row({ post }: { post: Post }) {
  const excerpt = plainText(post.excerpt).trim();
  return (
    <Link href={`/posts/${post._sys.breadcrumbs.join('/')}`} className="group grid gap-x-8 gap-y-1 py-6 md:grid-cols-[8rem_1fr]">
      <time dateTime={post.date ?? undefined} className="pt-1.5 text-xs uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
        {formatDate(post.date)}
      </time>
      <div>
        <h3 className="font-serif text-2xl leading-snug text-ink decoration-1 underline-offset-4 group-hover:underline">{post.title}</h3>
        {excerpt && <p className="mt-1 line-clamp-2 text-[0.95rem] text-muted-foreground">{excerpt}</p>}
        <div className="mt-3 flex flex-wrap gap-1.5 empty:hidden">
          <Pills post={post} />
        </div>
      </div>
    </Link>
  );
}

export function PostIndex({ data, posts }: { data: PageBlocksPostIndex; posts: PostEdges }) {
  const [expanded, setExpanded] = useState(false);
  const category = data.category ?? 'thought';
  const list = posts
    .map((e) => e?.node)
    .filter((p): p is Post => !!p && (p.category ?? 'thought') === category)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')); // newest first
  const shown = expanded ? list : list.slice(0, VISIBLE);
  const id = sectionId(category);

  return (
    <section id={id} className="mx-auto mt-24 w-full max-w-3xl scroll-mt-16 px-6" aria-labelledby={`${id}-heading`}>
      <h2
        id={`${id}-heading`}
        data-tina-field={tinaField(data, 'heading')}
        className="mb-6 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"
      >
        {data.heading || (category === 'concept' ? 'Design concepts' : 'Thoughts')}
      </h2>
      {list.length === 0 && <p className="border-t border-rule py-6 text-muted-foreground">Nothing here yet.</p>}
      <ol className="border-t border-rule empty:hidden">
        <AnimatePresence initial={false}>
          {shown.map((post, i) => (
            <motion.li
              key={post.id}
              className="border-b border-rule"
              initial={i >= VISIBLE ? { opacity: 0, y: -8 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
              transition={{ duration: 0.3, delay: i >= VISIBLE ? (i - VISIBLE) * 0.05 : 0 }}
            >
              <Row post={post} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      {list.length > VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-5 text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-ink"
        >
          {expanded ? 'Show fewer' : `Show all ${list.length}`} <span aria-hidden="true">{expanded ? '↑' : '↓'}</span>
        </button>
      )}
    </section>
  );
}
