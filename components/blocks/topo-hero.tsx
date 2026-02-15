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

    const animate = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        raf = requestAnimationFrame(animate);
        return;
      }

      const scrollProgress = progressRef.current?.scroll ?? 0;
      const transitionProgress = progressRef.current?.transition ?? 0;

      // Skip work if nothing changed
      if (scrollProgress === lastScroll && transitionProgress === lastTransition) {
        raf = requestAnimationFrame(animate);
        return;
      }
      lastScroll = scrollProgress;
      lastTransition = transitionProgress;

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

      // Hero layers: Z separation only
      const offsets = [-400, 0, 400];
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
            // Bracket '[' motion: slide out → forward → slide back
            const outEase = 1 - Math.pow(1 - Math.min(1, tp / 0.2), 2);
            const fwdEase = 1 - Math.pow(1 - Math.min(1, Math.max(0, (tp - 0.15) / 0.3)), 2);
            const backEase = 1 - Math.pow(1 - Math.min(1, Math.max(0, (tp - 0.4) / 0.15)), 2);

            const cardZ = baseZ + (500 - baseZ) * fwdEase;
            const slideY = 450 * outEase * (1 - backEase);

            // Phase 2: card scales to fill viewport
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

        .topo-layer-portrait {
          background-image: url('/images/hero-portrait.png');
          border: 1px solid rgba(224, 224, 224, 0.15);
          opacity: 0.5;
          filter: brightness(0.6);
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

            <div className="topo-layer topo-layer-portrait" ref={(el) => { layersRef.current[0] = el!; }} />
            <div className="topo-layer topo-layer-frame" ref={(el) => { layersRef.current[1] = el!; }} />
            <div className="topo-layer topo-layer-text" ref={(el) => { layersRef.current[2] = el!; }}>
              <div className="topo-frame-text">
                {data.headline && (
                  <h1 className="topo-frame-title" data-tina-field={tinaField(data, 'headline')}>
                    {data.headline}
                  </h1>
                )}
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
