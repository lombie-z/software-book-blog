'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { tinaField, useTina } from 'tinacms/dist/react';
import { TinaMarkdown } from 'tinacms/dist/rich-text';
import { PostQuery } from '@/tina/__generated__/types';
import { components } from '@/components/mdx-components';
import ErrorBoundary from '@/components/error-boundary';

interface ClientPostProps {
  data: PostQuery;
  variables: {
    relativePath: string;
  };
  query: string;
}

export default function PostClientPage(props: ClientPostProps) {
  const { data } = useTina({ ...props });
  const post = data.post;
  const [copied, setCopied] = useState(false);

  const date = new Date(post.date!);
  let formattedDate = '';
  if (!isNaN(date.getTime())) {
    // Format in UTC so SSR (server TZ) and client (browser TZ) agree — otherwise
    // the publish date differs across the date boundary and hydration mismatches.
    formattedDate = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
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
      <article className="mx-auto max-w-3xl px-6 pt-16 md:pt-24">
        <header className="mx-auto max-w-[65ch]">
          <h1 data-tina-field={tinaField(post, 'title')} className="text-balance font-serif text-4xl leading-[1.1] text-ink md:text-6xl">
            {post.title}
          </h1>
          <div className="mt-6 flex items-center justify-between gap-4 border-b border-rule pb-6 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <time data-tina-field={tinaField(post, 'date')} dateTime={post.date ?? undefined}>
              {formattedDate}
            </time>
            <button onClick={handleShare} className="uppercase tracking-[0.18em] transition-colors hover:text-ink" aria-label="Share this post">
              {copied ? 'Link copied' : 'Share'}
            </button>
          </div>
        </header>

        {post.heroImg && (
          <div data-tina-field={tinaField(post, 'heroImg')} className="relative mt-12 aspect-[16/9] overflow-hidden bg-plaster-shade">
            <Image priority src={post.heroImg} alt={post.title} fill sizes="(max-width: 820px) 100vw, 768px" className="object-cover" />
          </div>
        )}

        <div
          data-tina-field={tinaField(post, '_body')}
          className="prose prose-lg mx-auto mt-12 max-w-[65ch] font-serif prose-headings:font-serif prose-headings:font-normal prose-headings:text-ink prose-p:text-ink/85 prose-a:text-ink prose-a:decoration-1 prose-a:underline-offset-4 prose-strong:text-ink prose-blockquote:border-rule prose-blockquote:font-normal prose-blockquote:italic prose-blockquote:text-ink/70 prose-code:font-mono prose-li:text-ink/85"
        >
          <TinaMarkdown content={post._body} components={components} />
        </div>

        <div className="mx-auto mt-20 max-w-[65ch]">
          <Link href="/#posts" className="text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-ink">
            <span aria-hidden="true">&larr;</span> All writing
          </Link>
        </div>
      </article>
    </ErrorBoundary>
  );
}
