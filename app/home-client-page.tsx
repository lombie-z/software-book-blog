'use client';
import { useTina } from 'tinacms/dist/react';
import { Blocks } from '@/components/blocks';
import { RecentPostsSlider } from '@/components/blocks/recent-posts-slider';
import { BlogArchive } from '@/components/blocks/blog-archive';
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
  const archivePosts = posts.slice(5);

  return (
    <>
      <Blocks {...data?.page} />
      <RecentPostsSlider posts={recentPosts} />
      {archivePosts.length > 0 && <BlogArchive posts={archivePosts} tags={tags} />}
    </>
  );
}
