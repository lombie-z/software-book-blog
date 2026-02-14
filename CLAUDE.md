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

- `http://localhost:3000` — Website
- `http://localhost:3000/admin` — TinaCMS visual editor
- `http://localhost:4001/altair/` — GraphQL playground

## Architecture

**TinaCMS + Next.js 15 App Router** blog with server/client split pattern for visual editing.

### Server/Client Split (Core Pattern)

Every page follows this structure:

```
app/posts/[...urlSegments]/
├── page.tsx           # Server component — fetches data via client.queries.xxx()
└── client-page.tsx    # Client component — renders with useTina() hook
```

**Server component** (`page.tsx`): Calls `client.queries.xxx()`, destructures `{ query, data, variables }`, passes all three to the client component. Handle errors with `notFound()`.

**Client component** (`client-page.tsx`): Marked `"use client"`. Uses `useTina({ query, data, variables })` for live editing. Add `data-tina-field={tinaField(obj, 'fieldName')}` to every editable element.

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

### Key Directories

- `components/blocks/` — Page block components (hero, features, stats, CTA, etc.)
- `components/ui/` — shadcn/ui components
- `components/layout/` — Header, footer, section wrappers
- `components/mdx-components.tsx` — Custom MDX renderers (code blocks, blockquotes, mermaid diagrams, video)
- `content/` — All CMS-managed content files
- `tina/config.tsx` — Main TinaCMS configuration

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
