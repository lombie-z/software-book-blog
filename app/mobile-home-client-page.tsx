'use client';

import { useTina } from 'tinacms/dist/react';
import { MobileHome } from '@/components/mobile/mobile-home';
import type { PageQuery, PostConnectionQuery } from '@/tina/__generated__/types';

type PostEdges = NonNullable<PostConnectionQuery['postConnection']['edges']>;

interface MobileHomeClientPageProps {
  pageProps: {
    data: { page: PageQuery['page'] };
    variables: { relativePath: string };
    query: string;
  };
  posts: PostEdges;
}

export default function MobileHomeClientPage({ pageProps, posts }: MobileHomeClientPageProps) {
  const { data } = useTina({ ...pageProps });

  return <MobileHome pageData={data?.page ?? null} posts={posts} />;
}
