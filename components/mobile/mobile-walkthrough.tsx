'use client';

import { useCallback, useEffect, useState } from 'react';

// ─── Storage Key ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'iwrl-walkthrough-done';

function isWalkthroughDone(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markWalkthroughDone() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {}
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useWalkthrough() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);

  const start = useCallback(() => {
    if (isWalkthroughDone()) return;
    setStep(0);
    setActive(true);
  }, []);

  const next = useCallback(() => {
    setStep((s) => {
      if (s >= 2) {
        markWalkthroughDone();
        setActive(false);
        return 0;
      }
      return s + 1;
    });
  }, []);

  const dismiss = useCallback(() => {
    markWalkthroughDone();
    setActive(false);
  }, []);

  return { active, step, start, next, dismiss };
}

// ─── Steps ───────────────────────────────────────────────────────────────────

const STEPS = [
  {
    text: 'Tap a card to flip it and reveal the excerpt',
    position: 'center' as const,
  },
  {
    text: 'Swipe right to save a post, left to skip',
    position: 'center' as const,
  },
  {
    text: 'Your saved posts appear here',
    position: 'bottom-right' as const,
  },
];

// ─── Styles ──────────────────────────────────────────────────────────────────

const WALKTHROUGH_CSS = `
  .mw-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: oklch(0.05 0 0 / 0.72);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: mw-fade-in 0.3s ease-out both;
  }
  @keyframes mw-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .mw-card {
    position: absolute;
    max-width: 300px;
    width: calc(100% - 48px);
    background: oklch(0.13 0.01 255 / 0.92);
    border: 1px solid oklch(0.60 0.10 255 / 0.22);
    border-radius: 8px;
    padding: 24px 22px 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 12px 40px oklch(0 0 0 / 0.6);
    animation: mw-card-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }
  @keyframes mw-card-in {
    from { opacity: 0; transform: translateY(12px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .mw-card--center {
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
  .mw-card--bottom-right {
    bottom: 100px;
    right: 24px;
  }
  .mw-text {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    line-height: 1.6;
    letter-spacing: 0.04em;
    color: oklch(0.82 0.01 255);
    margin: 0;
  }
  .mw-arrows {
    display: flex;
    justify-content: center;
    gap: 28px;
    font-family: var(--font-heading);
    font-size: 1rem;
    color: oklch(0.55 0.10 255);
  }
  .mw-arrows span:first-child { color: oklch(0.50 0.12 240); }
  .mw-arrows span:last-child  { color: oklch(0.78 0.12 85); }
  .mw-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .mw-step-indicator {
    font-family: var(--font-mono);
    font-size: 0.54rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: oklch(0.45 0 0);
  }
  .mw-next-btn {
    font-family: var(--font-mono);
    font-size: 0.58rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    padding: 8px 18px;
    border-radius: 3px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    background: oklch(0.60 0.12 255 / 0.1);
    border: 1px solid oklch(0.60 0.12 255 / 0.3);
    color: oklch(0.75 0.10 255);
    transition: border-color 0.2s, background 0.2s;
  }
  .mw-next-btn:active {
    border-color: oklch(0.60 0.12 255 / 0.6);
    background: oklch(0.60 0.12 255 / 0.18);
  }
  .mw-dismiss {
    position: absolute;
    top: 8px;
    right: 10px;
    background: none;
    border: none;
    color: oklch(0.45 0 0);
    font-size: 1rem;
    cursor: pointer;
    padding: 4px 8px;
    -webkit-tap-highlight-color: transparent;
  }
`;

// ─── Component ───────────────────────────────────────────────────────────────

interface MobileWalkthroughProps {
  step: number;
  onNext: () => void;
  onDismiss: () => void;
}

export function MobileWalkthrough({ step, onNext, onDismiss }: MobileWalkthroughProps) {
  const current = STEPS[step];
  if (!current) return null;

  const isLast = step === STEPS.length - 1;
  const posClass = current.position === 'bottom-right' ? 'mw-card--bottom-right' : 'mw-card--center';

  return (
    <>
      <style>{WALKTHROUGH_CSS}</style>
      <div className="mw-overlay" onClick={onDismiss}>
        <div className={`mw-card ${posClass}`} onClick={(e) => e.stopPropagation()}>
          <button className="mw-dismiss" onClick={onDismiss} aria-label="Dismiss walkthrough">
            x
          </button>
          <p className="mw-text">{current.text}</p>
          {step === 1 && (
            <div className="mw-arrows" aria-hidden="true">
              <span>&larr; Skip</span>
              <span>Save &rarr;</span>
            </div>
          )}
          <div className="mw-footer">
            <span className="mw-step-indicator">
              {step + 1}/{STEPS.length}
            </span>
            <button className="mw-next-btn" onClick={onNext}>
              {isLast ? 'Got it' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
