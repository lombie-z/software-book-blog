'use client';

/**
 * MobileCard — individual post card with front/back flip.
 *
 * Phase 1: stub.
 * Phase 3:
 *   Front: title (Blackletter), blurred hero image, date
 *   Back:  excerpt, tags, reading time
 *   Tap = flip (CSS rotateY + backface-visibility: hidden)
 *   Swipe = delegate to MobileCardStack
 */

import type { PostConnectionQuery } from '@/tina/__generated__/types';

type PostEdge = NonNullable<NonNullable<PostConnectionQuery['postConnection']['edges']>[number]>;

interface MobileCardProps {
  post: PostEdge;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
}

export function MobileCard({ post: _post, onSwipeRight: _onSwipeRight, onSwipeLeft: _onSwipeLeft }: MobileCardProps) {
  return <div />;
}
