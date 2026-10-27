'use client';

import Link from 'next/link';
import type { Template } from 'tinacms';
import { tinaField } from 'tinacms/dist/react';
import type { PageBlocksPostIndex, PostConnectionQuery } from '@/tina/__generated__/types';

export type PostEdges = NonNullable<PostConnectionQuery['postConnection']['edges']>;

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

export function PostIndex({ data, posts }: { data: PageBlocksPostIndex; posts: PostEdges }) {
  return (
    <section id="posts" className="mx-auto mt-32 w-full max-w-3xl scroll-mt-16 px-6" aria-labelledby="posts-heading">
      <h2
        id="posts-heading"
        data-tina-field={tinaField(data, 'heading')}
        className="mb-6 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"
      >
        {data.heading || 'Writing'}
      </h2>
      {posts.length === 0 && <p className="border-t border-rule py-6 text-muted-foreground">Nothing published yet.</p>}
      <ol className="border-t border-rule empty:hidden">
        {posts.map((edge) => {
          const post = edge?.node;
          if (!post) return null;
          const excerpt = plainText(post.excerpt).trim();
          return (
            <li key={post.id} className="border-b border-rule">
              <Link href={`/posts/${post._sys.breadcrumbs.join('/')}`} className="group grid gap-x-8 gap-y-1 py-6 md:grid-cols-[8rem_1fr]">
                <time dateTime={post.date ?? undefined} className="pt-1.5 text-xs uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
                  {formatDate(post.date)}
                </time>
                <div>
                  <h3 className="font-serif text-2xl leading-snug text-ink decoration-1 underline-offset-4 group-hover:underline">{post.title}</h3>
                  {excerpt && <p className="mt-1 line-clamp-2 text-[0.95rem] text-muted-foreground">{excerpt}</p>}
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export const postIndexBlockSchema: Template = {
  name: 'postIndex',
  label: 'Post Index',
  ui: {
    defaultItem: { heading: 'Writing' },
  },
  fields: [
    {
      type: 'string',
      label: 'Heading',
      name: 'heading',
    },
  ],
};
