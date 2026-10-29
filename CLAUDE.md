# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start dev server (TinaCMS + Next.js Turbopack) |
| `pnpm build` | Production build (TinaCMS + Next.js) |
| `pnpm build-local` | Local build without cloud checks |
| `pnpm lint` | Lint with Biome |
| `pnpm start` | Start production server |

No test framework is configured.

## Local URLs

- `http://localhost:3002` — Website
- `http://localhost:3002/admin` — TinaCMS visual editor
- `http://localhost:4002/altair/` — GraphQL playground

## File Map

**Do not glob/explore to find files.** Use this map. If you need a file not listed here, it is likely in `tina/__generated__/` (auto-generated, never edit) or `node_modules/`.

```
app/
  layout.tsx                          # Root layout: fonts (Instrument Sans + Newsreader), metadata
  page.tsx                            # Home page (server) — fetches page + published posts
  home-client-page.tsx                # Home page (client) — useTina, mounts the shared WebGL canvas
  not-found.tsx                       # 404 page
  manifest.ts                         # PWA manifest
  posts/[slug]/
    page.tsx                          # Post page (server) — fetches post query, metadata, JSON-LD
    client-page.tsx                   # Post page (client) — reading column

components/
  blocks/                             # Page-level block components (Tina page blocks)
    index.tsx                         # Block registry — maps block types to components
    inlay-hero.tsx                    # Signature, three lit plaster niches, vertical side text with parallax
    micro-biome.tsx                   # Biome stage: lazy 3D scene, drag to turn, Blender still fallback
    post-index.tsx                    # Home Thoughts / Portfolio and concepts sections (routes to the two below)
    thought-phone.tsx                 # Thoughts as a scrolling message thread on a CSS phone
    concept-frame.tsx                 # Concept frames for the home grid: browser window (sites) or print mat
    mermaid.tsx                       # Mermaid diagram block
    video.tsx                         # Video embed block
  three/                              # react-three-fiber (v9) pieces, all drawn on one shared canvas
    scene-canvas.tsx                  # Fixed full-screen <Canvas> + drei <View.Port>; sun/eye controller
    scene-state.ts                    # Shared per-frame state (sun direction, viewer eye)
    scene-context.tsx                 # Whether WebGL is available (else fallbacks render)
    plaster-niche.tsx                 # One recessed niche sized from its DOM box, off-axis camera
    niche-params.ts                   # Shared eye/light/sun values for the 3D niches and their SVG stand-in
    niche.tsx                         # Niche box: 3D room + SVG stand-in handoff (used by the hero)
    niche-sketch.tsx                  # SVG drawing of a niche from the same projection + light (pre-3D / no-WebGL)
    cactus.tsx                        # Clay cactus glTF (public/models/cactus.glb)
    micro-biome-scene.tsx             # Biome glTF, procedural idle animation by node name, drag spring
  layout/
    layout.tsx                        # Site shell (global query, header, footer, smooth scroll)
    layout-context.tsx                # LayoutContext provider (global settings)
    smooth-scroll.tsx                 # Lenis root (off for reduced motion)
    nav/header.tsx                    # Small signature link (hidden on home)
    nav/footer.tsx                    # Footer with links
  ui/
    signature.tsx                     # Traced handwritten signature SVG with wipe-in
    button.tsx, breakpoint-indicator.tsx
  mdx-components.tsx                  # MDX renderers (code blocks, blockquotes, mermaid, video)
  mermaid-renderer.tsx                # Client-side mermaid rendering
  error-boundary.tsx, icon.tsx, raw-renderer.tsx
  shared/theme.ts                     # Theme utilities

art/                                  # Blender sources (cactus.blend, micro-biome.blend)
public/models/                        # Exported glTF (Draco); decoder self-hosted in public/draco/
public/images/3d/                     # Blender stills used as fallbacks

content/                              # CMS-managed content (TinaCMS edits these)
  posts/*.mdx                         # Blog posts (MDX)
  pages/home.mdx                      # Home page block order (inlayHero, microBiome, postIndex)
  authors/*.md                        # Author profiles
  tags/*.mdx                          # Tag definitions
  global/index.json                   # Site-wide config (site name/tagline, header, footer, theme)

tina/
  config.tsx                          # Main TinaCMS configuration
  collection/post.tsx                 # Post collection schema
  collection/page.ts                  # Page collection schema (block-based)
  collection/author.ts                # Author collection schema
  collection/tag.ts                   # Tag collection schema
  collection/global.ts                # Global settings schema
  fields/color.tsx                    # Custom color picker field
  fields/icon.tsx                     # Custom icon picker field
  queries/*.gql                       # GraphQL query/fragment definitions
  __generated__/                      # AUTO-GENERATED — never edit

lib/utils.ts                          # Utility functions (cn, SITE_URL, etc.)
styles.css                            # Global styles (Tailwind CSS 4, plaster palette tokens)
next.config.ts                        # Next.js config
biome.json                            # Biome linter/formatter config
```

