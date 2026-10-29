'use client';

import { useState } from 'react';
import { tinaField } from 'tinacms/dist/react';
import type { PageBlocksPostIndex, PostConnectionQuery } from '@/tina/__generated__/types';
import Link from 'next/link';
import { ConceptFrame, LIFT } from './concept-frame';
import { ThoughtPhone } from './thought-phone';

export type PostEdges = NonNullable<PostConnectionQuery['postConnection']['edges']>;
type Post = NonNullable<NonNullable<PostEdges[number]>['node']>;

// Three rows of two concepts, then a toggle. Thoughts all live in the phone's scrolling thread.
const VISIBLE_CONCEPTS = 6;

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

const href = (post: Post) => `/posts/${post._sys.breadcrumbs.join('/')}`;

export function PostIndex({ data, posts }: { data: PageBlocksPostIndex; posts: PostEdges }) {
  const [expanded, setExpanded] = useState(false);
  const category = data.category ?? 'thought';
  const list = posts
    .map((e) => e?.node)
    .filter((p): p is Post => !!p && (p.category ?? 'thought') === category)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')); // newest first
  const isConcept = category === 'concept';
  const id = sectionId(category);

  return (
    <section id={id} className='mx-auto mt-24 w-full max-w-3xl scroll-mt-16 px-6' aria-labelledby={`${id}-heading`}>
      <h2
        id={`${id}-heading`}
        data-tina-field={tinaField(data, 'heading')}
        className='mb-8 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'
      >
        {data.heading || (isConcept ? 'Portfolio and concepts' : 'Thoughts')}
      </h2>
      {list.length === 0 && <p className='text-muted-foreground'>Nothing here yet.</p>}
      {list.length > 0 && !isConcept && (
        <ThoughtPhone items={list.map((p) => ({ id: p.id, href: href(p), title: p.title ?? '', excerpt: plainText(p.excerpt).trim(), date: p.date }))} />
      )}
      {list.length > 0 && isConcept && (
        <>
          <ul className='grid gap-x-6 gap-y-8 sm:grid-cols-2'>
            {(expanded ? list : list.slice(0, VISIBLE_CONCEPTS)).map((p) => (
              <li key={p.id}>
                {/* Rests nearly flush on the plaster and lifts off it on hover. */}
                <Link
                  href={href(p)}
                  className='block h-full transition-transform duration-300 ease-out [--lift:var(--rest)] hover:-translate-y-1.5 hover:[--lift:var(--raised)] focus-visible:-translate-y-1.5 focus-visible:[--lift:var(--raised)] motion-reduce:transition-none'
                  style={{ '--rest': LIFT.rest, '--raised': LIFT.raised } as React.CSSProperties}
                >
                  <ConceptFrame type={p.conceptType} image={p.heroImg} title={p.title ?? ''} date={formatDate(p.date)} siteUrl={p.siteUrl} />
                </Link>
              </li>
            ))}
          </ul>
          {list.length > VISIBLE_CONCEPTS && (
            <button
              type='button'
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className='mt-8 text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-ink'
            >
              {expanded ? 'Show fewer' : `Show all ${list.length}`} <span aria-hidden='true'>{expanded ? '↑' : '↓'}</span>
            </button>
          )}
        </>
      )}
    </section>
  );
}
