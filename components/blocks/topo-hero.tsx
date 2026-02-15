'use client';
import { useEffect, useRef } from 'react';
import type { Template } from 'tinacms';
import { tinaField } from 'tinacms/dist/react';
import type { PageBlocksTopoHero } from '@/tina/__generated__/types';
import Link from 'next/link';

export const TopoHero = ({ data, scrollProgress = 0 }: { data: PageBlocksTopoHero; scrollProgress?: number }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLDivElement[]>([]);

  // Scroll-driven 3D animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Both rotation and separation run the full scroll duration
    const rotateProgress = scrollProgress;
    const separateLinear = Math.max(0, (scrollProgress - 0.05) / 0.95);
    const separateProgress = separateLinear * separateLinear;

    const rotX = rotateProgress * 55;
    const rotZ = rotateProgress * -25;
    const scale = 1 - rotateProgress * 0.05;

    canvas.style.transform = `rotateX(${rotX}deg) rotateZ(${rotZ}deg) scale(${scale})`;

    // Layer 0 = portrait (bottom), Layer 1 = frame (middle), Layer 2 = text (top)
    // Spread evenly: -400, 0, +400 — so the whole stack shifts down as it expands
    const offsets = [-400, 0, 400];
    layersRef.current.forEach((layer, index) => {
      if (!layer) return;
      const zOffset = separateProgress * offsets[index];
      layer.style.transform = `translateZ(${zOffset}px)`;
    });
  }, [scrollProgress]);

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
        }

        .topo-layer-portrait {
          background-image: url('/images/hero-portrait.png');
          border: 1px solid rgba(224, 224, 224, 0.15);
          opacity: 0.3;
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

      `}</style>

      <div className="topo-hero">
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <filter id="topo-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </svg>

        <div className="topo-grain" style={{ filter: 'url(#topo-grain)' }} />

        {/* Bottom UI: tagline + CTA */}
        <div className="topo-interface">
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

        {/* 3D perspective canvas */}
        <div className="topo-viewport">
          <div className="topo-canvas-3d" ref={canvasRef}>
            {/* Layer 1: Portrait photo (bottom) */}
            <div className="topo-layer topo-layer-portrait" ref={(el) => { layersRef.current[0] = el!; }} />

            {/* Layer 2: Ornamental frame (middle) */}
            <div className="topo-layer topo-layer-frame" ref={(el) => { layersRef.current[1] = el!; }} />

            {/* Layer 3: Text (top) */}
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
