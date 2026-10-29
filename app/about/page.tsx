import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Layout from '@/components/layout/layout';
import client from '@/tina/__generated__/client';
import AboutClientPage from './client-page';

export const metadata: Metadata = {
  title: 'About',
  alternates: { canonical: '/about' },
};

export default async function AboutPage() {
  let data: Awaited<ReturnType<typeof client.queries.page>>;
  try {
    data = await client.queries.page({ relativePath: 'about.mdx' });
  } catch {
    notFound();
  }
  return (
    <Layout rawPageData={data}>
      <AboutClientPage {...data} />
    </Layout>
  );
}
