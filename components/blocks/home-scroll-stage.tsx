'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { Blocks } from '@/components/blocks';
import { RecentPostsSlider } from '@/components/blocks/recent-posts-slider';
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

/**
 * Master scroll orchestrator for the home page.
 * Pins one viewport-sized container and crossfades three layers based on scroll progress.
 * Uses Lenis for smooth scrolling.
 *
 *   0%–28%     Hero visible, 3D tilt + layer separation
 *   20%–40%    Card transition: bracket slide, untilt, expand to fullscreen
 *   40%–70%    Hold phase: WILLIAM→IRL collapse, frame sequence, IRL slide-up
 *   68%–75%    Hero → Posts crossfade
 *   75%–87%    Posts cycling through individual posts
 *   87%–94%    Posts → Archive crossfade
 *   94%–100%   Archive visible
 */
export function HomeScrollStage({ pageData, recentPosts, archivePosts, tags }: HomeScrollStageProps) {
  const postCount = recentPosts.filter((p) => p?.node).length;
  const totalScrollVh = 550 + postCount * 80;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const postsRef = useRef<HTMLDivElement>(null);
  const archiveRef = useRef<HTMLDivElement>(null);

  const [postIndex, setPostIndex] = useState(0);
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
    const posts = postsRef.current;
    const archive = archiveRef.current;
    if (!wrapper || !pinned || !hero || !posts || !archive) return;

    gsap.set(hero, { opacity: 1 });
    gsap.set(posts, { opacity: 0 });
    gsap.set(archive, { opacity: 0, pointerEvents: 'none' });

    const st = ScrollTrigger.create({
      trigger: wrapper,
      start: 'top top',
      end: 'bottom bottom',
      pin: pinned,
      pinSpacing: false,
      onUpdate: (self) => {
        const p = self.progress;

        // Write progress directly to ref — no React re-renders
        progressRef.current.scroll = Math.min(1, p / 0.28);
        progressRef.current.transition = p <= 0.20 ? 0 : p >= 0.40 ? 1 : (p - 0.20) / 0.20;
        progressRef.current.hold = p <= 0.40 ? 0 : p >= 0.70 ? 1 : (p - 0.40) / 0.30;

        // Hero → Posts crossfade (68%–75%)
        const heroOut = p <= 0.68 ? 1 : p >= 0.75 ? 0 : 1 - (p - 0.68) / 0.07;
        const postsIn = p <= 0.68 ? 0 : p >= 0.75 ? 1 : (p - 0.68) / 0.07;
        gsap.set(hero, { opacity: heroOut });

        // Posts → Archive crossfade (87%–94%)
        const postsOut = p <= 0.87 ? 1 : p >= 0.94 ? 0 : 1 - (p - 0.87) / 0.07;
        const archiveIn = p <= 0.87 ? 0 : p >= 0.94 ? 1 : (p - 0.87) / 0.07;

        gsap.set(posts, { opacity: postsIn * postsOut });
        gsap.set(archive, { opacity: archiveIn, pointerEvents: archiveIn > 0.5 ? 'auto' : 'none' });

        // Post index: map 75%–87% to post indices
        if (postCount > 0 && p >= 0.75 && p <= 0.87) {
          const postProgress = (p - 0.75) / 0.12;
          const idx = Math.min(postCount - 1, Math.floor(postProgress * postCount));
          setPostIndex((prev) => (prev !== idx ? idx : prev));
        }
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
        {/* Layer 1: Hero */}
        <div ref={heroRef} style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          <Blocks {...pageData} cardPosts={cardPosts} progressRef={progressRef} />
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
