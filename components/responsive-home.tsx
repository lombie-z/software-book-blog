'use client';

import { useEffect, useRef, useState } from 'react';
import HomeClientPage from '@/app/home-client-page';
import MobileHomeClientPage from '@/app/mobile-home-client-page';
import { ViewSwitchTransition } from '@/components/view-switch-transition';

type Device = 'mobile' | 'desktop';

// Below this width the home renders the mobile experience, above it the desktop
// scroll experience. The server still picks the initial view from the UA; this
// watcher takes over on resize so a desktop browser narrowed past the breakpoint
// (or vice versa) switches with a transition.
const MOBILE_MAX_WIDTH = 768;

type ClientPageProps = React.ComponentProps<typeof HomeClientPage>;

interface ResponsiveHomeProps {
  initialDevice: Device;
  pageProps: ClientPageProps['pageProps'];
  posts: ClientPageProps['posts'];
}

export function ResponsiveHome({ initialDevice, pageProps, posts }: ResponsiveHomeProps) {
  // mode starts at the server's choice so the first client render matches SSR.
  const [mode, setMode] = useState<Device>(initialDevice);
  const [target, setTarget] = useState<Device | null>(null); // non-null while transitioning
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

  return (
    <>
      {mode === 'mobile' ? (
        <MobileHomeClientPage pageProps={pageProps} posts={posts} />
      ) : (
        <HomeClientPage pageProps={pageProps} posts={posts} />
      )}
      {target && <ViewSwitchTransition target={target} visible={overlayVisible} />}
    </>
  );
}
