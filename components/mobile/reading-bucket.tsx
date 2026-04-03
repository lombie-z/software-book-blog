'use client';

// Reading bucket — floating bottom-right button with animated count badge.
// Uses CSS keyframe animation triggered by `key` re-mount to bounce on count change.

const BUCKET_CSS = `
  .rb-btn {
    position: fixed;
    bottom: 28px;
    right: 24px;
    z-index: 100;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: oklch(0.13 0.01 85);
    border: 1.5px solid oklch(0.78 0.10 85 / 0.28);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    box-shadow: 0 4px 24px oklch(0 0 0 / 0.6);
    transition: border-color 0.2s, box-shadow 0.2s;
    animation: rb-pulse 4s ease-in-out infinite;
  }
  @keyframes rb-pulse {
    0%, 100% { box-shadow: 0 4px 24px oklch(0 0 0 / 0.6), 0 0 0 0 oklch(0.78 0.10 85 / 0); }
    50%       { box-shadow: 0 6px 32px oklch(0 0 0 / 0.7), 0 0 0 4px oklch(0.78 0.10 85 / 0.06); }
  }
  .rb-btn:active {
    border-color: oklch(0.78 0.10 85 / 0.55);
    box-shadow: 0 2px 12px oklch(0 0 0 / 0.7);
  }
  .rb-icon {
    color: oklch(0.78 0.10 85 / 0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  .rb-badge {
    position: absolute;
    top: -10px;
    right: -12px;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border-radius: 9px;
    background: oklch(0.78 0.10 85);
    border: 1px solid oklch(0.13 0.01 85);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-mono);
    font-size: 0.55rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: oklch(0.10 0 0);
    animation: rb-badge-bounce 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }
  @keyframes rb-badge-bounce {
    from { transform: scale(0.4); opacity: 0.4; }
    to   { transform: scale(1);   opacity: 1; }
  }
  .rb-hint {
    position: fixed;
    bottom: 28px;
    right: 88px;
    z-index: 99;
    font-family: var(--font-mono);
    font-size: 0.52rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: oklch(0.78 0.10 85 / 0.5);
    background: oklch(0.10 0 0 / 0.85);
    padding: 5px 10px;
    border-radius: 2px;
    border: 1px solid oklch(0.78 0.10 85 / 0.12);
    white-space: nowrap;
    pointer-events: none;
    animation: rb-hint-in 0.4s ease-out both, rb-hint-out 0.4s ease-in 3s forwards;
  }
  @keyframes rb-hint-in  { from { opacity: 0; transform: translateX(8px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes rb-hint-out { from { opacity: 1; } to { opacity: 0; } }
`;

// Bucket SVG icon
function BucketIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      {/* Bucket body */}
      <path
        d="M 4 8 L 5.5 18 L 16.5 18 L 18 8 Z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"
      />
      {/* Bucket handle arc */}
      <path
        d="M 7 8 Q 7 4 11 4 Q 15 4 15 8"
        stroke="currentColor" strokeWidth="1.3" fill="none"
      />
      {/* Lid / top rim */}
      <path d="M 3 8 L 19 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      {/* Decorative dot */}
      <circle cx="11" cy="13" r="1.2" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

interface ReadingBucketProps {
  count: number;
  onOpen: () => void;
  showHint?: boolean;
}

export function ReadingBucket({ count, onOpen, showHint }: ReadingBucketProps) {
  return (
    <>
      <style>{BUCKET_CSS}</style>

      {showHint && count > 0 && (
        <div className="rb-hint" key={`hint-${count}`} aria-live="polite">
          {count} saved — tap to review
        </div>
      )}

      <button
        className="rb-btn"
        onClick={onOpen}
        aria-label={count > 0 ? `Reading queue — ${count} saved` : 'Reading queue — empty'}
      >
        <div className="rb-icon">
          <BucketIcon />
          {count > 0 && (
            // Re-keying by count triggers the CSS bounce animation on each add
            <span key={count} className="rb-badge" aria-hidden="true">
              {count}
            </span>
          )}
        </div>
      </button>
    </>
  );
}
