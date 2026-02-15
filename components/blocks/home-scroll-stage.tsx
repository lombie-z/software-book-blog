'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { Blocks } from '@/components/blocks';
import { RecentPostsSlider } from '@/components/blocks/recent-posts-slider';
import { BlogArchive } from '@/components/blocks/blog-archive';
import type { Page, PostConnectionQuery, TagConnectionQuery } from '@/tina/__generated__/types';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

type PostEdges = NonNullable<PostConnectionQuery['postConnection']['edges']>;
type TagEdges = NonNullable<TagConnectionQuery['tagConnection']['edges']>;

interface HomeScrollStageProps {
  pageData: Omit<Page, 'id' | '_sys' | '_values'>;
  recentPosts: PostEdges;
  archivePosts: PostEdges;
  tags: TagEdges;
}

/**
 * Master scroll orchestrator for the home page.
 * Pins one viewport-sized container and fades three layers based on scroll progress.
 * Uses Lenis for smooth scrolling.
 *
 *   0%–10%    Hero visible
 *   10%–20%   Hero → Posts crossfade
 *   20%–65%   Posts visible, cycling through individual posts
 *   65%–75%   Posts → Archive crossfade
 *   75%–100%  Archive visible
 */
export function HomeScrollStage({ pageData, recentPosts, archivePosts, tags }: HomeScrollStageProps) {
  const postCount = recentPosts.filter((p) => p?.node).length;
  const totalScrollVh = 350 + postCount * 80;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const postsRef = useRef<HTMLDivElement>(null);
  const archiveRef = useRef<HTMLDivElement>(null);

  const [postIndex, setPostIndex] = useState(0);
  const [heroProgress, setHeroProgress] = useState(0);
  const lenisRef = useRef<Lenis | null>(null);
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSnappingRef = useRef(false);

  // Lenis smooth scroll
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    const lenis = new Lenis({
      lerp: 0.08,
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    // Reset snap lock if user scrolls manually (wheel/touch interrupts the snap)
    const onWheel = () => {
      isSnappingRef.current = false;
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onWheel, { passive: true });

    // Connect Lenis to GSAP ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onWheel);
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
    const posts = postsRef.current;
    const archive = archiveRef.current;
    if (!wrapper || !pinned || !hero || !posts || !archive) return;

    gsap.set(hero, { opacity: 1 });
    gsap.set(posts, { opacity: 0 });
    gsap.set(archive, { opacity: 0, pointerEvents: 'none' });

    // Crossfade zones — snap to whichever end is closest
    const FADE_ZONES = [
      { start: 0.30, end: 0.40 }, // Hero → Posts
      { start: 0.75, end: 0.85 }, // Posts → Archive
    ];

    const scheduleSnap = (progress: number, scrollStart: number, scrollEnd: number) => {
      // Don't schedule new snaps while one is animating
      if (isSnappingRef.current) return;
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);

      const zone = FADE_ZONES.find((z) => progress > z.start && progress < z.end);
      if (!zone) return;

      snapTimerRef.current = setTimeout(() => {
        const lenis = lenisRef.current;
        if (!lenis) return;
        isSnappingRef.current = true;
        const mid = (zone.start + zone.end) / 2;
        const snapTo = progress >= mid ? zone.end : zone.start;
        const targetScroll = scrollStart + snapTo * (scrollEnd - scrollStart);
        const snapDuration = 1.2;
        lenis.scrollTo(targetScroll, {
          duration: snapDuration,
          easing: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
          onComplete: () => {
            isSnappingRef.current = false;
          },
        });
        // Fallback: always unlock after duration + buffer
        setTimeout(() => {
          isSnappingRef.current = false;
        }, snapDuration * 1000 + 200);
      }, 150);
    };

    const st = ScrollTrigger.create({
      trigger: wrapper,
      start: 'top top',
      end: 'bottom bottom',
      pin: pinned,
      pinSpacing: false,
      onUpdate: (self) => {
        const p = self.progress;

        // Hero 3D animation: normalize 0–35% stage progress to 0–1
        const hp = Math.min(1, p / 0.35);
        setHeroProgress((prev) => (Math.abs(prev - hp) > 0.005 ? hp : prev));

        // Hero: full until 30%, fades out 30%–40%
        if (p <= 0.30) {
          gsap.set(hero, { opacity: 1 });
        } else if (p <= 0.40) {
          gsap.set(hero, { opacity: 1 - (p - 0.30) / 0.10 });
        } else {
          gsap.set(hero, { opacity: 0 });
        }

        // Posts: fades in 30%–40%, full 40%–75%, fades out 75%–85%
        if (p < 0.30) {
          gsap.set(posts, { opacity: 0 });
        } else if (p <= 0.40) {
          gsap.set(posts, { opacity: (p - 0.30) / 0.10 });
        } else if (p <= 0.75) {
          gsap.set(posts, { opacity: 1 });
        } else if (p <= 0.85) {
          gsap.set(posts, { opacity: 1 - (p - 0.75) / 0.10 });
        } else {
          gsap.set(posts, { opacity: 0 });
        }

        // Archive: fades in 75%–85%, full 85%–100%
        if (p < 0.75) {
          gsap.set(archive, { opacity: 0, pointerEvents: 'none' });
        } else if (p <= 0.85) {
          const fade = (p - 0.75) / 0.10;
          gsap.set(archive, { opacity: fade, pointerEvents: fade > 0.5 ? 'auto' : 'none' });
        } else {
          gsap.set(archive, { opacity: 1, pointerEvents: 'auto' });
        }

        // Post index: map 40%–75% to post indices
        if (postCount > 0 && p >= 0.40 && p <= 0.75) {
          const postProgress = (p - 0.40) / 0.35;
          const idx = Math.min(postCount - 1, Math.floor(postProgress * postCount));
          setPostIndex((prev) => (prev !== idx ? idx : prev));
        }

        // Snap out of crossfade zones when scrolling settles
        scheduleSnap(p, self.start, self.end);
      },
    });

    return () => {
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
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
        {/* Layer 1: Hero */}
        <div ref={heroRef} style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          <Blocks {...pageData} scrollProgress={heroProgress} />
        </div>

        {/* Layer 2: Posts slider */}
        <div ref={postsRef} style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
          <RecentPostsSlider posts={recentPosts} embedded currentIndex={postIndex} />
        </div>

        {/* Layer 3: Archive */}
        <div
          ref={archiveRef}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 3,
            overflow: 'auto',
          }}
        >
          <BlogArchive posts={archivePosts} tags={tags} />
        </div>
      </div>
    </div>
  );
}
