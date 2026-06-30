'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ViewSwitchTransition } from '@/components/view-switch-transition';

export type Device = 'mobile' | 'desktop';

// Below this width the home/post renders the mobile experience, above it the
// desktop one. The server still picks the initial view from the UA; this hook
// takes over on resize so a desktop browser narrowed past the breakpoint (or
// vice versa) switches with a transition.
export const MOBILE_MAX_WIDTH = 768;

interface ResponsiveView {
  mode: Device;
  target: Device | null; // non-null while a switch is animating
  overlayVisible: boolean;
}

export function useResponsiveView(initialDevice: Device): ResponsiveView {
  // mode starts at the server's choice so the first client render matches SSR.
  const [mode, setMode] = useState<Device>(initialDevice);
  const [target, setTarget] = useState<Device | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const transitioningRef = useRef(false);

  useEffect(() => {
    const compute = (): Device => (window.innerWidth < MOBILE_MAX_WIDTH ? 'mobile' : 'desktop');
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Silent reconcile on mount (e.g. desktop UA opened in a narrow window) —
    // no overlay, since the user didn't trigger this.
    const initial = compute();
    if (initial !== modeRef.current) setMode(initial);

    const startSwitch = (next: Device) => {
      transitioningRef.current = true;
      setTarget(next);
      requestAnimationFrame(() => setOverlayVisible(true)); // fade overlay in
      timers.push(
        setTimeout(() => setMode(next), 480), // swap the tree behind the overlay
        setTimeout(() => setOverlayVisible(false), 1180), // fade overlay out
        setTimeout(() => {
          setTarget(null);
          transitioningRef.current = false;
          // The width may have moved again during the animation — reconcile.
          const want = compute();
          if (want !== modeRef.current) startSwitch(want);
        }, 1560),
      );
    };

    let debounce: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        const want = compute();
        if (want !== modeRef.current && !transitioningRef.current) startSwitch(want);
      }, 220);
    };

    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(debounce);
      timers.forEach(clearTimeout);
    };
  }, []);

  return { mode, target, overlayVisible };
}

// Node-based switcher: the server renders both trees and passes them here, this
// picks one by width and animates the swap. Used where one side needs a server
// component wrapper (e.g. the post page's <Layout>), so it can't be imported
// directly into a client component.
export function ResponsiveSwitch({
  initialDevice,
  desktop,
  mobile,
}: {
  initialDevice: Device;
  desktop: ReactNode;
  mobile: ReactNode;
}) {
  const { mode, target, overlayVisible } = useResponsiveView(initialDevice);
  return (
    <>
      {mode === 'mobile' ? mobile : desktop}
      {target && <ViewSwitchTransition target={target} visible={overlayVisible} />}
    </>
  );
}
