import Link from 'next/link';
import { SITE_NAME } from '@/lib/utils';

// Placeholder profile URLs, carried over from the previous footer.
const SOCIAL_LINKS = [
  { label: 'GitHub', href: 'https://github.com' },
  { label: 'LinkedIn', href: 'https://linkedin.com' },
  { label: 'X', href: 'https://x.com' },
];

export const Footer = () => {
  return (
    <footer className="mx-auto mt-32 w-full max-w-3xl px-6 pb-12">
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-t border-rule pt-6 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <span>
          © {new Date().getFullYear()} {SITE_NAME}
        </span>
        <nav aria-label="Elsewhere" className="flex gap-6">
          <Link href="/about" className="transition-colors hover:text-ink">
            About
          </Link>
          {SOCIAL_LINKS.map((s) => (
            <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-ink">
              {s.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
};
