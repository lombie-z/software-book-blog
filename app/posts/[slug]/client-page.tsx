'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, UserRound } from 'lucide-react';
import { tinaField, useTina } from 'tinacms/dist/react';
import { TinaMarkdown } from 'tinacms/dist/rich-text';
import { PostQuery } from '@/tina/__generated__/types';
import { components } from '@/components/mdx-components';
import ErrorBoundary from '@/components/error-boundary';
import { sectionId } from '@/components/blocks/post-index';
import { ConceptFrame, LIFT } from '@/components/blocks/concept-frame';
import { AVATARS, useFirstName } from '@/components/blocks/thought-phone';

interface ClientPostProps {
  data: PostQuery;
  variables: {
    relativePath: string;
  };
  query: string;
  /** The body as markdown, for AIsaac's posts (serialized on the server). */
  raw?: string;
}

const PROSE =
  'prose prose-lg max-w-[65ch] font-serif prose-headings:font-serif prose-headings:font-normal prose-headings:text-ink prose-p:text-ink/85 prose-a:text-ink prose-a:decoration-1 prose-a:underline-offset-4 prose-strong:text-ink prose-blockquote:border-rule prose-blockquote:font-normal prose-blockquote:italic prose-blockquote:text-ink/70 prose-code:font-mono prose-li:text-ink/85';

function plainText(node: any): string {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  if (Array.isArray(node.children)) return node.children.map(plainText).join(' ');
  return '';
}

// Every image in the body, including annotated screenshots, for AIsaac's attachments list.
function mediaIn(node: any, found: string[] = []): string[] {
  if (!node) return found;
  if (node.type === 'img' && node.url) found.push(node.url);
  if (node.props?.src) found.push(node.props.src);
  if (Array.isArray(node.children)) for (const child of node.children) mediaIn(child, found);
  return found;
}

const bare = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

function Byline({ avatar, name, children }: { avatar: string; name: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className='flex items-center gap-3'>
      <Image src={avatar} alt='' width={36} height={36} className='size-9 rounded-full bg-plaster-shade object-cover' />
      <div className='flex flex-col'>
        <span className='text-sm font-medium text-ink'>{name}</span>
        <span className='text-xs text-muted-foreground'>{children}</span>
      </div>
    </div>
  );
}

// Markdown shown as source, lightly tinted: headings in ink, list markers and rules muted.
function RawMarkdown({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => {
        const marker = line.match(/^(\s*(?:[-*]|\d+\.)\s)(.*)$/);
        return (
          <span key={i} className='block min-h-[1lh]'>
            {line === '---' ? (
              <span className='text-muted-foreground/70'>{line}</span>
            ) : line.startsWith('#') ? (
              <span className='font-semibold text-ink'>{line}</span>
            ) : line.startsWith('>') ? (
              <span className='italic text-ink/60'>{line}</span>
            ) : marker ? (
              <>
                <span className='text-[oklch(0.6_0.19_35)]'>{marker[1]}</span>
                {marker[2]}
              </>
            ) : /^\w+: /.test(line) && i < 4 ? (
              <>
                <span className='text-muted-foreground'>{line.slice(0, line.indexOf(':') + 1)}</span>
                {line.slice(line.indexOf(':') + 1)}
              </>
            ) : (
              line
            )}
          </span>
        );
      })}
    </>
  );
}

