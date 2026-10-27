'use client';
import { useTina } from 'tinacms/dist/react';
import { Blocks } from '@/components/blocks';
import type { PostEdges } from '@/components/blocks/post-index';
import type { PageQuery } from '@/tina/__generated__/types';

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
  return <Blocks {...data.page} posts={posts} />;
}
