'use client';

// MobileHome — Hero landing + full-screen card overlay.
// "Discover Posts" opens the swipe UI as a separate screen.
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

const CARDS_OVERLAY_CSS = `
  .mh-cards-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: oklch(0.145 0 0);
    display: flex;
    flex-direction: column;
    animation: mh-cards-slide-in 0.38s cubic-bezier(0.34, 1.1, 0.64, 1) both;
  }
  @keyframes mh-cards-slide-in {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }
  .mh-cards-overlay.mh-cards-closing {
    animation: mh-cards-slide-out 0.3s cubic-bezier(0.55, 0, 1, 0.45) both;
  }
  @keyframes mh-cards-slide-out {
    from { transform: translateY(0); }
    to   { transform: translateY(100%); }
  }
  .mh-cards-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 24px 14px;
    flex-shrink: 0;
  }
  .mh-cards-header-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .mh-cards-header-title {
    font-family: var(--font-heading);
    font-size: 1.2rem;
    color: oklch(0.90 0.01 85);
    margin: 0;
    line-height: 1;
  }
  .mh-cards-header-sub {
    font-family: var(--font-mono);
    font-size: 0.5rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: oklch(0.38 0 0);
    margin: 0;
  }
  .mh-cards-close {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: transparent;
    border: 1px solid oklch(0.25 0 0);
    color: oklch(0.50 0 0);
    font-size: 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
  }
  .mh-cards-close:active { background: oklch(0.20 0 0); }
  .mh-cards-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
`;

export function MobileHome({ posts }: MobileHomeProps) {
  const [bucketSlugs, setBucketSlugs] = useState<string[]>([]);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [cardsClosing, setCardsClosing] = useState(false);
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

  const openCards = useCallback(() => {
    setCardsOpen(true);
    setCardsClosing(false);
  }, []);

  const closeCards = useCallback(() => {
    setCardsClosing(true);
    setTimeout(() => {
      setCardsOpen(false);
      setCardsClosing(false);
    }, 300);
  }, []);

  return (
    <>
      <style>{CARDS_OVERLAY_CSS}</style>
      <main style={{ height: '100dvh', background: 'oklch(0.145 0 0)', color: 'oklch(0.985 0 0)', overflow: 'hidden' }}>
        <MobileHero onScrollToCards={openCards} />
      </main>

      {/* Full-screen card overlay */}
      {cardsOpen && (
        <div className={`mh-cards-overlay${cardsClosing ? ' mh-cards-closing' : ''}`}>
          {/* Header with back button */}
          <div className="mh-cards-header">
            <div className="mh-cards-header-left">
              <h2 className="mh-cards-header-title">Discover Posts</h2>
              <p className="mh-cards-header-sub">{posts.length} posts — swipe to curate</p>
            </div>
            <button className="mh-cards-close" onClick={closeCards} aria-label="Back to home">✕</button>
          </div>

          {/* Card stack fills remaining space */}
          <div className="mh-cards-body">
            <MobileCardStack posts={posts} onSave={handleSave} />
          </div>

          {/* Floating reading bucket */}
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
        </div>
      )}
    </>
  );
}
