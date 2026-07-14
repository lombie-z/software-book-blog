'use client';

// Mobile landing hero. Deliberately calm: a solid near-black field with grain,
// the title, and a scroll cue. No parallax layers or tilt — those read as busy
// and awkward on a phone.

interface MobileHeroProps {
  onScrollToCards?: () => void;
}

export function MobileHero({ onScrollToCards }: MobileHeroProps) {
  return (
    <>
      <style>{`
        .mh-hero {
          position: relative;
          width: 100%;
          height: 100svh;
          overflow: hidden;
          background: #060606;
          display: flex;
          align-items: center;
          justify-content: center;
          -webkit-user-select: none;
          user-select: none;
        }

        /* Grain over the solid field — the only texture. */
        .mh-grain {
          position: absolute;
          inset: 0;
          z-index: 1;
          opacity: 0.09;
          pointer-events: none;
          filter: url(#mh-grain-filter);
        }

        .mh-title-block {
          position: relative;
          z-index: 2;
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
          text-shadow: 0 0 18px rgba(224, 224, 224, 0.12), 0 2px 40px rgba(0, 0, 0, 0.8);
        }

        .mh-tagline {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.08em;
          color: rgba(224, 224, 224, 0.4);
          margin-top: 1.25rem;
        }

        .mh-discover-btn {
          position: absolute;
          bottom: 3rem;
          left: 50%;
          transform: translateX(-50%);
          z-index: 3;
          font-family: var(--font-mono);
          font-size: 0.54rem;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(224, 224, 224, 0.5);
          background: transparent;
          border: 1px solid rgba(224, 224, 224, 0.15);
          border-radius: 3px;
          padding: 10px 20px;
          cursor: pointer;
          white-space: nowrap;
          -webkit-tap-highlight-color: transparent;
          transition: border-color 0.2s, color 0.2s;
        }
        .mh-discover-btn:active {
          border-color: rgba(224, 224, 224, 0.4);
          color: rgba(224, 224, 224, 0.8);
        }
      `}</style>

      {/* Hidden grain filter */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
        <filter id="mh-grain-filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>

      <section className="mh-hero" aria-label="Hero">
        <div className="mh-grain" aria-hidden="true" />

        <div className="mh-title-block">
          <h1 className="mh-title">I.&thinsp;William.&thinsp;R.&thinsp;L.</h1>
          <p className="mh-tagline">Thinking, and thinking about software</p>
        </div>

        {onScrollToCards && (
          <button type="button" className="mh-discover-btn" onClick={onScrollToCards}>
            Discover Posts &darr;
          </button>
        )}
      </section>
    </>
  );
}
