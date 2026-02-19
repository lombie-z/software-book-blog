'use client';
import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import Link from 'next/link';
import { Blocks } from '@/components/blocks';
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
  const totalScrollVh = 650 + postCount * 100;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const heroBorderRef = useRef<HTMLDivElement>(null);
  const postCardRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const glassPanelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const glassShineRefs = useRef<(HTMLDivElement | null)[]>([]);

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

    const lenis = new Lenis({
      lerp: 0.08,
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(lenis.raf as any);
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
        const p = self.progress;
        const viewH = pinned.offsetHeight;
        const viewW = pinned.offsetWidth;
        const cardW = Math.min(viewW * 0.82, 640);

        // Write progress directly to ref — no React re-renders
        progressRef.current.scroll = Math.min(1, p / 0.28);
        progressRef.current.transition = p <= 0.20 ? 0 : p >= 0.40 ? 1 : (p - 0.20) / 0.20;
        progressRef.current.hold = p <= 0.40 ? 0 : p >= 0.76 ? 1 : (p - 0.40) / 0.36;

        // ── Reveal: hero clips from fullscreen to card (76%–82%) ──
        const reveal = p <= 0.76 ? 0 : p >= 0.82 ? 1 : (p - 0.76) / 0.06;
        const revealE = 1 - Math.pow(1 - reveal, 2.5);

        const clipL = ((viewW - cardW) / 2) * revealE;
        const clipT = ((viewH - CARD_H) / 2) * revealE;
        const clipR = clipL;
        const clipB = clipT;

        // ── Card scroll (82%–97%) ──
        const cs = p <= 0.82 ? 0 : p >= 0.97 ? 1 : (p - 0.82) / 0.15;

        // Unified scroll: eases in during reveal, then continues at regular pace
        // earlyCs adds a gentle cubic ease-in worth ~8% of the total scroll range
        const earlyCs = reveal > 0 ? Math.pow(reveal, 3) * 0.08 : 0;
        const totalCs = earlyCs + cs;

        const heroTranslateY = postCount * totalCs * CARD_STEP;

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

        // ── Post cards: absolutely positioned, scroll in from above like parallax panels ──
        // Fade in during reveal, then always visible — natural scroll position handles entry
        const cardFade = p <= 0.78 ? 0 : p <= 0.82 ? (p - 0.78) / 0.04 : 1;
        postCardRefs.current.forEach((card, i) => {
          if (!card) return;
          if (cardFade <= 0) {
            card.style.opacity = '0';
            return;
          }

          // Virtual list: posts are i=0..N-1, hero is i=N
          // Uses totalCs so cards start easing in during reveal
          const screenTop = (i - postCount * (1 - totalCs)) * CARD_STEP + (viewH - CARD_H) / 2;

          card.style.opacity = String(cardFade);
          card.style.width = `${cardW}px`;
          card.style.left = `${(viewW - cardW) / 2}px`;
          card.style.transform = `translateY(${screenTop}px)`;
        });

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

          // Fade in during reveal
          const glassFade = p <= 0.80 ? (p - 0.78) / 0.02 : 1;
          // Fade out near the end
          const glassOut = p >= 0.95 ? Math.max(0, 1 - (p - 0.95) / 0.04) : 1;

          // Depth-based scale: closer panels are larger, further panels are smaller
          const depthScale = 0.5 + cfg.depth * 0.5;
          const panelW = cardW * depthScale;
          const panelH = CARD_H * depthScale;

          // Parallax Y: each panel scrolls at its own speed relative to card scroll
          const baseY = cfg.yOffset * viewH;
          const parallaxOffset = totalCs * postCount * CARD_STEP * cfg.depth;
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
    <div ref={wrapperRef} style={{ height: `${totalScrollVh}vh`, position: 'relative' }}>
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
          <Blocks {...pageData} cardPosts={cardPosts} progressRef={progressRef} />
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
            {/* Edge highlight */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
              }}
            />
          </div>
        ))}

        {/* Post cards — absolutely positioned, slide in from above during card scroll */}
        {postCards.map((post, i) => {
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
              ref={(el) => {
                postCardRefs.current[i] = el;
              }}
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
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `url(${post.heroImg})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
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
                    fontWeight: 700,
                    color: 'rgba(245, 245, 245, 0.92)',
                    textTransform: 'uppercase',
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
    </div>
  );
}
