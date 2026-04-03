'use client';

/**
 * MobileHome — top-level shell for the mobile home experience.
 *
 * Phase 1: placeholder layout.
 * Phase 2: gyroscope-driven hero (MobileHero), tap-animated I.W.R.L title sequence.
 * Phase 3: card stack + reading bucket wired to TinaCMS posts.
 */

import type { PageQuery, PostConnectionQuery } from '@/tina/__generated__/types';
import { MobileHero } from './mobile-hero';

type PostEdges = NonNullable<PostConnectionQuery['postConnection']['edges']>;

interface MobileHomeProps {
  pageData: PageQuery['page'] | null;
  posts: PostEdges;
}

export function MobileHome({ posts }: MobileHomeProps) {
  return (
    <main className='min-h-screen bg-[oklch(0.145_0_0)] text-[oklch(0.985_0_0)]'>
      {/* Phase 2: Gyroscope parallax hero — full viewport height */}
      <MobileHero />

      {/* Phase 3 placeholder: card stack will replace this */}
      <section
        className='flex flex-col items-center justify-center px-6 py-16 gap-4'
        style={{ background: 'oklch(0.145 0 0)' }}
      >
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6rem',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'oklch(0.556 0 0)',
          }}
        >
          {posts.length} posts · card stack coming in Phase 3
        </p>
      </section>
    </main>
  );
}
