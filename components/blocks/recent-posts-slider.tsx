'use client';
import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { PostConnectionQuery } from '@/tina/__generated__/types';

type PostEdges = NonNullable<PostConnectionQuery['postConnection']['edges']>;

const CONFIG = {
  SCROLL_SPEED: 0.75,
  LERP_FACTOR: 0.05,
  BUFFER_SIZE: 5,
  MAX_VELOCITY: 150,
  SNAP_DURATION: 500,
};

const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

export function RecentPostsSlider({ posts }: { posts: PostEdges }) {
  const validPosts = posts.filter((p) => p?.node) as NonNullable<(typeof posts)[number]>[];
  const count = validPosts.length;

  const [visibleRange, setVisibleRange] = React.useState({
    min: -CONFIG.BUFFER_SIZE,
    max: CONFIG.BUFFER_SIZE,
  });
  const fadeTopRef = React.useRef<HTMLDivElement>(null);
  const fadeBotRef = React.useRef<HTMLDivElement>(null);

  const getPost = (index: number) => {
    const i = ((Math.abs(index) % count) + count) % count;
    return validPosts[i]!.node!;
  };

  const getPostNumber = (index: number) => {
    return (((Math.abs(index) % count) + count) % count + 1).toString().padStart(2, '0');
  };

  const containerRef = React.useRef<HTMLDivElement>(null);
  const minimapCardRef = React.useRef<HTMLDivElement>(null);
  const contoursRef = React.useRef<HTMLDivElement>(null);
  const isActiveRef = React.useRef(false);
  const lastSnappedIndex = React.useRef(0);

  const state = React.useRef({
    currentY: 0,
    targetY: 0,
    isDragging: false,
    isSnapping: false,
    snapStart: { time: 0, y: 0, target: 0 },
    lastScrollTime: Date.now(),
    dragStart: { y: 0, scrollY: 0 },
    projectHeight: 0,
    minimapHeight: 250,
  });

  const projectsRef = React.useRef<Map<number, HTMLDivElement>>(new Map());
  const minimapRef = React.useRef<Map<number, HTMLDivElement>>(new Map());
  const infoRef = React.useRef<Map<number, HTMLDivElement>>(new Map());
  const requestRef = React.useRef<number>();
  const renderedRange = React.useRef({ min: -CONFIG.BUFFER_SIZE, max: CONFIG.BUFFER_SIZE });

  const updateParallax = (img: HTMLImageElement | null, scroll: number, index: number, height: number) => {
    if (!img) return;
    if (!img.dataset.parallaxCurrent) {
      img.dataset.parallaxCurrent = '0';
      img.style.transform = 'translateY(0px) scale(1.5)';
    }
    let current = Number.parseFloat(img.dataset.parallaxCurrent);
    const target = (-scroll - index * height) * 0.2;
    current = lerp(current, target, 0.1);
    img.style.transform = `translateY(${current}px) scale(1.5)`;
    img.dataset.parallaxCurrent = current.toString();
  };

  const updateSnap = () => {
    const s = state.current;
    const progress = Math.min((Date.now() - s.snapStart.time) / CONFIG.SNAP_DURATION, 1);
    const eased = 1 - (1 - progress) ** 3;
    s.targetY = s.snapStart.y + (s.snapStart.target - s.snapStart.y) * eased;
    if (progress >= 1) s.isSnapping = false;
  };

  const snapToProject = () => {
    const s = state.current;
    const current = Math.round(-s.targetY / s.projectHeight);
    const target = -current * s.projectHeight;
    s.isSnapping = true;
    s.snapStart = { time: Date.now(), y: s.targetY, target };
  };

  const updatePositions = () => {
    const s = state.current;
    const minimapY = (s.currentY * s.minimapHeight) / s.projectHeight;

    projectsRef.current.forEach((el, index) => {
      const y = index * s.projectHeight + s.currentY;
      el.style.transform = `translateY(${y}px)`;
      const img = el.querySelector('img');
      updateParallax(img, s.currentY, index, s.projectHeight);
    });

    minimapRef.current.forEach((el, index) => {
      const y = index * s.minimapHeight + minimapY;
      el.style.transform = `translateY(${y}px)`;
      const img = el.querySelector('img');
      if (img) updateParallax(img, minimapY, index, s.minimapHeight);
    });

    infoRef.current.forEach((el, index) => {
      const y = index * s.minimapHeight + minimapY;
      el.style.transform = `translateY(${y}px)`;
    });
  };

  const animateFrame = () => {
    const s = state.current;
    const now = Date.now();

    if (!s.isSnapping && !s.isDragging && now - s.lastScrollTime > 100) {
      const snapPoint = -Math.round(-s.targetY / s.projectHeight) * s.projectHeight;
      if (Math.abs(s.targetY - snapPoint) > 1) snapToProject();
    }

    if (s.isSnapping) updateSnap();
    if (!s.isDragging) {
      s.currentY += (s.targetY - s.currentY) * CONFIG.LERP_FACTOR;
    }

    updatePositions();

    const currentIndex = Math.round(-s.targetY / s.projectHeight);
    const min = currentIndex - CONFIG.BUFFER_SIZE;
    const max = currentIndex + CONFIG.BUFFER_SIZE;

    if (min !== renderedRange.current.min || max !== renderedRange.current.max) {
      renderedRange.current = { min, max };
      setVisibleRange({ min, max });
    }

    // Fade overlays — only on exact first/last post
    const snappedIndex = Math.round(-s.targetY / s.projectHeight);
    if (fadeTopRef.current) fadeTopRef.current.style.opacity = snappedIndex === 0 ? '1' : '0';
    if (fadeBotRef.current) fadeBotRef.current.style.opacity = snappedIndex === count - 1 ? '1' : '0';

    // Pulse contours on selection change
    if (snappedIndex !== lastSnappedIndex.current && contoursRef.current) {
      lastSnappedIndex.current = snappedIndex;
      const wrap = contoursRef.current;
      wrap.classList.remove('contour-pulse');
      // Force reflow to restart staggered ring animations
      void wrap.offsetWidth;
      wrap.classList.add('contour-pulse');
    }

    requestRef.current = requestAnimationFrame(animateFrame);
  };

  React.useEffect(() => {
    if (count === 0) return;

    const container = containerRef.current;
    if (!container) return;

    state.current.projectHeight = container.clientHeight;

    // Intersection observer — only capture scroll when section is mostly visible
    const observer = new IntersectionObserver(
      ([entry]) => {
        const wasActive = isActiveRef.current;
        isActiveRef.current = entry.isIntersecting;
        // Snap container flush to viewport when activating
        if (!wasActive && entry.isIntersecting) {
          container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      },
      { threshold: 0.85 }
    );
    observer.observe(container);

    const onWheel = (e: WheelEvent) => {
      if (!isActiveRef.current) return;
      const s = state.current;
      const maxScroll = -(count - 1) * s.projectHeight;
      const currentIndex = Math.round(-s.targetY / s.projectHeight);

      // At first post scrolling up, or last post scrolling down — let native scroll through
      if (e.deltaY < 0 && currentIndex <= 0 && s.targetY >= 0) return;
      if (e.deltaY > 0 && currentIndex >= count - 1 && s.targetY <= maxScroll) return;

      e.preventDefault();
      s.isSnapping = false;
      s.lastScrollTime = Date.now();
      const delta = Math.max(Math.min(e.deltaY * CONFIG.SCROLL_SPEED, CONFIG.MAX_VELOCITY), -CONFIG.MAX_VELOCITY);
      s.targetY = Math.max(maxScroll, Math.min(0, s.targetY - delta));
    };

    const onTouchStart = (e: TouchEvent) => {
      if (!isActiveRef.current) return;
      const s = state.current;
      s.isDragging = true;
      s.isSnapping = false;
      s.dragStart = { y: e.touches[0].clientY, scrollY: s.targetY };
      s.lastScrollTime = Date.now();
    };

    const onTouchMove = (e: TouchEvent) => {
      const s = state.current;
      if (!s.isDragging) return;
      s.targetY = s.dragStart.scrollY + (e.touches[0].clientY - s.dragStart.y) * 1.5;
      s.lastScrollTime = Date.now();
    };

    const onTouchEnd = () => {
      state.current.isDragging = false;
    };

    const onResize = () => {
      if (container) {
        state.current.projectHeight = container.clientHeight;
        container.style.height = `${container.clientHeight}px`;
      }
    };

    // Mouse-tracking tilt on the info card
    const onMouseMove = (e: MouseEvent) => {
      if (!minimapCardRef.current || !container) return;
      const x = (container.clientWidth / 2 - e.clientX) / 50;
      const y = (container.clientHeight / 2 - e.clientY) / 50;
      minimapCardRef.current.style.transform = `translate(-50%, -50%) perspective(800px) rotateX(${-y}deg) rotateY(${x}deg)`;
      // Contours get amplified movement for internal parallax
      if (contoursRef.current) {
        const cx = x * 3;
        const cy = y * 3;
        contoursRef.current.style.transform = `translate(${cx}px, ${cy}px)`;
      }
    };

    const onMouseLeave = () => {
      if (minimapCardRef.current) {
        minimapCardRef.current.style.transition = 'transform 0.6s ease';
        minimapCardRef.current.style.transform = 'translate(-50%, -50%) perspective(800px) rotateX(0deg) rotateY(0deg)';
        setTimeout(() => {
          if (minimapCardRef.current) minimapCardRef.current.style.transition = 'transform 0.15s ease';
        }, 600);
      }
      if (contoursRef.current) {
        contoursRef.current.style.transition = 'transform 0.6s ease';
        contoursRef.current.style.transform = 'translate(0px, 0px)';
        setTimeout(() => {
          if (contoursRef.current) contoursRef.current.style.transition = 'transform 0.15s ease';
        }, 600);
      }
    };

    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseleave', onMouseLeave);

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('resize', onResize);

    requestRef.current = requestAnimationFrame(animateFrame);

    return () => {
      observer.disconnect();
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('resize', onResize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [count]);

  if (count === 0) return null;

  const indices: number[] = [];
  for (let i = visibleRange.min; i <= visibleRange.max; i++) {
    indices.push(i);
  }

  return (
    <>
      <style>{`
        .parallax-container {
          position: relative;
          height: 100vh;
          width: 100%;
          overflow: hidden;
          background: #0a0a0a;
          cursor: grab;
        }
        .parallax-container:active { cursor: grabbing; }

        .project-list {
          list-style: none;
          margin: 0;
          padding: 0;
          position: absolute;
          inset: 0;
        }

        .project {
          position: absolute;
          width: 100%;
          height: 100%;
          overflow: hidden;
          opacity: 0.4;
        }

        .project img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          will-change: transform;
        }

        .slider-grain {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 3;
          opacity: 0.12;
        }

        .slider-contours-wrap {
          position: absolute;
          top: 50%;
          left: 50%;
          translate: -50% -50%;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 4;
          transition: transform 0.15s ease;
          overflow: hidden;
        }

        .slider-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          translate: -50% -50%;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.08);
        }

        .slider-vignette {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 2;
          background: radial-gradient(ellipse at center, transparent 40%, #0a0a0a 100%);
        }

        .minimap {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          z-index: 10;
          width: min(90vw, 750px);
          height: 250px;
          background: #fff;
          overflow: hidden;
        }

        .minimap-wrapper {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
        }

        .minimap-img-preview {
          position: relative;
          width: 250px;
          height: 100%;
          overflow: hidden;
          flex-shrink: 0;
          margin-left: auto;
        }

        @media (max-width: 639px) {
          .minimap-img-preview { width: 120px; }
        }

        .minimap-img-item {
          position: absolute;
          width: 100%;
          height: 250px;
          overflow: hidden;
        }

        .minimap-img-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          will-change: transform;
        }

        .minimap-info-list {
          position: relative;
          flex: 1;
          height: 100%;
          overflow: hidden;
        }

        .minimap-item-info {
          position: absolute;
          width: 100%;
          height: 250px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 2rem 2.5rem;
          box-sizing: border-box;
        }

        .minimap-item-info-row p {
          margin: 0;
          font-size: 0.8rem;
          font-weight: 700;
          font-family: system-ui, sans-serif;
          color: #0a0a0a;
          line-height: 1.5;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .minimap-item-info-row p:first-child {
          font-family: monospace;
          font-size: 0.75rem;
          font-weight: 400;
        }

        .minimap-item-info-row:first-child p:last-child {
          font-size: 1.1rem;
          font-weight: 800;
          letter-spacing: -0.01em;
        }

        .minimap-item-info a {
          color: #0a0a0a;
          text-decoration: none;
          transition: color 0.2s;
        }
        .minimap-item-info a:hover { color: #ff3c00; }

        .parallax-fade {
          position: absolute;
          left: 0;
          right: 0;
          height: 30%;
          z-index: 5;
          pointer-events: none;
          transition: opacity 0.6s ease;
        }

        .parallax-fade-top {
          top: 0;
          background: linear-gradient(to bottom, #0a0a0a, transparent);
        }

        .parallax-fade-bottom {
          bottom: 0;
          background: linear-gradient(to top, #0a0a0a, transparent);
        }

        .contour-pulse .slider-ring {
          animation: ringPulse 0.9s ease-out forwards;
        }

        @keyframes ringPulse {
          0% { scale: 1; border-color: rgba(255,255,255,0.18); }
          25% { scale: calc(1 - 0.03 * var(--dampen)); border-color: rgba(255,255,255,0.12); }
          50% { scale: calc(1 + 0.015 * var(--dampen)); border-color: rgba(255,255,255,0.08); }
          70% { scale: calc(1 - 0.007 * var(--dampen)); }
          85% { scale: calc(1 + 0.003 * var(--dampen)); }
          100% { scale: 1; border-color: rgba(255,255,255,0.08); }
        }
      `}</style>

      <div className="parallax-container" ref={containerRef}>
        <div ref={fadeTopRef} className="parallax-fade parallax-fade-top" style={{ opacity: 1 }} />
        <div ref={fadeBotRef} className="parallax-fade parallax-fade-bottom" style={{ opacity: 0 }} />

        <ul className="project-list">
          {indices.map((i) => {
            const post = getPost(i);
            return (
              <div
                key={i}
                className="project"
                ref={(el) => {
                  if (el) projectsRef.current.set(i, el);
                  else projectsRef.current.delete(i);
                }}
              >
                {post.heroImg ? (
                  <Image src={post.heroImg} alt={post.title || ''} fill sizes="100vw" style={{ objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: '#111' }} />
                )}
              </div>
            );
          })}
        </ul>

        {/* Overlays — grain, contours, vignette */}
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <filter id="slider-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </svg>
        <div className="slider-grain" style={{ filter: 'url(#slider-grain)' }} />
        <div className="slider-vignette" />

        {/* Contour rings — over background, behind card */}
        <div className="slider-contours-wrap" ref={contoursRef}>
          {Array.from({ length: 12 }, (_, i) => {
            const size = 60 + i * 80;
            return (
              <div
                key={i}
                className="slider-ring"
                style={{
                  width: size,
                  height: size,
                  animationDelay: `${(i * (i + 1)) / 2 * 0.02}s`,
                  '--dampen': 1 - (i / 11) * 0.8,
                } as React.CSSProperties}
              />
            );
          })}
        </div>

        <div className="minimap" ref={minimapCardRef} style={{ transition: 'transform 0.15s ease' }}>
          <div className="minimap-wrapper">
            <div className="minimap-info-list">
              {indices.map((i) => {
                const post = getPost(i);
                const num = getPostNumber(i);
                const slug = post._sys.breadcrumbs.join('/');
                const date = post.date ? new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : '';
                const tags = post.tags?.map((t) => t?.tag?.name).filter(Boolean) || [];
                const excerpt = post.excerpt?.children?.map((child: any) => child?.children?.map((c: any) => c?.text).join('')).join(' ').slice(0, 80) || '';

                return (
                  <div
                    key={i}
                    className="minimap-item-info"
                    ref={(el) => {
                      if (el) infoRef.current.set(i, el);
                      else infoRef.current.delete(i);
                    }}
                  >
                    <div className="minimap-item-info-row">
                      <p>{num}</p>
                      <p><Link href={`/posts/${slug}`}>{post.title}</Link></p>
                    </div>
                    <div className="minimap-item-info-row">
                      <p>{tags[0] || ''}</p>
                      <p>{date}</p>
                    </div>
                    <div className="minimap-item-info-row">
                      <p>{excerpt}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="minimap-img-preview">
              {indices.map((i) => {
                const post = getPost(i);
                return (
                  <div
                    key={i}
                    className="minimap-img-item"
                    ref={(el) => {
                      if (el) minimapRef.current.set(i, el);
                      else minimapRef.current.delete(i);
                    }}
                  >
                    {post.heroImg ? (
                      <Image src={post.heroImg} alt={post.title || ''} width={250} height={250} style={{ objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: '#222' }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
