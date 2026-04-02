'use client';

/**
 * MobileCardStack — Tinder-style swipeable post card stack.
 *
 * Phase 1: stub.
 * Phase 3: swipe right = save to bucket, swipe left = skip.
 *           Uses @use-gesture/react + motion spring physics.
 */

import type { PostConnectionQuery } from '@/tina/__generated__/types';

type PostEdges = NonNullable<PostConnectionQuery['postConnection']['edges']>;

interface MobileCardStackProps {
  posts: PostEdges;
}

export function MobileCardStack({ posts: _posts }: MobileCardStackProps) {
  return <div />;
}
