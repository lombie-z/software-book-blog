import type { MetadataRoute } from 'next';
import client from '@/tina/__generated__/client';
import { SITE_URL } from '@/lib/utils';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Page through every post (postConnection is paginated).
  const edges: Array<{ node?: { _sys: { breadcrumbs: string[] }; date?: string | null } | null } | null> = [];
  let page = await client.queries.postConnection();
  edges.push(...(page.data.postConnection.edges ?? []));
  while (page.data.postConnection.pageInfo.hasNextPage) {
    page = await client.queries.postConnection({ after: page.data.postConnection.pageInfo.endCursor });
    edges.push(...(page.data.postConnection.edges ?? []));
  }

  const posts: MetadataRoute.Sitemap = edges
    .map((e) => e?.node)
    .filter((n): n is NonNullable<typeof n> => Boolean(n))
    .map((n) => ({
      url: `${SITE_URL}/posts/${n._sys.breadcrumbs.join('/')}`,
      lastModified: n.date ? new Date(n.date) : undefined,
    }));

  return [{ url: SITE_URL, changeFrequency: 'weekly', priority: 1 }, ...posts];
}
