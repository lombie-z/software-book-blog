import { tinaField } from 'tinacms/dist/react';
import type { Page, PageBlocks } from '../../tina/__generated__/types';
import { TopoHero } from './topo-hero';
import type { CardPost } from './topo-hero';
import type { ProgressRef } from './home-scroll-stage';

type BlocksExtraProps = {
  cardPosts?: CardPost[];
  progressRef?: ProgressRef;
};

export const Blocks = (props: Omit<Page, 'id' | '_sys' | '_values'> & BlocksExtraProps) => {
  if (!props.blocks) return null;
  return (
    <>
      {props.blocks.map(function (block, i) {
        return (
          <div key={i} data-tina-field={tinaField(block)}>
            <Block {...block} cardPosts={props.cardPosts} progressRef={props.progressRef} />
          </div>
        );
      })}
    </>
  );
};

const Block = (block: PageBlocks & BlocksExtraProps) => {
  switch (block.__typename) {
    case 'PageBlocksTopoHero':
      return <TopoHero data={block} cardPosts={block.cardPosts} progressRef={block.progressRef} />;
    default:
      return null;
  }
};
