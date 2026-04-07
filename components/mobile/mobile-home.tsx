'use client';

// MobileHome — Snap-scroll layout.
// Hero and card sections are separate full-viewport screens.
// Bucket state persists to sessionStorage for refresh resilience.

import { useCallback, useEffect, useRef, useState } from 'react';
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

const SNAP_CSS = `
  .mh-snap-container {
    height: 100dvh;
    overflow-y: auto;
    scroll-snap-type: y mandatory;
    -webkit-overflow-scrolling: touch;
    background: oklch(0.145 0 0);
    color: oklch(0.985 0 0);
  }
  .mh-snap-section {
    scroll-snap-align: start;
    height: 100svh;
    min-height: 100svh;
    position: relative;
    overflow: hidden;
  }
  .mh-cards-screen {
    display: flex;
    flex-direction: column;
    background: oklch(0.145 0 0);
  }
  .mh-cards-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 24px 24px 16px;
    flex-shrink: 0;
  }
  .mh-cards-divider-line {
    flex: 1;
    height: 1px;
    background: oklch(0.22 0 0);
  }
  .mh-cards-divider-text {
    font-family: var(--font-mono);
    font-size: 0.54rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: oklch(0.38 0 0);
    margin: 0;
    white-space: nowrap;
  }
  .mh-cards-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
`;

export function MobileHome({ posts }: MobileHomeProps) {
  const [bucketSlugs, setBucketSlugs] = useState<string[]>([]);
  const [queueOpen, setQueueOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState(0);

  const snapRef = useRef<HTMLDivElement>(null);
  const cardSectionRef = useRef<HTMLDivElement>(null);

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

  const handleScrollToCards = useCallback(() => {
    cardSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <>
      <style>{SNAP_CSS}</style>
      <main ref={snapRef} className="mh-snap-container">
        {/* Screen 1: Hero */}
        <div className="mh-snap-section">
          <MobileHero onScrollToCards={handleScrollToCards} />
        </div>

        {/* Screen 2: Card stack */}
        <div ref={cardSectionRef} className="mh-snap-section mh-cards-screen">
          {/* Section divider */}
          <div className="mh-cards-divider">
            <span className="mh-cards-divider-line" />
            <p className="mh-cards-divider-text">
              {posts.length} Posts — Swipe to Curate
            </p>
            <span className="mh-cards-divider-line" />
          </div>

          {/* Card stack fills remaining space */}
          <div className="mh-cards-body">
            <MobileCardStack posts={posts} onSave={handleSave} />
          </div>
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
    </>
  );
}
