'use client';
import { useEffect, useLayoutEffect, useRef } from 'react';
import NextImage from 'next/image';
import { gsap } from 'gsap';
import type { Template } from 'tinacms';
import { tinaField } from 'tinacms/dist/react';
import type { PageBlocksTopoHero } from '@/tina/__generated__/types';
import type { ProgressRef } from './home-scroll-stage';


export type CardPost = {
  heroImg: string;
  title: string;
  slug: string;
};

const FRAME_COUNT = 192;
const FRAME_PATH = '/images/irl-frames/ezgif-frame-';

// ── Load-in intro ──
// Each hero layer starts hidden + slightly above its rest position, then falls
// onto the stack (bottom→front) the moment its image loads, with a small
// stagger. When the whole stack has landed the title fades in, then scroll
// unlocks (home-scroll-stage keeps Lenis stopped until INTRO_EVENT fires).
const INTRO_FALL_PX = 50;
const INTRO_DUR = 0.75; // per-layer fall duration (higher = slower fall)
const INTRO_STAGGER = 0.1; // spacing between the quick silhouette drops
const INTRO_FRAME_GAP = 0.6; // pause before the filigree frame falls — its own window
const INTRO_TEXT_GAP = 0.85; // pause after the frame before the title falls — its own window
const INTRO_LOAD_TIMEOUT = 2500; // ms before a slow image is dropped anyway
// Optional artificial extra delay (ms) per gated layer to preview how the
// cascade looks on a slow connection. Ship with 0 (gated on real image loads).
const INTRO_SIMULATED_LOAD_MS = 0;
export const INTRO_EVENT = 'hero-intro-complete';
// Rest opacities of the silhouette layers (warm, portrait, green, frame)
const LAYER_REST_OPACITY = [0.6, 0.45, 0.7, 1.0];
const SILHOUETTE_SRCS = [
  '/images/hero-silhouette-warm.png',
  '/images/hero-portrait-photo.png',
  '/images/hero-silhouette-green.png',
  '/images/hero-frame.png',
];

