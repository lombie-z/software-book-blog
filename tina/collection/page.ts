import type { Collection } from 'tinacms';
import { inlayHeroBlockSchema, microBiomeBlockSchema, postIndexBlockSchema } from './page-blocks';

const Page: Collection = {
  label: 'Pages',
  name: 'page',
  path: 'content/pages',
  format: 'mdx',
  ui: {
    router: ({ document }) => {
      const filepath = document._sys.breadcrumbs.join('/');
      if (filepath === 'home') {
        return '/';
      }
      return `/${filepath}`;
    },
  },
  fields: [
    {
      type: 'object',
      list: true,
      name: 'blocks',
      label: 'Sections',
      ui: {
        visualSelector: true,
      },
      templates: [
        inlayHeroBlockSchema,
        microBiomeBlockSchema,
        postIndexBlockSchema,
      ],
    },
  ],
};

export default Page;
