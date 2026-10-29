import React, { PropsWithChildren } from 'react';
import { LayoutProvider } from './layout-context';
import client from '../../tina/__generated__/client';
import { Header } from './nav/header';
import { Footer } from './nav/footer';
import { SmoothScroll } from './smooth-scroll';

type LayoutProps = PropsWithChildren & {
  rawPageData?: any;
  /** The home hero draws its own large signature. */
  hideHeader?: boolean;
};

export default async function Layout({ children, rawPageData, hideHeader }: LayoutProps) {
  const { data: globalData } = await client.queries.global(
    {
      relativePath: 'index.json',
    },
    {
      fetchOptions: {
        next: {
          revalidate: 60,
        },
      },
    }
  );

  return (
    <LayoutProvider globalSettings={globalData.global} pageData={rawPageData}>
      <SmoothScroll />
      {!hideHeader && <Header />}
      <main className="relative overflow-x-clip">{children}</main>
      <Footer />
    </LayoutProvider>
  );
}