export default function PostClientPage(props: ClientPostProps) {
  const { data } = useTina({ ...props });
  const post = data.post;
  const firstName = useFirstName() || 'Isaac';
  const [copied, setCopied] = useState(false);

  const isAi = post.category === 'ai';
  const isConcept = post.category === 'concept';
  const isSite = isConcept && post.conceptType === 'site';
  const slug = props.variables.relativePath.replace(/\.mdx?$/, '');

  const date = new Date(post.date!);
  // Format in UTC so SSR (server TZ) and client (browser TZ) agree, otherwise the date can differ across the boundary
  // and hydration mismatches.
  const formattedDate = Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const isoDate = Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  const minutes = Math.max(1, Math.round(plainText(post._body).split(/\s+/).filter(Boolean).length / 220));

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

  const section = isAi ? 'AIsaac · AI to AI stuff' : isConcept ? 'Portfolio' : 'Thoughts';
  const share = (
    <button
      type='button'
      onClick={handleShare}
      className='text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-ink'
      aria-label='Share this post'
    >
      {copied ? 'Link copied' : 'Share'}
    </button>
  );

  return (
    <ErrorBoundary>
      <article className='mx-auto max-w-3xl px-6 pt-16 md:pt-24'>
        <header className='mx-auto max-w-[65ch]'>
          <Link href={`/#${sectionId(post.category)}`} className='text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-ink'>
            {section}
          </Link>
          <h1
            data-tina-field={tinaField(post, 'title')}
            className={
              isAi
                ? 'mt-4 text-balance font-mono text-3xl leading-tight text-ink md:text-4xl'
                : 'mt-4 text-balance font-serif text-4xl leading-[1.1] text-ink md:text-6xl'
            }
          >
            {post.title}
          </h1>
          {post.excerpt && !isAi && (
            <div data-tina-field={tinaField(post, 'excerpt')} className='mt-5 font-serif text-xl leading-snug text-ink/65 md:text-2xl [&_p]:m-0'>
              <TinaMarkdown content={post.excerpt} />
            </div>
          )}

          <div className='mt-8 flex flex-wrap items-center justify-between gap-4 border-b border-rule pb-6'>
            {isAi ? (
              <Byline
                avatar={AVATARS.aisaac}
                name={
                  <>
                    AI<span className='text-muted-foreground'>saac</span>
                  </>
                }
              >
                <time dateTime={post.date ?? undefined}>{formattedDate}</time> · written by {firstName}&rsquo;s AI
              </Byline>
            ) : (
              <Byline avatar={AVATARS.isaac} name={firstName}>
                <time data-tina-field={tinaField(post, 'date')} dateTime={post.date ?? undefined}>
                  {formattedDate}
                </time>
                {!isSite && <> · {minutes} min read</>}
              </Byline>
            )}
            {share}
          </div>

          {isSite && post.siteUrl && (
            <div className='mt-6 flex flex-wrap items-center gap-3'>
              <a
                href={post.siteUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='group inline-flex items-center gap-2 rounded-full bg-ink py-2.5 pr-4 pl-5 text-sm text-plaster shadow-[0_10px_24px_-12px_oklch(0.24_0.012_60/0.6)] transition-transform duration-300 hover:-translate-y-0.5'
              >
                Visit <span className='text-plaster/70'>{bare(post.siteUrl)}</span>
                <ArrowUpRight
                  className='size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5'
                  aria-hidden='true'
                />
              </a>
              {post.role && (
                <span className='inline-flex items-center gap-1.5 rounded-full border border-rule px-3 py-2 text-xs text-muted-foreground'>
                  <UserRound className='size-3.5' aria-hidden='true' />
                  {post.role}
                </span>
              )}
            </div>
          )}
        </header>

        {isSite && post.heroImg ? (
          // The site's own screenshot in its browser window, linking out like the button.
          <a
            href={post.siteUrl ?? undefined}
            target='_blank'
            rel='noopener noreferrer'
            data-tina-field={tinaField(post, 'heroImg')}
            className='mt-12 block transition-transform duration-300 ease-out [--lift:var(--rest)] hover:-translate-y-1.5 hover:[--lift:var(--raised)]'
            style={{ '--rest': LIFT.rest, '--raised': LIFT.raised } as React.CSSProperties}
            aria-label={`Open ${post.siteUrl ? bare(post.siteUrl) : post.title}`}
          >
            <ConceptFrame
              type='site'
              image={post.heroImg}
              title={post.title}
              date=''
              siteUrl={post.siteUrl}
              role={post.role}
              sizes='(max-width: 820px) 100vw, 768px'
            />
          </a>
        ) : (
          post.heroImg &&
          !isAi && (
            <div data-tina-field={tinaField(post, 'heroImg')} className='relative mt-12 aspect-[16/9] overflow-hidden rounded-lg bg-plaster-shade'>
              <Image priority src={post.heroImg} alt={post.title} fill sizes='(max-width: 820px) 100vw, 768px' className='object-cover' />
            </div>
          )
        )}

        {isAi ? (
          <AiBody post={post} raw={props.raw} slug={slug} isoDate={isoDate} />
        ) : (
          <div data-tina-field={tinaField(post, '_body')} className={`${PROSE} mx-auto mt-12`}>
            <TinaMarkdown content={post._body} components={components} />
          </div>
        )}

        <div className='mx-auto mt-20 max-w-[65ch]'>
          <Link href={`/#${sectionId(post.category)}`} className='text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-ink'>
            <span aria-hidden='true'>&larr;</span> All {isConcept ? 'portfolio and concepts' : 'thoughts'}
          </Link>
        </div>
      </article>
    </ErrorBoundary>
  );
}

// AIsaac writes in markdown, so its posts show the file itself: a source view, then any images it refers to.
function AiBody({ post, raw, slug, isoDate }: { post: PostQuery['post']; raw?: string; slug: string; isoDate: string }) {
  const media = [...new Set([...(post.heroImg ? [post.heroImg] : []), ...mediaIn(post._body)])];
  const source = `---\ntitle: ${post.title}\ndate: ${isoDate}\n---\n\n${(raw ?? plainText(post._body)).trim()}`;
  return (
    <div className='mx-auto mt-12 max-w-[65ch]'>
      <div className='overflow-hidden rounded-xl bg-[oklch(0.965_0.006_80)] shadow-[0_0_0_1px_oklch(0.24_0.012_60/0.08),0_18px_40px_-28px_oklch(0.24_0.012_60/0.5)]'>
        <div className='flex items-center gap-2 border-b border-rule/70 px-4 py-2.5'>
          <Image src={AVATARS.aisaac} alt='' width={20} height={20} className='size-5 rounded-full bg-plaster-shade object-contain' />
          <span className='font-mono text-xs text-ink'>{slug}.md</span>
          <span className='ml-auto font-mono text-[0.7rem] text-muted-foreground'>markdown</span>
        </div>
        <pre
          data-tina-field={tinaField(post, '_body')}
          className='overflow-x-auto px-5 py-5 font-mono text-[0.82rem] leading-relaxed whitespace-pre-wrap break-words text-ink/85 sm:px-6'
        >
          <RawMarkdown text={source} />
        </pre>
      </div>

      {media.length > 0 && (
        <section className='mt-8' aria-label='Attachments'>
          <h2 className='mb-3 font-mono text-xs text-muted-foreground'>
            {media.length} attachment{media.length > 1 ? 's' : ''}
          </h2>
          <ul className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
            {media.map((src) => (
              <li key={src}>
                <a
                  href={src}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='group block overflow-hidden rounded-lg bg-plaster-shade shadow-[0_0_0_1px_oklch(0.24_0.012_60/0.08)]'
                >
                  <div className='relative aspect-[4/3]'>
                    <Image
                      src={src}
                      alt=''
                      fill
                      sizes='(max-width: 640px) 50vw, 14rem'
                      className='object-cover transition-transform duration-300 group-hover:scale-[1.03]'
                    />
                  </div>
                  <span className='block truncate px-2.5 py-1.5 font-mono text-[0.7rem] text-muted-foreground'>{src.split('/').pop()}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
