'use client';
import { useTina } from 'tinacms/dist/react';
import { Blocks } from '@/components/blocks';
import type { PageQuery, PageQueryVariables } from '@/tina/__generated__/types';

interface AboutClientPageProps {
  data: PageQuery;
  variables: PageQueryVariables;
  query: string;
}

export default function AboutClientPage(props: AboutClientPageProps) {
  const { data } = useTina({ ...props });
  return <Blocks {...data.page} />;
}
