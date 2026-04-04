'use client';

/**
 * BaroqueLoading — ornate loading states for the mobile experience.
 *
 * Phase 1: stub.
 * Phase 2+: animated filigree spinner / SVG pattern reveal.
 */

interface BaroqueLoadingProps {
  message?: string;
}

export function BaroqueLoading({ message = 'Loading...' }: BaroqueLoadingProps) {
  return (
    <div className='min-h-screen bg-[oklch(0.145_0_0)] flex items-center justify-center'>
      <p className='font-heading text-[oklch(0.708_0_0)] text-sm tracking-widest'>{message}</p>
    </div>
  );
}
