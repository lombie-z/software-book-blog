'use client';

// MobileHome — Phase 3 update.
// Wires MobileHero + MobileCardStack + ReadingBucket + ReadingQueue.
// Bucket state persists to sessionStorage for refresh resilience.

import { useCallback, useEffect, useState } from 'react';
import type { PageQuery, PostConnectionQuery } from '@/tina/__generated__/types';
import { MobileHero } from './mobile-hero';
import { MobileCardStack } from './mobile-card-stack';
import { ReadingBucket } from './reading-bucket';
import { ReadingQueue } from './reading-queue';

type PostEdges = NonNullable<PostConnectionQuery['postConnection']['edges']>;
type PostEdge  = NonNullable<PostEdges[number]>;

interface MobileHomeProps {
  pageData: PageQuery['page'] | null;
  posts: PostEdges;
}

const SESSION_KEY = 'iwrl-reading-bucket';

function loadBucketSlugs(): string[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveBucketSlugs(slugs: string[]) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(slugs)); } catch {}
}

export function MobileHome({ posts }: MobileHomeProps) {
  const [bucketSlugs, setBucketSlugs] = useState<string[]>([]);
  const [queueOpen, setQueueOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState(0);

  // Hydrate from sessionStorage after mount
  useEffect(() => { setBucketSlugs(loadBucketSlugs()); }, []);

  // Build slug → PostEdge lookup
  const postMap = new Map<string, PostEdge>();
  for (const edge of posts) {
    if (edge?.node) postMap.set(edge.node._sys.breadcrumbs.join('/'), edge as PostEdge);
  }

  // Preserve saved order
  const bucketPosts: PostEdge[] = bucketSlugs.map(s => postMap.get(s)).filter((p): p is PostEdge => !!p);

  const handleSave = useCallback((slug: string) => {
    setBucketSlugs(prev => {
      if (prev.includes(slug)) return prev;
      const next = [...prev, slug];
      saveBucketSlugs(next);
      return next;
    });
    setLastAdded(n => n + 1);
  }, []);

  const handleRemove = useCallback((slug: string) => {
    setBucketSlugs(prev => {
      const next = prev.filter(s => s !== slug);
      saveBucketSlugs(next);
      return next;
    });
  }, []);

  return (
    <main style={{ minHeight: '100dvh', background: 'oklch(0.145 0 0)', color: 'oklch(0.985 0 0)', overflowX: 'hidden' }}>
      {/* Phase 2: Gyroscope parallax hero */}
      <MobileHero />

      {/* Section divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '32px 24px 20px' }}>
        <span style={{ flex: 1, height: '1px', background: 'oklch(0.22 0 0)' }} />
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.54rem',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'oklch(0.38 0 0)',
          margin: 0,
          whiteSpace: 'nowrap',
        }}>
          {posts.length} Posts — Swipe to Curate
        </p>
        <span style={{ flex: 1, height: '1px', background: 'oklch(0.22 0 0)' }} />
      </div>

      {/* Phase 3: Tinder-style card stack */}
      <div style={{ paddingBottom: '40px' }}>
        <MobileCardStack posts={posts} onSave={handleSave} />
      </div>

      {/* Floating reading bucket (fixed position, z-index 100) */}
      <ReadingBucket
        count={bucketSlugs.length}
        onOpen={() => setQueueOpen(true)}
        showHint={lastAdded > 0}
      />

      {/* Full-screen reading queue overlay */}
      {queueOpen && (
        <ReadingQueue
          posts={bucketPosts}
          onClose={() => setQueueOpen(false)}
          onRemove={handleRemove}
        />
      )}
    </main>
  );
}
