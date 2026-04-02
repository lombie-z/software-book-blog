'use client';

/**
 * ReadingBucket — floating bucket icon with animated count badge.
 *
 * Phase 1: stub.
 * Phase 3:
 *   - Fixed bottom-right, z-index above card stack
 *   - Count badge with filigree border; scale-bounce on increment
 *   - Tap opens ReadingQueue full-screen overlay
 */

interface ReadingBucketProps {
  count: number;
  onOpen: () => void;
}

export function ReadingBucket({ count: _count, onOpen: _onOpen }: ReadingBucketProps) {
  return <div />;
}
