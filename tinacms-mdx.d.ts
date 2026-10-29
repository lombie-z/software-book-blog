// @tinacms/mdx ships its types but doesn't list them in its package.json "exports", so TypeScript can't find them.
declare module '@tinacms/mdx' {
  export const serializeMDX: (value: unknown, field: unknown, imageCallback: (url: string) => string) => string | object | undefined;
}
