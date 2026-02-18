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

const FLEUR_COUNT = 7;

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

  // Fleur-de-lis refs
  const fleurRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Cached screen positions + scale of WILLIAM chars, evenly-spaced rest positions, and circle targets
  const charScreenPosRef = useRef<{ x: number; y: number; scale: number }[]>([]);
  const fleurRestPosRef = useRef<{ x: number; y: number }[]>([]);
  const fleurTargetsRef = useRef<{ x: number; y: number; angle: number }[]>([]);

  // Track viewport dimensions for card expand scaling
  useEffect(() => {
    const update = () => {
      viewportRef.current = { w: window.innerWidth, h: window.innerHeight };
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

      // Keep animating during active hold phase (flicker + fly + vine growth)
      const inActiveHold = holdProgress > 0.01 && holdProgress < 0.88;
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

      // Card layers
      const cardOffsets = [-600, -800, -1000, -1200, -1400];
      const cardVerticalOffsets = [0, 5, 10, 15, 20];
      cardLayersRef.current.forEach((card, index) => {
        if (!card) return;

        const restZ = -index * 2;

        if (index === 0) {
          const baseZ = restZ + separateProgress * cardOffsets[0];

          if (tp > 0) {
            const outEase = 1 - Math.pow(1 - Math.min(1, tp / 0.2), 2);
            const fwdEase = 1 - Math.pow(1 - Math.min(1, Math.max(0, (tp - 0.15) / 0.3)), 2);
            const backEase = 1 - Math.pow(1 - Math.min(1, Math.max(0, (tp - 0.4) / 0.15)), 2);

            const cardZ = baseZ + (500 - baseZ) * fwdEase;
            const slideY = 450 * outEase * (1 - backEase);

            let cardScale = 1;
            let borderR = 4;
            let bright = 1;
            let overlayA = 0.55;
            let titleOp = 1;

            if (tp > 0.55) {
              const p2e = 1 - Math.pow(1 - (tp - 0.55) / 0.45, 2.5);
              const perspFactor = 2000 / (2000 - 500);
              const vp = viewportRef.current;
              const fillScale = Math.max(vp.w / (800 * perspFactor), vp.h / (418 * perspFactor)) * 1.05;
              cardScale = 1 + (fillScale - 1) * p2e;
              borderR = 4 * (1 - p2e);
              bright = 1 - 0.2 * p2e;
              overlayA = 0.55 - 0.1 * p2e;
              titleOp = Math.max(0, 1 - p2e * 3);
            }

            card.style.transform = `translateZ(${cardZ}px) translateY(${slideY}px) scale(${cardScale})`;
            card.style.borderRadius = `${borderR}px`;
            card.style.filter = bright < 1 ? `brightness(${bright.toFixed(3)})` : '';

            const overlay = card.querySelector('.topo-card-overlay') as HTMLElement;
            if (overlay) {
              overlay.style.background = `rgba(0,0,0,${overlayA.toFixed(3)})`;
              const title = overlay.querySelector('.topo-card-title') as HTMLElement;
              if (title) title.style.opacity = String(titleOp);
            }
          } else {
            card.style.transform = `translateZ(${baseZ}px)`;
            card.style.borderRadius = '';
            card.style.filter = '';
            const overlay = card.querySelector('.topo-card-overlay') as HTMLElement;
            if (overlay) {
              overlay.style.background = '';
              const title = overlay.querySelector('.topo-card-title') as HTMLElement;
              if (title) title.style.opacity = '';
            }
          }
        } else {
          const zOffset = restZ + separateProgress * cardOffsets[index];
          const yFan = cardVerticalOffsets[index] * (1 - separateProgress);
          card.style.transform = `translateZ(${zOffset}px) translateY(${yFan}px)`;
        }
      });

      // ── Hold phase: fleur flicker → settle → fly into circle around "I. R. L" ──
      // Single set of absolute fleur divs the whole way:
      //   0.00–0.18  Flicker: positioned over WILLIAM chars, randomly toggled with letters
      //   0.18–0.28  Settle: all fleurs visible over chars, letters hidden, brief pause
      //   0.28–0.55  Fly: fleurs animate from char positions into circular formation; "I. R. L" collapses
      const hold = holdProgress;
      if (hold > 0 || tp > 0) {
        const now = Date.now();

        // ── Measure char positions + compute circle targets once at hold start ──
        if (hold > 0.005 && charScreenPosRef.current.length === 0) {
          const vp = viewportRef.current;
          const fleurEl = fleurRefs.current[0];
          const fleurH = fleurEl?.querySelector('img')?.offsetHeight || 44;

          charScreenPosRef.current = williamCharsRef.current.map((el) => {
            if (!el) return { x: 50, y: 50, scale: 0.5 };
            const rect = el.getBoundingClientRect();
            return {
              x: ((rect.left + rect.width / 2) / vp.w) * 100,
              y: ((rect.top + rect.height / 2) / vp.h) * 100,
              scale: rect.height / fleurH,
            };
          });

          // Compute evenly-spaced rest positions across the WILLIAM group width
          const wgEl = williamGroupRef.current;
          const wgRect = wgEl?.getBoundingClientRect();
          if (wgRect && wgRect.width > 0) {
            const groupLeft = wgRect.left;
            const groupWidth = wgRect.width;
            const groupCenterY = (wgRect.top + wgRect.height / 2) / vp.h * 100;
            fleurRestPosRef.current = Array.from({ length: FLEUR_COUNT }, (_, i) => ({
              x: ((groupLeft + (i + 0.5) / FLEUR_COUNT * groupWidth) / vp.w) * 100,
              y: groupCenterY,
            }));
          }

          // Compute circular formation centered on the title
          const titleEl = williamGroupRef.current?.closest('.topo-frame-title') as HTMLElement;
          const titleRect = titleEl?.getBoundingClientRect();
          const centerX = titleRect ? ((titleRect.left + titleRect.width / 2) / vp.w) * 100 : 50;
          const centerY = titleRect ? ((titleRect.top + titleRect.height / 2) / vp.h) * 100 : 48;

          // Use min dimension so it's a true circle on any aspect ratio
          const radiusPx = Math.min(vp.w, vp.h) * 0.2;
          const radiusXPct = (radiusPx / vp.w) * 100;
          const radiusYPct = (radiusPx / vp.h) * 100;

          fleurTargetsRef.current = Array.from({ length: FLEUR_COUNT }, (_, i) => {
            const angleRad = (i / FLEUR_COUNT) * Math.PI * 2 - Math.PI / 2; // start from top
            return {
              x: centerX + Math.cos(angleRad) * radiusXPct,
              y: centerY + Math.sin(angleRad) * radiusYPct,
              angle: (i / FLEUR_COUNT) * 360, // point outward (0° = up at 12 o'clock, CW)
            };
          });
        }

        // Slide distance (% of viewport height) for the swap
        const slideDist = 4;

        // ── Phase 1: Slide up WILLIAM letters, slide in fleurs from below (staggered) ──
        // ── Phase 2: Settle, then fly to circle ──
        for (let i = 0; i < fleurRefs.current.length; i++) {
          const el = fleurRefs.current[i];
          if (!el) continue;

          const charEl = williamCharsRef.current[i];
          const measured = charScreenPosRef.current[i];
          const restPos = fleurRestPosRef.current[i];
          const restX = restPos?.x ?? measured?.x ?? 50;
          const restY = restPos?.y ?? measured?.y ?? 50;
          const textScale = measured?.scale ?? 0.5;
          const target = fleurTargetsRef.current[i];
          if (!target) continue;

          // Slide timing per character (staggered)
          const slideStart = 0.02 + i * 0.03;
          const slideEnd = slideStart + 0.12;
          const slideP = hold <= slideStart ? 0 : hold >= slideEnd ? 1 : (hold - slideStart) / (slideEnd - slideStart);
          // Smooth ease-out for the slide
          const slideE = 1 - Math.pow(1 - slideP, 3);

          // Fly timing — starts after settle pause, gentle ease
          const flyStart = 0.38;
          const flyEnd = 0.72;
          const flyP = hold <= flyStart ? 0 : Math.min(1, (hold - flyStart) / (flyEnd - flyStart));
          const flyE = 1 - Math.pow(1 - flyP, 2.5);

          // Fleur position: slides up from below → evenly-spaced rest position → circle target
          const slideY = restY - slideDist * slideE + slideDist; // starts below, arrives at restY
          const cx = (flyP > 0) ? restX + (target.x - restX) * flyE : restX;
          const cy = (flyP > 0) ? restY + (target.y - restY) * flyE : slideY;

          // Scale: text-size → full fleur size (only during fly)
          const fleurScale = textScale + (1 - textScale) * flyE;

          // Rotation: smoothly from 0° to outward-facing target angle, shortest path
          let angleDiff = target.angle % 360;
          if (angleDiff > 180) angleDiff -= 360;
          if (angleDiff < -180) angleDiff += 360;
          const currentRot = angleDiff * flyE;

          // Fleur opacity: fades in during slide
          const fleurOpacity = slideP;

          el.style.opacity = String(fleurOpacity);
          el.style.left = `${cx}%`;
          el.style.top = `${cy}%`;
          el.style.transform = `translate(-50%, -50%) rotate(${currentRot}deg) scale(${fleurScale})`;

          // Letter: slides up and fades out (inverse timing)
          if (charEl) {
            const letterOffset = -slideE * 30; // slides up in px
            charEl.style.opacity = String(1 - slideP);
            charEl.style.transform = `translateY(${letterOffset}px)`;
          }
        }

        // Tail (". ") fade — matches slide timing
        const wg = williamGroupRef.current;
        const tail = wg?.querySelector('.topo-william-tail') as HTMLElement;
        if (tail) {
          const tailP = hold <= 0.04 ? 0 : hold >= 0.18 ? 1 : (hold - 0.04) / 0.14;
          tail.style.opacity = String(1 - tailP);
        }

        // Width collapse: "I. R. L" slides together — synced with fly
        if (wg) {
          if (williamWidthRef.current === 0 && wg.scrollWidth > 0) {
            williamWidthRef.current = wg.scrollWidth;
          }
          const collapseStart = 0.38;
          const collapseEnd = 0.72;
          const collapseP = hold <= collapseStart ? 0 : hold >= collapseEnd ? 1 : (hold - collapseStart) / (collapseEnd - collapseStart);
          const eased = collapseP < 0.5 ? 4 * collapseP * collapseP * collapseP : 1 - Math.pow(-2 * collapseP + 2, 3) / 2;
          if (williamWidthRef.current > 0) {
            wg.style.width = `${williamWidthRef.current * (1 - eased)}px`;
          }
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

        .topo-fleur {
          position: absolute;
          z-index: 15;
          pointer-events: none;
          opacity: 0;
          transform: translate(-50%, -50%);
        }

        .topo-fleur img {
          width: clamp(28px, 4vw, 44px);
          height: auto;
          filter: brightness(0) invert(0.7);
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
            {cards.map((card, i) => (
              <div
                key={card.slug}
                className="topo-card-layer"
                ref={(el) => { cardLayersRef.current[i] = el!; }}
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

        {/* Fleur-de-lis icons — flicker over WILLIAM chars, then fly into circle */}
        {Array.from({ length: FLEUR_COUNT }, (_, i) => (
          <div
            key={`fleur-${i}`}
            className="topo-fleur"
            ref={(el) => { fleurRefs.current[i] = el; }}
          >
            <img src="/images/fleur-de-lis.svg" alt="" draggable={false} />
          </div>
        ))}
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
