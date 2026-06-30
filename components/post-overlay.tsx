'use client';

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// Desktop post overlay. Rendered in the @modal parallel-route slot by the
// intercepting route, so the home stays mounted underneath and closing
// (router.back) returns to the exact scroll position. `data-lenis-prevent`
// lets the panel scroll natively while the home's Lenis ignores it.
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
`;

const EXIT_MS = 360;

export function PostOverlay({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const closingRef = useRef(false);

  // Animate in on mount.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setOpen(false); // play the exit transition
    window.setTimeout(() => router.back(), EXIT_MS);
  }, [router]);

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
        <div className="po-scroll">{children}</div>
      </div>
    </div>
  );
}
