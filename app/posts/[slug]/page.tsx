import React from 'react';
import { headers } from 'next/headers';
import { Metadata } from 'next';
import client from '@/tina/__generated__/client';
import Layout from '@/components/layout/layout';
import { ResponsiveSwitch } from '@/components/responsive-switch';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/utils';
import PostClientPage from './client-page';
import MobilePostClientPage from './mobile-client-page';

function extractText(node: any): string {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  if (Array.isArray(node.children)) return node.children.map(extractText).join('');
  return '';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  let post: Awaited<ReturnType<typeof client.queries.post>>['data']['post'] | null = null;
  try {
    const { data } = await client.queries.post({ relativePath: `${slug}.mdx` });
    post = data.post;
  } catch {
    // Missing/unbuildable post — fall back to site defaults so metadata still renders.
    return { title: SITE_NAME, description: SITE_DESCRIPTION };
  }
  const description = (post.excerpt ? extractText(post.excerpt).slice(0, 160).trim() : '') || SITE_DESCRIPTION;
  const ogImage = post.heroImg || '/images/hero-portrait.png';
  const canonical = `/posts/${slug}`;
  return {
    title: post.title,
    description,
    alternates: { canonical },
    openGraph: {
      url: canonical,
      title: post.title,
      description,
      type: 'article',
      publishedTime: post.date ?? undefined,
      images: [{ url: ogImage, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: [ogImage],
    },
  };
}

export const revalidate = 300;

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await client.queries.post({
    relativePath: `${slug}.mdx`,
  });

  const headersList = await headers();
  const initialDevice = headersList.get('x-device-type') === 'mobile' ? 'mobile' : 'desktop';

  const post = data.data.post;
  const absImg = post.heroImg?.startsWith('http') ? post.heroImg : `${SITE_URL}${post.heroImg ?? '/images/hero-portrait.png'}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    image: absImg,
    datePublished: post.date ?? undefined,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/posts/${slug}` },
    author: { '@type': 'Person', name: SITE_NAME, url: SITE_URL },
    publisher: { '@type': 'Person', name: SITE_NAME, url: SITE_URL },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ResponsiveSwitch
        initialDevice={initialDevice}
        desktop={
          <Layout rawPageData={data}>
            <PostClientPage {...data} />
          </Layout>
        }
        mobile={<MobilePostClientPage {...data} />}
      />
    </>
  );
}

export async function generateStaticParams() {
  let posts = await client.queries.postConnection();
  const allPosts = posts;

  if (!allPosts.data.postConnection.edges) {
    return [];
  }

  while (posts.data?.postConnection.pageInfo.hasNextPage) {
    posts = await client.queries.postConnection({
      after: posts.data.postConnection.pageInfo.endCursor,
    });

    if (!posts.data.postConnection.edges) {
      break;
    }

    allPosts.data.postConnection.edges.push(...posts.data.postConnection.edges);
  }

  const params =
    allPosts.data?.postConnection.edges.map((edge) => ({
      slug: edge?.node?._sys.breadcrumbs.join('/'),
    })) || [];

  return params;
}
