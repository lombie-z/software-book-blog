'use client';

import HomeClientPage from '@/app/home-client-page';
import MobileHomeClientPage from '@/app/mobile-home-client-page';
import { type Device, useResponsiveView } from '@/components/responsive-switch';
import { ViewSwitchTransition } from '@/components/view-switch-transition';

type ClientPageProps = React.ComponentProps<typeof HomeClientPage>;

interface ResponsiveHomeProps {
  initialDevice: Device;
  pageProps: ClientPageProps['pageProps'];
  posts: ClientPageProps['posts'];
}

// Imports both client-pages directly and renders only the active one, so the
// heavy desktop scroll experience isn't rendered server-side when on mobile.
export function ResponsiveHome({ initialDevice, pageProps, posts }: ResponsiveHomeProps) {
  const { mode, target, overlayVisible } = useResponsiveView(initialDevice);
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
