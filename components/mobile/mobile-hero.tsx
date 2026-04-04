'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type PermState = 'detecting' | 'ios-prompt' | 'requesting' | 'active' | 'touch-fallback';

// ─── Constants ────────────────────────────────────────────────────────────────

// How far (px) each layer moves at full tilt (normalized ±1).
// Positive = moves in tilt direction (foreground feel).
// Negative = moves opposite to tilt (background feel).
// Layer order: warm-silhouette, portrait, green-silhouette, frame, text
const LAYER_DEPTHS = [50, 32, 18, 0, -18] as const;

// Natural phone-hold pitch offset — beta ≈ 70° when upright
const BETA_OFFSET = 70;

// LERP smoothing factor (lower = smoother/more lag)
const LERP_ALPHA = 0.07;

// ─── SVG Filigree Corner ─────────────────────────────────────────────────────

function FiligreeCorner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const flipX = pos === 'tr' || pos === 'br';
  const flipY = pos === 'bl' || pos === 'br';
  const style: CSSProperties = {
    position: 'absolute',
    color: 'rgba(224, 224, 224, 0.55)',
    ...(pos.includes('t') ? { top: -1 } : { bottom: -1 }),
    ...(pos.includes('l') ? { left: -1 } : { right: -1 }),
    transform: `scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`,
  };

  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={style}>
      {/* L-bracket arms */}
      <path d="M 4 24 L 4 4 L 24 4" stroke="currentColor" strokeWidth="1" strokeLinecap="square" />
      {/* Inner corner accent */}
      <path d="M 8 24 L 8 8 L 24 8" stroke="currentColor" strokeWidth="0.5" strokeLinecap="square" opacity="0.4" />
      {/* Corner jewel */}
      <circle cx="4" cy="4" r="1.5" fill="currentColor" />
      {/* Mid-arm dots */}
      <circle cx="4" cy="14" r="0.8" fill="currentColor" opacity="0.5" />
      <circle cx="14" cy="4" r="0.8" fill="currentColor" opacity="0.5" />
      {/* Outer serif ticks */}
      <path d="M 1 4 L 4 4" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
      <path d="M 4 1 L 4 4" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MobileHero() {
  const [permState, setPermState] = useState<PermState>('detecting');
  const [showHint, setShowHint] = useState(false);

  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number>(0);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const gyroCleanupRef = useRef<(() => void) | null>(null);

  // ── Permission detection on mount ─────────────────────────────────────────

  useEffect(() => {
    if (typeof DeviceOrientationEvent === 'undefined') {
      setPermState('touch-fallback');
      return;
    }
    // iOS 13+ exposes requestPermission as a static method
    if (typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function') {
      setPermState('ios-prompt');
    } else {
      setPermState('active');
    }
  }, []);

  // ── Gyroscope listener ────────────────────────────────────────────────────

  const attachGyro = useCallback(() => {
    const handler = (e: DeviceOrientationEvent) => {
      const x = Math.max(-1, Math.min(1, (e.gamma ?? 0) / 45));
      const y = Math.max(-1, Math.min(1, ((e.beta ?? BETA_OFFSET) - BETA_OFFSET) / 45));
      targetRef.current = { x, y };
    };
    window.addEventListener('deviceorientation', handler, { passive: true });
    return () => window.removeEventListener('deviceorientation', handler);
  }, []);

  // ── iOS permission request ────────────────────────────────────────────────

  const requestPermission = useCallback(async () => {
    setPermState('requesting');
    try {
      const doe = DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> };
      const result = await doe.requestPermission();
      setPermState(result === 'granted' ? 'active' : 'touch-fallback');
    } catch {
      setPermState('touch-fallback');
    }
  }, []);

  // ── RAF animation loop ────────────────────────────────────────────────────

  useEffect(() => {
    if (permState === 'detecting' || permState === 'ios-prompt' || permState === 'requesting') return;

    if (permState === 'active') {
      gyroCleanupRef.current = attachGyro();
      // Show tilt hint briefly
      setShowHint(true);
      const t = setTimeout(() => setShowHint(false), 4000);
      return () => clearTimeout(t);
    }

    // touch-fallback: show drag hint
    setShowHint(true);
    const t = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(t);
  }, [permState, attachGyro]);

  useEffect(() => {
    if (permState === 'detecting' || permState === 'ios-prompt' || permState === 'requesting') return;

    const animate = () => {
      currentRef.current.x += (targetRef.current.x - currentRef.current.x) * LERP_ALPHA;
      currentRef.current.y += (targetRef.current.y - currentRef.current.y) * LERP_ALPHA;

      const { x, y } = currentRef.current;
      layerRefs.current.forEach((el, i) => {
        if (!el) return;
        const d = LAYER_DEPTHS[i] ?? 0;
        el.style.transform = `translateX(${(x * d).toFixed(2)}px) translateY(${(y * d).toFixed(2)}px)`;
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(rafRef.current);
      gyroCleanupRef.current?.();
      gyroCleanupRef.current = null;
    };
  }, [permState]);

  // ── Touch / pointer fallback ──────────────────────────────────────────────

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (permState !== 'touch-fallback') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    targetRef.current = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
  }, [permState]);

  // Gently return to center when pointer leaves (touch-fallback only)
  const handlePointerLeave = useCallback(() => {
    if (permState !== 'touch-fallback') return;
    targetRef.current = { x: 0, y: 0 };
  }, [permState]);

  // ── Hint text ─────────────────────────────────────────────────────────────

  const hintText = permState === 'touch-fallback' ? 'Drag to explore' : 'Tilt to explore';
  const showPrompt = permState === 'ios-prompt' || permState === 'requesting';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        .mh-hero {
          position: relative;
          width: 100%;
          height: 100svh;
          overflow: hidden;
          background: #050505;
          display: flex;
          align-items: center;
          justify-content: center;
          touch-action: pan-y;
          -webkit-user-select: none;
          user-select: none;
        }

        /* ── Grain ── */
        .mh-grain {
          position: absolute;
          inset: 0;
          z-index: 5;
          opacity: 0.10;
          pointer-events: none;
          filter: url(#mh-grain-filter);
        }

        /* ── Parallax layers ── */
        /* inset: -70px makes each layer 140px wider/taller than the viewport,
           so 70px of parallax travel is available before edges show. */
        .mh-layer {
          position: absolute;
          inset: -70px;
          background-size: cover;
          background-position: center;
          will-change: transform;
          backface-visibility: hidden;
        }

        .mh-layer-warm {
          background-image: url('/images/hero-silhouette-warm.png');
          background-position: left top;
          opacity: 0.45;
        }

        .mh-layer-portrait {
          background-image: url('/images/hero-portrait-photo.png');
          background-position: center top;
          opacity: 0.30;
          filter: brightness(0.6);
        }

        .mh-layer-green {
          background-image: url('/images/hero-silhouette-green.png');
          background-position: left top;
          opacity: 0.50;
        }

        .mh-layer-frame {
          background-image: url('/images/hero-frame.png');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          opacity: 0.80;
          animation: mh-frame-breathe 4s ease-in-out infinite;
        }

        @keyframes mh-frame-breathe {
          0%, 100% {
            opacity: 0.65;
            filter: drop-shadow(0 0 8px rgba(224, 224, 224, 0.04));
          }
          50% {
            opacity: 0.88;
            filter: drop-shadow(0 0 24px rgba(224, 224, 224, 0.10));
          }
        }

        /* ── Text layer ── */
        .mh-layer-text {
          inset: 0;             /* text layer is viewport-sized — no parallax bleed needed */
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 4;
          pointer-events: none;
        }

        /* ── Radial vignette ── */
        .mh-vignette {
          position: absolute;
          inset: 0;
          z-index: 3;
          background: radial-gradient(
            ellipse 80% 80% at center,
            transparent 25%,
            rgba(0, 0, 0, 0.28) 60%,
            rgba(0, 0, 0, 0.88) 100%
          );
          pointer-events: none;
        }

        /* ── Title block ── */
        .mh-title-block {
          text-align: center;
          padding: 0 1.5rem;
        }

        .mh-title {
          font-family: var(--font-heading);
          font-size: clamp(2.2rem, 9vw, 3.8rem);
          color: rgba(224, 224, 224, 0.92);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          line-height: 1;
          margin: 0;
          animation: mh-title-glow 4s ease-in-out infinite;
        }

        @keyframes mh-title-glow {
          0%, 100% {
            text-shadow:
              0 0 12px rgba(224, 224, 224, 0.12),
              0 2px 40px rgba(0, 0, 0, 0.8);
          }
          50% {
            text-shadow:
              0 0 28px rgba(224, 224, 224, 0.22),
              0 0 60px rgba(200, 210, 220, 0.08),
              0 2px 40px rgba(0, 0, 0, 0.8);
          }
        }

        .mh-tagline {
          font-family: var(--font-mono);
          font-size: 0.6rem;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(224, 224, 224, 0.35);
          margin-top: 1.25rem;
        }

        /* ── iOS prompt overlay ── */
        .mh-prompt-overlay {
          position: absolute;
          inset: 0;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          background: rgba(5, 5, 5, 0.72);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          animation: mh-overlay-in 0.4s ease-out both;
        }

        @keyframes mh-overlay-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .mh-awaken-wrap {
          position: relative;
          padding: 0.25rem;
          display: inline-flex;
        }

        .mh-awaken-btn {
          position: relative;
          padding: 1.2rem 2.8rem;
          font-family: var(--font-heading);
          font-size: 1.05rem;
          color: rgba(224, 224, 224, 0.88);
          background: rgba(8, 8, 8, 0.7);
          border: 1px solid rgba(224, 224, 224, 0.22);
          letter-spacing: 0.14em;
          text-transform: uppercase;
          cursor: pointer;
          outline: none;
          -webkit-tap-highlight-color: transparent;
          animation: mh-btn-pulse 3s ease-in-out infinite;
          transition: border-color 0.2s, color 0.2s, background 0.2s;
        }

        .mh-awaken-btn:not(:disabled):active {
          border-color: rgba(224, 224, 224, 0.55);
          color: rgba(224, 224, 224, 1);
          background: rgba(20, 20, 20, 0.8);
        }

        .mh-awaken-btn:disabled {
          opacity: 0.6;
          cursor: default;
          animation: none;
        }

        @keyframes mh-btn-pulse {
          0%, 100% {
            border-color: rgba(224, 224, 224, 0.18);
            box-shadow:
              0 0 16px rgba(224, 224, 224, 0.04),
              inset 0 0 12px rgba(224, 224, 224, 0.02);
          }
          50% {
            border-color: rgba(224, 224, 224, 0.38);
            box-shadow:
              0 0 32px rgba(224, 224, 224, 0.08),
              inset 0 0 20px rgba(224, 224, 224, 0.04);
          }
        }

        .mh-prompt-sub {
          font-family: var(--font-mono);
          font-size: 0.6rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(224, 224, 224, 0.28);
          margin-top: 0.25rem;
        }

        /* ── Interaction hint ── */
        .mh-hint {
          position: absolute;
          bottom: 2.5rem;
          left: 50%;
          transform: translateX(-50%);
          z-index: 6;
          font-family: var(--font-mono);
          font-size: 0.58rem;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(224, 224, 224, 0.28);
          white-space: nowrap;
          pointer-events: none;
          animation: mh-hint-fade 4s ease-out forwards;
        }

        @keyframes mh-hint-fade {
          0%   { opacity: 1; }
          60%  { opacity: 1; }
          100% { opacity: 0; }
        }

        /* ── Shimmer border on the entire hero (ambient interactive cue) ── */
        .mh-hero::after {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
          border: 1px solid rgba(224, 224, 224, 0);
          animation: mh-border-shimmer 5s ease-in-out infinite;
        }

        @keyframes mh-border-shimmer {
          0%, 100% { border-color: rgba(224, 224, 224, 0.00); }
          50%      { border-color: rgba(224, 224, 224, 0.06); }
        }
      `}</style>

      {/* Hidden grain filter */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
        <filter id="mh-grain-filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>

      <section
        className="mh-hero"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        aria-label="Hero — tilt to explore"
      >
        {/* Grain overlay */}
        <div className="mh-grain" aria-hidden="true" />

        {/* Parallax layers — order = paint order (first = furthest back) */}
        <div className="mh-layer mh-layer-warm"    ref={el => { layerRefs.current[0] = el; }} aria-hidden="true" />
        <div className="mh-layer mh-layer-portrait" ref={el => { layerRefs.current[1] = el; }} aria-hidden="true" />
        <div className="mh-layer mh-layer-green"   ref={el => { layerRefs.current[2] = el; }} aria-hidden="true" />
        <div className="mh-layer mh-layer-frame"   ref={el => { layerRefs.current[3] = el; }} aria-hidden="true" />

        {/* Radial vignette */}
        <div className="mh-vignette" aria-hidden="true" />

        {/* Title — floats on top with slight counter-parallax */}
        <div className="mh-layer mh-layer-text" ref={el => { layerRefs.current[4] = el; }}>
          <div className="mh-title-block">
            <h1 className="mh-title">I.&thinsp;William.&thinsp;R.&thinsp;L</h1>
            <p className="mh-tagline">Software · Philosophy · Code</p>
          </div>
        </div>

        {/* iOS permission prompt */}
        {showPrompt && (
          <div className="mh-prompt-overlay">
            <div className="mh-awaken-wrap">
              <FiligreeCorner pos="tl" />
              <FiligreeCorner pos="tr" />
              <FiligreeCorner pos="bl" />
              <FiligreeCorner pos="br" />
              <button
                className="mh-awaken-btn"
                onClick={requestPermission}
                disabled={permState === 'requesting'}
                aria-label="Request device orientation access"
              >
                {permState === 'requesting' ? 'Awakening\u2026' : '\u2756\u2009Tap to Awaken\u2009\u2756'}
              </button>
            </div>
            <p className="mh-prompt-sub">Allow motion to explore the parallax</p>
          </div>
        )}

        {/* Interaction hint — fades automatically */}
        {showHint && !showPrompt && (
          <div className="mh-hint" aria-hidden="true">
            {hintText}
          </div>
        )}
      </section>
    </>
  );
}
