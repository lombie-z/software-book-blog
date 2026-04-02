'use client';

/**
 * FiligreeTransitions — shared transition wrapper for mobile page changes.
 *
 * Phase 1: stub — renders children directly.
 * Phase 4+: View Transition API animations (scale compress → slide in from right).
 */

interface FiligreeTransitionsProps {
  children: React.ReactNode;
}

export function FiligreeTransitions({ children }: FiligreeTransitionsProps) {
  return <>{children}</>;
}
