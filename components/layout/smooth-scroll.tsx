'use client';

import { useEffect, useState } from 'react';
import { ReactLenis } from 'lenis/react';

// Lenis takes the edge off wheel steps so the niche parallax glides; a high lerp keeps it close to native so the page
// never feels behind the wheel. Nested scrollers (the phone threads) scroll first and hand back to the page at their
// ends. Off for reduced motion.
export function SmoothScroll() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => setEnabled(!window.matchMedia('(prefers-reduced-motion: reduce)').matches), []);
  return enabled ? <ReactLenis root options={{ lerp: 0.5, anchors: true, allowNestedScroll: true }} /> : null;
}
