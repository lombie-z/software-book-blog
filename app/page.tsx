import React from 'react';
import { headers } from 'next/headers';
import client from '@/tina/__generated__/client';
import { ResponsiveHome } from '@/components/responsive-home';

export default async function Home() {
  const headersList = await headers();
  const deviceType = headersList.get('x-device-type') ?? 'desktop';
  const initialDevice = deviceType === 'mobile' ? 'mobile' : 'desktop';

  const [pageData, postsData] = await Promise.all([
    client.queries.page({ relativePath: 'home.mdx' }),
    client.queries.postConnection({ sort: 'date', last: 100 }),
  ]);

  const posts = [...(postsData.data.postConnection.edges || [])].reverse();

  return <ResponsiveHome initialDevice={initialDevice} pageProps={pageData} posts={posts} />;
}
