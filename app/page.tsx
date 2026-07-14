import React from 'react';
import { headers } from 'next/headers';
import client from '@/tina/__generated__/client';
import { ResponsiveHome } from '@/components/responsive-home';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/utils';

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Person', name: SITE_NAME, url: SITE_URL, image: `${SITE_URL}/images/hero-portrait.png` },
    { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL, description: SITE_DESCRIPTION },
  ],
};

export default async function Home() {
  const headersList = await headers();
  const deviceType = headersList.get('x-device-type') ?? 'desktop';
  const initialDevice = deviceType === 'mobile' ? 'mobile' : 'desktop';

  const [pageData, postsData] = await Promise.all([
    client.queries.page({ relativePath: 'home.mdx' }),
    client.queries.postConnection({ sort: 'date', last: 100 }),
  ]);

  const posts = [...(postsData.data.postConnection.edges || [])].reverse();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ResponsiveHome initialDevice={initialDevice} pageProps={pageData} posts={posts} />
    </>
  );
}
