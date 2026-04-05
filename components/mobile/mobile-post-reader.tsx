'use client';

// MobilePostReader — Phase 4
// Full mobile reading experience: progress bar, auto-hide header,
// queue-aware bottom nav, baroque typography, View Transition support.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { format } from 'date-fns';
import { TinaMarkdown } from 'tinacms/dist/rich-text';
import { Prism } from 'tinacms/dist/rich-text/prism';
import type { PostQuery } from '@/tina/__generated__/types';
import { components } from '@/components/mdx-components';
import { Mermaid } from '@/components/blocks/mermaid';
import ErrorBoundary from '@/components/error-boundary';
import { SocialFooter } from '@/components/social-footer';

const SESSION_KEY = 'iwrl-reading-bucket';

function readBucket(): string[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function countWords(node: unknown): number {
  if (!node) return 0;
  if (typeof node === 'string') return node.split(/\s+/).filter(Boolean).length;
  if (typeof node !== 'object') return 0;
  const n = node as { text?: string; children?: unknown[] };
  let count = n.text ? n.text.split(/\s+/).filter(Boolean).length : 0;
  if (Array.isArray(n.children)) {
    count += n.children.reduce((acc: number, c) => acc + countWords(c), 0);
  }
  return count;
}

// ─── Filigree corner bracket ──────────────────────────────────────────────────

function FiligreeCorner({ flip }: { flip?: boolean }) {
  return (
    <svg
      width="30" height="30" viewBox="0 0 36 36" fill="none" aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        ...(flip ? { right: 0 } : { left: 0 }),
        transform: flip ? 'scaleX(-1)' : undefined,
        pointerEvents: 'none',
        color: 'oklch(0.78 0.10 85 / 0.24)',
      }}
    >
      <path d="M 5 31 L 5 5 L 31 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
      <path d="M 9 31 L 9 9 L 31 9" stroke="currentColor" strokeWidth="0.55" strokeLinecap="square" opacity="0.45" />
      <circle cx="5" cy="5" r="2.2" fill="currentColor" />
      <circle cx="5" cy="15" r="1" fill="currentColor" opacity="0.4" />
      <circle cx="15" cy="5" r="1" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  /* View Transition: card-like expand into post */
  @media (prefers-reduced-motion: no-preference) {
    ::view-transition-old(root) {
      animation: mpr-vt-out 0.18s ease-out both;
    }
    ::view-transition-new(root) {
      animation: mpr-vt-in 0.38s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
  }
  @keyframes mpr-vt-out {
    from { opacity: 1; transform: scale(1); }
    to   { opacity: 0; transform: scale(0.95); }
  }
  @keyframes mpr-vt-in {
    from { opacity: 0; transform: translateY(5%) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)  scale(1); }
  }

  /* Page wrapper */
  .mpr-wrap {
    min-height: 100dvh;
    background: oklch(0.085 0 0);
    color: oklch(0.88 0.01 0);
    overflow-x: hidden;
    padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
  }

  /* Fallback enter animation when View Transitions are not supported */
  @supports not (view-transition-name: none) {
    .mpr-wrap { animation: mpr-enter 0.38s cubic-bezier(0.16, 1, 0.3, 1) both; }
  }
  @keyframes mpr-enter {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Progress bar ──────────────────────────────────────────────────────────── */
  .mpr-prog {
    position: fixed;
    top: 0; left: 0;
    height: 2px;
    background: linear-gradient(90deg, oklch(0.78 0.14 85), oklch(0.70 0.18 58));
    z-index: 400;
    pointer-events: none;
    transition: width 0.08s linear;
  }

  /* ── Auto-hide header ────────────────────────────────────────────────────────*/
  .mpr-hdr {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 300;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: max(16px, calc(env(safe-area-inset-top) + 10px)) 16px 12px;
    background: oklch(0.085 0 0 / 0.90);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid oklch(0.78 0.10 85 / 0.07);
    transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    will-change: transform;
  }
  .mpr-hdr.mpr-hdr--hidden { transform: translateY(-120%); }

  .mpr-hdr-back {
    width: 34px; height: 34px;
    flex-shrink: 0;
    border-radius: 50%;
    border: 1px solid oklch(0.78 0.10 85 / 0.24);
    background: transparent;
    color: oklch(0.78 0.10 85 / 0.85);
    font-size: 0.9rem;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    line-height: 1;
  }
  .mpr-hdr-back:active { background: oklch(0.78 0.10 85 / 0.16); }

  .mpr-hdr-share {
    width: 34px; height: 34px;
    flex-shrink: 0;
    border-radius: 50%;
    border: 1px solid oklch(0.78 0.10 85 / 0.24);
    background: transparent;
    color: oklch(0.78 0.10 85 / 0.70);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .mpr-hdr-share:active { background: oklch(0.78 0.10 85 / 0.16); }
  .mpr-hdr-share--copied { color: oklch(0.72 0.16 140 / 0.85); border-color: oklch(0.72 0.16 140 / 0.35); }

  .mpr-hdr-title {
    flex: 1; min-width: 0;
    font-family: var(--font-heading);
    font-size: 0.9rem;
    color: oklch(0.88 0.01 85);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }

  .mpr-hdr-pos {
    flex-shrink: 0;
    font-family: var(--font-mono);
    font-size: 0.52rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: oklch(0.50 0 0);
    white-space: nowrap;
  }

  /* ── Hero image ──────────────────────────────────────────────────────────────*/
  .mpr-hero {
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    position: relative;
    background: oklch(0.12 0.005 85);
  }
  .mpr-hero-shade {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 60%;
    background: linear-gradient(to top, oklch(0.085 0 0) 0%, transparent 100%);
    pointer-events: none;
  }

  /* ── Post in-content header ──────────────────────────────────────────────────*/
  .mpr-phdr {
    padding: 22px 20px 16px;
    position: relative;
  }

  .mpr-tag {
    display: inline-flex;
    align-items: center;
    font-family: var(--font-mono);
    font-size: 0.52rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: oklch(0.78 0.12 85);
    border: 1px solid oklch(0.78 0.12 85 / 0.30);
    padding: 3px 9px;
    border-radius: 2px;
    margin-bottom: 14px;
  }

  .mpr-title {
    font-family: var(--font-heading);
    font-size: clamp(1.75rem, 7.5vw, 2.5rem);
    line-height: 1.1;
    color: oklch(0.97 0.005 85);
    margin: 0 0 16px;
    text-wrap: balance;
    letter-spacing: -0.01em;
  }

  .mpr-meta {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
  }
  .mpr-meta-label {
    font-family: var(--font-mono);
    font-size: 0.53rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: oklch(0.47 0 0);
  }
  .mpr-meta-sep { color: oklch(0.28 0 0); }
  .mpr-meta-rt {
    font-family: var(--font-mono);
    font-size: 0.53rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: oklch(0.42 0 0);
  }

  /* ── Ornamental rule ─────────────────────────────────────────────────────────*/
  .mpr-rule {
    margin: 4px 20px 26px;
    height: 1px;
    background: linear-gradient(
      to right,
      oklch(0.78 0.10 85 / 0.28) 0%,
      oklch(0.78 0.10 85 / 0.04) 100%
    );
    position: relative;
  }
  .mpr-rule::before {
    content: '✦';
    position: absolute;
    top: 50%; left: 0;
    transform: translateY(-50%);
    font-size: 0.56rem;
    color: oklch(0.78 0.10 85 / 0.55);
    background: oklch(0.085 0 0);
    padding-right: 8px;
    line-height: 1;
  }

  /* ── Body text ───────────────────────────────────────────────────────────────*/
  .mpr-body {
    padding: 0 20px;
  }
  /* Mobile reading: larger text, looser leading */
  .mpr-body .prose p,
  .mpr-body .prose li {
    font-size: 1.06rem !important;
    line-height: 1.8 !important;
  }
  /* Code blocks bleed to screen edge */
  .mpr-body .prose pre {
    margin-left: -20px !important;
    margin-right: -20px !important;
    border-radius: 0 !important;
    font-size: 0.8rem !important;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  /* Scroll indicator for wide code blocks */
  .mpr-body .prose pre::-webkit-scrollbar {
    height: 3px;
  }
  .mpr-body .prose pre::-webkit-scrollbar-track {
    background: transparent;
  }
  .mpr-body .prose pre::-webkit-scrollbar-thumb {
    background: oklch(0.78 0.10 85 / 0.35);
    border-radius: 2px;
  }
  /* Inline code warm tint */
  .mpr-body .prose code:not(pre code) {
    font-size: 0.83em;
    padding: 2px 5px;
    border-radius: 3px;
    background: oklch(0.14 0.02 85 / 0.55) !important;
    color: oklch(0.82 0.12 85) !important;
  }

  /* ── Tables ──────────────────────────────────────────────────────────────────*/
  .mpr-body .prose table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }
  .mpr-body .prose thead tr {
    border-bottom: 1px solid oklch(0.78 0.10 85 / 0.25);
  }
  .mpr-body .prose thead th {
    padding: 6px 10px;
    text-align: left;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: oklch(0.65 0.08 85) !important;
  }
  .mpr-body .prose tbody tr {
    border-bottom: 1px solid oklch(0.22 0 0);
  }
  .mpr-body .prose tbody td {
    padding: 7px 10px;
    color: oklch(0.80 0.01 0) !important;
  }

  /* ── Blockquotes ─────────────────────────────────────────────────────────────*/
  .mpr-body .prose blockquote {
    border-left: 2px solid oklch(0.78 0.10 85 / 0.35) !important;
    background: oklch(0.11 0.01 85 / 0.5);
    padding: 0.6rem 1rem;
    margin: 1rem 0;
    border-radius: 0 4px 4px 0;
  }
  .mpr-body .prose blockquote p {
    color: oklch(0.68 0.04 85) !important;
    font-style: italic;
  }

  /* ── Bottom navigation bar ───────────────────────────────────────────────────*/
  .mpr-bnav {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    z-index: 300;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    padding-bottom: max(12px, env(safe-area-inset-bottom, 12px));
    background: oklch(0.085 0 0 / 0.94);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-top: 1px solid oklch(0.78 0.10 85 / 0.09);
  }
  .mpr-bnav-btn {
    height: 44px;
    min-width: 44px;
    padding: 0 14px;
    border-radius: 6px;
    border: 1px solid oklch(0.78 0.10 85 / 0.20);
    background: oklch(0.12 0.01 85 / 0.45);
    color: oklch(0.72 0.08 85);
    font-family: var(--font-mono);
    font-size: 0.58rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 6px;
    -webkit-tap-highlight-color: transparent;
    white-space: nowrap;
    transition: border-color 0.14s, color 0.14s, background 0.14s;
  }
  .mpr-bnav-btn:active {
    border-color: oklch(0.78 0.10 85 / 0.45);
    color: oklch(0.92 0.10 85);
    background: oklch(0.78 0.10 85 / 0.12);
  }
  .mpr-bnav-btn:disabled {
    opacity: 0.22;
    pointer-events: none;
  }
  .mpr-bnav-center {
    flex: 1;
    display: flex; flex-direction: column; align-items: center;
    gap: 3px;
    min-width: 0;
  }
  .mpr-bnav-pos {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.10em;
    color: oklch(0.65 0.08 85);
    line-height: 1;
  }
  .mpr-bnav-lbl {
    font-family: var(--font-mono);
    font-size: 0.44rem;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: oklch(0.36 0 0);
    line-height: 1;
  }
  .mpr-bnav-rt {
    font-family: var(--font-mono);
    font-size: 0.50rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: oklch(0.38 0 0);
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

type Post = NonNullable<PostQuery['post']>;

export default function MobilePostReader({ post }: { post: Post }) {
  const [progress, setProgress] = useState(0);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  const [shareCopied, setShareCopied] = useState(false);
  const lastScrollY = useRef(0);
  const router = useRouter();

  const slug = post._sys.breadcrumbs.join('/');
  const title = post.title ?? '';
  const date = post.date && !isNaN(new Date(post.date).getTime())
    ? format(new Date(post.date), 'MMM dd, yyyy')
    : '';
  const category = post.tags?.[0]?.tag?.name ?? '';
  const wordCount = countWords(post._body);
  const readingTime = Math.max(1, Math.round(wordCount / 220));

  // Hydrate queue from sessionStorage (client-only)
  useEffect(() => { setQueue(readBucket()); }, []);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    const shareTitle = post.title ?? '';
    if (navigator.share) {
      await navigator.share({ title: shareTitle, url });
    } else {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  }, [post.title]);

  const queueIndex = queue.indexOf(slug);
  const inQueue = queueIndex !== -1;
  const prevSlug = inQueue && queueIndex > 0 ? queue[queueIndex - 1] : null;
  const nextSlug = inQueue && queueIndex < queue.length - 1 ? queue[queueIndex + 1] : null;

  // Scroll: reading progress + header auto-hide
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(maxY > 0 ? Math.min(100, (y / maxY) * 100) : 0);

      if (y < 80) {
        setHeaderHidden(false);
      } else if (y > lastScrollY.current + 6) {
        setHeaderHidden(true);
      } else if (y < lastScrollY.current - 6) {
        setHeaderHidden(false);
      }
      lastScrollY.current = y;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Top padding when no hero image — must clear the fixed header
  const noHeroPaddingTop = 'calc(max(16px, calc(env(safe-area-inset-top) + 10px)) + 46px + 12px)';

  return (
    <ErrorBoundary>
      <style>{CSS}</style>

      {/* Reading progress bar */}
      <div className="mpr-prog" style={{ width: `${progress}%` }} aria-hidden="true" />

      {/* Auto-hide floating header */}
      <header className={`mpr-hdr${headerHidden ? ' mpr-hdr--hidden' : ''}`}>
        <button
          className="mpr-hdr-back"
          onClick={() => router.push('/')}
          aria-label="Back to card stack"
        >
          ←
        </button>
        <span className="mpr-hdr-title">{title}</span>
        {inQueue && (
          <span className="mpr-hdr-pos">{queueIndex + 1} / {queue.length}</span>
        )}
        <button
          className={`mpr-hdr-share${shareCopied ? ' mpr-hdr-share--copied' : ''}`}
          onClick={handleShare}
          aria-label={shareCopied ? 'Link copied' : 'Share this post'}
        >
          {shareCopied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          )}
        </button>
      </header>

      {/* Page content */}
      <div className="mpr-wrap">
        {/* Hero image */}
        {post.heroImg ? (
          <div className="mpr-hero">
            <Image
              src={post.heroImg}
              alt={title}
              width={800}
              height={450}
              priority
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <div className="mpr-hero-shade" />
          </div>
        ) : (
          <div style={{ height: noHeroPaddingTop }} aria-hidden="true" />
        )}

        {/* Post in-content header */}
        <div
          className="mpr-phdr"
          style={{ paddingTop: post.heroImg ? '22px' : '22px' }}
        >
          <FiligreeCorner />
          <FiligreeCorner flip />
          {category && <span className="mpr-tag">{category}</span>}
          <h1 className="mpr-title">{title}</h1>
          <div className="mpr-meta">
            {date && <span className="mpr-meta-label">{date}</span>}
            {date && <span className="mpr-meta-sep">·</span>}
            <span className="mpr-meta-rt">~{readingTime} min read</span>
          </div>
        </div>

        {/* Ornamental rule */}
        <div className="mpr-rule" aria-hidden="true" />

        {/* Body */}
        <div className="mpr-body">
          <div
            className="prose prose-invert max-w-none
              prose-headings:font-heading prose-headings:tracking-wide
              prose-headings:text-[#f5f4f0]
              prose-p:text-[#ccc9c0]
              prose-a:text-[#c9a85c] prose-a:underline
              prose-strong:text-[#ede8df]
              prose-blockquote:border-[#5a4e38] prose-blockquote:text-[#8a8070]
              prose-code:text-[#d4ab6a]"
          >
            <TinaMarkdown content={post._body} components={{
              ...components,
              code_block: (props: any) => {
                if (!props) return <></>;
                if (props.lang === 'mermaid') return <Mermaid value={props.value} />;
                return <Prism lang={props.lang} value={props.value} theme="vsDark" />;
              },
            }} />
          </div>
        </div>
      </div>

      {/* Social island — sits above the bottom nav bar (bottom: 80px clears the ~64px mpr-bnav) */}
      <SocialFooter bottom="80px" />

      {/* Bottom navigation bar */}
      <nav className="mpr-bnav" aria-label="Post navigation">
        {inQueue ? (
          <>
            <button
              className="mpr-bnav-btn"
              onClick={() => prevSlug && router.push(`/posts/${prevSlug}`)}
              disabled={!prevSlug}
              aria-label="Previous post in queue"
            >
              ← Prev
            </button>
            <div className="mpr-bnav-center">
              <span className="mpr-bnav-pos">{queueIndex + 1} / {queue.length}</span>
              <span className="mpr-bnav-lbl">In Queue</span>
            </div>
            <button
              className="mpr-bnav-btn"
              onClick={() => nextSlug && router.push(`/posts/${nextSlug}`)}
              disabled={!nextSlug}
              aria-label="Next post in queue"
            >
              Next →
            </button>
          </>
        ) : (
          <>
            <button
              className="mpr-bnav-btn"
              onClick={() => router.push('/')}
              aria-label="Back to card stack"
            >
              ← Stack
            </button>
            <div className="mpr-bnav-center" />
            <span className="mpr-bnav-rt">{readingTime} min read</span>
          </>
        )}
      </nav>
    </ErrorBoundary>
  );
}
