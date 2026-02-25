'use client';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Tilt } from '@/components/ui/tilt';
import type { PostConnectionQuery, TagConnectionQuery } from '@/tina/__generated__/types';

type PostEdges = NonNullable<PostConnectionQuery['postConnection']['edges']>;
type TagEdges = NonNullable<TagConnectionQuery['tagConnection']['edges']>;

export function BlogArchive({ posts, tags }: { posts: PostEdges; tags: TagEdges }) {
  const router = useRouter();
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const handleCardClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      if (!document.startViewTransition) return;
      e.preventDefault();
      const el = e.currentTarget;
      el.style.viewTransitionName = 'blog-card';
      const transition = document.startViewTransition(() => {
        el.style.viewTransitionName = '';
        return router.push(href) as unknown as Promise<void>;
      });
      transition.finished.then(() => {
        el.style.viewTransitionName = '';
      });
    },
    [router],
  );

  const filteredPosts = selectedTag
    ? posts.filter((post) => {
        const postTags = post?.node?.tags;
        if (!postTags) return false;
        return postTags.some((t) => t?.tag?._sys?.filename === selectedTag);
      })
    : posts;

  return (
    <section className="min-h-screen bg-[#0a0a0a] py-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="mb-4 text-center font-heading text-2xl font-bold uppercase tracking-tight text-[#e0e0e0] sm:text-3xl">Archive</h2>
        <p className="mb-10 text-center font-mono text-xs uppercase tracking-widest text-[#e0e0e0]/40">All posts</p>

        {/* Tag filter bar */}
        {tags.length > 0 && (
          <div className="mb-12 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              className={`rounded-full border px-4 py-1.5 font-body text-xs font-bold uppercase tracking-wider transition-colors ${
                selectedTag === null
                  ? 'border-[#e0e0e0] bg-[#e0e0e0] text-[#0a0a0a]'
                  : 'border-[#e0e0e0]/20 text-[#e0e0e0]/50 hover:border-[#e0e0e0]/40 hover:text-[#e0e0e0]/80'
              }`}
            >
              All
            </button>
            {tags.map((tag) => {
              const node = tag?.node;
              if (!node) return null;
              const filename = node._sys.filename;
              return (
                <button
                  key={filename}
                  type="button"
                  onClick={() => setSelectedTag(selectedTag === filename ? null : filename)}
                  className={`rounded-full border px-4 py-1.5 font-body text-xs font-bold uppercase tracking-wider transition-colors ${
                    selectedTag === filename
                      ? 'border-[#e0e0e0] bg-[#e0e0e0] text-[#0a0a0a]'
                      : 'border-[#e0e0e0]/20 text-[#e0e0e0]/50 hover:border-[#e0e0e0]/40 hover:text-[#e0e0e0]/80'
                  }`}
                >
                  {node.name || filename}
                </button>
              );
            })}
          </div>
        )}

        {/* Post cards grid */}
        {filteredPosts.length === 0 ? (
          <p className="py-20 text-center font-body text-sm text-[#e0e0e0]/30">No posts found.</p>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPosts.map((post) => {
              const node = post?.node;
              if (!node) return null;
              const slug = node._sys.breadcrumbs.join('/');
              const date = node.date ? new Date(node.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
              const postTags = node.tags?.map((t) => t?.tag?.name).filter(Boolean) || [];

              const cardClip = 'polygon(0 0, 100% 0, 100% calc(100% - 24px), calc(100% - 32px) 100%, 0 100%)';
              return (
                <Link key={node._sys.filename} href={`/posts/${slug}`} className="block" onClick={(e) => handleCardClick(e, `/posts/${slug}`)}>
                  <Tilt rotationFactor={8} isRevese>
                    <div
                      className="p-px"
                      style={{ clipPath: cardClip, background: 'rgba(224,224,224,0.1)' }}
                    >
                    <div
                      className="flex flex-col overflow-hidden bg-[#111]"
                      style={{ clipPath: cardClip }}
                    >
                      {node.heroImg ? (
                        <div className="relative aspect-[16/10]">
                          <Image
                            src={node.heroImg}
                            alt={node.title || ''}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex aspect-[16/10] items-center justify-center bg-[#1a1a1a]">
                          <span className="font-body text-xs text-[#e0e0e0]/20">No image</span>
                        </div>
                      )}
                      <div className="p-3">
                        <h3 className="font-body leading-snug text-[#e0e0e0]">{node.title}</h3>
                        <p className="font-mono text-sm text-[#e0e0e0]/50">
                          {postTags[0] || ''}{postTags.length > 0 && date ? ' · ' : ''}{date}
                        </p>
                      </div>
                    </div>
                    </div>
                  </Tilt>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
