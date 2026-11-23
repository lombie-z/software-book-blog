'use client';
import { useEffect, useState } from 'react';
import { useTina } from 'tinacms/dist/react';
import { Blocks } from '@/components/blocks';
import type { PostEdges } from '@/components/blocks/post-index';
import { SceneAvailableContext } from '@/components/three/scene-context';
import type { PageQuery } from '@/tina/__generated__/types';


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
  useEffect(() => {
    let left = false;
    // The signature writes on the main thread, and three.js booting mid-stroke makes it stutter, so the 3D waits
    // until it's written. Nothing is writing under reduced motion or without the hero, so there's no wait then.
    const writing = (document.getAnimations?.() ?? []).filter((a) => a instanceof CSSAnimation && a.animationName === 'signature-write');
    Promise.allSettled(writing.map((a) => a.finished)).then(() => {
      if (!left) setWebgl(hasWebGL());
    });
    return () => {
      left = true;
    };
  }, []);

  return (
    <SceneAvailableContext.Provider value={webgl}>
      <Blocks {...data.page} posts={posts} />
    </SceneAvailableContext.Provider>
  );
}
