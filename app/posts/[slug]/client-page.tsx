'use client';
import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { tinaField, useTina } from 'tinacms/dist/react';
import { TinaMarkdown } from 'tinacms/dist/rich-text';
import { PostQuery } from '@/tina/__generated__/types';
import { components } from '@/components/mdx-components';
import ErrorBoundary from '@/components/error-boundary';
import { SocialFooter } from '@/components/social-footer';

interface ClientPostProps {
  data: PostQuery;
  variables: {
    relativePath: string;
  };
  query: string;
  // Rendered inside the desktop post overlay (intercepting route): drop the
  // full-page chrome (back link, min-h-screen, footer) so it sits in the panel.
  overlay?: boolean;
}

export default function PostClientPage({ overlay, ...props }: ClientPostProps) {
  const { data } = useTina({ ...props });
  const post = data.post;
  const [copied, setCopied] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const heroRef = useRef<HTMLImageElement>(null);

  // A cached/priority hero can finish loading before React attaches onLoad,
  // which would leave it stuck at opacity 0. Reveal it if it's already complete.
  useEffect(() => {
    if (heroRef.current?.complete) setHeroLoaded(true);
  }, []);

  const date = new Date(post.date!);
  let formattedDate = '';
  if (!isNaN(date.getTime())) {
    // Format in UTC so SSR (server TZ) and client (browser TZ) agree — otherwise
    // the publish date differs across the date boundary and hydration mismatches.
    formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' });
  }

  const handleShare = async () => {
    const url = window.location.href;
    const title = post.title ?? '';
    if (navigator.share) {
      await navigator.share({ title, url });
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <ErrorBoundary>
      <div className={overlay ? 'bg-[#0a0a0a]' : 'min-h-screen bg-[#0a0a0a]'}>
        <div className={`mx-auto max-w-3xl px-6 ${overlay ? 'pb-16 pt-14' : 'pb-28 pt-28'}`}>
          {!overlay && (
            <Link
              href="/#posts"
              className="mb-10 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[#e0e0e0]/50 transition-colors hover:text-[#e0e0e0]"
            >
              <span aria-hidden="true">&larr;</span> Back to posts
            </Link>
          )}
          <h1
            data-tina-field={tinaField(post, 'title')}
            className="mb-8 font-heading text-5xl tracking-wide text-[#e0e0e0] md:text-6xl"
          >
            {post.title}
          </h1>

          <div className="mb-16 flex items-center justify-between gap-4">
            <span
              data-tina-field={tinaField(post, 'date')}
              className="font-mono text-xs uppercase tracking-widest text-[#e0e0e0]/50"
            >
              {formattedDate}
            </span>
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 rounded border border-[#e0e0e0]/15 bg-transparent px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-[#e0e0e0]/50 transition-colors hover:border-[#e0e0e0]/30 hover:text-[#e0e0e0]/80"
              aria-label="Share this post"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              {copied ? 'Copied' : 'Share'}
            </button>
          </div>

          {post.heroImg && (
            <div data-tina-field={tinaField(post, 'heroImg')} className="relative mb-16">
              {/* Low-res base (matches the home card's 640px variant, so it's
                  already cached and paints instantly). The full-res layer fades
                  in over it on load — no blank box, no pop. Doubles as a blur-up
                  on the full post page where the card image isn't cached. */}
              <Image
                src={post.heroImg}
                alt=""
                aria-hidden
                fill
                sizes="640px"
                className="rounded-lg object-cover"
              />
              <Image
                ref={heroRef}
                priority={true}
                src={post.heroImg}
                alt={post.title}
                width={1200}
                height={675}
                onLoad={() => setHeroLoaded(true)}
                className="relative h-auto w-full rounded-lg object-cover transition-opacity duration-500 ease-out"
                style={{ opacity: heroLoaded ? 1 : 0 }}
              />
            </div>
          )}

          <div
            data-tina-field={tinaField(post, '_body')}
            className="prose prose-invert max-w-none prose-headings:font-heading prose-headings:tracking-wide prose-headings:text-[#e0e0e0] prose-p:text-[#e0e0e0]/80 prose-a:text-[#e0e0e0] prose-a:underline prose-strong:text-[#e0e0e0] prose-code:text-[#e0e0e0]/90 prose-blockquote:border-[#e0e0e0]/20 prose-blockquote:text-[#e0e0e0]/60"
          >
            <TinaMarkdown
              content={post._body}
              components={{
                ...components,
              }}
            />
          </div>
        </div>
      </div>
      {!overlay && <SocialFooter />}
    </ErrorBoundary>
  );
}
