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

// Book SVG icon (open book)
function BookIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      {/* Left page */}
      <path
        d="M 11 7 C 9 6 6 6 3 7 L 3 17 C 6 16 9 16 11 17"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
      {/* Right page */}
      <path
        d="M 11 7 C 13 6 16 6 19 7 L 19 17 C 16 16 13 16 11 17"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
      {/* Spine */}
      <path d="M 11 7 L 11 17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {/* Left page lines */}
      <path d="M 5.5 10 L 9 9.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
      <path d="M 5.5 13 L 9 12.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
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
          <BookIcon />
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
