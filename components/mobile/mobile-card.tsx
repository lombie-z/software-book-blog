'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TinaMarkdown } from 'tinacms/dist/rich-text';
import type { PostConnectionQuery } from '@/tina/__generated__/types';

type PostEdge = NonNullable<NonNullable<PostConnectionQuery['postConnection']['edges']>[number]>;

interface MobileCardProps {
  post: PostEdge;
  stackIndex: 0 | 1 | 2;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
}

// Extract plain text from a TinaCMS rich-text AST (or return the value if already a string)
function richTextToPlain(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return '';
  const node = value as { type?: string; text?: string; children?: unknown[] };
  if (node.text) return node.text;
  if (Array.isArray(node.children)) return node.children.map(richTextToPlain).join(' ');
  return '';
}

const SWIPE_THRESHOLD = 80; // px to commit
const VEL_THRESHOLD = 0.32; // px/ms to commit
const STACK_SCALES = [1, 1, 1] as const;        // no scale — avoids promotion jank
const STACK_TRANSLATE_Y = [0, 0, 0] as const;   // flat stack — no Y offset
const STACK_OPACITY = [1, 1, 1] as const;        // all opaque — flat stack, only top card visible

// ─── Filigree corner bracket ──────────────────────────────────────────────────

function FiligreeCorner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const flipX = pos === 'tr' || pos === 'br';
  const flipY = pos === 'bl' || pos === 'br';
  return (
    <svg
      width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true"
      style={{
        position: 'absolute',
        ...(pos.includes('t') ? { top: 10 } : { bottom: 10 }),
        ...(pos.includes('l') ? { left: 10 } : { right: 10 }),
        transform: `scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`,
        pointerEvents: 'none',
      }}
    >
      <path d="M 5 31 L 5 5 L 31 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
      <path d="M 9 31 L 9 9 L 31 9" stroke="currentColor" strokeWidth="0.55" strokeLinecap="square" opacity="0.4" />
      <circle cx="5" cy="5" r="2.2" fill="currentColor" />
      <circle cx="5" cy="18" r="1.1" fill="currentColor" opacity="0.5" />
      <circle cx="18" cy="5" r="1.1" fill="currentColor" opacity="0.5" />
      <path d="M 2 5 L 5 5" stroke="currentColor" strokeWidth="1.1" opacity="0.65" />
      <path d="M 5 2 L 5 5" stroke="currentColor" strokeWidth="1.1" opacity="0.65" />
      <path d="M 7 5 L 5 5 L 5 7" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
    </svg>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_CSS = `
  .mc-wrapper {
    position: absolute;
    inset: 0;
    border-radius: 16px;
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
    will-change: transform;
    cursor: grab;
    perspective: 1000px;
  }
  .mc-wrapper:active { cursor: grabbing; }
  .mc-wrapper.mc-top {
    animation: mc-breathe 4s ease-in-out infinite;
  }
  @keyframes mc-breathe {
    0%, 100% { box-shadow: 0 10px 40px oklch(0 0 0 / 0.55), 0 0 0 1px oklch(0.78 0.10 85 / 0.06); }
    50%       { box-shadow: 0 18px 60px oklch(0 0 0 / 0.72), 0 0 0 1px oklch(0.78 0.10 85 / 0.16); }
  }
  .mc-flip-container {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 16px;
    transform-style: preserve-3d;
    transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .mc-face {
    position: absolute;
    inset: 0;
    border-radius: 16px;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    overflow: hidden;
  }
  .mc-front {
    background: oklch(0.11 0.005 85);
    border: 1px solid oklch(0.78 0.10 85 / 0.16);
    color: oklch(0.78 0.10 85 / 0.52);
  }
  .mc-back {
    background: oklch(0.12 0.015 255);
    border: 1px solid oklch(0.60 0.10 255 / 0.22);
    transform: rotateY(180deg);
    color: oklch(0.60 0.10 255 / 0.52);
  }
  .mc-hero-bg {
    position: absolute;
    inset: -6px;
    background-size: cover;
    background-position: center;
    filter: blur(3px) brightness(0.38) saturate(1.3);
    transform: scale(1.04);
    border-radius: 16px;
  }
  .mc-hero-color-wash {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse 120% 80% at 50% 0%,
      oklch(0.55 0.14 85 / 0.18) 0%,
      transparent 60%
    );
  }
  .mc-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to top,
      oklch(0.07 0 0 / 0.98) 0%,
      oklch(0.07 0 0 / 0.72) 38%,
      oklch(0.07 0 0 / 0.18) 100%
    );
  }
  .mc-front-content {
    position: absolute;
    bottom: 32px;
    left: 36px;
    right: 36px;
    z-index: 2;
  }
  .mc-category {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 0.54rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: oklch(0.78 0.12 85);
    border: 1px solid oklch(0.78 0.12 85 / 0.32);
    padding: 3px 9px;
    border-radius: 2px;
    margin-bottom: 11px;
  }
  .mc-title {
    font-family: var(--font-heading);
    font-size: clamp(1.4rem, 5.8vw, 1.8rem);
    color: oklch(0.96 0.01 85);
    line-height: 1.15;
    margin: 0 0 9px;
    text-shadow: 0 2px 14px oklch(0 0 0 / 0.75);
    text-wrap: balance;
  }
  .mc-date {
    font-family: var(--font-mono);
    font-size: 0.57rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: oklch(0.72 0 0 / 0.55);
    margin: 0 0 14px;
  }
  .mc-flip-hint {
    font-family: var(--font-mono);
    font-size: 0.5rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: oklch(0.45 0 0);
    margin: 0;
  }
  .mc-back-inner {
    height: 100%;
    box-sizing: border-box;
    padding: 40px 36px 32px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .mc-excerpt {
    font-family: var(--font-body, system-ui, sans-serif);
    font-size: 0.875rem;
    line-height: 1.68;
    color: oklch(0.80 0.01 255);
    flex: 1;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 7;
    -webkit-box-orient: vertical;
    margin: 0;
  }
  .mc-back-footer {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 12px;
    border-top: 1px solid oklch(0.60 0.10 255 / 0.18);
    margin-top: auto;
  }
  .mc-reading-time {
    font-family: var(--font-mono);
    font-size: 0.54rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: oklch(0.50 0 0);
  }
  .mc-read-link {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: oklch(0.65 0.12 255);
    text-decoration: none;
    padding: 14px 24px;
    min-height: 52px;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid oklch(0.65 0.12 255 / 0.3);
    border-radius: 4px;
    -webkit-tap-highlight-color: transparent;
    background: oklch(0.60 0.12 255 / 0.1);
    cursor: pointer;
    position: relative;
    z-index: 10;
    transition: background 0.15s, border-color 0.15s;
  }
  .mc-read-link:active {
    background: oklch(0.60 0.12 255 / 0.22);
    border-color: oklch(0.65 0.12 255 / 0.55);
  }
  .mc-glow-right {
    position: absolute;
    inset: 0;
    border-radius: 16px;
    background: radial-gradient(ellipse 90% 100% at 88% 50%, oklch(0.78 0.16 85 / 0.45) 0%, transparent 60%);
    border: 2px solid oklch(0.78 0.16 85 / 0.5);
    pointer-events: none;
    z-index: 5;
    opacity: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 18px;
  }
  .mc-glow-right .mc-glow-label-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .mc-glow-right .mc-glow-front {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    font-family: var(--font-heading);
    font-size: 2.4rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: oklch(0.96 0.14 85);
    text-shadow: 0 0 20px oklch(0.78 0.16 85 / 0.5);
    mix-blend-mode: screen;
    position: relative;
    z-index: 1;
  }
  .mc-glow-right .mc-glow-echo {
    position: absolute;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    font-family: var(--font-display-block), Impact, sans-serif;
    font-size: 3.2rem;
    font-weight: 400;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: oklch(0.78 0.16 85 / 0.28);
    text-shadow: 0 0 40px oklch(0.78 0.16 85 / 0.35);
    transform: translateX(-10px);
    filter: blur(0.3px);
  }
  .mc-glow-left {
    position: absolute;
    inset: 0;
    border-radius: 16px;
    background: radial-gradient(ellipse 90% 100% at 12% 50%, oklch(0.45 0.14 240 / 0.40) 0%, transparent 60%);
    border: 2px solid oklch(0.45 0.14 240 / 0.45);
    pointer-events: none;
    z-index: 5;
    opacity: 0;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding-left: 18px;
  }
  .mc-glow-left .mc-glow-label-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .mc-glow-left .mc-glow-front {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    font-family: var(--font-heading);
    font-size: 2.4rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: oklch(0.78 0.12 240);
    text-shadow: 0 0 20px oklch(0.45 0.14 240 / 0.5);
    mix-blend-mode: screen;
    position: relative;
    z-index: 1;
  }
  .mc-glow-left .mc-glow-echo {
    position: absolute;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    font-family: var(--font-display-block), Impact, sans-serif;
    font-size: 3.2rem;
    font-weight: 400;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: oklch(0.45 0.14 240 / 0.28);
    text-shadow: 0 0 40px oklch(0.45 0.14 240 / 0.35);
    transform: translateX(10px);
    filter: blur(0.3px);
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

export function MobileCard({ post, stackIndex, onSwipeRight, onSwipeLeft }: MobileCardProps) {
  const [flipped, setFlipped] = useState(false);
  const router = useRouter();

  const wrapperRef = useRef<HTMLDivElement>(null);
  const frontFaceRef = useRef<HTMLDivElement>(null);
  const glowRightRef = useRef<HTMLDivElement>(null);
  const glowLeftRef = useRef<HTMLDivElement>(null);

  // Keep callbacks stable across effect closures
  const cbRef = useRef({ onSwipeRight, onSwipeLeft });
  useLayoutEffect(() => { cbRef.current = { onSwipeRight, onSwipeLeft }; });

  const node = post.node!;
  const title = node.title ?? '';
  const heroImg = node.heroImg ?? '';
  const date = node.date
    ? new Date(node.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const excerpt = richTextToPlain(node.excerpt);
  const category = node.tags?.[0]?.tag?.name ?? '';
  const slug = node._sys.breadcrumbs.join('/');
  const readingTime = Math.max(1, Math.ceil(excerpt.split(/\s+/).filter(Boolean).length / 200));

  // ── Animate stack position when stackIndex changes ────────────────────────
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    el.style.zIndex = String(10 - stackIndex);
    el.style.transition = '';
    el.style.transform = '';
    el.style.opacity = '1';
  }, [stackIndex]);

  // ── Pointer events — top card only ───────────────────────────────────────
  useEffect(() => {
    if (stackIndex !== 0) return;
    const el = wrapperRef.current;
    if (!el) return;

    let rafId = 0;
    const state = { startX: 0, startY: 0, curX: 0, curY: 0, time: 0, active: false, moved: false, committed: false };

    const updateOverlays = (dx: number) => {
      const right = Math.max(0, Math.min(1, dx / SWIPE_THRESHOLD));
      const left  = Math.max(0, Math.min(1, -dx / SWIPE_THRESHOLD));
      if (glowRightRef.current) glowRightRef.current.style.opacity = String(right);
      if (glowLeftRef.current)  glowLeftRef.current.style.opacity  = String(left);
      // Interpolate filigree corner color to match the border glow direction
      if (frontFaceRef.current) {
        let color: string;
        if (right > 0) {
          // gold: L 0.78→0.82, C 0.10→0.16, H 85, A 0.52→0.80
          const L = (0.78 + 0.04 * right).toFixed(3);
          const C = (0.10 + 0.06 * right).toFixed(3);
          const A = (0.52 + 0.28 * right).toFixed(3);
          color = `oklch(${L} ${C} 85 / ${A})`;
        } else if (left > 0) {
          // blue: L 0.78→0.58, C 0.10→0.12, H 85→240, A 0.52→0.80
          const L = (0.78 - 0.20 * left).toFixed(3);
          const C = (0.10 + 0.02 * left).toFixed(3);
          const H = (85 + 155 * left).toFixed(1);
          const A = (0.52 + 0.28 * left).toFixed(3);
          color = `oklch(${L} ${C} ${H} / ${A})`;
        } else {
          color = 'oklch(0.78 0.10 85 / 0.52)';
        }
        frontFaceRef.current.style.color = color;
      }
    };

    const onDown = (e: PointerEvent) => {
      if (state.committed) return;
      if ((e.target as HTMLElement).closest('.mc-read-link')) return;
      try { el.setPointerCapture(e.pointerId); } catch {}
      state.startX = e.clientX;
      state.startY = e.clientY;
      state.time = Date.now();
      state.active = true;
      state.moved = false;
      el.style.transition = 'none';
    };

    const onMove = (e: PointerEvent) => {
      if (!state.active) return;
      if ((e.target as HTMLElement).closest('.mc-read-link')) return;
      state.curX = e.clientX;
      state.curY = e.clientY;
      const dx = e.clientX - state.startX;
      const dy = (e.clientY - state.startY) * 0.2;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) state.moved = true;
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          const rdx = state.curX - state.startX;
          const rdy = (state.curY - state.startY) * 0.2;
          el.style.transform = `translateX(${rdx}px) translateY(${rdy}px) rotate(${rdx * 0.065}deg) scale(1)`;
          updateOverlays(rdx);
        });
      }
    };

    const onUp = (e: PointerEvent) => {
      if (!state.active) return;
      state.active = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }

      const dx = e.clientX - state.startX;
      const dy = (e.clientY - state.startY) * 0.2;
      const velocity = dx / Math.max(1, Date.now() - state.time);

      if (!state.moved) {
        // Tap → flip
        el.style.transition = 'transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)';
        el.style.transform = `translateY(0px) scale(1)`;
        updateOverlays(0);
        setFlipped(f => !f);
        return;
      }

      const commit = Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(velocity) > VEL_THRESHOLD;
      if (commit && !state.committed) {
        state.committed = true;
        const dir = dx > 0 ? 'right' : 'left';
        const exitX = dir === 'right' ? window.innerWidth * 1.4 : -window.innerWidth * 1.4;
        el.style.transition = 'transform 0.38s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.32s ease';
        el.style.transform = `translateX(${exitX}px) translateY(${dy}px) rotate(${dir === 'right' ? 26 : -26}deg) scale(1)`;
        el.style.opacity = '0';
        updateOverlays(0);
        setTimeout(() => {
          if (dir === 'right') cbRef.current.onSwipeRight();
          else cbRef.current.onSwipeLeft();
        }, 360);
      } else {
        el.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        el.style.transform = `translateY(0px) scale(1)`;
        updateOverlays(0);
      }
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, [stackIndex]);

  return (
    <>
      <style>{CARD_CSS}</style>
      <div
        ref={wrapperRef}
        className={`mc-wrapper${stackIndex === 0 ? ' mc-top' : ''}`}
        aria-label={`Post card: ${title}`}
      >
        {/* 3D flip container */}
        <div
          className="mc-flip-container"
          style={{ transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        >
          {/* FRONT */}
          <div ref={frontFaceRef} className="mc-face mc-front" style={{ opacity: flipped ? 0 : 1, transition: 'opacity 0.15s ease' }}>
            {heroImg && (
              <>
                <div className="mc-hero-bg" style={{ backgroundImage: `url(${heroImg})` }} />
                <div className="mc-hero-color-wash" />
              </>
            )}
            <div className="mc-overlay" />
            <FiligreeCorner pos="tl" />
            <FiligreeCorner pos="tr" />
            <FiligreeCorner pos="bl" />
            <FiligreeCorner pos="br" />
            <div className="mc-front-content">
              {category && <span className="mc-category">{category}</span>}
              <h2 className="mc-title">{title}</h2>
              <p className="mc-date">{date}</p>
              <p className="mc-flip-hint">tap to reveal excerpt</p>
            </div>
          </div>

          {/* BACK */}
          <div className="mc-face mc-back">
            <div className="mc-back-inner">
              <div className="mc-excerpt">
                {node.excerpt ? <TinaMarkdown content={node.excerpt} /> : 'No excerpt available.'}
              </div>
              <div className="mc-back-footer">
                <span className="mc-reading-time">~{readingTime} min read</span>
                <button
                  className="mc-read-link"
                  onPointerDown={e => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/posts/${slug}`);
                  }}
                >
                  Read →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Swipe overlays (top card only) */}
        {stackIndex === 0 && (
          <>
            <div ref={glowRightRef} className="mc-glow-right" aria-hidden="true">
              <div className="mc-glow-label-wrap">
                <span className="mc-glow-echo">Read</span>
                <span className="mc-glow-front">Read</span>
              </div>
            </div>
            <div ref={glowLeftRef} className="mc-glow-left" aria-hidden="true">
              <div className="mc-glow-label-wrap">
                <span className="mc-glow-echo">Skip</span>
                <span className="mc-glow-front">Skip</span>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
