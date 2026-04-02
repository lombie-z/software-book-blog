'use client';

/**
 * ReadingQueue — full-screen queue view for saved posts.
 *
 * Phase 1: stub.
 * Phase 3:
 *   - Vertical list styled as a medieval scroll
 *   - Tap to read, swipe to remove from queue
 *   - "Read all" sequential mode with View Transition API between posts
 *   - Persisted to sessionStorage for refresh resilience
 */

interface ReadingQueueProps {
  slugs: string[];
  onClose: () => void;
  onRemove: (slug: string) => void;
}

export function ReadingQueue({ slugs: _slugs, onClose: _onClose, onRemove: _onRemove }: ReadingQueueProps) {
  return <div />;
}
