'use client';
import { useTina } from 'tinacms/dist/react';
import { HomeScrollStage } from '@/components/blocks/home-scroll-stage';
import type { PageQuery, PostConnectionQuery, TagConnectionQuery } from '@/tina/__generated__/types';

type PostEdges = NonNullable<PostConnectionQuery['postConnection']['edges']>;
type TagEdges = NonNullable<TagConnectionQuery['tagConnection']['edges']>;

interface HomeClientPageProps {
  pageProps: {
    data: { page: PageQuery['page'] };
    variables: { relativePath: string };
    query: string;
  };
  posts: PostEdges;
  tags: TagEdges;
}

export default function HomeClientPage({ pageProps, posts, tags }: HomeClientPageProps) {
  const { data } = useTina({ ...pageProps });

  const recentPosts = posts.slice(0, 5);

  return (
    <HomeScrollStage
      pageData={data?.page}
      recentPosts={recentPosts}
      archivePosts={posts}
      tags={tags}
    />
  );
}
