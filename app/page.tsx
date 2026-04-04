import React from 'react';
import { headers } from 'next/headers';
import client from '@/tina/__generated__/client';
import HomeClientPage from './home-client-page';
import MobileHomeClientPage from './mobile-home-client-page';

export default async function Home() {
  const headersList = await headers();
  const deviceType = headersList.get('x-device-type') ?? 'desktop';
  const isMobile = deviceType === 'mobile';

  const [pageData, postsData] = await Promise.all([
    client.queries.page({ relativePath: 'home.mdx' }),
    client.queries.postConnection({ sort: 'date', last: 100 }),
  ]);

  const posts = [...(postsData.data.postConnection.edges || [])].reverse();

  if (isMobile) {
    return <MobileHomeClientPage pageProps={pageData} posts={posts} />;
  }

  return <HomeClientPage pageProps={pageData} posts={posts} />;
}
