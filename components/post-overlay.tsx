'use client';

import Image from 'next/image';
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
    /* overflow-y: scroll (not auto) so the styled scrollbar's 9px lane is
       ALWAYS reserved. With auto, the classic scrollbar (forced by styling
       ::-webkit-scrollbar) only appears once the loaded post overflows, which
       shrinks the content area and shifts the centred header sideways — the
       shift you see on skeleton→content. scrollbar-gutter covers browsers that
       honour it (Safari <18.2 didn't); scroll covers the rest. */
    overflow-y: scroll;
    overscroll-behavior: contain;
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
// then restores the URL (history.back) and unmounts this. `title` is the
// clicked card's title (null when opened via back/forward): when present the
// skeleton renders it in its final position so the title never shifts on load.
export function PostOverlay({ slug, title, heroImg, date, onRequestClose }: { slug: string; title?: string | null; heroImg?: string | null; date?: string | null; onRequestClose: () => void }) {
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

  // Format the card's date exactly like PostClientPage (UTC) so the meta row
  // shown in the skeleton is byte-identical to the loaded post — no shift.
  const d = date ? new Date(date) : null;
  const formattedDate = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '';

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
            // No wrapper fade: the title is already in place from the skeleton,
            // so re-fading it would flash. The hero fades on its own load and
            // the body/meta resolve in place from the skeleton bars.
            <PostClientPage {...post} overlay />
          ) : (
            // Mirrors PostClientPage's overlay layout exactly (same container,
            // same h1 classes/margins) so the swap to real content doesn't shift.
            <div className="mx-auto max-w-3xl px-6 pb-16 pt-14" aria-hidden={title ? undefined : true}>
              {title ? (
                <h1 className="mb-8 font-heading text-5xl tracking-wide text-[#e0e0e0] md:text-6xl">{title}</h1>
              ) : (
                <>
                  <div className="po-skel-block" style={{ width: '82%', height: 44, marginBottom: 14 }} />
                  <div className="po-skel-block" style={{ width: '55%', height: 44, marginBottom: 32 }} />
                </>
              )}
              {/* meta row — real date + share button, identical markup to
                  PostClientPage so it doesn't shift when the post loads */}
              <div className="mb-16 flex items-center justify-between gap-4">
                <span className="font-mono text-xs uppercase tracking-widest text-[#e0e0e0]/50">{formattedDate}</span>
                <span
                  className="inline-flex items-center gap-2 rounded border border-[#e0e0e0]/15 bg-transparent px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-[#e0e0e0]/50"
                  aria-hidden="true"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  Share
                </span>
              </div>
              {/* hero image — the card's 640px variant is cached, so it paints
                  instantly instead of a gray block; mb-16 */}
              {heroImg ? (
                <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', marginBottom: 64, borderRadius: 8, overflow: 'hidden' }}>
                  <Image src={heroImg} alt="" fill sizes="640px" style={{ objectFit: 'cover' }} />
                </div>
              ) : (
                <div className="po-skel-block" style={{ width: '100%', aspectRatio: '16 / 9', marginBottom: 64, borderRadius: 12 }} />
              )}
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
