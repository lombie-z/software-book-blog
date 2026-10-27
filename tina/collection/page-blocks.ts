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
    defaultItem: { caption: 'Modelled in Blender by Claude' },
  },
  fields: [
    {
      type: 'string',
      label: 'Caption',
      name: 'caption',
    },
  ],
};

export const postIndexBlockSchema: Template = {
  name: 'postIndex',
  label: 'Post Index',
  ui: {
    defaultItem: { heading: 'Writing' },
  },
  fields: [
    {
      type: 'string',
      label: 'Heading',
      name: 'heading',
    },
  ],
};
