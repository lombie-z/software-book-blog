'use client';
import { useEffect, useLayoutEffect, useRef } from 'react';
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
const POST_FRAME_COUNT = 192;
const POST_FRAME_PATH = '/images/post-frames/';
const POST_FRAME_W = 1080;
const POST_FRAME_H = 1920;
// Target visual height (px) of the tilted card at rest. The perspective is
// computed dynamically from this + floorY so the trapezoid matches the video
// card on every viewport. Increase → more foreshortened, decrease → taller.
const FIN_VISUAL_H = 185;
const FIN_TILT_DEG = 75;
// Small trim (%) per side at the top edge to correct CSS perspective width coupling.
// Scales with finPerspective so it only kicks in on larger viewports. Increase to narrow more.
const FIN_TOP_TRIM = 0.8;
const _SIN75 = Math.sin(75 * Math.PI / 180); // 0.966
const _COS75 = Math.cos(75 * Math.PI / 180); // 0.259

// Measured from frame 001 pixel analysis:
// Card bottom edge (front, transform-origin) in normalized frame coords
const FRAME_CARD_CX = 0.4903; // center X of card bottom edge
const FRAME_CARD_BY = 0.6086; // Y of card bottom edge
const FRAME_CARD_FRONT_W = 0.6056; // width of card bottom edge as fraction of frame

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
  const cardCount = postCount + 1; // posts + fin card
  const cardScrollVh = 650 + cardCount * 130;
  const fallVh = 500; // extra scroll for fin fall + landing
  const frameVh = 600; // scroll-driven frame sequence after fin
  const totalScrollVh = cardScrollVh + fallVh + frameVh;
  // The card scroll phases (0–0.97) occupy this fraction of the total scroll
  const cardFrac = cardScrollVh / totalScrollVh;
  const fallFrac = (cardScrollVh + fallVh) / totalScrollVh;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const heroBorderRef = useRef<HTMLDivElement>(null);
  const postCardRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const finCardRef = useRef<HTMLDivElement>(null);
  const glassPanelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const glassShineRefs = useRef<(HTMLDivElement | null)[]>([]);

  const progressRef = useRef({ scroll: 0, transition: 0, hold: 0 });
  const lastCsRef = useRef(0);
  // Tracks which section the user was last in before entering the fall zone.
  // 'cards' = came from blog cards, 'socials' = came from frame sequence/socials
  const finOriginRef = useRef<'cards' | 'socials'>('cards');
  const lenisRef = useRef<Lenis | null>(null);
  const frameCanvasRef = useRef<HTMLCanvasElement>(null);
  const postFramesRef = useRef<HTMLImageElement[]>([]);
  const lastPostFrameRef = useRef(-1);
  const frameProgressRef = useRef(0);
  const smoothedFpRef = useRef(0);
  const socialRef = useRef<HTMLDivElement>(null);
  const sectionNavRef = useRef<HTMLDivElement>(null);
  const navBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const sectionNav2Ref = useRef<HTMLDivElement>(null);
  const navBtn2Refs = useRef<(HTMLButtonElement | null)[]>([]);

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
    const sectionBoundaries = [0.28, 0.40, 0.717, 0.78]; // normalized to cardFrac
    const resistanceRadius = 0.025; // how wide the sticky zone is (in rawP)
    lenis.on('scroll', () => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const scrollMax = wrapper.scrollHeight - window.innerHeight;
      if (scrollMax <= 0) return;
      const rawP = lenis.scroll / scrollMax;
      // Check proximity to any boundary (mapped to total scroll via cardFrac)
      let minDist = 1;
      for (const b of sectionBoundaries) {
        const globalB = b * cardFrac;
        minDist = Math.min(minDist, Math.abs(rawP - globalB));
      }
      // Also add resistance at fall/frame boundaries
      minDist = Math.min(minDist, Math.abs(rawP - cardFrac), Math.abs(rawP - fallFrac));

      // Lerp: low (sticky) near boundaries, normal elsewhere
      const proximity = Math.max(0, 1 - minDist / resistanceRadius);
      const baseLerp = 0.03;
      const stickyLerp = 0.015;
      (lenis as any).options.lerp = baseLerp - (baseLerp - stickyLerp) * proximity * proximity;
    });

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    return () => {
      window.removeEventListener('wheel', detectInput);
      gsap.ticker.remove(lenis.raf as any);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // Preload post-fin frame sequence as JPEGs
  useEffect(() => {
    const frames: HTMLImageElement[] = [];
    for (let i = 1; i <= POST_FRAME_COUNT; i++) {
      const img = new Image();
      img.src = `${POST_FRAME_PATH}${String(i).padStart(3, '0')}.jpg`;
      frames.push(img);
    }
    postFramesRef.current = frames;
  }, []);

  // Canvas dimensions set dynamically in onUpdate based on viewport + card alignment

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

        // Track which section the user is in — 'socials' updates here,
        // 'cards' is deferred to the fin card logic (when pastBreakaway <= 0)
        // so the reverse animation isn't cut short near the boundary.
        if (rawP >= fallFrac) finOriginRef.current = 'socials';

        const viewH = pinned.offsetHeight;
        const viewW = pinned.offsetWidth;
        const cardW = Math.min(viewW * 0.82, 640);

        // Remap: card phases occupy [0, cardFrac], normalized to p in [0, 1]
        const p = Math.min(1, rawP / cardFrac);

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

        // ── Card scroll (82%–100% of card phase, continues into fall) ──
        const csRaw = p <= 0.78 ? 0 : Math.min(1, (p - 0.78) / 0.22);
        // Ease-in-out: gentle resistance at start and end of card list
        const csSmooth = csRaw * csRaw * (3 - 2 * csRaw);
        const cs = csRaw * 0.65 + csSmooth * 0.35;

        // Unified scroll: eases in during reveal, then continues at regular pace
        const earlyCs = reveal > 0 ? Math.pow(reveal, 3) * 0.08 : 0;

        // Fall scroll extends totalCs so cards keep sliding through the fall phase
        const fallEnd = fallFrac;
        const fallRaw = rawP <= cardFrac ? 0 : rawP >= fallEnd ? 1 : (rawP - cardFrac) / (fallEnd - cardFrac);
        const totalCs = earlyCs + cs + fallRaw * 0.6;

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

        // ── Post cards — keep sliding and fading ──
        const fallFadeOut = fallRaw <= 0 ? 1 : Math.max(0, 1 - fallRaw * 3);
        const cardFade = (p <= 0.74 ? 0 : p <= 0.78 ? (p - 0.74) / 0.04 : 1) * fallFadeOut;

        // ── Section nav ──
        // Nav 1 (inside 3D scene): visible on landing, dark panel covers it naturally
        const sectionNav = sectionNavRef.current;
        if (sectionNav) {
          // Active on landing, hide once hold starts (dark panel already covering)
          const nav1Opacity = p < 0.40 ? 1 : 0;
          sectionNav.style.opacity = String(nav1Opacity);
          sectionNav.style.pointerEvents = nav1Opacity > 0.01 ? 'auto' : 'none';

          // Active state for nav1: always Landing
          for (let i = 0; i < 3; i++) {
            const btn = navBtnRefs.current[i];
            if (!btn) continue;
            const isActive = i === 0;
            btn.style.borderLeft = isActive ? '2px solid rgba(224, 224, 224, 0.7)' : '2px solid transparent';
            btn.style.color = isActive ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.4)';
            btn.style.background = isActive ? 'rgba(255, 255, 255, 0.06)' : 'transparent';
          }
        }

        // Nav 2 (outside hero): appears after hold phase
        const sectionNav2 = sectionNav2Ref.current;
        if (sectionNav2) {
          let nav2Opacity: number;
          if (p < 0.68) {
            nav2Opacity = 0;
          } else if (p < 0.717) {
            nav2Opacity = (p - 0.68) / 0.037;
          } else if (p < 0.76) {
            nav2Opacity = Math.max(0, 1 - ((p - 0.717) / 0.043) * 2);
          } else if (p < 0.82) {
            nav2Opacity = (p - 0.76) / 0.06;
          } else {
            nav2Opacity = 1;
          }
          if (rawP > cardFrac) nav2Opacity = 1;

          sectionNav2.style.opacity = String(nav2Opacity);
          sectionNav2.style.pointerEvents = nav2Opacity > 0.01 ? 'auto' : 'none';

          // Active state: Blog when cards visible, Socials in frame phase
          let activeIdx = 1;
          if (rawP >= fallFrac) {
            activeIdx = 2;
          }
          for (let i = 0; i < 3; i++) {
            const btn = navBtn2Refs.current[i];
            if (!btn) continue;
            const isActive = i === activeIdx;
            btn.style.borderLeft = isActive ? '2px solid rgba(224, 224, 224, 0.7)' : '2px solid transparent';
            btn.style.color = isActive ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.4)';
            btn.style.background = isActive ? 'rgba(255, 255, 255, 0.06)' : 'transparent';
          }
        }

        postCardRefs.current.forEach((card, i) => {
          if (!card) return;
          if (cardFade <= 0) {
            card.style.opacity = '0';
            return;
          }

          const virtualIdx = postCount - i;
          const screenTop = (virtualIdx - cardCount * (1 - totalCs)) * CARD_STEP + (viewH - CARD_H) / 2;

          card.style.opacity = String(cardFade);
          card.style.width = `${cardW}px`;
          card.style.left = `${(viewW - cardW) / 2}px`;
          card.style.transform = `translateY(${screenTop}px)`;
        });

        // ── Fin card — scrolls with cards, then leaf-falls when it enters the viewport ──
        const fin = finCardRef.current;
        if (fin) {
          const center = (viewH - CARD_H) / 2;
          // Fin scroll position without fall extension (freezes at end of card scroll)
          const finTotalCs = earlyCs + cs;
          const finScrollY = -cardCount * (1 - finTotalCs) * CARD_STEP + center;

          // Breakaway: fin detaches when it enters the viewport near the top
          const breakawayY = viewH * 0.15;
          // What totalCs value puts the fin exactly at breakawayY
          const breakawayCs = 1 + (breakawayY - center) / (cardCount * CARD_STEP);
          // Extended totalCs adds fall-phase scroll budget for the fall animation
          const finCsExtended = finTotalCs + fallRaw * 0.5;
          const pastBreakaway = finCsExtended - breakawayCs;

          if (pastBreakaway <= 0) {
            // Fin is back in the card stack — safe to mark origin as 'cards'
            finOriginRef.current = 'cards';
            // Normal card scroll — fin hasn't reached breakaway yet
            const finFade = p <= 0.74 ? 0 : p <= 0.78 ? (p - 0.74) / 0.04 : 1;
            if (finFade <= 0) {
              fin.style.opacity = '0';
            } else {
              fin.style.opacity = String(finFade);
              fin.style.width = `${cardW}px`;
              fin.style.left = `${(viewW - cardW) / 2}px`;
              fin.style.transform = `translateY(${finScrollY}px)`;
            }
          } else {
            // Leaf-fall: fin has entered the viewport, detach and fall
            const totalBudget = (earlyCs + 1 - breakawayCs) + 0.5;
            const fallProgress = Math.min(1, pastBreakaway / totalBudget);

            // From socials: same card, same math — just kill the sway so it
            // rewinds as a clean untilt instead of the dramatic leaf-fall.
            const fromSocials = finOriginRef.current === 'socials';

            // Momentum resistance: slow at sway peaks (0.25, 0.75), speed through center
            const resistK = 0.18;
            const mFall = fromSocials
              ? fallProgress // linear rewind when coming from socials
              : fallProgress + resistK * Math.sin(fallProgress * Math.PI * 4) / (Math.PI * 4);

            // Drop: ease from breakaway position to floor
            const dropEase = 1 - Math.pow(1 - mFall, 2.5);
            const floorY = viewH * 0.55;
            const fallY = breakawayY + (floorY - breakawayY) * dropEase;

            // Sway: zero when coming from socials
            const swayDampen = 1 - mFall;
            const swayAmplitude = fromSocials ? 0 : viewW * 0.14 * swayDampen;
            const swayX = Math.sin(mFall * Math.PI * 2) * swayAmplitude;
            const swayRot = fromSocials ? 0 : Math.sin(mFall * Math.PI * 2) * 10 * swayDampen;

            const tiltBack = mFall * FIN_TILT_DEG;

            // Scale shrinks as it lies flat
            const fallScale = 1 - dropEase * 0.30;

            // Compute perspective so the tilted card's visual height = FIN_VISUAL_H
            // on every viewport. Formula derived from:
            //   V = h(d·cosθ + Y·sinθ) / (d + h·sinθ)  →  d = h·sinθ·(Y - V) / (V - h·cosθ)
            // Uses final resting values so the transition frame matches the video.
            const finalH = CARD_H * 0.70; // fallScale at mFall=1
            const hSin = finalH * _SIN75;
            const hCos = finalH * _COS75;
            const finPerspective = Math.max(200, hSin * (floorY - FIN_VISUAL_H) / (FIN_VISUAL_H - hCos));

            fin.style.opacity = '1';
            fin.style.width = `${cardW}px`;
            fin.style.left = `${(viewW - cardW) / 2}px`;
            fin.style.transform = `perspective(${finPerspective}px) translateY(${fallY}px) translateX(${swayX}px) rotateX(${tiltBack}deg) rotateZ(${swayRot}deg) scale(${fallScale})`;
            fin.style.transformOrigin = 'center bottom';
            // Trim top-edge width to correct CSS perspective width coupling.
            // Applied proportionally to tilt progress.
            const trimPct = mFall * FIN_TOP_TRIM;
            fin.style.clipPath = trimPct > 0.01
              ? `polygon(${trimPct}% 0%, ${100 - trimPct}% 0%, 100% 100%, 0% 100%)`
              : 'none';

            // Transition card appearance: glow → video-matched as it falls
            const morphP = Math.min(1, mFall * 2); // fully morphed by halfway through fall
            // Background: from dark translucent to video's darker grey (#181818)
            const bgR = Math.round(12 + (24 - 12) * morphP);
            const bgG = bgR;
            const bgB = bgR;
            fin.style.background = `linear-gradient(160deg, rgb(${bgR + 8}, ${bgG + 8}, ${bgB + 8}) 0%, rgb(${bgR - 4}, ${bgG - 4}, ${bgB - 4}) 40%, rgb(${bgR}, ${bgG}, ${bgB}) 100%)`;
            // Border fades out, replaced by soft shadow
            fin.style.border = `1px solid rgba(224, 224, 224, ${0.06 * (1 - morphP)})`;
            // Box shadow: glow → ambient shadow
            const glowA = 1 - morphP;
            const shadowA = morphP;
            fin.style.boxShadow = [
              `0 0 30px rgba(224, 224, 224, ${0.04 * glowA})`,
              `0 0 80px rgba(224, 224, 224, ${0.02 * glowA})`,
              `inset 0 0 60px rgba(224, 224, 224, ${0.01 * glowA})`,
              `inset 0 0 40px rgba(60, 60, 60, ${0.15 * shadowA})`,
              `0 0 20px rgba(0, 0, 0, ${0.5 * shadowA})`,
            ].join(', ');
            // Kill glow animation once morphing
            if (morphP > 0) fin.style.animation = 'none';

            // Transition background from #0a0a0a to match video bg during fall
            const bgP = Math.min(1, mFall * 1.5);
            const bgFrom = 10; // #0a
            const bgTo = 18;   // perceived match for video frame 1 (solid reads darker than noisy avg)
            const bgVal = Math.round(bgFrom + (bgTo - bgFrom) * bgP);
            pinned.style.background = `rgb(${bgVal}, ${bgVal}, ${bgVal})`;

          }

          // ── Frame sequence phase: after leaf-fall, scroll-driven video ──
          const framePRaw = rawP <= fallFrac ? 0 : Math.min(1, (rawP - fallFrac) / (1 - fallFrac));
          // Cap how fast frame progress can change per tick to prevent jarring jumps
          const maxDelta = 0.008; // ~1.5 frames per tick — smooth in both directions
          const prev = smoothedFpRef.current;
          const clamped = Math.max(prev - maxDelta, Math.min(prev + maxDelta, framePRaw));
          smoothedFpRef.current = clamped;
          const frameP = clamped;
          frameProgressRef.current = frameP;

          // Fade fin card out as frame sequence begins
          if (frameP > 0 && pastBreakaway > 0) {
            const finFadeOut = Math.max(0, 1 - frameP / 0.08);
            fin.style.opacity = String(finFadeOut);
          }
        }

        // ── Post-fin frame sequence: scroll-driven "video" ──
        // Position canvas so video card aligns with CSS fin card.
        // Crop top 20% and bottom 20% of the video frame; show middle 60%.
        const fc = frameCanvasRef.current;
        const fp = frameProgressRef.current;

        if (fc) {
          if (fp <= 0) {
            fc.style.opacity = '0';
          } else {
            // ── Align video to CSS card using matching perspective transform ──
            // Instead of trying to match the video's baked perspective to CSS via scaling
            // (impossible across viewports), we apply the SAME perspective+tilt to the canvas.
            // This makes the canvas deform identically to the CSS card on every screen.

            // Scale video so its card bottom edge matches cardW * fallScale BEFORE perspective
            // (perspective is applied via CSS transform on the canvas, not baked into scale)
            const cssVisualW = cardW * 0.70;
            const videoCardFrontW = FRAME_CARD_FRONT_W * POST_FRAME_W;
            const drawScale = cssVisualW / videoCardFrontW;

            const fullW = POST_FRAME_W * drawScale;
            const fullH = POST_FRAME_H * drawScale;

            // Position: card bottom-center at (viewW/2, floorY + CARD_H) in pinned coords
            // But the canvas will have perspective applied, so we position it in
            // un-perspectived space — the CSS transform handles the projection
            const cardBottomY = viewH * 0.55 + CARD_H;
            const cardCenterX = viewW / 2;

            // Full frame position so video card bottom-center aligns with CSS card
            const fullLeft = cardCenterX - FRAME_CARD_CX * fullW;
            const fullTop = cardBottomY - FRAME_CARD_BY * fullH;

            // Crop: top 20% and bottom 20% of the full frame
            const cropTop = 0.2;
            const cropBot = 0.2;
            const visibleTop = fullTop + cropTop * fullH;
            const visibleH = (1 - cropTop - cropBot) * fullH;

            // Canvas pixel buffer and CSS display size
            const canvasW = Math.ceil(fullW);
            const canvasH = Math.ceil(visibleH);
            if (fc.width !== canvasW || fc.height !== canvasH) {
              fc.width = canvasW;
              fc.height = canvasH;
            }
            fc.style.left = `${fullLeft}px`;
            fc.style.top = `${visibleTop}px`;
            fc.style.width = `${fullW}px`;
            fc.style.height = `${visibleH}px`;

            // No corrective transform needed — the CSS card now uses the same
            // fixed perspective (738px) as the video was rendered with, so the
            // foreshortening matches naturally on every viewport.
            fc.style.transform = 'none';

            // Pacing: ease through video — fast at start/end, slow through middle
            // Uses a symmetric S-curve that crawls through the mid-section
            // fp 0→1 maps to frameFrac 0→1, but spends more scroll time in the middle
            const midPoint = 117 / POST_FRAME_COUNT; // center of the slow zone
            // Piecewise hermite: ease-out into mid, ease-in out of mid
            let frameFrac: number;
            if (fp <= 0.5) {
              // First half of scroll → 0 to midPoint
              const t = fp / 0.5; // 0→1
              const eased = t * t * (3 - 2 * t); // smoothstep
              frameFrac = eased * midPoint;
            } else {
              // Second half of scroll → midPoint to 1
              // ease-in (accelerating out) so it doesn't stall on the last frame
              const t = (fp - 0.5) / 0.5; // 0→1
              const eased = t * t; // quadratic ease-in — slow departure from mid, fast finish
              frameFrac = midPoint + eased * (1 - midPoint);
            }

            // Fade in/out
            const frameFadeIn = Math.min(1, fp / 0.08);
            const frameFadeOut = fp > 0.92 ? Math.max(0, 1 - (fp - 0.92) / 0.08) : 1;
            fc.style.opacity = String(frameFadeIn * frameFadeOut);

            // Social buttons: fade in around midpoint, persist after video fades
            const socialStart = 0.35;
            const social = socialRef.current;
            if (social) {
              if (fp < socialStart) {
                social.style.opacity = '0';
                social.style.pointerEvents = 'none';
              } else {
                const socialFadeIn = Math.min(1, (fp - socialStart) / 0.1);
                social.style.opacity = String(socialFadeIn);
                social.style.pointerEvents = socialFadeIn > 0.5 ? 'auto' : 'none';
              }
            }

            // Keep stage background in sync with video's shifting bg color
            // Frame 1: ~#121212 (perceived — solid color reads darker than noisy video avg)
            // Frame 100+: #0c0c10 (darker, slight purple)
            const videoBgP = Math.min(1, frameFrac * 2);
            const vBgR = Math.round(18 - (18 - 12) * videoBgP);
            const vBgG = Math.round(18 - (18 - 12) * videoBgP);
            const vBgB = Math.round(18 - (18 - 16) * videoBgP);
            pinned.style.background = `rgb(${vBgR}, ${vBgG}, ${vBgB})`;

            // Draw: source crop from the frame image
            // The source region is the middle 60% vertically
            const srcY = cropTop * POST_FRAME_H;
            const srcH = (1 - cropTop - cropBot) * POST_FRAME_H;

            // Draw current frame
            {
              const frameCount = postFramesRef.current.length;
              const exactFrame = frameFrac * (frameCount - 1);
              const frameA = Math.floor(exactFrame);
              const frameB = Math.min(frameCount - 1, frameA + 1);
              const mix = exactFrame - frameA;

              const mixKey = frameA + mix;
              if (Math.abs(mixKey - lastPostFrameRef.current) > 0.001) {
                lastPostFrameRef.current = mixKey;
                const ctx = fc.getContext('2d');
                if (ctx) {
                  ctx.clearRect(0, 0, canvasW, canvasH);

                  const fImgA = postFramesRef.current[frameA];
                  if (fImgA?.complete) {
                    ctx.globalAlpha = 1;
                    ctx.drawImage(fImgA, 0, srcY, POST_FRAME_W, srcH, 0, 0, canvasW, canvasH);
                  }
                  const fImgB = postFramesRef.current[frameB];
                  if (fImgB?.complete && frameA !== frameB && mix > 0.01) {
                    ctx.globalAlpha = mix;
                    ctx.drawImage(fImgB, 0, srcY, POST_FRAME_W, srcH, 0, 0, canvasW, canvasH);
                    ctx.globalAlpha = 1;
                  }
                }
              }
            }
          }
        }


        // ── Stained glass parallax panels ──
        const glassVisible = p >= 0.74;
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
          const glassFade = p <= 0.76 ? (p - 0.74) / 0.02 : 1;
          // Fade out near the end
          const glassOut = (p >= 0.95 ? Math.max(0, 1 - (p - 0.95) / 0.04) : 1) * fallFadeOut;

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
            sectionNavSlot={
              <div
                ref={sectionNavRef}
                style={{
                  position: 'absolute',
                  left: 'calc(-50vw + 400px + 24px)',
                  top: '50%',
                  transform: 'translateY(-50%) translateZ(0px)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  opacity: 1,
                  pointerEvents: 'auto',
                }}
              >
                {(['Landing', 'Blog', 'Socials'] as const).map((label, i) => (
                  <button
                    key={label}
                    ref={(el) => { navBtnRefs.current[i] = el; }}
                    type="button"
                    onClick={() => {
                      const wrapper = wrapperRef.current;
                      if (!wrapper || !lenisRef.current) return;
                      const scrollMax = wrapper.scrollHeight - window.innerHeight;
                      const quartic = (t: number) => 1 - Math.pow(1 - t, 4);
                      const smoothstep = (t: number) => t * t * (3 - 2 * t);
                      if (i === 0) {
                        lenisRef.current.scrollTo(0, { duration: 8, easing: smoothstep });
                      } else if (i === 1) {
                        lenisRef.current.scrollTo(scrollMax * cardFrac * 0.78, { duration: 10, easing: quartic });
                      } else {
                        lenisRef.current.scrollTo(scrollMax, { duration: 10, easing: quartic });
                      }
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderLeft: '2px solid transparent',
                      color: 'rgba(255, 255, 255, 0.4)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.65rem',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'color 0.2s, background 0.2s, border-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
                    }}
                    onMouseLeave={(e) => {
                      // scroll handler resets color
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            }
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

        {/* Fin card */}
        <style>{`
          @keyframes fin-glow {
            0%, 100% {
              box-shadow:
                0 0 30px rgba(224, 224, 224, 0.03),
                0 0 80px rgba(224, 224, 224, 0.015),
                inset 0 0 60px rgba(224, 224, 224, 0.01);
              border-color: rgba(224, 224, 224, 0.06);
            }
            50% {
              box-shadow:
                0 0 40px rgba(224, 224, 224, 0.06),
                0 0 100px rgba(224, 224, 224, 0.03),
                inset 0 0 80px rgba(224, 224, 224, 0.02);
              border-color: rgba(224, 224, 224, 0.10);
            }
          }
        `}</style>
        <div
          ref={finCardRef}
          style={{
            position: 'absolute',
            top: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: `${CARD_H}px`,
            opacity: 0,
            zIndex: 3,
            willChange: 'transform, opacity',
            overflow: 'hidden',
            background: 'linear-gradient(160deg, rgba(20, 20, 20, 0.9) 0%, rgba(12, 12, 12, 0.95) 100%)',
            border: '1px solid rgba(224, 224, 224, 0.06)',
            animation: 'fin-glow 4s ease-in-out infinite',
          }}
        />

        {/* Post-fin frame sequence — scroll-driven video canvas */}
        <canvas
          ref={frameCanvasRef}
          style={{
            position: 'absolute',
            zIndex: 8,
            pointerEvents: 'none',
            opacity: 0,
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%), linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
            maskComposite: 'intersect',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%), linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
            WebkitMaskComposite: 'source-in',
          }}
        />

        {/* Social media buttons — appear during video hold phase */}
        <div
          ref={socialRef}
          style={{
            position: 'absolute',
            top: '15%',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9,
            display: 'flex',
            gap: '24px',
            opacity: 0,
            pointerEvents: 'none',
            transition: 'opacity 0.3s ease',
          }}
        >
          {/* Green glow backdrop */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '280px',
              height: '120px',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse, rgba(76, 149, 101, 0.25) 0%, rgba(86, 145, 83, 0.12) 40%, transparent 70%)',
              pointerEvents: 'none',
              filter: 'blur(20px)',
            }}
          />
          {[
            { label: 'GitHub', href: 'https://github.com', icon: 'M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z' },
            { label: 'LinkedIn', href: 'https://linkedin.com', icon: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z' },
            { label: 'X', href: 'https://x.com', icon: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' },
          ].map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.10)',
                color: 'rgba(255, 255, 255, 0.7)',
                transition: 'background 0.2s, color 0.2s, transform 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.95)';
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d={s.icon} />
              </svg>
            </a>
          ))}
        </div>

        {/* Section nav 2 — post-hold, outside hero so it's not clipped */}
        <div
          ref={sectionNav2Ref}
          style={{
            position: 'absolute',
            left: '24px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 11,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            opacity: 0,
            pointerEvents: 'none',
          }}
        >
          {(['Landing', 'Blog', 'Socials'] as const).map((label, i) => (
            <button
              key={label}
              ref={(el) => { navBtn2Refs.current[i] = el; }}
              type="button"
              onClick={() => {
                const wrapper = wrapperRef.current;
                if (!wrapper || !lenisRef.current) return;
                const scrollMax = wrapper.scrollHeight - window.innerHeight;
                const quartic = (t: number) => 1 - Math.pow(1 - t, 4);
                const smoothstep = (t: number) => t * t * (3 - 2 * t);
                if (i === 0) {
                  lenisRef.current.scrollTo(0, { duration: 20, easing: smoothstep });
                } else if (i === 1) {
                  lenisRef.current.scrollTo(scrollMax * cardFrac * 0.78, { duration: 16, easing: quartic });
                } else {
                  lenisRef.current.scrollTo(scrollMax, { duration: 20, easing: quartic });
                }
              }}
              style={{
                background: 'transparent',
                border: 'none',
                borderLeft: '2px solid transparent',
                color: 'rgba(255, 255, 255, 0.4)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.65rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '8px 12px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'color 0.2s, background 0.2s, border-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
              }}
              onMouseLeave={(e) => {
                // scroll handler resets color
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
