'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
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
}

export default function PostClientPage(props: ClientPostProps) {
  const { data } = useTina({ ...props });
  const post = data.post;
  const [copied, setCopied] = useState(false);

  const date = new Date(post.date!);
  let formattedDate = '';
  if (!isNaN(date.getTime())) {
    formattedDate = format(date, 'MMM dd, yyyy');
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
      <div className="min-h-screen bg-[#0a0a0a]" style={{ viewTransitionName: 'blog-card' }}>
        <div className="mx-auto max-w-3xl px-6 pb-28 pt-28">
          <Link
            href="/#posts"
            className="mb-10 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[#e0e0e0]/50 transition-colors hover:text-[#e0e0e0]"
          >
            <span aria-hidden="true">&larr;</span> Back to posts
          </Link>
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
            <div data-tina-field={tinaField(post, 'heroImg')} className="mb-16">
              <Image
                priority={true}
                src={post.heroImg}
                alt={post.title}
                width={1200}
                height={675}
                className="w-full rounded-lg object-cover"
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
      <SocialFooter />
    </ErrorBoundary>
  );
}
