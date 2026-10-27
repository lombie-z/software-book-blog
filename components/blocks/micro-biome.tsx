'use client';

import type { Template } from 'tinacms';
import { tinaField } from 'tinacms/dist/react';
import type { PageBlocksMicroBiome } from '@/tina/__generated__/types';

export function MicroBiome({ data }: { data: PageBlocksMicroBiome }) {
  return (
    <section className="mx-auto mt-32 w-full max-w-[640px] px-6" aria-label="Micro biome">
      <div className="aspect-square w-full" data-biome-stage />
      {data.caption && (
        <p data-tina-field={tinaField(data, 'caption')} className="mt-4 text-center text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {data.caption}
        </p>
      )}
    </section>
  );
}

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
