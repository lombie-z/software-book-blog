'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowUpRight } from 'lucide-react';
import { tinaField } from 'tinacms/dist/react';
import type { DragState } from '@/components/three/micro-biome-scene';
import { useSceneAvailable } from '@/components/three/scene-context';
import type { PageBlocksMicroBiome } from '@/tina/__generated__/types';
import { cn } from '@/lib/utils';

// The scene module carries three.js, so it (and the 2 MB model) only loads when the stage nears the viewport.
const MicroBiomeView = dynamic(() => import('@/components/three/micro-biome-scene').then((m) => m.MicroBiomeView), { ssr: false });

// Radians of rotation per pixel dragged.
const DRAG_SPEED = 0.008;

function useLiveScene() {
  const available = useSceneAvailable();
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    setOk(available && !reduced && !(memory !== undefined && memory < 4));
  }, [available]);
  return ok;
}

export function MicroBiome({ data }: { data: PageBlocksMicroBiome }) {
  const stage = useRef<HTMLDivElement>(null);
  const live = useLiveScene();
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false);
  const drag = useRef<DragState>({ yaw: 0, pitch: 0, active: false });
  const start = useRef({ x: 0, y: 0 });

  // Only fetch the 1.5 MB model once the stage is close to the viewport.
  useEffect(() => {
    if (!live || !stage.current) return;
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setNear(true), { rootMargin: '600px 0px' });
    io.observe(stage.current);
    return () => io.disconnect();
  }, [live]);

  const onReady = useCallback(() => setReady(true), []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!ready) return;
    drag.current.active = true;
    start.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    drag.current.yaw = (e.clientX - start.current.x) * DRAG_SPEED;
    drag.current.pitch = (e.clientY - start.current.y) * DRAG_SPEED * 0.5;
  };
  const onPointerUp = () => {
    drag.current = { yaw: 0, pitch: 0, active: false };
  };

  return (
    <section className="mx-auto mt-32 w-full max-w-[640px] px-6" aria-label="Micro biome">
      <div
        ref={stage}
        className={cn('relative aspect-square w-full select-none', ready && 'cursor-grab touch-pan-y active:cursor-grabbing')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Blender still: placeholder while loading, and the whole show without WebGL or with reduced motion. */}
        <img
          src="/images/3d/micro-biome.webp"
          alt="A clay micro biome: a coral planter with red spires, green bushes, a blue pool, pink clouds and stars, with the word MICRO tumbling off one corner."
          className={cn('absolute inset-0 h-full w-full object-contain transition-opacity duration-500', ready && 'opacity-0')}
          draggable={false}
        />
        {live && near && <MicroBiomeView trackRef={stage} drag={drag} onReady={onReady} animate />}
      </div>
      {data.caption && (
        <p data-tina-field={tinaField(data, 'caption')} className="mt-4 text-center text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {data.caption}
        </p>
      )}
      {data.linkLabel && (
        <p className="mt-2 text-center text-xs">
          {/* Until the full site has an address, the label shows without a link. */}
          {data.linkUrl ? (
            <a
              href={data.linkUrl}
              target="_blank"
              rel="noopener"
              data-tina-field={tinaField(data, 'linkLabel')}
              className="inline-flex items-center gap-1 text-ink underline-offset-4 hover:underline"
            >
              {data.linkLabel}
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : (
            <span data-tina-field={tinaField(data, 'linkLabel')} className="inline-flex items-center gap-1 text-ink">
              {data.linkLabel}
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </span>
          )}
        </p>
      )}
    </section>
  );
}
