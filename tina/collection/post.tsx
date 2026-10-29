import { videoBlockSchema } from '@/components/blocks/video';
import type { Collection } from 'tinacms';

const Post: Collection = {
  label: 'Blog Posts',
  name: 'post',
  path: 'content/posts',
  format: 'mdx',
  ui: {
    router: ({ document }) => {
      return `/posts/${document._sys.breadcrumbs.join('/')}`;
    },
  },
  fields: [
    {
      type: 'string',
      label: 'Title',
      name: 'title',
      isTitle: true,
      required: true,
    },
    {
      type: 'boolean',
      label: 'Ready for release',
      name: 'published',
      description: 'Show this post on the site.',
    },
    {
      type: 'string',
      label: 'Section',
      name: 'category',
      description: 'Which home page list this appears in. Blank counts as a thought.',
      options: [
        { label: 'Thought', value: 'thought' },
        { label: 'Portfolio or concept', value: 'concept' },
      ],
    },
    {
      type: 'string',
      label: 'Concept type',
      name: 'conceptType',
      description: 'Portfolio and concepts only: sites get a browser window, everything else a print mat.',
      options: [
        { label: 'Model', value: 'model' },
        { label: 'Site', value: 'site' },
        { label: 'Graphic', value: 'graphic' },
      ],
    },
    {
      type: 'string',
      label: 'Site URL',
      name: 'siteUrl',
      description: 'Sites only: the live address, shown in the browser bar. Leave blank for work on this site.',
    },
    {
      type: 'image',
      name: 'heroImg',
      label: 'Hero Image',
      // @ts-ignore
      uploadDir: () => 'posts',
    },
    {
      type: 'rich-text',
      label: 'Excerpt',
      name: 'excerpt',
      overrides: {
        toolbar: ['bold', 'italic', 'link'],
      },
    },
    {
      type: 'datetime',
      label: 'Posted Date',
      name: 'date',
      ui: {
        dateFormat: 'MMMM DD YYYY',
        timeFormat: 'hh:mm A',
      },
    },
    {
      type: 'object',
      label: 'Tags',
      name: 'tags',
      list: true,
      fields: [
        {
          type: 'reference',
          label: 'Tag',
          name: 'tag',
          collections: ['tag'],
          ui: {
            optionComponent: (
              props: {
                name?: string;
              },
              _internalSys: { path: string }
            ) => props.name || _internalSys.path,
          },
        },
      ],
      ui: {
        itemProps: (item) => {
          return { label: item?.tag };
        },
      },
    },
    {
      type: 'rich-text',
      label: 'Body',
      name: '_body',
      templates: [
        {
          name: 'BlockQuote',
          label: 'Block Quote',
          fields: [
            {
              name: 'children',
              label: 'Quote',
              type: 'rich-text',
              overrides: {
                toolbar: ['bold', 'italic', 'link'],
              },
            },
            {
              name: 'authorName',
              label: 'Author',
              type: 'string',
            },
          ],
        },
        {
          name: 'DateTime',
          label: 'Date & Time',
          inline: true,
          fields: [
            {
              name: 'format',
              label: 'Format',
              type: 'string',
              options: ['utc', 'iso', 'local'],
            },
          ],
        },
        {
          name: 'NewsletterSignup',
          label: 'Newsletter Sign Up',
          fields: [
            {
              name: 'children',
              label: 'CTA',
              type: 'rich-text',
            },
            {
              name: 'placeholder',
              label: 'Placeholder',
              type: 'string',
            },
            {
              name: 'buttonText',
              label: 'Button Text',
              type: 'string',
            },
            {
              name: 'disclaimer',
              label: 'Disclaimer',
              type: 'rich-text',
              overrides: {
                toolbar: ['bold', 'italic', 'link'],
              },
            },
          ],
          ui: {
            defaultItem: {
              placeholder: 'Enter your email',
              buttonText: 'Notify Me',
            },
          },
        },
        videoBlockSchema,
      ],
      isBody: true,
    },
  ],
};

export default Post;
