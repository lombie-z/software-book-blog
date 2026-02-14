'use client';
import { useEffect, useRef } from 'react';
import type { Template } from 'tinacms';
import { tinaField } from 'tinacms/dist/react';
import type { PageBlocksTopoHero } from '@/tina/__generated__/types';
import Link from 'next/link';

export const TopoHero = ({ data }: { data: PageBlocksTopoHero }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLDivElement[]>([]);
  const contoursRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const x = (window.innerWidth / 2 - e.pageX) / 25;
      const y = (window.innerHeight / 2 - e.pageY) / 25;

      canvas.style.transform = `rotateX(${55 + y / 2}deg) rotateZ(${-25 + x / 2}deg)`;

      layersRef.current.forEach((layer, index) => {
        if (!layer) return;
        const depth = (index + 1) * 15;
        const moveX = x * (index + 1) * 0.2;
        const moveY = y * (index + 1) * 0.2;
        layer.style.transform = `translateZ(${depth}px) translate(${moveX}px, ${moveY}px)`;
      });
    };

    // Entrance animation
    canvas.style.opacity = '0';
    canvas.style.transform = 'rotateX(90deg) rotateZ(0deg) scale(0.8)';

    const timeout = setTimeout(() => {
      canvas.style.transition = 'all 2.5s cubic-bezier(0.16, 1, 0.3, 1)';
      canvas.style.opacity = '1';
      canvas.style.transform = 'rotateX(55deg) rotateZ(-25deg) scale(1)';
    }, 300);

    window.addEventListener('mousemove', handleMouseMove);

    // Intermittent contour pulse
    const triggerPulse = () => {
      const el = contoursRef.current;
      if (!el) return;
      el.classList.remove('topo-contour-pulse');
      void el.offsetWidth;
      el.classList.add('topo-contour-pulse');
    };
    const pulseInterval = setInterval(triggerPulse, 4000 + Math.random() * 2000);
    // First pulse after entrance animation settles
    const firstPulse = setTimeout(triggerPulse, 3500);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeout);
      clearTimeout(firstPulse);
      clearInterval(pulseInterval);
    };
  }, []);

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
          overflow: hidden;
          position: absolute;
          inset: 0;
        }

        .topo-canvas-3d {
          position: relative;
          width: 800px; height: 500px;
          transform-style: preserve-3d;
          transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .topo-layer {
          position: absolute;
          inset: 0;
          border: 1px solid rgba(224, 224, 224, 0.1);
          background-size: cover;
          background-position: center;
          transition: transform 0.5s ease;
        }

        .topo-layer-1 {
          background-image: url('https://images.unsplash.com/photo-1558618666-fcd25c85f82e?auto=format&fit=crop&q=80&w=1200');
          filter: grayscale(1) contrast(1.2) brightness(0.5);
        }
        .topo-layer-2 {
          background-image: url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=1200');
          filter: grayscale(1) contrast(1.1) brightness(0.7);
          opacity: 0.6;
          mix-blend-mode: screen;
        }
        .topo-layer-3 {
          background-image: url('https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&q=80&w=1200');
          filter: grayscale(1) contrast(1.3) brightness(0.8);
          opacity: 0.4;
          mix-blend-mode: overlay;
        }

        .topo-contours {
          position: absolute;
          inset: 0;
          transform: translateZ(120px);
          pointer-events: none;
        }

        .topo-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          translate: -50% -50%;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.05);
        }

        .topo-contour-pulse .topo-ring {
          animation: topoRingPulse calc(0.9s + var(--slow) * 0.4s) ease-out forwards;
        }

        @keyframes topoRingPulse {
          0% { scale: 1; border-color: rgba(255,255,255,0.14); }
          25% { scale: calc(1 - 0.03 * var(--dampen)); border-color: rgba(255,255,255,0.09); }
          50% { scale: calc(1 + 0.015 * var(--dampen)); border-color: rgba(255,255,255,0.06); }
          70% { scale: calc(1 - 0.007 * var(--dampen)); }
          85% { scale: calc(1 + 0.003 * var(--dampen)); }
          100% { scale: 1; border-color: rgba(255,255,255,0.05); }
        }

        .topo-interface {
          position: absolute;
          inset: 0;
          padding: 2rem;
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: auto 1fr auto;
          z-index: 10;
          pointer-events: none;
        }

        @media (min-width: 640px) {
          .topo-interface { padding: 4rem; }
        }

        .topo-title {
          grid-column: 1 / -1;
          align-self: center;
          font-size: clamp(2.5rem, 10vw, 10rem);
          line-height: 0.85;
          letter-spacing: -0.04em;
          mix-blend-mode: difference;
          font-weight: 700;
          text-transform: uppercase;
        }

        .topo-cta {
          pointer-events: auto;
          background: var(--topo-silver);
          color: var(--topo-bg);
          padding: 1rem 2rem;
          text-decoration: none;
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
        {/* SVG grain filter */}
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <filter id="topo-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </svg>

        <div className="topo-grain" style={{ filter: 'url(#topo-grain)' }} />

        {/* Content overlay grid */}
        <div className="topo-interface">
          <div />
          <div />

          {data.headline && (
            <h1 className="topo-title" data-tina-field={tinaField(data, 'headline')}>
              {data.headline}
            </h1>
          )}

          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
            {data.tagline && (
              <p
                data-tina-field={tinaField(data, 'tagline')}
                style={{ fontFamily: 'monospace', fontSize: '0.75rem', maxWidth: '400px', lineHeight: 1.6 }}
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
        </div>

        {/* 3D perspective canvas */}
        <div className="topo-viewport">
          <div className="topo-canvas-3d" ref={canvasRef}>
            <div className="topo-layer topo-layer-1" ref={(el) => { layersRef.current[0] = el!; }} />
            <div className="topo-layer topo-layer-2" ref={(el) => { layersRef.current[1] = el!; }} />
            <div className="topo-layer topo-layer-3" ref={(el) => { layersRef.current[2] = el!; }} />
            <div className="topo-contours" ref={contoursRef}>
              {Array.from({ length: 15 }, (_, i) => {
                const size = 40 + i * 60;
                return (
                  <div
                    key={i}
                    className="topo-ring"
                    style={{
                      width: size,
                      height: size,
                      animationDelay: `${(i * (i + 1)) / 2 * 0.015}s`,
                      '--dampen': Math.max(0.05, 1 - (i / 14) * 0.95),
                      '--slow': i / 14,
                    } as React.CSSProperties}
                  />
                );
              })}
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
