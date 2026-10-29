import { tinaField } from 'tinacms/dist/react';
import { type Components, TinaMarkdown } from 'tinacms/dist/rich-text';
import { components } from '@/components/mdx-components';
import type { PageBlocksProse } from '@/tina/__generated__/types';

/** The reading column's type styles, shared with the post pages. */
export const PROSE =
  'prose prose-lg max-w-[65ch] font-serif prose-headings:font-serif prose-headings:font-normal prose-headings:text-ink prose-p:text-ink/85 prose-a:text-ink prose-a:decoration-1 prose-a:underline-offset-4 prose-strong:text-ink prose-blockquote:border-rule prose-blockquote:font-normal prose-blockquote:italic prose-blockquote:text-ink/70 prose-code:font-mono prose-li:text-ink/85';

// Images in plain text pages sit in the line, like a logo in a sentence; the alt text reads in its place.
const textComponents: Components<{}> = {
  ...components,
  img: (props) =>
    props?.url ? <img src={props.url} alt={props.alt || ''} className='not-prose ml-1 inline h-[2em] w-auto align-middle [margin-block:-0.5em]' /> : <></>,
};

/** A heading and a run of text in the reading column, for plain pages like About. */
export function Prose({ data }: { data: PageBlocksProse }) {
  return (
    <article className='mx-auto max-w-3xl px-6 pt-16 md:pt-24'>
      <div className='mx-auto max-w-[65ch]'>
        {data.heading && (
          <h1 data-tina-field={tinaField(data, 'heading')} className='text-balance font-serif text-4xl leading-[1.1] text-ink md:text-6xl'>
            {data.heading}
          </h1>
        )}
        <div data-tina-field={tinaField(data, 'body')} className={`${PROSE} mt-10`}>
          <TinaMarkdown content={data.body} components={textComponents} />
        </div>
      </div>
    </article>
  );
}
