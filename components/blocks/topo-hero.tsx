'use client';
import { useEffect, useRef } from 'react';
import type { Template } from 'tinacms';
import { tinaField } from 'tinacms/dist/react';
import type { PageBlocksTopoHero } from '@/tina/__generated__/types';
import type { ProgressRef } from './home-scroll-stage';
import Link from 'next/link';

export type CardPost = {
  heroImg: string;
  title: string;
  slug: string;
};

const FRAME_COUNT = 192;
const FRAME_PATH = '/images/irl-frames/ezgif-frame-';

export const TopoHero = ({
  data,
  cardPosts,
  progressRef,
}: {
  data: PageBlocksTopoHero;
  cardPosts?: CardPost[];
  progressRef?: ProgressRef;
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLDivElement[]>([]);
  const cardLayersRef = useRef<HTMLDivElement[]>([]);
  const interfaceRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef({ w: 1920, h: 1080 });
  const williamGroupRef = useRef<HTMLDivElement>(null);
  const williamCharsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const williamWidthRef = useRef(0);

  // Frame sequence refs
  const frameCanvasRef = useRef<HTMLCanvasElement>(null);
  const frameVignetteRef = useRef<HTMLDivElement>(null);
  const framesRef = useRef<HTMLImageElement[]>([]);
  const lastFrameIdxRef = useRef(-1);

  // Preload all frame images
  useEffect(() => {
    const frames: HTMLImageElement[] = [];
    for (let i = 1; i <= FRAME_COUNT; i++) {
      const img = new Image();
      img.src = `${FRAME_PATH}${String(i).padStart(3, '0')}.jpg`;
      frames.push(img);
    }
    framesRef.current = frames;
  }, []);

  // Track viewport dimensions + size frame canvas
  useEffect(() => {
    const update = () => {
      viewportRef.current = { w: window.innerWidth, h: window.innerHeight };
      const fc = frameCanvasRef.current;
      if (fc) {
        fc.width = window.innerWidth;
        fc.height = window.innerHeight;
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Animation loop — reads directly from progressRef, no React re-renders
  useEffect(() => {
    if (!progressRef) return;

    let raf: number;
    let lastScroll = -1;
    let lastTransition = -1;
    let lastHold = -1;

    const animate = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        raf = requestAnimationFrame(animate);
        return;
      }

      const scrollProgress = progressRef.current?.scroll ?? 0;
      const transitionProgress = progressRef.current?.transition ?? 0;
      const holdProgress = progressRef.current?.hold ?? 0;

      // Keep animating during active hold phase (letter slide-up + frame sequence)
      const inActiveHold = holdProgress > 0.01 && holdProgress < 0.99;
      if (scrollProgress === lastScroll && transitionProgress === lastTransition && holdProgress === lastHold && !inActiveHold) {
        raf = requestAnimationFrame(animate);
        return;
      }
      lastScroll = scrollProgress;
      lastTransition = transitionProgress;
      lastHold = holdProgress;

      const rotateProgress = scrollProgress;
      const separateLinear = Math.max(0, (scrollProgress - 0.05) / 0.95);
      const separateProgress = separateLinear * separateLinear;
      const tp = transitionProgress;

      // Canvas rotation unwind — completes by tp=0.55 so scene is flat before card expands
      const unwind = Math.pow(Math.max(0, 1 - tp / 0.55), 3);
      const rotX = rotateProgress * 55 * unwind;
      const rotZ = rotateProgress * -25 * unwind;
      const scale = 1 - rotateProgress * 0.05 * unwind;

      canvas.style.transform = `rotateX(${rotX}deg) rotateZ(${rotZ}deg) scale(${scale})`;

      // Hero layers: Z separation only (5 layers, all above card stack at Z=-600)
      const offsets = [-500, -250, 0, 250, 500];
      layersRef.current.forEach((layer, index) => {
        if (!layer) return;
        layer.style.transform = `translateZ(${separateProgress * offsets[index]}px)`;
      });

      // Interface opacity
      if (interfaceRef.current) {
        interfaceRef.current.style.opacity = String(1 - tp);
      }

      // Card layers — index 0 is the dark panel, 1+ are blog post cards
      const cardOffsets = [-600, -800, -1000, -1200, -1400, -1600];
      const cardVerticalOffsets = [0, 5, 10, 15, 20, 25];
      cardLayersRef.current.forEach((card, index) => {
        if (!card) return;

        const restZ = -index * 2;

        if (index === 0) {
          // Dark panel: slides out, comes forward, expands to fullscreen
          const baseZ = restZ + separateProgress * cardOffsets[0];

          if (tp > 0) {
            const outEase = 1 - Math.pow(1 - Math.min(1, tp / 0.2), 2);
            const fwdEase = 1 - Math.pow(1 - Math.min(1, Math.max(0, (tp - 0.15) / 0.3)), 2);
            const backEase = 1 - Math.pow(1 - Math.min(1, Math.max(0, (tp - 0.4) / 0.15)), 2);

            const cardZ = baseZ + (500 - baseZ) * fwdEase;
            const slideY = 450 * outEase * (1 - backEase);

            let cardScale = 1;
            let borderR = 4;

            if (tp > 0.55) {
              const p2e = 1 - Math.pow(1 - (tp - 0.55) / 0.45, 2.5);
              const perspFactor = 2000 / (2000 - 500);
              const vp = viewportRef.current;
              const fillScale = Math.max(vp.w / (800 * perspFactor), vp.h / (418 * perspFactor)) * 1.05;
              cardScale = 1 + (fillScale - 1) * p2e;
              borderR = 4 * (1 - p2e);
            }

            card.style.transform = `translateZ(${cardZ}px) translateY(${slideY}px) scale(${cardScale})`;
            card.style.borderRadius = `${borderR}px`;
          } else {
            card.style.transform = `translateZ(${baseZ}px)`;
            card.style.borderRadius = '';
          }
        } else {
          // Blog post cards: parallax fan only
          const zOffset = restZ + separateProgress * cardOffsets[index];
          const yFan = cardVerticalOffsets[index] * (1 - separateProgress);
          card.style.transform = `translateZ(${zOffset}px) translateY(${yFan}px)`;
        }
      });

      // ── Hold phase: WILLIAM→IRL collapse, frame sequence, IRL slide-up ──
      //   0.00–0.22  WILLIAM letters slide up + fade (staggered)
      //   0.04–0.20  Tail ". " fades
      //   0.12–0.30  Width collapse: "I. R. L" slides together
      //   0.24–0.32  Frame canvas fades in (starts nearly black)
      //   0.30–0.88  Frame sequence plays forward/backward (192 frames)
      //   0.62–0.74  Title slides up + fades (the SAME element, not an overlay)
      //   0.88–1.00  Final frame holds (full ornate pattern)
      const hold = holdProgress;
      if (hold > 0 || tp > 0) {
        // Slide up each WILLIAM letter (staggered)
        for (let i = 0; i < williamCharsRef.current.length; i++) {
          const charEl = williamCharsRef.current[i];
          if (!charEl) continue;

          const slideStart = 0.02 + i * 0.02;
          const slideEnd = slideStart + 0.14;
          const slideP = hold <= slideStart ? 0 : hold >= slideEnd ? 1 : (hold - slideStart) / (slideEnd - slideStart);
          const slideE = 1 - Math.pow(1 - slideP, 3);

          charEl.style.opacity = String(1 - slideP);
          charEl.style.transform = `translateY(${-slideE * 30}px)`;
        }

        // Tail (". ") fade
        const wg = williamGroupRef.current;
        const tail = wg?.querySelector('.topo-william-tail') as HTMLElement;
        if (tail) {
          const tailP = hold <= 0.04 ? 0 : hold >= 0.20 ? 1 : (hold - 0.04) / 0.16;
          tail.style.opacity = String(1 - tailP);
        }

        // Width collapse: "I. R. L" slides together
        if (wg) {
          if (williamWidthRef.current === 0 && wg.scrollWidth > 0) {
            williamWidthRef.current = wg.scrollWidth;
          }
          const collapseStart = 0.12;
          const collapseEnd = 0.30;
          const collapseP = hold <= collapseStart ? 0 : hold >= collapseEnd ? 1 : (hold - collapseStart) / (collapseEnd - collapseStart);
          const eased = collapseP < 0.5 ? 4 * collapseP * collapseP * collapseP : 1 - Math.pow(-2 * collapseP + 2, 3) / 2;
          if (williamWidthRef.current > 0) {
            wg.style.width = `${williamWidthRef.current * (1 - eased)}px`;
          }
        }

        // ── Frame sequence canvas (lives inside 3D scene, behind text layer via Z-sorting) ──
        const fc = frameCanvasRef.current;
        if (fc && framesRef.current.length > 0) {
          const vp = viewportRef.current;

          // Position the canvas to fill viewport from within the 800x418 3D canvas
          const offsetX = -(vp.w - 800) / 2;
          const offsetY = -(vp.h - 418) / 2;
          fc.style.left = `${offsetX}px`;
          fc.style.top = `${offsetY}px`;
          fc.style.width = `${vp.w}px`;
          fc.style.height = `${vp.h}px`;

          // Fade in (starts nearly black so crossfade is subtle)
          const fadeP = hold <= 0.24 ? 0 : hold >= 0.32 ? 1 : (hold - 0.24) / 0.08;
          fc.style.opacity = String(fadeP);

          // Z=501 — in front of dark panel (Z≈500) but behind text layer (Z=500, later in DOM)
          fc.style.transform = `translateZ(501px)`;

          // Vignette matches the frame canvas position
          const vig = frameVignetteRef.current;
          if (vig) {
            vig.style.left = `${offsetX}px`;
            vig.style.top = `${offsetY}px`;
            vig.style.width = `${vp.w}px`;
            vig.style.height = `${vp.h}px`;
            vig.style.opacity = String(fadeP);
            vig.style.transform = `translateZ(502px)`;
          }

          // Map hold to frame index
          const frameStart = 0.30;
          const frameEnd = 0.88;
          const frameP = hold <= frameStart ? 0 : hold >= frameEnd ? 1 : (hold - frameStart) / (frameEnd - frameStart);
          const frameIdx = Math.min(FRAME_COUNT - 1, Math.floor(frameP * FRAME_COUNT));

          // Only redraw when frame changes
          if (frameIdx !== lastFrameIdxRef.current) {
            lastFrameIdxRef.current = frameIdx;
            const frame = framesRef.current[frameIdx];
            if (frame?.complete) {
              const ctx = fc.getContext('2d');
              if (ctx) {
                const cw = fc.width;
                const ch = fc.height;
                const iw = frame.naturalWidth;
                const ih = frame.naturalHeight;
                const coverScale = Math.max(cw / iw, ch / ih);
                const sw = iw * coverScale;
                const sh = ih * coverScale;
                ctx.drawImage(frame, (cw - sw) / 2, (ch - sh) / 2, sw, sh);
              }
            }
          }
        }

        // ── IRL exit: the original title slides up + fades before circle zooms out ──
        const titleEl = wg?.closest('.topo-frame-title') as HTMLElement;
        if (titleEl) {
          const irlOutP = hold <= 0.62 ? 0 : hold >= 0.74 ? 1 : (hold - 0.62) / 0.12;
          const irlOutE = 1 - Math.pow(1 - irlOutP, 3);

          titleEl.style.opacity = String(1 - irlOutP);
          titleEl.style.transform = `translateY(${-irlOutE * 40}px)`;
        }

        // Also fade the tagline
        const taglineEl = wg?.closest('.topo-frame-text')?.querySelector('.topo-frame-tagline') as HTMLElement;
        if (taglineEl) {
          const tagP = hold <= 0.04 ? 0 : hold >= 0.20 ? 1 : (hold - 0.04) / 0.16;
          taglineEl.style.opacity = String(1 - tagP);
        }
      }

      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [progressRef]);

  const cards = cardPosts?.slice(0, 5) ?? [];

  return (
    <>
      <style>{`
        .topo-hero {
          --topo-bg: #0a0a0a;
          --topo-silver: #e0e0e0;
          --topo-accent: #ff3c00;
          --topo-grain-opacity: 0.15;

          position: relative;
          background-color: var(--topo-bg);
          color: var(--topo-silver);
          overflow: hidden;
          height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .topo-grain {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          pointer-events: none;
          z-index: 5;
          opacity: var(--topo-grain-opacity);
        }

        .topo-viewport {
          perspective: 2000px;
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          overflow: visible;
          position: absolute;
          inset: 0;
        }

        .topo-canvas-3d {
          position: relative;
          width: 800px; height: 418px;
          transform-style: preserve-3d;
        }

        .topo-layer {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          will-change: transform;
          backface-visibility: hidden;
        }

        .topo-layer-silhouette-warm {
          background-image: url('/images/hero-silhouette-warm.png');
          background-position: left top;
          opacity: 0.6;
        }

        .topo-layer-portrait {
          background-image: url('/images/hero-portrait-photo.png');
          background-position: center top;
          border: 1px solid rgba(224, 224, 224, 0.15);
          opacity: 0.45;
          filter: brightness(0.7);
        }

        .topo-layer-silhouette-green {
          background-image: url('/images/hero-silhouette-green.png');
          background-position: left top;
          opacity: 0.7;
        }

        .topo-layer-frame {
          background-image: url('/images/hero-frame.png');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        }

        .topo-layer-text {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .topo-frame-text {
          text-align: center;
          pointer-events: none;
        }

        .topo-frame-title {
          display: flex;
          align-items: baseline;
          justify-content: center;
          font-family: var(--font-heading);
          font-size: clamp(1.8rem, 5vw, 4rem);
          line-height: 0.9;
          letter-spacing: -0.02em;
          font-weight: 400;
          color: var(--topo-silver);
          text-transform: uppercase;
          margin: 0;
        }

        .topo-frame-tagline {
          font-family: var(--font-mono);
          font-size: 0.6rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(224, 224, 224, 0.5);
          margin-top: 0.75rem;
        }

        .topo-interface {
          position: absolute;
          inset: 0;
          padding: 2rem;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          z-index: 10;
          pointer-events: none;
        }

        @media (min-width: 640px) {
          .topo-interface { padding: 4rem; }
        }

        .topo-cta {
          pointer-events: auto;
          background: var(--topo-silver);
          color: var(--topo-bg);
          padding: 1rem 2rem;
          text-decoration: none;
          font-family: var(--font-body);
          font-weight: 700;
          font-size: 0.875rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          clip-path: polygon(0 0, 100% 0, 100% 70%, 85% 100%, 0 100%);
          transition: 0.3s;
          display: inline-block;
        }

        .topo-cta:hover {
          background: var(--topo-accent);
          transform: translateY(-5px);
        }

        .topo-card-layer {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          will-change: transform;
          backface-visibility: hidden;
          border-radius: 4px;
          overflow: hidden;
        }

        .topo-dark-panel {
          border: 1px solid rgba(224, 224, 224, 0.12);
          box-shadow:
            0 0 20px rgba(224, 224, 224, 0.06),
            0 0 60px rgba(224, 224, 224, 0.04),
            inset 0 0 40px rgba(224, 224, 224, 0.02);
          animation: topo-panel-pulse 3s ease-in-out infinite;
        }

        @keyframes topo-panel-pulse {
          0%, 100% {
            border-color: rgba(224, 224, 224, 0.10);
            box-shadow:
              0 0 20px rgba(224, 224, 224, 0.05),
              0 0 60px rgba(224, 224, 224, 0.03),
              inset 0 0 40px rgba(224, 224, 224, 0.01);
          }
          50% {
            border-color: rgba(224, 224, 224, 0.22);
            box-shadow:
              0 0 30px rgba(224, 224, 224, 0.10),
              0 0 80px rgba(224, 224, 224, 0.06),
              inset 0 0 60px rgba(224, 224, 224, 0.03);
          }
        }

        .topo-card-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.55);
          display: flex;
          align-items: flex-end;
          padding: 1.5rem;
        }

        .topo-card-title {
          font-family: var(--font-heading);
          font-size: clamp(0.9rem, 2vw, 1.4rem);
          font-weight: 700;
          color: rgba(245, 245, 245, 0.92);
          text-transform: uppercase;
          letter-spacing: -0.01em;
          line-height: 1.1;
          margin: 0;
        }

        .topo-william-group {
          display: inline-flex;
          overflow: hidden;
          white-space: nowrap;
        }

        .topo-william-group > span {
          display: inline-block;
          text-align: center;
          position: relative;
        }

        .topo-william-tail {
          white-space: pre;
        }

        .topo-frame-canvas {
          position: absolute;
          pointer-events: none;
          opacity: 0;
        }

        .topo-frame-vignette {
          position: absolute;
          pointer-events: none;
          opacity: 0;
          background: radial-gradient(
            ellipse 70% 70% at center,
            transparent 40%,
            rgba(0, 0, 0, 0.4) 70%,
            rgba(0, 0, 0, 0.95) 100%
          );
        }

      `}</style>

      <div className="topo-hero">
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <filter id="topo-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </svg>

        <div className="topo-grain" style={{ filter: 'url(#topo-grain)' }} />

        <div className="topo-interface" ref={interfaceRef}>
          {data.tagline && (
            <p
              data-tina-field={tinaField(data, 'tagline')}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', maxWidth: '400px', lineHeight: 1.6 }}
            >
              {data.tagline}
            </p>
          )}
          {data.ctaLabel && data.ctaLink && (
            <Link href={data.ctaLink} className="topo-cta" data-tina-field={tinaField(data, 'ctaLabel')}>
              {data.ctaLabel}
            </Link>
          )}
        </div>

        <div className="topo-viewport">
          <div className="topo-canvas-3d" ref={canvasRef}>
            {/* Dark panel — expands to fullscreen as seamless bridge to frame sequence */}
            <div
              className="topo-card-layer topo-dark-panel"
              ref={(el) => { cardLayersRef.current[0] = el!; }}
              style={{ background: '#050505' }}
            />

            {/* Background blog post cards (parallax only, no expansion) */}
            {cards.map((card, i) => (
              <div
                key={card.slug}
                className="topo-card-layer"
                ref={(el) => { cardLayersRef.current[i + 1] = el!; }}
                style={{ backgroundImage: `url(${card.heroImg})` }}
              >
                <div className="topo-card-overlay">
                  <p className="topo-card-title">{card.title}</p>
                </div>
              </div>
            )).reverse()}

            <div className="topo-layer topo-layer-silhouette-warm" ref={(el) => { layersRef.current[0] = el!; }} />
            <div className="topo-layer topo-layer-portrait" ref={(el) => { layersRef.current[1] = el!; }} />
            <div className="topo-layer topo-layer-silhouette-green" ref={(el) => { layersRef.current[2] = el!; }} />
            <div className="topo-layer topo-layer-frame" ref={(el) => { layersRef.current[3] = el!; }} />

            {/* Frame canvas — inside the 3D scene so text layer naturally renders in front via Z-sorting */}
            <canvas ref={frameCanvasRef} className="topo-frame-canvas" />
            <div ref={frameVignetteRef} className="topo-frame-vignette" />

            <div className="topo-layer topo-layer-text" ref={(el) => { layersRef.current[4] = el!; }}>
              <div className="topo-frame-text">
                <h1 className="topo-frame-title">
                  <span style={{ whiteSpace: 'pre' }}>{'I. '}</span>
                  <span className="topo-william-group" ref={williamGroupRef}>
                    {['W', 'I', 'L', 'L', 'I', 'A', 'M'].map((c, i) => (
                      <span key={i} ref={(el) => { williamCharsRef.current[i] = el; }}>{c}</span>
                    ))}
                    <span className="topo-william-tail">{'. '}</span>
                  </span>
                  <span style={{ whiteSpace: 'pre' }}>{'R. L'}</span>
                </h1>
                {data.tagline && (
                  <p className="topo-frame-tagline">{data.tagline}</p>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {cards.length > 0 && (
        <link rel="preload" as="image" href={cards[0].heroImg} />
      )}
    </>
  );
};

export const topoHeroBlockSchema: Template = {
  name: 'topoHero',
  label: 'Topo Hero',
  ui: {
    defaultItem: {
      headline: 'Welcome to My Blog',
      tagline: 'Thoughts, ideas, and explorations in code and beyond.',
      ctaLabel: 'Explore',
      ctaLink: '/posts',
    },
  },
  fields: [
    {
      type: 'string',
      label: 'Headline',
      name: 'headline',
    },
    {
      type: 'string',
      label: 'Tagline',
      name: 'tagline',
    },
    {
      type: 'string',
      label: 'CTA Label',
      name: 'ctaLabel',
    },
    {
      type: 'string',
      label: 'CTA Link',
      name: 'ctaLink',
    },
  ],
};
