'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PostConnectionQuery } from '@/tina/__generated__/types';
import { MobileCard } from './mobile-card';

type PostEdges = NonNullable<PostConnectionQuery['postConnection']['edges']>;

interface MobileCardStackProps {
  posts: PostEdges;
  onSave: (slug: string) => void;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const STACK_CSS = `
  .mcs-wrap {
    position: relative;
    width: 100%;
    padding: 0 24px 80px;
    box-sizing: border-box;
  }
  .mcs-card-region {
    position: relative;
    height: min(calc(100dvh - 200px), 640px);
    min-height: 380px;
    display: flex;
    flex-direction: column;
  }
  .mcs-stage {
    position: relative;
    width: 100%;
    flex: 1;
  }
  .mcs-swipe-hint {
    display: flex;
    justify-content: space-between;
    padding: 10px 22px 0;
    pointer-events: none;
  }
  .mcs-swipe-hint span {
    font-family: var(--font-mono);
    font-size: 0.5rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: oklch(0.38 0 0);
  }
  .mcs-progress {
    display: flex;
    justify-content: center;
    gap: 6px;
    padding-top: 12px;
  }
  .mcs-pip {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: oklch(0.35 0 0);
    transition: background 0.3s ease;
  }
  .mcs-pip.mcs-pip--active {
    background: oklch(0.78 0.10 85);
    width: 16px;
    border-radius: 2px;
  }
  .mcs-pip.mcs-pip--done {
    background: oklch(0.28 0 0);
  }

  /* Empty / completion state — sits behind cards inside .mcs-stage,
     fades in when the last card leaves. No layout shift possible. */
  .mcs-empty {
    position: absolute;
    inset: 0;
    z-index: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    text-align: center;
    padding: 0 28px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.45s ease;
  }
  .mcs-empty--visible {
    opacity: 1;
    pointer-events: auto;
    transition: opacity 0.45s ease 0.12s;
  }
  .mcs-empty-circle {
    width: 96px;
    height: 96px;
    border: 1.5px solid oklch(0.78 0.10 85 / 0.3);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: mcs-circle-spin 12s linear infinite;
    position: relative;
  }
  @keyframes mcs-circle-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  .mcs-empty-circle::before {
    content: '';
    position: absolute;
    inset: 6px;
    border: 0.5px solid oklch(0.78 0.10 85 / 0.15);
    border-radius: 50%;
    animation: mcs-circle-spin 8s linear infinite reverse;
  }
  .mcs-empty-circle-inner {
    font-family: var(--font-heading);
    font-size: 1.1rem;
    color: oklch(0.78 0.10 85 / 0.55);
    animation: mcs-circle-spin 12s linear infinite reverse;
  }
  .mcs-empty-title {
    font-family: var(--font-heading);
    font-size: 1.3rem;
    color: oklch(0.88 0.01 85);
    margin: 0;
    line-height: 1.3;
  }
  .mcs-empty-sub {
    font-family: var(--font-mono);
    font-size: 0.55rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: oklch(0.45 0 0);
    margin: 0;
  }
  .mcs-btn {
    font-family: var(--font-mono);
    font-size: 0.58rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    padding: 10px 24px;
    border-radius: 3px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    background: transparent;
    border: 1px solid oklch(0.78 0.10 85 / 0.3);
    color: oklch(0.78 0.10 85);
    transition: border-color 0.2s, color 0.2s;
  }
  .mcs-btn:active {
    border-color: oklch(0.78 0.10 85 / 0.6);
    color: oklch(0.92 0.10 85);
  }
  .mcs-btn-row {
    display: flex;
    gap: 12px;
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

export function MobileCardStack({ posts, onSave }: MobileCardStackProps) {
  const [deckIndex, setDeckIndex] = useState(0);
  // When a card is swiped, suppress mounting the new back card until the
  // promotion animation finishes. Simultaneously mounting a new card while
  // two existing cards animate their stackIndex causes layout recalculation
  // that eats animation frames — visible as jank on the first 4+ cards.
  const [showBackCard, setShowBackCard] = useState(true);
  const backCardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (backCardTimer.current) clearTimeout(backCardTimer.current); }, []);

  const validPosts = posts.filter(p => p?.node);
  const isEmpty = deckIndex >= validPosts.length;

  // Only show the 3rd (back) card when showBackCard is true
  const visiblePosts = validPosts.slice(deckIndex, deckIndex + (showBackCard ? 3 : 2));

  const scheduleBackCard = useCallback(() => {
    if (backCardTimer.current) clearTimeout(backCardTimer.current);
    setShowBackCard(false);
    backCardTimer.current = setTimeout(() => setShowBackCard(true), 420);
  }, []);

  const handleSwipeRight = useCallback(() => {
    const post = validPosts[deckIndex];
    if (post?.node) {
      onSave(post.node._sys.breadcrumbs.join('/'));
    }
    scheduleBackCard();
    setDeckIndex(i => i + 1);
  }, [deckIndex, validPosts, onSave, scheduleBackCard]);

  const handleSwipeLeft = useCallback(() => {
    scheduleBackCard();
    setDeckIndex(i => i + 1);
  }, [scheduleBackCard]);

  const handleShuffle = useCallback(() => {
    if (backCardTimer.current) clearTimeout(backCardTimer.current);
    setShowBackCard(true);
    setDeckIndex(0);
  }, []);

  // Progress pips (max 10 visible at once around current position)
  const total = validPosts.length;
  const pipStart = Math.max(0, Math.min(deckIndex - 2, total - 10));
  const pips = Array.from({ length: Math.min(10, total) }, (_, i) => pipStart + i);

  return (
    <>
      <style>{STACK_CSS}</style>
      <div className="mcs-wrap">
        <div className="mcs-card-region">
          <div className="mcs-stage">
            {/* Completion screen — always in DOM, positioned behind cards.
                Fades in when the last card exits; no height shift ever. */}
            <div className={`mcs-empty${isEmpty ? ' mcs-empty--visible' : ''}`} aria-hidden={!isEmpty}>
              <div className="mcs-empty-circle">
                <span className="mcs-empty-circle-inner">✦</span>
              </div>
              <h2 className="mcs-empty-title">You&apos;ve seen them all</h2>
              <p className="mcs-empty-sub">All {total} posts reviewed</p>
              <div className="mcs-btn-row">
                <button className="mcs-btn" onClick={handleShuffle}>
                  Shuffle Again
                </button>
              </div>
            </div>

            {/* Cards render on top (z-index 10–8 via inline style) */}
            {[...visiblePosts].reverse().map((post, revIdx) => {
              if (!post?.node) return null;
              const stackIndex = (visiblePosts.length - 1 - revIdx) as 0 | 1 | 2;
              return (
                <MobileCard
                  key={post.node._sys.filename ?? post.node._sys.breadcrumbs.join('/')}
                  post={post}
                  stackIndex={stackIndex}
                  onSwipeRight={handleSwipeRight}
                  onSwipeLeft={handleSwipeLeft}
                />
              );
            })}
          </div>
        </div>

        {/* Hints and pips stay in DOM to avoid layout shift — fade out when done */}
        <div
          className="mcs-swipe-hint"
          aria-hidden="true"
          style={{ opacity: isEmpty ? 0 : 1, transition: 'opacity 0.3s ease', pointerEvents: 'none' }}
        >
          <span>← skip</span>
          <span>save →</span>
        </div>
        <div
          className="mcs-progress"
          aria-label={isEmpty ? undefined : `Post ${deckIndex + 1} of ${total}`}
          style={{ opacity: isEmpty ? 0 : 1, transition: 'opacity 0.3s ease' }}
        >
          {pips.map(idx => (
            <div
              key={idx}
              className={`mcs-pip${idx === deckIndex ? ' mcs-pip--active' : idx < deckIndex ? ' mcs-pip--done' : ''}`}
            />
          ))}
        </div>
      </div>
    </>
  );
}
