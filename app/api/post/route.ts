import { NextRequest, NextResponse } from 'next/server';
import client from '@/tina/__generated__/client';

// Returns a single post's Tina query result so the desktop home can render it
// in a client-side overlay without a route change. Intercepting/parallel routes
// are broken on Vercel (they crash the router in applyRouterStatePatchToTree),
// so the overlay fetches through here instead.
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug');
  if (!slug) {
    return NextResponse.json({ error: 'missing slug' }, { status: 400 });
  }
  try {
    const { data, query, variables } = await client.queries.post({ relativePath: `${slug}.mdx` });
    return NextResponse.json({ data, query, variables });
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
}
