'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTina } from 'tinacms/dist/react';
import { Blocks } from '@/components/blocks';
import type { PostEdges } from '@/components/blocks/post-index';
import type { PageQuery } from '@/tina/__generated__/types';

const SceneCanvas = dynamic(() => import('@/components/three/scene-canvas'), { ssr: false });

function hasWebGL() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

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
  // Without WebGL the niches keep their CSS-shaded stand-ins.
  const [webgl, setWebgl] = useState(false);
  useEffect(() => setWebgl(hasWebGL()), []);

  return (
    <>
      <Blocks {...data.page} posts={posts} />
      {webgl && <SceneCanvas />}
    </>
  );
}
