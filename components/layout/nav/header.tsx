'use client';

import Link from 'next/link';
import { Signature } from '@/components/ui/signature';

export const Header = () => {
  return (
    <header className="mx-auto w-full max-w-3xl px-6 pt-8">
      <Link href="/" aria-label="Home" className="inline-block text-ink transition-opacity hover:opacity-60">
        <Signature variant="etched" depth={1.6} className="w-28" animate={false} />
      </Link>
    </header>
  );
};
