'use client';

interface ViewSwitchTransitionProps {
  target: 'mobile' | 'desktop';
  visible: boolean;
}

// Full-screen overlay shown while the home view swaps between mobile and
// desktop on resize. A circle of two curved arrows spins, with the
// "Switching to …" label on top. Self-contained (own scoped CSS).
const CSS = `
  .vst-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(
      ellipse 65% 65% at 50% 45%,
      oklch(0.17 0.012 85 / 0.98) 0%,
      oklch(0.09 0.005 85 / 0.99) 72%
    );
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.4s ease;
  }
  .vst-overlay[data-visible='true'] {
    opacity: 1;
    pointer-events: auto;
  }
  .vst-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 28px;
    transform: scale(0.94);
    transition: transform 0.5s cubic-bezier(0.34, 1.4, 0.5, 1);
  }
  .vst-overlay[data-visible='true'] .vst-inner { transform: scale(1); }

  .vst-spinner {
    width: 92px;
    height: 92px;
    animation: vst-spin 1.05s linear infinite;
    filter: drop-shadow(0 0 10px oklch(0.80 0.11 85 / 0.4));
  }
  @keyframes vst-spin { to { transform: rotate(360deg); } }
  .vst-arc {
    fill: none;
    stroke: oklch(0.81 0.115 85);
    stroke-width: 5;
    stroke-linecap: round;
  }
  .vst-head { fill: oklch(0.81 0.115 85); }

  .vst-text {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .vst-label {
    font-family: var(--font-mono, monospace);
    font-size: 0.6rem;
    letter-spacing: 0.34em;
    text-transform: uppercase;
    color: oklch(0.72 0.045 85 / 0.72);
    padding-left: 0.34em;
  }
  .vst-target {
    font-family: var(--font-heading, serif);
    font-size: 2.1rem;
    line-height: 1;
    color: oklch(0.96 0.015 85);
    text-shadow: 0 2px 18px oklch(0 0 0 / 0.6);
  }
  @media (prefers-reduced-motion: reduce) {
    .vst-spinner { animation-duration: 2.4s; }
  }
`;

export function ViewSwitchTransition({ target, visible }: ViewSwitchTransitionProps) {
  return (
    <div className="vst-overlay" data-visible={visible} role="status" aria-live="polite">
      <style>{CSS}</style>
      <div className="vst-inner">
        {/* Circle of two curved arrows */}
        <svg className="vst-spinner" viewBox="0 0 100 100" aria-hidden="true">
          <path className="vst-arc" d="M 18 38 A 34 34 0 0 1 82 38" />
          <path className="vst-head" d="M 84.4 44.6 L 76.6 37.8 L 86.0 34.4 Z" />
          <path className="vst-arc" d="M 82 62 A 34 34 0 0 1 18 62" />
          <path className="vst-head" d="M 15.6 55.4 L 23.4 62.2 L 14.0 65.6 Z" />
        </svg>
        <div className="vst-text">
          <span className="vst-label">Switching to</span>
          <span className="vst-target">{target === 'mobile' ? 'Mobile' : 'Desktop'}</span>
        </div>
      </div>
    </div>
  );
}
