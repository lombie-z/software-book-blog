import React from 'react';
import { headers } from 'next/headers';
import { Metadata } from 'next';
import client from '@/tina/__generated__/client';
import Layout from '@/components/layout/layout';
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
  params: Promise<{ urlSegments: string[] }>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const filepath = resolvedParams.urlSegments.join('/');
  const { data } = await client.queries.post({ relativePath: `${filepath}.mdx` });
  const post = data.post;
  const description = post.excerpt ? extractText(post.excerpt).slice(0, 160).trim() : undefined;
  const ogImage = post.heroImg || '/images/hero-portrait.png';
  return {
    title: post.title,
    description,
    openGraph: {
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
  params: Promise<{ urlSegments: string[] }>;
}) {
  const resolvedParams = await params;
  const filepath = resolvedParams.urlSegments.join('/');
  const data = await client.queries.post({
    relativePath: `${filepath}.mdx`,
  });

  const headersList = await headers();
  const isMobile = headersList.get('x-device-type') === 'mobile';

  if (isMobile) {
    return <MobilePostClientPage {...data} />;
  }

  return (
    <Layout rawPageData={data}>
      <PostClientPage {...data} />
    </Layout>
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
      urlSegments: edge?.node?._sys.breadcrumbs,
    })) || [];

  return params;
}
