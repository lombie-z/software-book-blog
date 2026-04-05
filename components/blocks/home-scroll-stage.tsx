'use client';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import Link from 'next/link';
import { Blocks } from '@/components/blocks';
import { SocialFooter } from '@/components/social-footer';
import type { Page, PostConnectionQuery } from '@/tina/__generated__/types';
import type { CardPost } from './topo-hero';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

type PostEdges = NonNullable<PostConnectionQuery['postConnection']['edges']>;

export type ProgressRef = React.RefObject<{ scroll: number; transition: number; hold: number }>;

interface HomeScrollStageProps {
  pageData: Omit<Page, 'id' | '_sys' | '_values'>;
  recentPosts: PostEdges;
}

const CARD_H = 380;
const CARD_GAP = 24;
const CARD_STEP = CARD_H + CARD_GAP;

// Hand-drawn SVG overlays for card hover effects — cycle through 3 per card
const CARD_OVERLAYS = [
  { svg: '/images/hand-drawn/brought-to-you-by.svg', r: 6, g: 255, b: 0, name: 'green' },
  { svg: '/images/hand-drawn/read-this-one.svg', r: 0, g: 56, b: 255, name: 'blue' },
  { svg: '/images/hand-drawn/czech-it-out.svg', r: 255, g: 0, b: 0, name: 'red' },
];

// Which glass panels each color group "owns" — hover tints only those panels, all the same color
const GHOST_MAP: Record<number, number[]> = { 0: [0, 2], 1: [4, 5], 2: [1, 3] };

// Stained glass parallax panels — card-shaped, depth-scaled, motion-blurred
// depth: <1 = further back (smaller, more blur), >1 = closer (larger, more blur)
const GLASS_PANELS = [
  // Left side
  { x: -0.36, yOffset: 0.1, depth: 0.55, color: 'rgba(80, 80, 80, 0.08)', border: 'rgba(120, 120, 120, 0.10)', shine: 25 },
  { x: -0.30, yOffset: 0.5, depth: 0.75, color: 'rgba(50, 70, 50, 0.07)', border: 'rgba(80, 110, 80, 0.10)', shine: 40 },
  { x: -0.40, yOffset: 0.85, depth: 0.40, color: 'rgba(60, 60, 60, 0.06)', border: 'rgba(100, 100, 100, 0.08)', shine: 15 },
  // Right side
  { x: 0.36, yOffset: 0.2, depth: 1.35, color: 'rgba(55, 75, 55, 0.08)', border: 'rgba(90, 120, 90, 0.10)', shine: 50 },
  { x: 0.32, yOffset: 0.65, depth: 1.55, color: 'rgba(70, 70, 70, 0.07)', border: 'rgba(110, 110, 110, 0.09)', shine: 35 },
  { x: 0.38, yOffset: 0.9, depth: 0.35, color: 'rgba(45, 60, 45, 0.06)', border: 'rgba(75, 95, 75, 0.08)', shine: 20 },
  // Deep flanks
  { x: -0.44, yOffset: 0.35, depth: 0.30, color: 'rgba(65, 65, 65, 0.05)', border: 'rgba(95, 95, 95, 0.07)', shine: 10 },
  { x: 0.44, yOffset: 0.45, depth: 1.7, color: 'rgba(50, 65, 50, 0.06)', border: 'rgba(85, 105, 85, 0.08)', shine: 60 },
];

/**
 * Master scroll orchestrator for the home page.
 * Pins one viewport-sized container and drives layers based on scroll progress.
 * Uses Lenis for smooth scrolling.
 *
 *   0%–28%     Hero visible, 3D tilt + layer separation
 *   20%–40%    Card transition: bracket slide, untilt, expand to fullscreen
 *   40%–76%    Hold phase: WILLIAM→IRL collapse, frame sequence, IRL slide-up
 *   76%–82%    Reveal: hero clip-paths from fullscreen to card dimensions
 *   82%–97%    Card scroll: hero card slides down, all post cards enter from above
 */
