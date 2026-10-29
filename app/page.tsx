import React from 'react';
import client from '@/tina/__generated__/client';
import Layout from '@/components/layout/layout';
import HomeClientPage from './home-client-page';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/utils';

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Person', name: SITE_NAME, url: SITE_URL, image: `${SITE_URL}/images/hero-portrait.png` },
    { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL, description: SITE_DESCRIPTION },
  ],
};

export default async function Home() {
  const [pageData, postsData] = await Promise.all([
    client.queries.page({ relativePath: 'home.mdx' }),
    client.queries.postConnection({
      sort: 'date',
      last: 100,
      filter: { published: { eq: true } },
    }),
  ]);

  const posts = [...(postsData.data.postConnection.edges || [])].reverse();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Layout rawPageData={pageData} hideHeader>
        <HomeClientPage pageProps={pageData} posts={posts} />
      </Layout>
    </>
  );
}
