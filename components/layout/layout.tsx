import React, { PropsWithChildren } from "react";
import { LayoutProvider } from "./layout-context";
import client from "../../tina/__generated__/client";
import { Header } from "./nav/header";
import { Footer } from "./nav/footer";

type LayoutProps = PropsWithChildren & {
  rawPageData?: any;
};

export default async function Layout({ children, rawPageData }: LayoutProps) {
  const { data: globalData } = await client.queries.global({
    relativePath: "index.json",
  },
    {
      fetchOptions: {
        next: {
          revalidate: 60,
        },
      }
    }
  );

  return (
    <LayoutProvider globalSettings={globalData.global} pageData={rawPageData}>
      <Header />
      <main className="overflow-x-hidden bg-[#0a0a0a] relative">
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <filter id="global-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </svg>
        <div
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 50,
            opacity: 0.15,
            filter: 'url(#global-grain)',
          }}
        />
        {children}
      </main>
      <Footer />
    </LayoutProvider>
  );
}
