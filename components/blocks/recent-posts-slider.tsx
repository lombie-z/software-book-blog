'use client';
import * as React from 'react';
import Link from 'next/link';
import type { PostConnectionQuery } from '@/tina/__generated__/types';
import { FullScreenScrollFX } from '@/components/ui/full-screen-scroll-fx';

type PostEdges = NonNullable<PostConnectionQuery['postConnection']['edges']>;

export function RecentPostsSlider({
  posts,
  embedded,
  currentIndex,
}: {
  posts: PostEdges;
  embedded?: boolean;
  currentIndex?: number;
}) {
  const validPosts = posts.filter((p) => p?.node) as NonNullable<(typeof posts)[number]>[];

  if (validPosts.length === 0) return null;

  const sections = validPosts.map((edge) => {
    const post = edge.node!;
    const slug = post._sys.breadcrumbs.join('/');
    const firstTag = post.tags?.[0]?.tag?.name ?? '';
    const date = post.date
      ? new Date(post.date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '';

    return {
      id: slug,
      background: post.heroImg ?? '',
      leftLabel: firstTag,
      title: (
        <Link href={`/posts/${slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
          {post.title}
        </Link>
      ),
      rightLabel: date,
    };
  });

  return (
    <FullScreenScrollFX
      sections={sections}
      showProgress
      durations={{ change: 0.7, snap: 800 }}
      colors={{
        text: 'rgba(192,192,192,0.92)',
        overlay: 'rgba(0,0,0,0.45)',
        pageBg: '#0a0a0a',
        stageBg: '#0a0a0a',
      }}
      embedded={embedded}
      currentIndex={currentIndex}
    />
  );
}
