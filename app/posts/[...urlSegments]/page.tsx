import React from 'react';
import client from '@/tina/__generated__/client';
import Layout from '@/components/layout/layout';
import PostClientPage from './client-page';

export const revalidate = 300;

export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ urlSegments: string[] }>;
  searchParams: Promise<{ title?: string }>;
}) {
  const resolvedParams = await params;
  const { title } = await searchParams;
  const titleIndex = Number.parseInt(title ?? '', 10);
  const filepath = resolvedParams.urlSegments.join('/');
  const data = await client.queries.post({
    relativePath: `${filepath}.mdx`,
  });

  return (
    <Layout rawPageData={data}>
      <PostClientPage {...data} titleIndex={Number.isNaN(titleIndex) ? 0 : titleIndex} />
    </Layout>
  );
}

export async function generateStaticParams() {
  let posts = await client.queries.postConnection({
    filter: { draft: { eq: false } },
  });
  const allPosts = posts;

  if (!allPosts.data.postConnection.edges) {
    return [];
  }

  while (posts.data?.postConnection.pageInfo.hasNextPage) {
    posts = await client.queries.postConnection({
      after: posts.data.postConnection.pageInfo.endCursor,
      filter: { draft: { eq: false } },
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
