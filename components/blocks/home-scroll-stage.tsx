'use client';
import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import Link from 'next/link';
import { Blocks } from '@/components/blocks';
import { BlogArchive } from '@/components/blocks/blog-archive';
import type { Page, PostConnectionQuery, TagConnectionQuery } from '@/tina/__generated__/types';
import type { CardPost } from './topo-hero';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

type PostEdges = NonNullable<PostConnectionQuery['postConnection']['edges']>;
type TagEdges = NonNullable<TagConnectionQuery['tagConnection']['edges']>;

export type ProgressRef = React.RefObject<{ scroll: number; transition: number; hold: number }>;

interface HomeScrollStageProps {
  pageData: Omit<Page, 'id' | '_sys' | '_values'>;
  recentPosts: PostEdges;
  archivePosts: PostEdges;
  tags: TagEdges;
}

const CARD_H = 380;
const CARD_GAP = 24;
const CARD_STEP = CARD_H + CARD_GAP;

/**
 * Master scroll orchestrator for the home page.
 * Pins one viewport-sized container and drives layers based on scroll progress.
 * Uses Lenis for smooth scrolling.
 *
 *   0%–28%     Hero visible, 3D tilt + layer separation
 *   20%–40%    Card transition: bracket slide, untilt, expand to fullscreen
 *   40%–70%    Hold phase: WILLIAM→IRL collapse, frame sequence, IRL slide-up
 *   70%–76%    Reveal: hero clip-paths from fullscreen to card dimensions
 *   76%–93%    Card scroll: hero card slides down, post cards enter from above
 *   93%–100%   Archive crossfade
 */
export function HomeScrollStage({ pageData, recentPosts, archivePosts, tags }: HomeScrollStageProps) {
  const postCount = recentPosts.filter((p) => p?.node).length;
  const totalScrollVh = 650 + postCount * 100;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const heroBorderRef = useRef<HTMLDivElement>(null);
  const archiveRef = useRef<HTMLDivElement>(null);
  const postCardRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const progressRef = useRef({ scroll: 0, transition: 0, hold: 0 });
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

  // Extended post data for card display
  const postCards = recentPosts
    .filter((p) => p?.node?.heroImg)
    .slice(0, 5)
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
    const archive = archiveRef.current;
    if (!wrapper || !pinned || !hero || !archive) return;

    gsap.set(hero, { opacity: 1 });
    gsap.set(archive, { opacity: 0, pointerEvents: 'none' });
    postCardRefs.current.forEach((card) => {
      if (card) gsap.set(card, { opacity: 0 });
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
        const clipRadius = 0;

        // ── Card scroll (82%–95%) ──
        const cs = p <= 0.82 ? 0 : p >= 0.95 ? 1 : (p - 0.82) / 0.13;

        // Hero translates downward during card scroll (exits viewport bottom)
        const heroTranslateY = 5 * cs * CARD_STEP;

        // Hero opacity: subtle fade during reveal, stronger fade as it exits
        let heroOpacity = 1;
        if (reveal > 0) {
          heroOpacity = 1 - revealE * 0.12; // 1.0 → 0.88
        }
        if (cs > 0) {
          heroOpacity = 0.88 * Math.max(0, 1 - cs * 2.5);
        }

        gsap.set(hero, {
          clipPath: `inset(${clipT}px ${clipR}px ${clipB}px ${clipL}px round ${clipRadius}px)`,
          y: heroTranslateY,
          opacity: heroOpacity,
        });

        // Hero card border overlay — follows the hero clip area
        if (heroBorder) {
          gsap.set(heroBorder, {
            opacity: revealE * (cs > 0 ? Math.max(0, 1 - cs * 2.5) : 1),
            width: cardW,
            height: CARD_H,
            left: (viewW - cardW) / 2,
            top: (viewH - CARD_H) / 2 + heroTranslateY,
            borderRadius: clipRadius,
          });
        }

        // ── Post cards: absolutely positioned, enter from above ──
        const cardsVisible = p >= 0.80;
        const numPosts = postCardRefs.current.length;
        postCardRefs.current.forEach((card, i) => {
          if (!card) return;
          if (!cardsVisible) {
            card.style.opacity = '0';
            return;
          }

          // Virtual list: posts are i=0..4, hero is i=5
          // At cs=0, hero centered → posts above viewport
          // At cs=1, post 0 centered → hero below viewport
          const screenTop = (i - 5 * (1 - cs)) * CARD_STEP + (viewH - CARD_H) / 2;

          // Only show if on screen (with buffer)
          const onScreen = screenTop > -CARD_H - 50 && screenTop < viewH + 50;
          card.style.opacity = onScreen ? '1' : '0';
          card.style.transform = `translateY(${screenTop}px)`;
          card.style.width = `${cardW}px`;
          card.style.left = `${(viewW - cardW) / 2}px`;
        });

        // ── Archive crossfade (95%–100%) ──
        const archiveIn = p <= 0.95 ? 0 : p >= 1.0 ? 1 : (p - 0.95) / 0.05;
        gsap.set(archive, { opacity: archiveIn, pointerEvents: archiveIn > 0.5 ? 'auto' : 'none' });
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
          background: '#000',
        }}
      >
        {/* Hero layer — clips to card, then slides down */}
        <div
          ref={heroRef}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            willChange: 'clip-path, transform, opacity',
          }}
        >
          <Blocks {...pageData} cardPosts={cardPosts} progressRef={progressRef} />
        </div>

        {/* Hero card border overlay — follows the clip area, pulsing glow */}
        <style>{`
          @keyframes stage-panel-pulse {
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
        `}</style>
        <div
          ref={heroBorderRef}
          style={{
            position: 'absolute',
            zIndex: 2,
            border: '1px solid rgba(224, 224, 224, 0.12)',
            pointerEvents: 'none',
            opacity: 0,
            animation: 'stage-panel-pulse 3s ease-in-out infinite',
          }}
        />

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
                border: '1px solid rgba(224, 224, 224, 0.10)',
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

        {/* Archive */}
        <div
          ref={archiveRef}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 4,
            overflow: 'auto',
          }}
        >
          <BlogArchive posts={archivePosts} tags={tags} />
        </div>
      </div>
    </div>
  );
}
