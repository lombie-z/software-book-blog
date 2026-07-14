'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PostClientPage from '@/app/posts/[slug]/client-page';
import type { PostQuery } from '@/tina/__generated__/types';

// Desktop post overlay. Rendered directly on the home page (not via a parallel/
// intercepting route — those crash the router on Vercel). It fetches the post's
// Tina query result from /api/post and renders it in a centred panel while the
// home stays mounted underneath. `data-lenis-prevent` lets the panel scroll
// natively while the home's Lenis ignores it.
const CSS = `
  .po-root {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4vh 16px;
  }
  .po-backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    padding: 0;
    cursor: pointer;
    background: oklch(0.07 0 0 / 0.72);
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
    opacity: 0;
    transition: opacity 0.34s ease;
  }
  .po-root[data-open='true'] .po-backdrop { opacity: 1; }

  .po-panel {
    position: relative;
    width: min(880px, 100%);
    max-height: 92vh;
    background: #0a0a0a;
    border: 1px solid oklch(0.78 0.10 85 / 0.16);
    border-radius: 14px;
    box-shadow: 0 30px 80px oklch(0 0 0 / 0.6), 0 0 0 1px oklch(0 0 0 / 0.4);
    overflow: hidden;
    opacity: 0;
    transform: translateY(22px) scale(0.985);
    transition: opacity 0.34s ease, transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .po-root[data-open='true'] .po-panel {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  .po-scroll {
    max-height: 92vh;
    overflow-y: auto;
    overscroll-behavior: contain;
    /* Reserve a gutter so the scrollbar gets its own lane (content + close
       button never sit under it), and keep it thin/themed. */
    scrollbar-gutter: stable;
    scrollbar-width: thin;
    scrollbar-color: oklch(0.78 0.10 85 / 0.35) transparent;
  }
  .po-scroll::-webkit-scrollbar {
    width: 9px;
  }
  .po-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .po-scroll::-webkit-scrollbar-thumb {
    background: oklch(0.78 0.10 85 / 0.3);
    border-radius: 9px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }
  .po-scroll::-webkit-scrollbar-thumb:hover {
    background: oklch(0.78 0.10 85 / 0.5);
    background-clip: padding-box;
  }

  .po-close {
    position: absolute;
    top: 14px;
    right: 22px;
    z-index: 2;
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 1px solid oklch(0.78 0.10 85 / 0.22);
    background: oklch(0.07 0 0 / 0.55);
    color: oklch(0.85 0.04 85 / 0.85);
    font-size: 15px;
    cursor: pointer;
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
    transition: background 0.2s, color 0.2s, transform 0.2s;
  }
  .po-close:hover {
    background: oklch(0.78 0.10 85 / 0.14);
    color: oklch(0.95 0.02 85);
    transform: scale(1.06);
  }

  @media (prefers-reduced-motion: reduce) {
    .po-panel, .po-backdrop { transition-duration: 0.01s; }
  }

  /* Loading skeleton — mirrors the post layout, gold sheen sweep. Fades out
     when the real content mounts so the swap reads as a reveal, not a pop. */
  .po-skel {
    max-width: 48rem;
    margin: 0 auto;
    padding: 56px 24px 64px;
  }

  /* Loaded content fades/rises in so the skeleton→post swap reads as a reveal. */
  .po-content-in { animation: po-fade-in 0.5s ease-out; }
  @keyframes po-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .po-skel-block {
    position: relative;
    overflow: hidden;
    border-radius: 8px;
    background: oklch(0.78 0.10 85 / 0.055);
  }
  .po-skel-block::after {
    content: '';
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    background: linear-gradient(90deg, transparent 0%, oklch(0.86 0.08 85 / 0.11) 50%, transparent 100%);
    animation: po-sheen 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }
  @keyframes po-sheen { to { transform: translateX(100%); } }

  @media (prefers-reduced-motion: reduce) {
    .po-skel-block::after { animation: none; }
    .po-content-in { animation: none; }
  }
`;

const SKELETON_LINES = [
  { w: '100%', h: 15 },
  { w: '96%', h: 15 },
  { w: '88%', h: 15 },
  { w: '40%', h: 15 },
];

const EXIT_MS = 360;

type PostProps = { data: PostQuery; query: string; variables: { relativePath: string } };

// `onRequestClose` is called after the exit animation finishes — the parent
// then restores the URL (history.back) and unmounts this.
export function PostOverlay({ slug, onRequestClose }: { slug: string; onRequestClose: () => void }) {
  const [open, setOpen] = useState(false);
  const [post, setPost] = useState<PostProps | null>(null);
  const [failed, setFailed] = useState(false);
  const closingRef = useRef(false);

  // Animate in on mount.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Fetch the post for this slug.
  useEffect(() => {
    let cancelled = false;
    setPost(null);
    setFailed(false);
    fetch(`/api/post?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!cancelled) setPost(d);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setOpen(false); // play the exit transition
    window.setTimeout(onRequestClose, EXIT_MS);
  }, [onRequestClose]);

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <div className="po-root" data-open={open} data-lenis-prevent role="dialog" aria-modal="true">
      <style>{CSS}</style>
      <button type="button" className="po-backdrop" aria-label="Close post" onClick={close} />
      <div className="po-panel">
        <button type="button" className="po-close" aria-label="Close post" onClick={close}>
          ✕
        </button>
        <div className="po-scroll">
          {failed ? (
            <div style={{ display: 'flex', minHeight: '40vh', alignItems: 'center', justifyContent: 'center', color: 'oklch(0.85 0.04 85 / 0.6)', fontFamily: 'var(--font-heading)', fontSize: '1.1rem', letterSpacing: '0.03em' }}>
              This post could not be summoned.
            </div>
          ) : post ? (
            <div className="po-content-in">
              <PostClientPage {...post} overlay />
            </div>
          ) : (
            <div className="po-skel" aria-hidden="true">
              {/* title */}
              <div className="po-skel-block" style={{ width: '82%', height: 44, marginBottom: 14 }} />
              <div className="po-skel-block" style={{ width: '55%', height: 44, marginBottom: 32 }} />
              {/* meta row */}
              <div className="po-skel-block" style={{ width: '30%', height: 12, marginBottom: 40 }} />
              {/* hero image */}
              <div className="po-skel-block" style={{ width: '100%', aspectRatio: '16 / 9', marginBottom: 40, borderRadius: 12 }} />
              {/* body lines */}
              {SKELETON_LINES.map((l, i) => (
                <div key={i} className="po-skel-block" style={{ width: l.w, height: l.h, marginBottom: 16 }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
