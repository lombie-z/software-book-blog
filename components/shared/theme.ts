/**
 * Shared design tokens used by both the desktop and mobile experiences.
 *
 * Desktop components consume these via Tailwind CSS variables (see styles.css).
 * Mobile components reference these constants directly where inline styles or
 * dynamic values are needed (e.g. animation targets, canvas draws).
 *
 * All color values are OKLCH to match the Tailwind 4 theme in styles.css.
 */

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

export const colors = {
  // Core surface/text (dark mode — the site always renders dark)
  background: 'oklch(0.145 0 0)',
  foreground: 'oklch(0.985 0 0)',
  card: 'oklch(0.205 0 0)',
  cardForeground: 'oklch(0.985 0 0)',

  // UI scale
  muted: 'oklch(0.269 0 0)',
  mutedForeground: 'oklch(0.708 0 0)',
  border: 'oklch(1 0 0 / 10%)',
  ring: 'oklch(0.556 0 0)',

  // Baroque accent — warm gold used for save-to-bucket glow, filigree highlights
  gold: 'oklch(0.828 0.189 84.429)',
  goldLight: 'oklch(0.87 0.16 84)',

  // Stained-glass panel tints (ambient color washes on card edges)
  stainedAmber: 'oklch(0.769 0.188 70.08)',
  stainedViolet: 'oklch(0.627 0.265 303.9)',
  stainedTeal: 'oklch(0.696 0.17 162.48)',
} as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const typography = {
  // Font family CSS variables (set in app/layout.tsx via next/font)
  fontHeading: 'var(--font-heading)',  // Lucida Blackletter
  fontBody: 'var(--font-body)',        // Inter / system sans
  fontMono: 'var(--font-mono)',        // Lato / system mono

  // Scale (mobile-first, in rem)
  sizeXs: '0.75rem',
  sizeSm: '0.875rem',
  sizeBase: '1rem',
  sizeLg: '1.125rem',
  sizeXl: '1.25rem',
  size2xl: '1.5rem',
  size3xl: '1.875rem',
  size4xl: '2.25rem',
} as const;

// ---------------------------------------------------------------------------
// Motion / animation constants
// ---------------------------------------------------------------------------

export const motion = {
  // Spring config for card stack physics (used with framer-motion / motion)
  cardSpring: { type: 'spring', stiffness: 400, damping: 35 } as const,

  // Bucket badge bounce
  badgeBounce: { type: 'spring', stiffness: 600, damping: 20 } as const,

  // Swipe threshold: velocity above this = committed swipe
  swipeVelocityThreshold: 500,

  // Swipe threshold: horizontal distance to count as swipe
  swipeDistanceThreshold: 80,

  // Card breathing animation cycle (ms)
  breathingCycleMs: 4000,
} as const;

// ---------------------------------------------------------------------------
// Z-index layers
// ---------------------------------------------------------------------------

export const zIndex = {
  cardStack: 10,
  bucketButton: 20,
  bottomNav: 30,
  overlay: 40,
  modal: 50,
} as const;
