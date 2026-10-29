import type { Template } from 'tinacms';

// Home page block templates. Kept apart from the React components so the Tina config bundle never imports three.js.

export const inlayHeroBlockSchema: Template = {
  name: 'inlayHero',
  label: 'Inlay Hero',
  ui: {
    defaultItem: { showCactus: true },
  },
  fields: [
    {
      type: 'boolean',
      label: 'Show cactus',
      name: 'showCactus',
      description: 'The clay cactus in the lowest niche.',
    },
  ],
};

export const microBiomeBlockSchema: Template = {
  name: 'microBiome',
  label: 'Micro Biome',
  ui: {
    defaultItem: { caption: 'Claude-powered Modelling for Interactive Web Experiences', linkLabel: 'See full site' },
  },
  fields: [
    {
      type: 'string',
      label: 'Caption',
      name: 'caption',
    },
    {
      type: 'string',
      label: 'Link label',
      name: 'linkLabel',
    },
    {
      type: 'string',
      label: 'Link URL',
      name: 'linkUrl',
      description: 'The full micro biome site. Opens in a new tab.',
    },
  ],
};

export const postIndexBlockSchema: Template = {
  name: 'postIndex',
  label: 'Post Index',
  ui: {
    defaultItem: { heading: 'Thoughts', category: 'thought' },
  },
  fields: [
    {
      type: 'string',
      label: 'Heading',
      name: 'heading',
    },
    {
      type: 'string',
      label: 'Shows',
      name: 'category',
      description: 'Lists posts from this section; the latest three show, the rest behind a toggle.',
      options: [
        { label: 'Thoughts', value: 'thought' },
        { label: 'Portfolio and concepts', value: 'concept' },
      ],
    },
  ],
};
