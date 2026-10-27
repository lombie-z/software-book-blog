'use client';

import { useEffect, useState } from 'react';
import { ReactLenis } from 'lenis/react';

// Lenis eases wheel scrolling so the niche parallax and sun sweep glide; off for reduced motion.
export function SmoothScroll() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => setEnabled(!window.matchMedia('(prefers-reduced-motion: reduce)').matches), []);
  return enabled ? <ReactLenis root options={{ lerp: 0.12, anchors: true }} /> : null;
}
