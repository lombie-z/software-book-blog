import React from 'react';
import client from '@/tina/__generated__/client';
import HomeClientPage from './home-client-page';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [pageData, postsData] = await Promise.all([
    client.queries.page({ relativePath: 'home.mdx' }),
    client.queries.postConnection({ sort: 'date', last: 100 }),
  ]);

  const posts = [...(postsData.data.postConnection.edges || [])].reverse();

  return <HomeClientPage pageProps={pageData} posts={posts} />;
}
