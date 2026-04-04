'use client';
import { useEffect, useState } from 'react';
import { useTina } from 'tinacms/dist/react';
import { HomeScrollStage } from '@/components/blocks/home-scroll-stage';
import { MobileHome } from '@/components/mobile/mobile-home';
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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)device-type=([^;]+)/);
    if (match?.[1] === 'mobile') setIsMobile(true);
  }, []);

  if (isMobile) {
    return <MobileHome pageData={data?.page ?? null} posts={posts} />;
  }

  return (
    <HomeScrollStage
      pageData={data?.page}
      recentPosts={posts}
    />
  );
}
