import client from '@/tina/__generated__/client';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/utils';

export const revalidate = 3600;

// The excerpt is Tina rich text (a tree of nodes); the feed wants its words.
type RichText = { text?: string; children?: RichText[] };
const plainText = (node: RichText): string => node.text ?? (node.children ?? []).map(plainText).join(node.children?.some((c) => c.text === undefined) ? ' ' : '');

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** RSS 2.0 feed of the published posts: title, link and excerpt, newest first. */
export async function GET() {
  // Page through every post (postConnection is paginated).
  type Node = { _sys: { breadcrumbs: string[] }; title: string; excerpt?: RichText | null; date?: string | null };
  const nodes: Node[] = [];
  let page = await client.queries.postConnection({ filter: { published: { eq: true } } });
  for (;;) {
    for (const e of page.data.postConnection.edges ?? []) if (e?.node) nodes.push(e.node);
    if (!page.data.postConnection.pageInfo.hasNextPage) break;
    page = await client.queries.postConnection({ after: page.data.postConnection.pageInfo.endCursor, filter: { published: { eq: true } } });
  }

  const items = nodes
    .filter((n) => n.date)
    .sort((a, b) => Date.parse(b.date!) - Date.parse(a.date!))
    .map((n) => {
      const excerpt = n.excerpt ? plainText(n.excerpt).replace(/\s+/g, ' ').trim() : '';
      const url = `${SITE_URL}/posts/${n._sys.breadcrumbs.join('/')}`;
      return `    <item>
      <title>${escape(n.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(n.date!).toUTCString()}</pubDate>${excerpt ? `\n      <description>${escape(excerpt)}</description>` : ''}
    </item>`;
    });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <description>${escape(SITE_DESCRIPTION)}</description>
    <language>en</language>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items.join('\n')}
  </channel>
</rss>
`;

  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
