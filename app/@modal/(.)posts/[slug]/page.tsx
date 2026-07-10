import { headers } from 'next/headers';
import client from '@/tina/__generated__/client';
import PostClientPage from '@/app/posts/[slug]/client-page';
import MobilePostClientPage from '@/app/posts/[slug]/mobile-client-page';
import { PostOverlay } from '@/components/post-overlay';

// Intercepts in-app navigations to /posts/* and renders the post in the @modal
// slot over the still-mounted home. A direct visit or refresh hits the real
// route (app/posts/...) and renders the full page instead.
export default async function InterceptedPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await client.queries.post({ relativePath: `${slug}.mdx` });

  const isMobile = (await headers()).get('x-device-type') === 'mobile';

  // Mobile already has a full-screen reader with its own navigation; show it
  // as-is. Desktop gets the centred overlay panel.
  if (isMobile) {
    return <MobilePostClientPage {...data} />;
  }

  return (
    <PostOverlay>
      <PostClientPage {...data} overlay />
    </PostOverlay>
  );
}
