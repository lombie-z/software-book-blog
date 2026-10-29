'use client';

import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { NicheSketch } from './niche-sketch';

// The 3D niches (and three.js with them) load in the browser after the page is up; until then, and without WebGL,
// each niche box shows its CSS-shaded stand-in.
const PlasterNiche = dynamic(() => import('./plaster-niche').then((m) => m.PlasterNiche), { ssr: false });

/**
 * One niche box. The 3D room draws into it from the shared canvas; above that sits an SVG drawing of the same room
 * (same eye, light and sun) that fades out once the 3D has drawn, so the handoff is near invisible. Without WebGL the
 * drawing simply stays.
 */
export function Niche({ id, aspect, slope = 0, cactus = false }: { id: string; aspect: string; slope?: number; cactus?: boolean }) {
  const [ready, setReady] = useState(false);
  const [shown, setShown] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const onShown = useCallback(() => setShown(true), []);
  // Hand over only when the 3D has drawn and the drawing has fully faded in, whichever is later.
  const handOver = ready && shown;
  // The sloped ceiling is cut on the drawing layers only (the 3D cuts its own). Clipping the niche box itself would
  // make it a stacking context and trap the stand-in's z-index beneath the canvas, so the 3D would pop in over it.
  const clip = slope ? { clipPath: `polygon(0 ${slope * 100}%, 100% 0, 100% 100%, 0 100%)` } : undefined;
  return (
    <div data-niche={id} className={cn(aspect, 'relative w-full')}>
      {/* Under the canvas: drei skips a view's first frame or two as it scrolls back on screen, and this matching
          drawing shows through instead of empty plaster, so there's no pop. */}
      {handOver && (
        <div className='absolute inset-0' style={clip}>
          <NicheSketch slope={slope} />
        </div>
      )}
      <PlasterNiche slope={slope} cactus={cactus} onReady={onReady} />
      {/* Above the canvas (z-0) until the room is in. The plaster base (the page colour) keeps the 3D from showing
          through while the drawing is still fading in. Symmetric easing so the change is spread evenly. */}
      <div
        style={clip}
        className={cn(
          'pointer-events-none absolute inset-0 z-[1] bg-plaster transition-opacity duration-[1600ms] [transition-timing-function:cubic-bezier(0.45,0,0.55,1)]',
          handOver && 'opacity-0'
        )}
      >
        <NicheSketch slope={slope} active={!handOver} onShown={onShown} />
      </div>
    </div>
  );
}