export function HomeScrollStage({ pageData, recentPosts }: HomeScrollStageProps) {
  const postCount = recentPosts.filter((p) => p?.node).length;
  const cardCount = postCount;
  const cardScrollVh = 650 + cardCount * 130;
  const endVh = 120; // extra scroll for end panel
  const totalScrollVh = cardScrollVh + endVh;
  const cardFrac = cardScrollVh / totalScrollVh;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const heroBorderRef = useRef<HTMLDivElement>(null);
  const postCardRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const glassPanelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const glassShineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const glassTintRefs = useRef<(HTMLDivElement | null)[]>([]);
  const socialFooterRef = useRef<HTMLDivElement>(null);
  const bottomGradRef = useRef<HTMLDivElement>(null);
  const endPanelRef = useRef<HTMLDivElement>(null);

  const progressRef = useRef({ scroll: 0, transition: 0, hold: 0 });
  const lastCsRef = useRef(0);
  const lenisRef = useRef<Lenis | null>(null);

  // Derive card posts from recent posts (first 5 with hero images)
  const cardPosts: CardPost[] = recentPosts
    .filter((p) => p?.node?.heroImg)
    .slice(0, 5)
    .map((p) => ({
      heroImg: p!.node!.heroImg!,
      title: p!.node!.title ?? '',
      slug: p!.node!._sys.breadcrumbs.join('/'),
    }));

  // Extended post data for card display — ALL posts with hero images
  const postCards = recentPosts
    .filter((p) => p?.node?.heroImg)
    .map((p) => ({
      heroImg: p!.node!.heroImg!,
      title: p!.node!.title ?? '',
      slug: p!.node!._sys.breadcrumbs.join('/'),
      date: p!.node!.date ?? '',
      tag: p!.node!.tags?.[0]?.tag?.name ?? '',
    }));

  // Lenis smooth scroll
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    const shouldScrollToPosts = window.location.hash === '#posts';

    const lenis = new Lenis({
      lerp: 0.03,
      smoothWheel: true,
      wheelMultiplier: 5,
    });
    lenisRef.current = lenis;

    // Detect trackpad vs mouse wheel — trackpad sends many small deltas
    let smallDeltaCount = 0;
    const detectInput = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 50) {
        smallDeltaCount = Math.min(smallDeltaCount + 1, 5);
      } else {
        smallDeltaCount = 0;
      }
      (lenis as any).options.wheelMultiplier = smallDeltaCount >= 3 ? 1 : 5;
    };
    window.addEventListener('wheel', detectInput, { passive: true });

    // Section-based scroll resistance: slow down at phase boundaries so the
    // experience "catches" at natural rest points. User can push through with
    // continued scrolling.
    const sectionBoundaries = [0.28, 0.40, 0.717, 0.78]; // in card-phase (p) space
    const resistanceRadius = 0.025; // how wide the sticky zone is (in rawP)
    lenis.on('scroll', () => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const scrollMax = wrapper.scrollHeight - window.innerHeight;
      if (scrollMax <= 0) return;
      const rawP = lenis.scroll / scrollMax;
      let minDist = 1;
      for (const b of sectionBoundaries) {
        minDist = Math.min(minDist, Math.abs(rawP - b * cardFrac));
      }

      // Lerp: low (sticky) near boundaries, normal elsewhere
      const proximity = Math.max(0, 1 - minDist / resistanceRadius);
      const baseLerp = 0.03;
      const stickyLerp = 0.015;
      (lenis as any).options.lerp = baseLerp - (baseLerp - stickyLerp) * proximity * proximity;
    });

    lenis.on('scroll', ScrollTrigger.update);
    const tickerCallback = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tickerCallback);
    gsap.ticker.lagSmoothing(0);

    // If navigated with #posts hash, jump to the blog cards section
    if (shouldScrollToPosts) {
      window.history.replaceState(null, '', window.location.pathname);
      requestAnimationFrame(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;
        const scrollMax = wrapper.scrollHeight - window.innerHeight;
        lenis.scrollTo(scrollMax * cardFrac * 0.78, { immediate: true });
      });
    }

    return () => {
      window.removeEventListener('wheel', detectInput);
      gsap.ticker.remove(tickerCallback);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // ScrollTrigger stage
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const wrapper = wrapperRef.current;
    const pinned = pinnedRef.current;
    const hero = heroRef.current;
    const heroBorder = heroBorderRef.current;
    if (!wrapper || !pinned || !hero) return;

    gsap.set(hero, { opacity: 1 });
    postCardRefs.current.forEach((card) => {
      if (card) gsap.set(card, { opacity: 0 });
    });
    glassPanelRefs.current.forEach((panel) => {
      if (panel) gsap.set(panel, { opacity: 0 });
    });

    const st = ScrollTrigger.create({
      trigger: wrapper,
      start: 'top top',
      end: 'bottom bottom',
      pin: pinned,
      pinSpacing: false,
      onUpdate: (self) => {
        const rawP = self.progress;
        // Card phases occupy [0, cardFrac] of total scroll, normalized to p in [0, 1]
        const p = Math.min(1, rawP / cardFrac);
        // End panel progress [0, 1] for the zone after card scroll
        const endP = rawP <= cardFrac ? 0 : Math.min(1, (rawP - cardFrac) / (1 - cardFrac));

        const viewH = pinned.offsetHeight;
        const viewW = pinned.offsetWidth;
        const cardW = Math.min(viewW * 0.82, 640);

        // Write progress directly to ref — no React re-renders
        progressRef.current.scroll = Math.min(1, p / 0.28);
        progressRef.current.transition = p <= 0.20 ? 0 : p >= 0.40 ? 1 : (p - 0.20) / 0.20;
        progressRef.current.hold = p <= 0.40 ? 0 : p >= 0.717 ? 1 : (p - 0.40) / 0.317;

        // ── Reveal: hero clips from fullscreen to card ──
        // Starts at p=0.717 (when IRL frame sequence hits last frame) so there's
        // no dead zone between the video ending and the crop beginning.
        const revealStart = 0.717;
        const revealEnd = 0.78;
        const reveal = p <= revealStart ? 0 : p >= revealEnd ? 1 : (p - revealStart) / (revealEnd - revealStart);
        const revealE = 1 - Math.pow(1 - reveal, 2.5);

        const clipL = ((viewW - cardW) / 2) * revealE;
        const clipT = ((viewH - CARD_H) / 2) * revealE;
        const clipR = clipL;
        const clipB = clipT;

        // ── Card scroll (78%–100%) ──
        const csRaw = p <= 0.78 ? 0 : Math.min(1, (p - 0.78) / 0.22);
        // Ease-in-out: gentle resistance at start and end of card list
        const csSmooth = csRaw * csRaw * (3 - 2 * csRaw);
        const cs = csRaw * 0.65 + csSmooth * 0.35;

        // Unified scroll: eases in during reveal, then continues at regular pace
        const earlyCs = reveal > 0 ? Math.pow(reveal, 3) * 0.08 : 0;
        const totalCs = earlyCs + cs;

        const heroTranslateY = cardCount * totalCs * CARD_STEP;

        // Hero opacity: subtle fade during reveal, stronger fade as it exits
        let heroOpacity = 1;
        if (reveal > 0) {
          heroOpacity = 1 - revealE * 0.12; // 1.0 → 0.88
        }
        if (totalCs > 0.08) {
          heroOpacity = 0.88 * Math.max(0, 1 - (totalCs - 0.08) / 0.92 * 2.5);
        }

        gsap.set(hero, {
          clipPath: `inset(${clipT}px ${clipR}px ${clipB}px ${clipL}px)`,
          y: heroTranslateY,
          opacity: heroOpacity,
        });

        // Disable pointer events on hero once cards are visible — hero sits above
        // cards (z-index 6 vs 3) and would block clicks even when fully transparent.
        hero.style.pointerEvents = p >= 0.78 ? 'none' : 'auto';

        // Hero card border overlay — follows the hero clip area
        if (heroBorder) {
          gsap.set(heroBorder, {
            opacity: revealE * (totalCs > 0.08 ? Math.max(0, 1 - (totalCs - 0.08) / 0.92 * 2.5) : 1),
            width: cardW,
            height: CARD_H,
            left: (viewW - cardW) / 2,
            top: (viewH - CARD_H) / 2 + heroTranslateY,
          });
        }

        // ── Post cards — slide and fade in after reveal completes (p=0.78) ──
        const cardFade = p <= 0.78 ? 0 : p <= 0.80 ? (p - 0.78) / 0.02 : 1;

        postCardRefs.current.forEach((card, i) => {
          if (!card) return;
          if (cardFade <= 0) {
            card.style.opacity = '0';
            return;
          }

          // Hero occupies slot 0; post cards start one slot above it (slot -1, -2, …)
          // so card i=0 enters center only after the hero has scrolled down one step.
          const virtualIdx = postCount - i - 1;
          const screenTop = (virtualIdx - cardCount * (1 - totalCs)) * CARD_STEP + (viewH - CARD_H) / 2;

          card.style.opacity = String(cardFade);
          card.style.width = `${cardW}px`;
          card.style.left = `${(viewW - cardW) / 2}px`;
          card.style.transform = `translateY(${screenTop}px)`;
        });

        // ── Sticky social footer — fades in as soon as cards appear ──
        const footer = socialFooterRef.current;
        const bottomGrad = bottomGradRef.current;
        if (footer) {
          let footerOpacity: number;
          if (p < 0.78) {
            footerOpacity = 0;
          } else if (p < 0.80) {
            footerOpacity = (p - 0.78) / 0.02;
          } else {
            footerOpacity = 1;
          }
          footer.style.opacity = String(footerOpacity);
          footer.style.pointerEvents = footerOpacity > 0.01 ? 'auto' : 'none';
          if (bottomGrad) {
            bottomGrad.style.opacity = String(footerOpacity);
          }
        }

        // ── End panel — fades in after all cards have scrolled through ──
        const endPanel = endPanelRef.current;
        if (endPanel) {
          const endOpacity = endP <= 0 ? 0 : endP <= 0.4 ? endP / 0.4 : 1;
          endPanel.style.opacity = String(endOpacity);
          endPanel.style.pointerEvents = endOpacity > 0.01 ? 'auto' : 'none';
        }

        // ── Stained glass parallax panels ──
        const glassVisible = p >= 0.78;
        // Scroll velocity for motion shadows (based on totalCs for unified movement)
        const csVelocity = totalCs - lastCsRef.current;
        lastCsRef.current = totalCs;

        glassPanelRefs.current.forEach((panel, i) => {
          if (!panel) return;
          const cfg = GLASS_PANELS[i];
          if (!cfg) return;
          if (!glassVisible) {
            panel.style.opacity = '0';
            return;
          }

          // Fade in after reveal
          const glassFade = p <= 0.80 ? (p - 0.78) / 0.02 : 1;
          // Fade out near the end
          const glassOut = p >= 0.95 ? Math.max(0, 1 - (p - 0.95) / 0.04) : 1;

          // Depth-based scale: closer panels are larger, further panels are smaller
          const depthScale = 0.5 + cfg.depth * 0.5;
          const panelW = cardW * depthScale;
          const panelH = CARD_H * depthScale;

          // Parallax Y: each panel scrolls at its own speed relative to card scroll
          const baseY = cfg.yOffset * viewH;
          const parallaxOffset = totalCs * cardCount * CARD_STEP * cfg.depth;
          const panelY = baseY - parallaxOffset + viewH * 0.3;
          const panelX = viewW / 2 + cfg.x * viewW - panelW / 2;

          // Motion shadows: trailing copies offset by velocity × depth
          // Velocity is signed: positive = scrolling forward, shadows trail behind (upward)
          const vel = csVelocity * 8000 * cfg.depth; // scale to pixel-like offset
          const absVel = Math.min(60, Math.abs(vel));
          const dir = vel > 0 ? 1 : -1; // shadow direction (opposite to movement)

          let shadows = '0 0 0 transparent';
          if (absVel > 1) {
            const layers: string[] = [];
            const steps = 5;
            for (let s = 1; s <= steps; s++) {
              const offset = dir * s * (absVel / steps) * 0.8;
              const alpha = 0.06 * (1 - s / (steps + 1));
              layers.push(`0 ${offset}px ${absVel * 0.3}px rgba(${cfg.color.includes('70') ? '70, 90, 70' : '90, 90, 90'}, ${alpha})`);
            }
            shadows = layers.join(', ');
          }

          panel.style.opacity = String(glassFade * glassOut * (0.4 + cfg.depth * 0.2));
          panel.style.transform = `translate(${panelX}px, ${panelY}px)`;
          panel.style.width = `${panelW}px`;
          panel.style.height = `${panelH}px`;
          panel.style.filter = absVel > 2 ? `blur(${Math.min(3, absVel * 0.08)}px)` : 'none';
          panel.style.boxShadow = shadows;

          // Subtle shine drift — slide the gloss based on viewport position
          const shine = glassShineRefs.current[i];
          if (shine) {
            const viewportNorm = panelY / viewH;
            shine.style.transform = `translateY(${viewportNorm * 30 * cfg.depth}%)`;
          }
        });
      },
    });

    return () => {
      st.kill();
    };
  }, [postCount]);

  return (
    <div ref={wrapperRef} style={{ height: `${totalScrollVh}vh`, position: 'relative', overflowX: 'hidden' }}>
      <div
        ref={pinnedRef}
        style={{
          position: 'relative',
          width: '100%',
          height: '100vh',
          overflow: 'hidden',
          background: '#0a0a0a',
        }}
      >
        {/* Grain overlay — matches hero background texture */}
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <filter id="stage-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 10,
            opacity: 0.15,
            filter: 'url(#stage-grain)',
          }}
        />

        {/* Hero layer — clips to card, then slides down (above post cards) */}
        <div
          ref={heroRef}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 6,
            willChange: 'clip-path, transform, opacity',
          }}
        >
          <Blocks
            {...pageData}
            cardPosts={cardPosts}
            progressRef={progressRef}
          />
        </div>

        {/* Hero card border overlay — follows the clip area, pulsing glow */}
        <style>{`
          @keyframes stage-panel-pulse {
            0%, 100% {
              box-shadow:
                0 0 20px rgba(224, 224, 224, 0.05),
                0 0 60px rgba(224, 224, 224, 0.03),
                inset 0 0 40px rgba(224, 224, 224, 0.01);
            }
            50% {
              box-shadow:
                0 0 30px rgba(224, 224, 224, 0.10),
                0 0 80px rgba(224, 224, 224, 0.06),
                inset 0 0 60px rgba(224, 224, 224, 0.03);
            }
          }
          .post-card-link {
            transition: scale 0.2s ease, box-shadow 0.35s ease !important;
          }
          .post-card-link:hover {
            scale: 1.02 !important;
          }
          .card-img {
            transition: filter 0.35s ease;
          }
          .post-card-link:hover .card-img {
            filter: grayscale(1) brightness(0.15);
          }
          .card-color-tint {
            opacity: 0;
            transition: opacity 0.35s ease;
            pointer-events: none;
            mix-blend-mode: color;
          }
          .post-card-link:hover .card-color-tint {
            opacity: 1;
          }
          .card-svg-overlay {
            opacity: 0;
            transition: opacity 0.35s ease;
            pointer-events: none;
          }
          .post-card-link:hover .card-svg-overlay {
            opacity: 1;
          }
          .post-card-link[data-oc="green"]:hover {
            box-shadow: 0 0 0 2px rgba(6,255,0,0.55), 0 0 40px rgba(6,255,0,0.18) !important;
          }
          .post-card-link[data-oc="blue"]:hover {
            box-shadow: 0 0 0 2px rgba(0,56,255,0.55), 0 0 40px rgba(0,56,255,0.18) !important;
          }
          .post-card-link[data-oc="red"]:hover {
            box-shadow: 0 0 0 2px rgba(255,0,0,0.55), 0 0 40px rgba(255,0,0,0.18) !important;
          }
          .glass-tint {
            transition: opacity 0.4s ease, background 0.4s ease;
          }
        `}</style>
        <div
          ref={heroBorderRef}
          style={{
            position: 'absolute',
            zIndex: 7,
            pointerEvents: 'none',
            opacity: 0,
            animation: 'stage-panel-pulse 3s ease-in-out infinite',
          }}
        />

        {/* Stained glass parallax panels */}
        {GLASS_PANELS.map((cfg, i) => (
          <div
            key={i}
            ref={(el) => {
              glassPanelRefs.current[i] = el;
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              opacity: 0,
              zIndex: cfg.depth > 1 ? 5 : 0,
              background: cfg.color,
              pointerEvents: 'none',
              willChange: 'transform, opacity, filter',
              overflow: 'hidden',
            }}
          >
            {/* Shine — diagonal gloss streak, uniform light direction */}
            <div
              ref={(el) => {
                glassShineRefs.current[i] = el;
              }}
              style={{
                position: 'absolute',
                inset: '-20% 0',
                background: 'linear-gradient(125deg, transparent 25%, rgba(255,255,255,0.02) 45%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.02) 55%, transparent 75%)',
                pointerEvents: 'none',
                willChange: 'transform',
              }}
            />
            {/* Hover tint overlay — activated by card mouseenter/mouseleave */}
            <div
              ref={(el) => {
                glassTintRefs.current[i] = el;
              }}
              className='glass-tint'
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0,
                pointerEvents: 'none',
              }}
            />
          </div>
        ))}

        {/* Post cards — absolutely positioned, slide in from above during card scroll */}
        {postCards.map((post, i) => {
          const overlay = CARD_OVERLAYS[i % CARD_OVERLAYS.length];
          const date = post.date
            ? new Date(post.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })
            : '';
          return (
            <Link
              href={`/posts/${post.slug}`}
              key={post.slug}
              className='post-card-link'
              data-oc={overlay.name}
              ref={(el) => {
                postCardRefs.current[i] = el;
              }}
              onMouseEnter={() => {
                // Tint only this color group's assigned panels, all the same color
                const colorIdx = i % CARD_OVERLAYS.length;
                const panelIndices = GHOST_MAP[colorIdx] ?? [];
                panelIndices.forEach((pi) => {
                  const el = glassTintRefs.current[pi];
                  if (!el) return;
                  el.style.background = `rgba(${overlay.r},${overlay.g},${overlay.b},0.14)`;
                  el.style.opacity = '1';
                });
              }}
              onMouseLeave={() => {
                const colorIdx = i % CARD_OVERLAYS.length;
                const panelIndices = GHOST_MAP[colorIdx] ?? [];
                panelIndices.forEach((pi) => {
                  const el = glassTintRefs.current[pi];
                  if (!el) return;
                  el.style.opacity = '0';
                });
              }}
              // onClick={(e) => {
              //   const el = e.currentTarget;
              //   if (!document.startViewTransition) return;
              //   e.preventDefault();
              //   el.style.viewTransitionName = 'blog-card';
              //   const transition = document.startViewTransition(() => {
              //     el.style.viewTransitionName = '';
              //     return router.push(`/posts/${post.slug}`) as unknown as Promise<void>;
              //   });
              //   transition.finished.then(() => {
              //     el.style.viewTransitionName = '';
              //   });
              // }
              style={{
                position: 'absolute',
                top: 0,
                display: 'block',
                height: `${CARD_H}px`,
                overflow: 'hidden',
                textDecoration: 'none',
                zIndex: 3,
                opacity: 0,
                boxShadow: '0 0 20px rgba(224, 224, 224, 0.04), 0 0 60px rgba(224, 224, 224, 0.02)',
                willChange: 'transform, opacity',
              }}
            >
              <div
                className='card-img'
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `url(${post.heroImg})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              {/* Color tint overlay — mix-blend-mode:color turns greyscale image into monochrome hue */}
              <div
                className='card-color-tint'
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `rgb(${overlay.r},${overlay.g},${overlay.b})`,
                }}
              />
              {/* Hand-drawn SVG overlay — fades in on hover */}
              <img
                src={overlay.svg}
                alt=''
                className='card-svg-overlay'
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  padding: '12px',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 40%, transparent 70%)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {(post.tag || date) && (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {post.tag && (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.65rem',
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: 'rgba(224, 224, 224, 0.6)',
                        }}
                      >
                        {post.tag}
                      </span>
                    )}
                    {date && (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.65rem',
                          letterSpacing: '0.05em',
                          color: 'rgba(224, 224, 224, 0.4)',
                        }}
                      >
                        {date}
                      </span>
                    )}
                  </div>
                )}
                <h3
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 'clamp(1.1rem, 2.5vw, 1.6rem)',
                    fontWeight: 400,
                    color: 'rgba(245, 245, 245, 0.92)',
                    textTransform: 'none',
                    letterSpacing: '-0.01em',
                    lineHeight: 1.15,
                    margin: 0,
                  }}
                >
                  {post.title}
                </h3>
              </div>
            </Link>
          );
        })}

      </div>

      {/* Bottom gradient — gives the island contrast against any background */}
      <div
        ref={bottomGradRef}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '120px',
          background: 'linear-gradient(to top, rgba(0, 0, 0, 0.55) 0%, transparent 100%)',
          pointerEvents: 'none',
          zIndex: 19,
          opacity: 0,
        }}
      />

      {/* Sticky floating social island — opacity/pointerEvents driven by scroll via socialFooterRef */}
      <SocialFooter ref={socialFooterRef} style={{ opacity: 0, pointerEvents: 'none' }} />

      {/* End panel — fades in after card scroll, baroque-styled */}
      <style>{`
        @keyframes end-panel-shimmer {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .end-subscribe-input::placeholder { color: rgba(200, 180, 120, 0.35); }
        .end-subscribe-input:focus { outline: none; border-color: rgba(200, 180, 120, 0.5); }
        .end-subscribe-btn:hover { background: rgba(200, 180, 120, 0.15) !important; color: rgba(200, 180, 120, 1) !important; }
      `}</style>
      <div
        ref={endPanelRef}
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 12,
          opacity: 0,
          pointerEvents: 'none',
          background: '#080808',
        }}
      >
        {/* Grain overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            opacity: 0.18,
            filter: 'url(#stage-grain)',
          }}
        />

        {/* Subtle radial glow at center */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '600px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(200, 170, 80, 0.05) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '48px',
            maxWidth: '560px',
            width: '100%',
            padding: '0 24px',
          }}
        >
          {/* That's all SVG */}
          <div style={{ textAlign: 'center' }}>
            <img
              src="/images/hand-drawn/thats-all.svg"
              alt="That's all"
              style={{ width: 'clamp(280px, 40vw, 480px)', display: 'block', margin: '0 auto', transform: 'translateX(-10px)' }}
            />
          </div>

          {/* Divider */}
          <div
            style={{
              width: '100%',
              height: '1px',
              background: 'linear-gradient(to right, transparent, rgba(200, 180, 120, 0.2) 30%, rgba(200, 180, 120, 0.2) 70%, transparent)',
            }}
          />

          {/* Subscribe section */}
          <div style={{ width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-lucida-bl)',
                  fontSize: 'clamp(1.4rem, 3vw, 2rem)',
                  fontWeight: 400,
                  color: 'rgba(255, 255, 255, 0.82)',
                  letterSpacing: '0.03em',
                  margin: '0 0 8px',
                }}
              >
                Stay in the loop
              </h2>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'rgba(255,255,255,0.28)', letterSpacing: '0.06em' }}>
                New essays, projects &amp; experiments — no noise.
              </p>
            </div>
            <form
              onSubmit={(e) => e.preventDefault()}
              style={{ display: 'flex', gap: '10px', width: '100%' }}
            >
              <input
                type="email"
                placeholder="your@email.com"
                className="end-subscribe-input"
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(200, 180, 120, 0.22)',
                  borderRadius: '6px',
                  padding: '12px 16px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'rgba(255, 255, 255, 0.75)',
                  letterSpacing: '0.04em',
                  transition: 'border-color 0.2s',
                }}
              />
              <button
                type="submit"
                className="end-subscribe-btn"
                style={{
                  background: 'rgba(200, 180, 120, 0.08)',
                  border: '1px solid rgba(200, 180, 120, 0.30)',
                  borderRadius: '6px',
                  padding: '12px 20px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.7rem',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'rgba(200, 180, 120, 0.75)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.2s, color 0.2s',
                }}
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
