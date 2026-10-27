import Link from 'next/link';
import { Signature } from '@/components/ui/signature';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
      <Link href="/" aria-label="Home" className="text-ink transition-opacity hover:opacity-60">
        <Signature className="w-40" animate={false} />
      </Link>
      <h1 className="mt-12 font-serif text-5xl text-ink md:text-6xl">Nothing here.</h1>
      <p className="mt-4 text-muted-foreground">The page you were after has moved or never existed.</p>
      <Link href="/" className="mt-10 text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-ink">
        <span aria-hidden="true">&larr;</span> Back home
      </Link>
    </div>
  );
}