## Where to Look

| Task | Start here |
|------|-----------|
| Change post rendering/layout | `app/posts/[slug]/client-page.tsx` |
| Change home page layout | `content/pages/home.mdx` (block order), `components/blocks/*` |
| Edit the niches / lighting | `components/three/plaster-niche.tsx`, `components/three/scene-canvas.tsx` |
| Edit the 3D models | `art/*.blend` in Blender, re-export to `public/models/` (Draco) and re-render the still in `public/images/3d/` |
| Add/change an MDX component | `components/mdx-components.tsx` + template in `tina/collection/post.tsx` |
| Add a page block type | `tina/collection/page.ts` (schema) + `components/blocks/` (renderer) + `components/blocks/index.tsx` (registry) |
| Change header/footer/nav | `components/layout/nav/header.tsx` or `footer.tsx` |
| Change site-wide settings | `content/global/index.json` (values), `tina/collection/global.ts` (schema) |
| Change TinaCMS schema | `tina/collection/*.ts` — then run `pnpm dev` to regenerate types |
| Add a new post | Create `.mdx` file in `content/posts/` |
| Change styles/theme | `styles.css` (global), `components/shared/theme.ts` (theme utils) |

## Architecture

**TinaCMS + Next.js 15 App Router** blog with server/client split pattern for visual editing.

### Server/Client Split (Core Pattern)

Every page follows this structure:

```
app/posts/[slug]/
  page.tsx           # Server component — fetches data via client.queries.xxx()
  client-page.tsx    # Client component — renders with useTina() hook
```

**Server component** (`page.tsx`): Calls `client.queries.xxx()`, destructures `{ query, data, variables }`, passes all three to the client component. Handle errors with `notFound()`.

**Client component** (`client-page.tsx`): Marked `"use client"`. Uses `useTina({ query, data, variables })` for live editing. Add `data-tina-field={tinaField(obj, 'fieldName')}` to every editable element.

### One responsive site

There is no separate mobile tree; every page is a single responsive layout.

### 3D

All WebGL draws on one fixed, pointer-transparent canvas (`components/three/scene-canvas.tsx`) using drei `<View>`, so each 3D element tracks a normal DOM box. Next 15's App Router runs React 19 internally, so react-three-fiber must stay on v9 / drei v10 (v8 crashes) even though package.json lists React 18; the peer warnings are expected.

### TinaCMS Collections

Schema defined in `tina/collection/`. Five collections:

| Collection | Path | Format |
|-----------|------|--------|
| post | `content/posts` | MDX |
| page | `content/pages` | MDX (block-based) |
| author | `content/authors` | MD |
| tag | `content/tags` | MDX |
| global | `content/global` | JSON (header, footer, theme) |

Types are auto-generated in `tina/__generated__/` — never edit these files. Import types like:

```typescript
import { PostQuery, PostQueryVariables } from '@/tina/__generated__/types';
```

### Content Rendering

Use `TinaMarkdown` for rich-text fields, passing the centralized `components` from `@/components/mdx-components`. Code blocks with `lang: 'mermaid'` render as Mermaid diagrams; all others use Shiki syntax highlighting.

### Global Settings

Site-wide config (header nav, footer social links, theme colors, font, dark mode) lives in `content/global/index.json`. Accessed via `LayoutContext` provider in `components/layout/`.

## Coding Standards

- **Formatter/Linter**: Biome — 2-space indent, 160-char line width, single quotes, always semicolons
- **Path alias**: `@/*` maps to project root
- **Node version**: v22 (see `.nvmrc`)
- **Package manager**: pnpm
- **Naming**: Files in kebab-case, components in PascalCase, fields in camelCase
- **Styling**: Tailwind CSS 4 with oklch CSS variables (plaster palette). Light only.

## Key Patterns

### Adding a New Page

1. Create server `page.tsx` that fetches via `client.queries.xxx()`
2. Create `client-page.tsx` with `"use client"`, `useTina()`, and `tinaField()` attributes
3. Always pass `{ query, data, variables }` — all three — from server to client

### Adding a New MDX Component

1. Define the template in the collection schema (`tina/collection/post.tsx` or `page.ts`)
2. Add the renderer in `components/mdx-components.tsx`
3. Type the component props in the `Components<{...}>` generic

### Anti-Patterns

- Never call `client.queries.*()` in client components
- Never use string literals for `data-tina-field` — use `tinaField()` helper
- Never omit `variables` when passing query results to client
- Never edit files in `tina/__generated__/`

## Environment Variables

```
NEXT_PUBLIC_TINA_CLIENT_ID   # TinaCMS project ID
TINA_TOKEN                    # TinaCMS auth token
NEXT_PUBLIC_TINA_BRANCH      # Git branch for content
```

Copy `.env.example` to `.env` and fill in values from [app.tina.io](https://app.tina.io).
