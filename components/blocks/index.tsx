import { tinaField } from 'tinacms/dist/react';
import type { Page, PageBlocks } from '../../tina/__generated__/types';
import { InlayHero } from './inlay-hero';
import { MicroBiome } from './micro-biome';
import { PostIndex, type PostEdges } from './post-index';

type BlocksExtraProps = {
  posts: PostEdges;
};

export const Blocks = (props: Omit<Page, 'id' | '_sys' | '_values'> & BlocksExtraProps) => {
  if (!props.blocks) return null;
  return (
    <>
      {props.blocks.map(function (block, i) {
        if (!block) return null;
        return (
          <div key={i} data-tina-field={tinaField(block)}>
            <Block block={block} posts={props.posts} />
          </div>
        );
      })}
    </>
  );
};

const Block = ({ block, posts }: { block: PageBlocks } & BlocksExtraProps) => {
  switch (block.__typename) {
    case 'PageBlocksInlayHero':
      return <InlayHero data={block} />;
    case 'PageBlocksMicroBiome':
      return <MicroBiome data={block} />;
    case 'PageBlocksPostIndex':
      return <PostIndex data={block} posts={posts} />;
    default:
      return null;
  }
};
