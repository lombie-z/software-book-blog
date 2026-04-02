'use client';

/**
 * MobileHome — top-level shell for the mobile home experience.
 *
 * Phase 1: placeholder layout.
 * Phase 2: gyroscope-driven hero, tap-animated I.W.R.L title sequence.
 * Phase 3: card stack + reading bucket wired to TinaCMS posts.
 */

import type { PageQuery, PostConnectionQuery } from '@/tina/__generated__/types';

type PostEdges = NonNullable<PostConnectionQuery['postConnection']['edges']>;

interface MobileHomeProps {
  pageData: PageQuery['page'] | null;
  posts: PostEdges;
}

export function MobileHome({ pageData: _pageData, posts }: MobileHomeProps) {
  return (
    <main className='min-h-screen bg-[oklch(0.145_0_0)] text-[oklch(0.985_0_0)] flex flex-col items-center justify-center px-4'>
      <div className='text-center space-y-6'>
        <h1 className='font-heading text-4xl tracking-widest'>I. W. R. L</h1>
        <p className='text-sm text-[oklch(0.708_0_0)] tracking-wide uppercase'>Mobile experience — coming soon</p>
        <div className='text-xs text-[oklch(0.556_0_0)] space-y-1'>
          <p>{posts.length} posts</p>
          <p className='opacity-50'>Phase 2: gyroscope hero · Phase 3: card stack</p>
        </div>
      </div>
    </main>
  );
}
