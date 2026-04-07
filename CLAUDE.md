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
  layout.tsx                          # Root layout, wraps everything in LayoutContext
  page.tsx                            # Home page (server) — fetches page query
  home-client-page.tsx                # Home page (client, desktop) — useTina + scroll orchestration
  mobile-home-client-page.tsx         # Home page (client, mobile) — useTina + mobile layout
  not-found.tsx                       # 404 page
  manifest.ts                         # PWA manifest
  posts/[...urlSegments]/
    page.tsx                          # Post page (server) — fetches post query
    client-page.tsx                   # Post page (client, desktop)
    mobile-client-page.tsx            # Post page (client, mobile)

components/
  blocks/                             # Page-level block components
    index.tsx                         # Block registry — maps block types to components
    home-scroll-stage.tsx             # Desktop home scroll orchestrator (GSAP ScrollTrigger)
    topo-hero.tsx                     # Desktop hero with 3D tilt + frame animation
    recent-posts-slider.tsx           # Post card slider
    blog-archive.tsx                  # Archive listing
    mermaid.tsx                       # Mermaid diagram block
    video.tsx                         # Video embed block
  mobile/                             # Mobile-specific components
    mobile-home.tsx                   # Mobile home page shell
    mobile-hero.tsx                   # Mobile hero component
    mobile-card.tsx                   # Single post card (mobile)
    mobile-card-stack.tsx             # Stacked card layout
    mobile-post-reader.tsx            # Mobile post reading view
    reading-bucket.tsx                # Read-later bucket UI
    reading-queue.tsx                 # Reading queue management
    filigree-transitions.tsx          # Mobile page transition animations
    baroque-loading.tsx               # Mobile loading skeleton
  layout/
    layout.tsx                        # Site shell (header + content + footer)
    layout-context.tsx                # LayoutContext provider (global settings)
    section.tsx                       # Section wrapper
    nav/header.tsx                    # Site header + nav
    nav/footer.tsx                    # Site footer
  ui/                                 # shadcn/ui + custom UI primitives
    avatar.tsx, button.tsx, card.tsx  # Standard shadcn components
    tilt.tsx                          # 3D tilt effect wrapper
    halide-topo-hero.tsx              # Topographic background SVG
    full-screen-scroll-fx.tsx         # Scroll-driven fullscreen effect
    argent-loop-infinite-slider.tsx   # Infinite horizontal slider
    progressive-blur.tsx              # Blur gradient overlay
    spotlight.tsx                     # Cursor spotlight effect
    breakpoint-indicator.tsx          # Dev-only breakpoint label
  mdx-components.tsx                  # MDX renderers (code blocks, blockquotes, mermaid, video)
  mermaid-renderer.tsx                # Client-side mermaid rendering
  error-boundary.tsx                  # React error boundary
  icon.tsx                            # Icon component
  raw-renderer.tsx                    # Raw HTML renderer
  social-footer.tsx                   # Social links footer
  shared/theme.ts                     # Theme utilities

content/                              # CMS-managed content (TinaCMS edits these)
  posts/*.mdx                         # Blog posts (MDX)
  posts/june/*.mdx                    # Posts in subdirectories
  pages/home.mdx                      # Home page block definitions
  authors/*.md                        # Author profiles
  tags/*.mdx                          # Tag definitions
  global/index.json                   # Site-wide config (header, footer, theme)

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

lib/utils.ts                          # Utility functions (cn, etc.)
middleware.ts                         # Next.js middleware
styles.css                           # Global styles (Tailwind CSS 4)
next.config.ts                        # Next.js config
biome.json                            # Biome linter/formatter config
```

## Where to Look

| Task | Start here |
|------|-----------|
| Change post rendering/layout | `app/posts/[...urlSegments]/client-page.tsx` (desktop), `mobile-client-page.tsx` (mobile) |
| Change home page layout | `app/home-client-page.tsx` (desktop), `app/mobile-home-client-page.tsx` (mobile) |
| Edit desktop scroll/hero animation | `components/blocks/home-scroll-stage.tsx`, `components/blocks/topo-hero.tsx` |
| Edit mobile experience | `components/mobile/` directory |
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
app/posts/[...urlSegments]/
  page.tsx           # Server component — fetches data via client.queries.xxx()
  client-page.tsx    # Client component — renders with useTina() hook
```

**Server component** (`page.tsx`): Calls `client.queries.xxx()`, destructures `{ query, data, variables }`, passes all three to the client component. Handle errors with `notFound()`.

**Client component** (`client-page.tsx`): Marked `"use client"`. Uses `useTina({ query, data, variables })` for live editing. Add `data-tina-field={tinaField(obj, 'fieldName')}` to every editable element.

### Desktop/Mobile Split

The home page and post pages each have separate desktop and mobile client components. The server `page.tsx` passes data to both; the client components handle their own responsive concerns.

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
- **Styling**: Tailwind CSS 4 with oklch CSS variables for theming. Dark mode supported (system/light/dark).

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
