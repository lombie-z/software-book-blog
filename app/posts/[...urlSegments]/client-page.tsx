'use client';
import React from 'react';
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

  const date = new Date(post.date!);
  let formattedDate = '';
  if (!isNaN(date.getTime())) {
    formattedDate = format(date, 'MMM dd, yyyy');
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#0a0a0a]" style={{ viewTransitionName: 'blog-card' }}>
        <div className="mx-auto max-w-3xl px-6 pb-20 pt-28">
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

          <div className="mb-16">
            <span
              data-tina-field={tinaField(post, 'date')}
              className="font-mono text-xs uppercase tracking-widest text-[#e0e0e0]/50"
            >
              {formattedDate}
            </span>
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
