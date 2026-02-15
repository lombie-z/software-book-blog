import { tinaField } from "tinacms/dist/react";
import { Page, PageBlocks } from "../../tina/__generated__/types";
import { TopoHero } from "./topo-hero";

export const Blocks = (props: Omit<Page, "id" | "_sys" | "_values"> & { scrollProgress?: number }) => {
  if (!props.blocks) return null;
  return (
    <>
      {props.blocks.map(function (block, i) {
        return (
          <div key={i} data-tina-field={tinaField(block)}>
            <Block {...block} scrollProgress={props.scrollProgress} />
          </div>
        );
      })}
    </>
  );
};

const Block = (block: PageBlocks & { scrollProgress?: number }) => {
  switch (block.__typename) {
    case "PageBlocksTopoHero":
      return <TopoHero data={block} scrollProgress={block.scrollProgress} />;
    default:
      return null;
  }
};
