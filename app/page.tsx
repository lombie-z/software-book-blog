import React from 'react';
import client from '@/tina/__generated__/client';
import HomeClientPage from './home-client-page';

export const revalidate = 300;

export default async function Home() {
  const [pageData, postsData, tagsData] = await Promise.all([
    client.queries.page({ relativePath: 'home.mdx' }),
    client.queries.postConnection({ sort: 'date', last: 100 }),
    client.queries.tagConnection(),
  ]);

  const posts = [...(postsData.data.postConnection.edges || [])].reverse();
  const tags = tagsData.data.tagConnection.edges || [];

  return (
    <HomeClientPage
      pageProps={pageData}
      posts={posts}
      tags={tags}
    />
  );
}