export const TopoHero = ({
  data,
  cardPosts,
  progressRef,
  sectionNavSlot,
}: {
  data: PageBlocksTopoHero;
  cardPosts?: CardPost[];
  progressRef?: ProgressRef;
  sectionNavSlot?: React.ReactNode;
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLDivElement[]>([]);
  const cardLayersRef = useRef<HTMLDivElement[]>([]);
  const interfaceRef = useRef<HTMLDivElement>(null);
  const navSlotRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef({ w: 1920, h: 1080 });
  const williamGroupRef = useRef<HTMLDivElement>(null);
  const williamCharsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const williamWidthRef = useRef(0);

  // Frame sequence refs
  const frameCanvasRef = useRef<HTMLCanvasElement>(null);
  const frameVignetteRef = useRef<HTMLDivElement>(null);
  const framesRef = useRef<HTMLImageElement[]>([]);
  const lastFrameIdxRef = useRef(-1);
  const breatheStartRef = useRef(0); // timestamp when breathing zone was entered
  const breatheScaleRef = useRef(1); // current breathing scale for frame canvas

  // Intro state — driven by GSAP, read by the animation loop (no re-renders).
  // cardIntroRef[0] = dark panel, [1..5] = blog cards. layerIntroRef = silhouettes.
  const introActiveRef = useRef(true);
  const cardIntroRef = useRef<{ y: number; o: number }[]>([]);
  const layerIntroRef = useRef<{ y: number; o: number }[]>([]);
  const textIntroRef = useRef({ y: 0, o: 0 });

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

  // Initialise intro state before paint so layers start hidden (no flash).
  // Skip the intro when the page loads mid-scroll or via the #posts deep-link.
  useLayoutEffect(() => {
    // No progressRef → no scroll orchestration (e.g. plain page block); show
    // everything immediately rather than leaving layers stuck hidden.
    const skip = !progressRef || window.scrollY > 5 || window.location.hash === '#posts';
    const y = skip ? 0 : -INTRO_FALL_PX;
    const o = skip ? 1 : 0;
    cardIntroRef.current = Array.from({ length: 6 }, () => ({ y, o }));
    layerIntroRef.current = Array.from({ length: 4 }, () => ({ y, o }));
    textIntroRef.current = { y, o };
    introActiveRef.current = !skip;
    if (skip) window.dispatchEvent(new CustomEvent(INTRO_EVENT));
  }, []);

  // Drive the load-in: drop each layer bottom→front as its image loads, then
  // reveal the title, then signal scroll-unlock via INTRO_EVENT.
  useEffect(() => {
    if (!introActiveRef.current) return; // skipped intro
    const cardArr = cardPosts?.slice(0, 5) ?? [];

    let cancelled = false;
    const tweens: gsap.core.Tween[] = [];
    const fall = (t: { y: number; o: number } | undefined) => {
      if (t) tweens.push(gsap.to(t, { y: 0, o: 1, duration: INTRO_DUR, ease: 'power3.out' }));
    };

    // Blog cards sit behind the opaque dark panel and are never visible at
    // landing, so they aren't gated on their (remote) images — drop them up
    // front so the visible sequence starts immediately. Their images keep
    // loading in the background for the later scroll reveal.
    for (let j = cardArr.length; j >= 1; j--) fall(cardIntroRef.current[j]);

    // Visible stack, bottom→front, each gated on its image load:
    // dark panel (no image) → warm → portrait → green → frame (filigree).
    // `gap` = pause (s) before that item drops, so the filigree gets its own window.
    const lastSil = SILHOUETTE_SRCS.length - 1;
    const order: { ref: typeof cardIntroRef | typeof layerIntroRef; idx: number; src: string | null; gap?: number }[] = [
      { ref: cardIntroRef, idx: 0, src: null },
      ...SILHOUETTE_SRCS.map((src, i) => ({ ref: layerIntroRef, idx: i, src, gap: i === lastSil ? INTRO_FRAME_GAP : undefined })),
    ];

    const drop = (item: (typeof order)[number]) => fall(item.ref.current[item.idx]);

    const whenLoaded = (src: string | null, cb: () => void) => {
      // DEBUG: add a fake delay so the cascade is visible even when images are cached.
      const ready = INTRO_SIMULATED_LOAD_MS > 0 ? () => setTimeout(cb, INTRO_SIMULATED_LOAD_MS) : cb;
      if (!src) { ready(); return; }
      let done = false;
      const finish = () => { if (!done) { done = true; ready(); } };
      const img = new Image();
      img.onload = finish;
      img.onerror = finish;
      img.src = src;
      if (img.complete) finish();
      else setTimeout(finish, INTRO_LOAD_TIMEOUT);
    };

    const revealText = () => {
      if (cancelled) return;
      tweens.push(
        gsap.to(textIntroRef.current, {
          y: 0,
          o: 1,
          duration: INTRO_DUR,
          ease: 'power3.out',
          onComplete: () => {
            introActiveRef.current = false;
            window.dispatchEvent(new CustomEvent(INTRO_EVENT));
          },
        }),
      );
    };

    let i = 0;
    const next = () => {
      if (cancelled) return;
      // Stack fully landed → pause, then the title falls in as its own window.
      if (i >= order.length) { tweens.push(gsap.delayedCall(INTRO_TEXT_GAP, revealText)); return; }
      const item = order[i++];
      whenLoaded(item.src, () => {
        if (cancelled) return;
        drop(item);
        const upcoming = order[i];
        const lead = upcoming ? (upcoming.gap ?? INTRO_STAGGER) : 0;
        tweens.push(gsap.delayedCall(lead, next));
      });
    };
    next();

    return () => {
      cancelled = true;
      tweens.forEach((t) => t.kill());
    };
    // Intro runs once on mount; cardPosts is present from the first render.
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
      // Also keep animating when breathing is active (idle at end of frame sequence)
      const inActiveHold = holdProgress > 0.01 && holdProgress < 0.99;
      const mayBreathe = holdProgress > 0.50; // keep looping in breathing zone
      if (scrollProgress === lastScroll && transitionProgress === lastTransition && holdProgress === lastHold && !inActiveHold && !mayBreathe && !introActiveRef.current) {
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

      // Counter-rotate nav slot so it stays upright while canvas tilts
      if (navSlotRef.current) {
        const invScale = scale !== 0 ? 1 / scale : 1;
        navSlotRef.current.style.transform = `scale(${invScale}) rotateZ(${-rotZ}deg) rotateX(${-rotX}deg)`;
      }

      // Hero layers: Z separation only (5 layers, all above card stack at Z=-600).
      // Indices 0–3 are the silhouettes (fall + fade during intro); index 4 is the
      // text layer, revealed only after the stack has landed (textIntro.o).
      const offsets = [-500, -250, 0, 250, 500];
      layersRef.current.forEach((layer, index) => {
        if (!layer) return;
        if (index < 4) {
          const intro = layerIntroRef.current[index] ?? { y: 0, o: 1 };
          layer.style.transform = `translateZ(${separateProgress * offsets[index]}px) translateY(${intro.y}px)`;
          layer.style.opacity = String(LAYER_REST_OPACITY[index] * intro.o);
        } else {
          const tIntro = textIntroRef.current;
          layer.style.transform = `translateZ(${separateProgress * offsets[index]}px) translateY(${tIntro.y}px)`;
          layer.style.opacity = String(tIntro.o);
        }
      });

      // Interface opacity (held hidden until the intro reveals the title)
      if (interfaceRef.current) {
        interfaceRef.current.style.opacity = String((1 - tp) * textIntroRef.current.o);
      }

      // Card layers — index 0 is the dark panel, 1+ are blog post cards
      const cardOffsets = [-600, -800, -1000, -1200, -1400, -1600];
      const cardVerticalOffsets = [0, 5, 10, 15, 20, 25];
      cardLayersRef.current.forEach((card, index) => {
        if (!card) return;

        const restZ = -index * 2;
        const cIntro = cardIntroRef.current[index] ?? { y: 0, o: 1 };
        card.style.opacity = String(cIntro.o);

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

            card.style.transform = `translateZ(${cardZ}px) translateY(${slideY + cIntro.y}px) scale(${cardScale})`;
            card.style.borderRadius = `${borderR}px`;
          } else {
            card.style.transform = `translateZ(${baseZ}px) translateY(${cIntro.y}px)`;
            card.style.borderRadius = '';
          }
        } else {
          // Blog post cards: parallax fan only
          const zOffset = restZ + separateProgress * cardOffsets[index];
          const yFan = cardVerticalOffsets[index] * (1 - separateProgress);
          card.style.transform = `translateZ(${zOffset}px) translateY(${yFan + cIntro.y}px)`;
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

          // Z=500 — same plane as text layer; DOM order puts canvas behind text (text is later in DOM)
          // Breathing scale pulse is applied here (breatheScaleRef updated in breathing block below)
          const bScale = breatheScaleRef.current;
          fc.style.transform = `translateZ(500px) scale(${bScale})`;

          // Vignette matches the frame canvas position
          const vig = frameVignetteRef.current;
          if (vig) {
            vig.style.left = `${offsetX}px`;
            vig.style.top = `${offsetY}px`;
            vig.style.width = `${vp.w}px`;
            vig.style.height = `${vp.h}px`;
            vig.style.opacity = String(fadeP);
            vig.style.transform = `translateZ(500px)`;
          }

          // Map hold to frame index
          const frameStart = 0.30;
          const frameEnd = 0.88;
          const frameP = hold <= frameStart ? 0 : hold >= frameEnd ? 1 : (hold - frameStart) / (frameEnd - frameStart);

          // Breathing: eases in automatically as frame sequence nears end
          // Amplitude is scroll-driven (frameP 0.7→1.0 = amplitude 0→1), oscillation is time-driven
          const now = performance.now();
          const BREATHE_FRAMES = 10;
          const BREATHE_PERIOD = 3000; // slower breathing cycle
          const BREATHE_ZONE_START = 0.96; // frameP where breathing begins

          // Ease-in cubic: ramps up very gently at first, then stronger
          const rawAmp = frameP <= BREATHE_ZONE_START ? 0 : Math.min(1, (frameP - BREATHE_ZONE_START) / (1 - BREATHE_ZONE_START));
          const amplitude = rawAmp * rawAmp * rawAmp;

          if (amplitude > 0) {
            if (breatheStartRef.current === 0) breatheStartRef.current = now;
            const elapsed = now - breatheStartRef.current;
            const breatheWave = (Math.sin(elapsed / BREATHE_PERIOD * Math.PI * 2) + 1) / 2;
            // Subtle scale pulse: 1.0 → 1.03 synced with wave
            breatheScaleRef.current = 1 + breatheWave * amplitude * 0.03;
            const breatheFloat = breatheWave * amplitude * BREATHE_FRAMES;
            const baseFrame = Math.min(FRAME_COUNT - 1, Math.floor(frameP * FRAME_COUNT));
            const breatheA = Math.max(0, baseFrame - Math.floor(breatheFloat));
            const breatheB = Math.max(0, baseFrame - Math.ceil(breatheFloat));
            const breatheMix = breatheFloat - Math.floor(breatheFloat);

            const ctx = fc.getContext('2d');
            if (ctx) {
              const cw = fc.width;
              const ch = fc.height;
              const fA = framesRef.current[breatheA];
              const fB = framesRef.current[breatheB];
              if (fA?.complete) {
                const coverScale = Math.max(cw / fA.naturalWidth, ch / fA.naturalHeight);
                const sw = fA.naturalWidth * coverScale;
                const sh = fA.naturalHeight * coverScale;
                ctx.globalAlpha = 1;
                ctx.drawImage(fA, (cw - sw) / 2, (ch - sh) / 2, sw, sh);
              }
              if (fB?.complete && breatheA !== breatheB) {
                const coverScale = Math.max(cw / fB.naturalWidth, ch / fB.naturalHeight);
                const sw = fB.naturalWidth * coverScale;
                const sh = fB.naturalHeight * coverScale;
                ctx.globalAlpha = breatheMix;
                ctx.drawImage(fB, (cw - sw) / 2, (ch - sh) / 2, sw, sh);
                ctx.globalAlpha = 1;
              }
              lastFrameIdxRef.current = -2;
            }
          } else {
            breatheStartRef.current = 0;
            breatheScaleRef.current = 1;
          }

          // Cross-fade between adjacent frames for smooth scroll stops/starts
          if (amplitude === 0) {
            const exactFrame = frameP * (FRAME_COUNT - 1);
            const frameA = Math.floor(exactFrame);
            const frameB = Math.min(FRAME_COUNT - 1, frameA + 1);
            const mix = exactFrame - frameA;

            // Skip redraw if nothing changed (use a precision threshold for the mix)
            const mixKey = frameA + mix;
            if (Math.abs(mixKey - lastFrameIdxRef.current) > 0.001) {
              lastFrameIdxRef.current = mixKey;
              const ctx = fc.getContext('2d');
              if (ctx) {
                const cw = fc.width;
                const ch = fc.height;
                const fA = framesRef.current[frameA];
                const fB = framesRef.current[frameB];
                if (fA?.complete) {
                  const coverScale = Math.max(cw / fA.naturalWidth, ch / fA.naturalHeight);
                  const sw = fA.naturalWidth * coverScale;
                  const sh = fA.naturalHeight * coverScale;
                  ctx.globalAlpha = 1;
                  ctx.drawImage(fA, (cw - sw) / 2, (ch - sh) / 2, sw, sh);
                }
                if (fB?.complete && frameA !== frameB && mix > 0.01) {
                  const coverScale = Math.max(cw / fB.naturalWidth, ch / fB.naturalHeight);
                  const sw = fB.naturalWidth * coverScale;
                  const sh = fB.naturalHeight * coverScale;
                  ctx.globalAlpha = mix;
                  ctx.drawImage(fB, (cw - sw) / 2, (ch - sh) / 2, sw, sh);
                  ctx.globalAlpha = 1;
                }
              }
            }
          }
        }

        // ── IRL exit: glow bloom then fade out ──
        const titleEl = wg?.closest('.topo-frame-title') as HTMLElement;
        if (titleEl) {
          const irlOutP = hold <= 0.44 ? 0 : hold >= 0.58 ? 1 : (hold - 0.44) / 0.14;
          titleEl.style.opacity = String(1 - irlOutP);
          titleEl.style.transform = 'none';

          // Glow ramps up after collapse settles (0.30→0.44), then fades with the text
          const glowIn = hold <= 0.30 ? 0 : hold >= 0.44 ? 1 : (hold - 0.30) / 0.14;
          const glowEase = 1 - Math.pow(1 - glowIn, 2);
          const glowIntensity = glowEase * (1 - irlOutP);

          if (glowIntensity > 0.01) {
            const g = glowIntensity;
            titleEl.style.textShadow = [
              `0 0 ${8 * g}px rgba(224, 224, 224, ${0.6 * g})`,
              `0 0 ${20 * g}px rgba(224, 224, 224, ${0.4 * g})`,
              `0 0 ${40 * g}px rgba(200, 210, 220, ${0.25 * g})`,
              `0 0 ${80 * g}px rgba(180, 190, 200, ${0.12 * g})`,
            ].join(', ');
          } else {
            titleEl.style.textShadow = 'none';
          }
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
        </div>

        <div className="topo-viewport">
          <div className="topo-canvas-3d" ref={canvasRef}>
            {/* Section nav slot — counter-rotated so it stays upright while canvas tilts */}
            <div ref={navSlotRef} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}>
              {sectionNavSlot}
            </div>

            {/* Dark panel — expands to fullscreen as seamless bridge to frame sequence */}
            <div
              className="topo-card-layer topo-dark-panel"
              ref={(el) => { cardLayersRef.current[0] = el!; }}
              style={{ background: '#050505', opacity: progressRef ? 0 : undefined }}
            />

            {/* Background blog post cards (parallax only, no expansion) */}
            {cards.map((card, i) => (
              <div
                key={card.slug}
                className="topo-card-layer"
                ref={(el) => { cardLayersRef.current[i + 1] = el!; }}
                style={{ filter: 'brightness(0.4) saturate(0.4)', opacity: progressRef ? 0 : undefined }}
              >
                <NextImage src={card.heroImg} alt="" fill sizes="800px" loading="eager" style={{ objectFit: 'cover' }} />
              </div>
            )).reverse()}

            <div className="topo-layer topo-layer-silhouette-warm" style={{ opacity: progressRef ? 0 : undefined }} ref={(el) => { layersRef.current[0] = el!; }} />
            <div className="topo-layer topo-layer-portrait" style={{ opacity: progressRef ? 0 : undefined }} ref={(el) => { layersRef.current[1] = el!; }} />
            <div className="topo-layer topo-layer-silhouette-green" style={{ opacity: progressRef ? 0 : undefined }} ref={(el) => { layersRef.current[2] = el!; }} />
            <div className="topo-layer topo-layer-frame" style={{ opacity: progressRef ? 0 : undefined }} ref={(el) => { layersRef.current[3] = el!; }} />

            {/* Frame canvas — inside the 3D scene so text layer naturally renders in front via Z-sorting */}
            <canvas ref={frameCanvasRef} className="topo-frame-canvas" />
            <div ref={frameVignetteRef} className="topo-frame-vignette" />

            <div className="topo-layer topo-layer-text" style={{ opacity: progressRef ? 0 : undefined }} ref={(el) => { layersRef.current[4] = el!; }}>
              <div className="topo-frame-text">
                <h1 className="topo-frame-title">
                  <span style={{ whiteSpace: 'pre' }}>{'I. '}</span>
                  <span className="topo-william-group" ref={williamGroupRef}>
                    {['W', 'I', 'L', 'L', 'I', 'A', 'M'].map((c, i) => (
                      <span key={i} ref={(el) => { williamCharsRef.current[i] = el; }}>{c}</span>
                    ))}
                    <span className="topo-william-tail">{'. '}</span>
                  </span>
                  <span style={{ whiteSpace: 'pre' }}>{'R. L.'}</span>
                </h1>
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
