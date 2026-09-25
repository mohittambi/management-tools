# docdeck

Builds a client **deck** (16:9) and a product **document** (A4) as HTML and
PDF from Markdown chapters, in the project's own theme, logo and fonts. Tables
come from the project's code through data providers, and screenshots come from
the running app.

```
docdeck init            scaffold docs/client in a project
docdeck check           lint chapters, providers, screens, slide fit
docdeck build           deck.html  deck.pdf  book.html  book.pdf
docdeck preview         live-reloading preview while editing
docdeck install-skill   install the client-docs skill for Claude Code
```

## Use it in another project

Nothing needs installing in the project. Run the engine from wherever it
lives. A project's `import … from "docdeck"` resolves to the engine itself.

```bash
node /path/to/management-tools/docdeck/bin/docdeck.mjs init
node /path/to/management-tools/docdeck/bin/docdeck.mjs build --open
```

A project can wrap this in its own script, so its team runs `pnpm docs:build`.

PDF output uses Chromium through Playwright. If it is missing, run
`npx playwright-core install chromium` once.

## How a project plugs in

- **`docdeck.config.ts`** holds the project name, logo, theme and chapters
  folder. The theme maps the project's CSS tokens onto the engine's roles:
  `paper`, `ink`, `surface`, `accent`, `accent2`, `attention`, `rule`, `muted`.
  Templates and styles use only those roles.
- **`providers.ts`** holds the data the chapters show. Read it from the code
  so the document never drifts from the product.
- **`chapters/NN-slug.md`** are the chapters, one per file. Each `##` section
  is one slide.

The block syntax is in [skill/reference.md](skill/reference.md). The writing
rules are in [skill/SKILL.md](skill/SKILL.md). Chapters describe the current
state only, and `check` rejects commit hashes and changelog wording.

## Layout

| Path | What |
|---|---|
| `src/cli.ts` | commands |
| `src/config.ts` | config schema |
| `src/theme.ts` | tokens from CSS, embedded fonts |
| `src/content.ts` | chapters, sections, lint |
| `src/markdown.ts`, `src/blocks/` | Markdown and blocks |
| `src/providers.ts` | project data |
| `bin/resolve.mjs` | resolves `"docdeck"` imports to this engine |
| `src/screens.ts` | app screenshots |
| `src/render.ts`, `templates/`, `styles/` | HTML |
| `src/pdf.ts` | PDF: page numbers, index, bookmarks, footers |
| `skill/` | the Claude Code skill |

Tests: `pnpm --filter docdeck test`. These build a fixture project with real
Chromium.
