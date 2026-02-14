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
  const totalScrollVh = 200 + postCount * 80;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const postsRef = useRef<HTMLDivElement>(null);
  const archiveRef = useRef<HTMLDivElement>(null);

  const [postIndex, setPostIndex] = useState(0);
  const lenisRef = useRef<Lenis | null>(null);
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lenis smooth scroll
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    const lenis = new Lenis({
      lerp: 0.08,
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    // Connect Lenis to GSAP ScrollTrigger
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
    const posts = postsRef.current;
    const archive = archiveRef.current;
    if (!wrapper || !pinned || !hero || !posts || !archive) return;

    gsap.set(hero, { opacity: 1 });
    gsap.set(posts, { opacity: 0 });
    gsap.set(archive, { opacity: 0, pointerEvents: 'none' });

    // Crossfade zones — snap to whichever end is closest
    const FADE_ZONES = [
      { start: 0.10, end: 0.20 }, // Hero → Posts
      { start: 0.65, end: 0.75 }, // Posts → Archive
    ];

    const scheduleSnap = (progress: number, scrollStart: number, scrollEnd: number) => {
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);

      const zone = FADE_ZONES.find((z) => progress > z.start && progress < z.end);
      if (!zone) return;

      snapTimerRef.current = setTimeout(() => {
        const lenis = lenisRef.current;
        if (!lenis) return;
        const mid = (zone.start + zone.end) / 2;
        const snapTo = progress >= mid ? zone.end : zone.start;
        const targetScroll = scrollStart + snapTo * (scrollEnd - scrollStart);
        lenis.scrollTo(targetScroll, { duration: 0.6 });
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

        // Hero: full until 10%, fades out 10%–20%
        if (p <= 0.10) {
          gsap.set(hero, { opacity: 1 });
        } else if (p <= 0.20) {
          gsap.set(hero, { opacity: 1 - (p - 0.10) / 0.10 });
        } else {
          gsap.set(hero, { opacity: 0 });
        }

        // Posts: fades in 10%–20%, full 20%–65%, fades out 65%–75%
        if (p < 0.10) {
          gsap.set(posts, { opacity: 0 });
        } else if (p <= 0.20) {
          gsap.set(posts, { opacity: (p - 0.10) / 0.10 });
        } else if (p <= 0.65) {
          gsap.set(posts, { opacity: 1 });
        } else if (p <= 0.75) {
          gsap.set(posts, { opacity: 1 - (p - 0.65) / 0.10 });
        } else {
          gsap.set(posts, { opacity: 0 });
        }

        // Archive: fades in 65%–75%, full 75%–100%
        if (p < 0.65) {
          gsap.set(archive, { opacity: 0, pointerEvents: 'none' });
        } else if (p <= 0.75) {
          const fade = (p - 0.65) / 0.10;
          gsap.set(archive, { opacity: fade, pointerEvents: fade > 0.5 ? 'auto' : 'none' });
        } else {
          gsap.set(archive, { opacity: 1, pointerEvents: 'auto' });
        }

        // Post index: map 20%–65% to post indices
        if (postCount > 0 && p >= 0.20 && p <= 0.65) {
          const postProgress = (p - 0.20) / 0.45;
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
          <Blocks {...pageData} />
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
