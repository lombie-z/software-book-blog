'use client';

import { useTina } from 'tinacms/dist/react';
import type { PostQuery } from '@/tina/__generated__/types';
import MobilePostReader from '@/components/mobile/mobile-post-reader';

interface MobilePostClientPageProps {
  data: PostQuery;
  variables: { relativePath: string };
  query: string;
}

export default function MobilePostClientPage(props: MobilePostClientPageProps) {
  const { data } = useTina({ ...props });
  return <MobilePostReader post={data.post} />;
}
