'use client';

// Reading Queue — full-screen overlay for the saved post reading list.
// Changed interface from `slugs: string[]` to `posts` for richer display.
// Swipe left on any item to remove it from the queue.

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { PostConnectionQuery } from '@/tina/__generated__/types';

type PostEdge = NonNullable<NonNullable<PostConnectionQuery['postConnection']['edges']>[number]>;

function richTextToPlain(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return '';
  const node = value as { text?: string; children?: unknown[] };
  if (node.text) return node.text;
  if (Array.isArray(node.children)) return node.children.map(richTextToPlain).join(' ');
  return '';
}

interface ReadingQueueProps {
  posts: PostEdge[];
  onClose: () => void;
  onRemove: (slug: string) => void;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const QUEUE_CSS = `
  .rq-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: oklch(0.08 0 0 / 0.75);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    animation: rq-backdrop-in 0.3s ease-out both;
  }
  @keyframes rq-backdrop-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .rq-panel {
    position: fixed;
    inset: 0;
    top: 0;
    z-index: 201;
    background: oklch(0.105 0.005 255);
    display: flex;
    flex-direction: column;
    animation: rq-panel-in 0.38s cubic-bezier(0.34, 1.1, 0.64, 1) both;
    overflow: hidden;
  }
  @keyframes rq-panel-in {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }
  .rq-panel.rq-closing {
    animation: rq-panel-out 0.3s cubic-bezier(0.55, 0, 1, 0.45) both;
  }
  @keyframes rq-panel-out {
    from { transform: translateY(0); }
    to   { transform: translateY(100%); }
  }

  /* Header */
  .rq-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 22px 16px;
    border-bottom: 1px solid oklch(0.60 0.10 255 / 0.14);
    flex-shrink: 0;
  }
  .rq-header-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .rq-title {
    font-family: var(--font-heading);
    font-size: 1.45rem;
    color: oklch(0.93 0.02 255);
    margin: 0;
    line-height: 1;
  }
  .rq-subtitle {
    font-family: var(--font-mono);
    font-size: 0.52rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: oklch(0.45 0 0);
    margin: 0;
  }
  .rq-close {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: transparent;
    border: 1px solid oklch(0.32 0 0);
    color: oklch(0.50 0 0);
    font-size: 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    align-self: center;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
  }
  .rq-close:active { background: oklch(0.20 0 0); }

  /* Scroll list */
  .rq-list {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 6px 0 40px;
  }

  /* Empty state */
  .rq-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    height: 100%;
    padding: 40px 28px;
    text-align: center;
  }
  .rq-empty-title {
    font-family: var(--font-heading);
    font-size: 1.2rem;
    color: oklch(0.55 0 0);
    margin: 0;
  }
  .rq-empty-sub {
    font-family: var(--font-mono);
    font-size: 0.54rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: oklch(0.38 0 0);
    margin: 0;
  }

  /* Queue item */
  .rq-item-wrap {
    overflow: hidden;
  }
  .rq-item {
    display: flex;
    align-items: stretch;
    gap: 0;
    padding: 0 22px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    touch-action: pan-y;
    will-change: transform;
    transition: transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.3s ease;
  }
  .rq-item:active .rq-item-inner { background: oklch(0.60 0.10 255 / 0.06); }
  .rq-item-inner {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 0;
    border-bottom: 1px solid oklch(0.60 0.10 255 / 0.1);
    border-radius: 4px;
  }
  .rq-item-num {
    font-family: var(--font-mono);
    font-size: 0.58rem;
    letter-spacing: 0.12em;
    color: oklch(0.38 0 0);
    min-width: 20px;
    text-align: right;
    flex-shrink: 0;
  }
  .rq-item-thumb {
    width: 48px;
    height: 48px;
    border-radius: 6px;
    background-size: cover;
    background-position: center;
    flex-shrink: 0;
    border: 1px solid oklch(0.60 0.10 255 / 0.15);
    background-color: oklch(0.15 0.01 255);
  }
  .rq-item-text {
    flex: 1;
    min-width: 0;
  }
  .rq-item-title {
    font-family: var(--font-heading);
    font-size: 0.98rem;
    color: oklch(0.90 0.02 255);
    margin: 0 0 4px;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rq-item-meta {
    font-family: var(--font-mono);
    font-size: 0.52rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: oklch(0.48 0 0);
    display: flex;
    gap: 8px;
  }
  .rq-item-arrow {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: oklch(0.45 0.08 255);
    flex-shrink: 0;
    align-self: center;
  }

  /* Swipe-to-delete hint under the item */
  .rq-delete-hint {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0 22px;
    height: 100%;
    background: oklch(0.22 0.05 10);
    color: oklch(0.72 0.10 25);
    font-family: var(--font-mono);
    font-size: 0.56rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    position: absolute;
    inset: 0;
    border-radius: 0;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.1s;
  }

  /* Footer read-all button */
  .rq-footer {
    padding: 12px 22px 32px;
    border-top: 1px solid oklch(0.60 0.10 255 / 0.1);
    flex-shrink: 0;
  }
  .rq-read-all-btn {
    width: 100%;
    padding: 13px;
    font-family: var(--font-mono);
    font-size: 0.58rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    background: transparent;
    border: 1px solid oklch(0.78 0.10 85 / 0.28);
    border-radius: 3px;
    color: oklch(0.78 0.10 85);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: border-color 0.2s, color 0.2s;
  }
  .rq-read-all-btn:active {
    border-color: oklch(0.78 0.10 85 / 0.6);
    color: oklch(0.92 0.12 85);
  }
`;

// ─── Queue item with swipe-to-remove ─────────────────────────────────────────

interface QueueItemProps {
  post: PostEdge;
  index: number;
  total: number;
  onNavigate: (slug: string) => void;
  onRemove: (slug: string) => void;
}

function QueueItem({ post, index, total, onNavigate, onRemove }: QueueItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const node = post.node!;
  const slug = node._sys.breadcrumbs.join('/');
  const title = node.title ?? '';
  const heroImg = node.heroImg ?? '';
  const date = node.date
    ? new Date(node.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const excerptText = richTextToPlain(node.excerpt);
  const readingTime = Math.max(1, Math.ceil(excerptText.split(/\s+/).filter(Boolean).length / 200));

  useEffect(() => {
    const el = itemRef.current;
    if (!el) return;

    const state = { startX: 0, startY: 0, active: false, moved: false };

    const onDown = (e: PointerEvent) => {
      try { el.setPointerCapture(e.pointerId); } catch {}
      state.startX = e.clientX;
      state.startY = e.clientY;
      state.active = true;
      state.moved = false;
      el.style.transition = 'none';
    };

    const onMove = (e: PointerEvent) => {
      if (!state.active) return;
      const dx = e.clientX - state.startX;
      const dy = Math.abs(e.clientY - state.startY);
      // Only track horizontal swipe (not scroll)
      if (!state.moved && dy > Math.abs(dx)) {
        state.active = false;
        el.style.transition = '';
        el.style.transform = '';
        return;
      }
      if (Math.abs(dx) > 6) state.moved = true;
      const clamped = Math.min(0, dx); // only allow swiping left
      el.style.transform = `translateX(${clamped}px)`;
    };

    const onUp = (e: PointerEvent) => {
      if (!state.active) return;
      state.active = false;
      const dx = e.clientX - state.startX;
      if (dx < -100) {
        el.style.transition = 'transform 0.28s ease, opacity 0.28s ease';
        el.style.transform = `translateX(-110%)`;
        el.style.opacity = '0';
        setTimeout(() => onRemove(slug), 300);
      } else {
        el.style.transition = 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)';
        el.style.transform = '';
      }
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, [slug, onRemove]);

  return (
    <div className="rq-item-wrap">
      <div
        ref={itemRef}
        className="rq-item"
        onClick={() => onNavigate(slug)}
        role="button"
        tabIndex={0}
        aria-label={`Read ${title} (${index + 1} of ${total})`}
      >
        <div className="rq-item-inner">
          <span className="rq-item-num">{index + 1}</span>
          {heroImg && (
            <div
              className="rq-item-thumb"
              style={{ backgroundImage: `url(${heroImg})` }}
              aria-hidden="true"
            />
          )}
          <div className="rq-item-text">
            <h3 className="rq-item-title">{title}</h3>
            <div className="rq-item-meta">
              <span>{date}</span>
              <span>·</span>
              <span>~{readingTime} min</span>
            </div>
          </div>
          <span className="rq-item-arrow" aria-hidden="true">→</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReadingQueue({ posts, onClose, onRemove }: ReadingQueueProps) {
  const router = useRouter();

  const navigate = (slug: string) => {
    router.push(`/posts/${slug}`);
  };

  const handleReadAll = () => {
    if (posts.length > 0 && posts[0].node) {
      navigate(posts[0].node._sys.breadcrumbs.join('/'));
    }
  };

  return (
    <>
      <style>{QUEUE_CSS}</style>
      <div className="rq-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="rq-panel" role="dialog" aria-modal="true" aria-label="Reading queue">
        {/* Header */}
        <div className="rq-header">
          <div className="rq-header-left">
            <h2 className="rq-title">Reading Queue</h2>
            <p className="rq-subtitle">
              {posts.length === 0
                ? 'Empty — swipe right to save posts'
                : `${posts.length} post${posts.length !== 1 ? 's' : ''} saved · swipe left to remove`}
            </p>
          </div>
          <button className="rq-close" onClick={onClose} aria-label="Close queue">✕</button>
        </div>

        {/* List */}
        <div className="rq-list">
          {posts.length === 0 ? (
            <div className="rq-empty">
              <p className="rq-empty-title">Queue is empty</p>
              <p className="rq-empty-sub">Swipe right on cards to save posts here</p>
            </div>
          ) : (
            posts.map((post, i) => (
              post.node ? (
                <QueueItem
                  key={post.node._sys.filename ?? post.node._sys.breadcrumbs.join('/')}
                  post={post}
                  index={i}
                  total={posts.length}
                  onNavigate={navigate}
                  onRemove={onRemove}
                />
              ) : null
            ))
          )}
        </div>

        {/* Footer */}
        {posts.length > 0 && (
          <div className="rq-footer">
            <button className="rq-read-all-btn" onClick={handleReadAll}>
              Start Reading — {posts.length} Post{posts.length !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
