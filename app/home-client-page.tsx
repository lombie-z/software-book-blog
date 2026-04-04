'use client';
import { useTina } from 'tinacms/dist/react';
import { HomeScrollStage } from '@/components/blocks/home-scroll-stage';
import type { PageQuery, PostConnectionQuery } from '@/tina/__generated__/types';

type PostEdges = NonNullable<PostConnectionQuery['postConnection']['edges']>;

interface HomeClientPageProps {
  pageProps: {
    data: { page: PageQuery['page'] };
    variables: { relativePath: string };
    query: string;
  };
  posts: PostEdges;
}

export default function HomeClientPage({ pageProps, posts }: HomeClientPageProps) {
  const { data } = useTina({ ...pageProps });

  return (
    <HomeScrollStage
      pageData={data?.page}
      recentPosts={posts}
    />
  );
}
