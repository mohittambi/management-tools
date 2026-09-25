# docdeck

Builds a client **deck** (16:9) and a product **document** (A4 book) as HTML
and PDF, in a project's own theme, logo and fonts.

- Chapters are plain Markdown.
- Tables come from the project's own code through data providers.
- Screenshots are taken from the running app.
- The book gets a cover, an index with page numbers, running footers and PDF
  bookmarks.
- The deck gets one slide per section, fitted to the slide.
- Chapters are edited in place. `check` rejects commit hashes and changelog
  wording, so the document always reads as the current state.

```
docdeck init            scaffold docs/client in a project
docdeck check           lint chapters, providers, screens, slide fit
docdeck build [--open]  deck.html  deck.pdf  book.html  book.pdf
docdeck preview         live-reloading preview while editing
docdeck install-skill   install the client-docs skill for Claude Code
```

## Contents

1. [Quick start](#quick-start)
2. [Use it in a project](#use-it-in-a-project)
3. [Customise it](#customise-it)
4. [Write chapters](#write-chapters)
5. [Data providers](#data-providers)
6. [The Claude Code skill](#the-claude-code-skill)
7. [How it works](#how-it-works)
8. [Roadmap](#roadmap)

## Quick start

```bash
cd management-tools && pnpm install
npx playwright-core install chromium     # once: PDF output and screenshots
cd /path/to/your-project
node /path/to/management-tools/docdeck/bin/docdeck.mjs init
node /path/to/management-tools/docdeck/bin/docdeck.mjs build --open
```

## Use it in a project

Nothing needs installing in the project. Run the engine from wherever it lives.
The project's `import … from "docdeck"` resolves to the engine itself through a
resolve hook (`bin/resolve.mjs`).

`init` creates this in the project:

```
docs/client/
  docdeck.config.ts   name, logo, theme, chapters, screens
  providers.ts        data read from the project's code
  GUIDE.md            writing guide the skill follows for this project
  package.json        { "type": "module" }, so the config loads as ESM
  chapters/01-….md    one file per chapter
```

Wrap the command in a project script so the team runs `pnpm docs:build`.
CONNECT does this with a small locator, `scripts/docdeck.mjs`. It finds the
engine through `DOCDECK_HOME`, or next to the repo.

## Customise it

All customisation lives in the project's `docdeck.config.ts`. Paths are
relative to `root`.

| Key | What it changes | Default |
|---|---|---|
| `project.name` / `title` / `tagline` / `audience` | Cover, footer, deck title | `title: "Product overview"` |
| `project.edition` | The date on the cover. `"auto"` uses the build date | `"auto"` |
| `brand.logo` | Cover and deck footer image (png, jpg, svg, webp) | required |
| `brand.logoOnDark` | Logo for the dark deck cover | the logo |
| `brand.mark` | Small square mark for slide footers | the logo |
| `theme.css` + `theme.selector` | Stylesheet and selector whose custom properties hold the colours | none |
| `theme.map` | Engine role → project token, e.g. `accent: "--primary"` | neutral palette |
| `theme.tokens` | Engine role → literal colour, when there is no stylesheet | — |
| `theme.fonts.display/body/mono` | A `@fontsource/*` package, or `{ family, files: { "400": "path.woff2" } }` | Source Serif 4, Geist, Geist Mono |
| `styles` | Extra CSS files applied last. Use the `--dd-*` variables | `[]` |
| `templates` | A folder of `.njk` files that replace the engine's (`book.njk`, `deck.njk`, `macros.njk`) | engine templates |
| `book.size` | Page size | `"A4"` |
| `book.margin` | Page margins. The page colour runs under them to the edge | `"24mm 22mm 26mm 22mm"` |
| `book.footer` | Footer pattern with `{project}` `{chapter}` `{page}` `{pages}` | `"{project}  ·  {chapter}"` |
| `labels` | "Contents", "Index", "Chapter", "Prepared for", "Edition", for other languages | English |
| `screens.baseUrl` / `login` / `logins` / `shots` | Screenshot capture from the running app | none |
| `outputs` | `["deck", "book"]`, or one of them | both |
| `out` | Output folder | `docs/client/dist` |

**Theme roles.** Every colour in the templates is one of eight roles:

| Role | Used for |
|---|---|
| `paper` | Page ground |
| `ink` | Text |
| `surface` | Cards and tables |
| `accent` | Primary brand colour: links, current step, chapter rules |
| `accent2` | Second brand colour: the "other side" in comparisons |
| `attention` | Decisions and warnings |
| `rule` | Hairlines |
| `muted` | Secondary text |

Map the project's tokens onto these roles and the whole document takes its
theme.

**Going further.** A project can change the look without touching the engine,
in three steps:

1. `styles` for small changes: spacing, a heavier heading, a different table rule.
2. `templates` to change the structure of the cover, index or slides. Copy the
   engine's `templates/` folder and edit.
3. Blocks and providers for new kinds of content. A new block type is an engine
   change; see the roadmap.

## Write chapters

```md
---
title: Types of outward
summary: One sentence the client remembers.
deck: true          # false: book only
book: true          # false: deck only
---

Intro paragraph. On the deck it sits on the chapter's opening slide.

## A section          ← one slide in the deck, a heading in the book
Short prose, then a block.

:::table source="outward.templates"
:::

:::book
## Detail only the book needs
…
:::

:::deck
## The same idea, in one slide
…
:::
```

Blocks: `table`, `matrix`, `flow`, `compare`, `cards`, `stats`, `callout`,
`decisions`, `columns`, `screen`, `book`, `deck`. The full reference, with the
data each block expects, is in [skill/reference.md](skill/reference.md).

## Data providers

`providers.ts` default-exports an object. Chapters address its values by dotted
path. Values are data, or functions returning data (async is fine). Read the
project's real constants, seed data or API, so the document cannot drift from
the product.

```ts
import { defineProviders } from "docdeck";
import { ROLES } from "../../src/roles";

export default defineProviders({
  roles: () => ({ columns: ["Role", "Can do"], rows: ROLES.map((r) => [r.label, r.summary]) }),
  journey: ["Received", "Reviewed", "Done"],
});
```

## The Claude Code skill

`client-docs` drives the whole loop. It:

1. reads the config and the project's `GUIDE.md`;
2. checks the code for facts;
3. edits only the chapters the request touches;
4. runs `check`, then `build`;
5. reports the outputs, and any place where the code and the spec disagree.

**Install once for every project:**

```bash
node docdeck/bin/docdeck.mjs install-skill          # → ~/.claude/skills/client-docs
```

Then invoke `/client-docs` in any project with a docdeck config.

**Customise it for one project.** There are two ways, lightest first.

1. **Write `docs/client/GUIDE.md`** (`init` creates one). The skill reads it
   before writing and follows it over its own defaults. Put in it:
   - the audience;
   - the words to use and avoid;
   - the chapter order;
   - what stays out of the deck;
   - where the facts live in the code.

   This covers most needs, and the file is committed with the project.
2. **Install a project copy of the skill:**

   ```bash
   cd your-project
   node /path/to/docdeck/bin/docdeck.mjs install-skill --project   # → ./.claude/skills/client-docs
   ```

   Edit `.claude/skills/client-docs/SKILL.md`: change the steps, add
   project-only checks, rename it. Claude Code prefers the project's skill
   over the user-level one. Commit it so the whole team gets the same
   behaviour.

To update the skill after pulling a new engine, run `install-skill` again (and
`--project`, if the project keeps its own copy, then re-apply its edits).

## How it works

1. **Load.** The config and providers are loaded through tsx, and `"docdeck"`
   resolves to the engine.
2. **Content.** Chapters are read and split for each output (`:::book` /
   `:::deck`).
3. **Data.** Every `source="…"` a chapter asks for is resolved once.
4. **Screens.** Each shot is captured with Playwright after signing in, and
   cached in `<out>/.screens`.
5. **Render.** Markdown and blocks become HTML through Nunjucks templates.
   Fonts, logo and screens are inlined, so every HTML file stands alone.
6. **Deck.** Chromium lays out each 1600×900 slide and shrinks text to fit,
   down to a floor. `check` fails on any slide that still overflows.
7. **Book.**
   1. Each part is printed on its own to count its pages.
   2. The index is filled with real page numbers.
   3. The whole book is printed once, so Chromium writes the bookmarks.
   4. pdf-lib stamps the running footer.

| Path | What |
|---|---|
| `bin/docdeck.mjs`, `bin/resolve.mjs` | entry point; `"docdeck"` import resolution |
| `src/cli.ts` | commands |
| `src/config.ts` | config schema |
| `src/theme.ts` | tokens from CSS, embedded fonts |
| `src/content.ts` | chapters, sections, book/deck split, lint |
| `src/markdown.ts`, `src/blocks/` | Markdown and blocks |
| `src/providers.ts` | project data |
| `src/screens.ts` | app screenshots |
| `src/render.ts`, `templates/`, `styles/` | HTML |
| `src/pdf.ts` | PDF: page counts, index, bookmarks, footers |
| `skill/` | the Claude Code skill |
| `docs/` (repo root) | docdeck's own deck and book, built with docdeck |

Tests: `pnpm --filter docdeck test`. They build a fixture project with real
Chromium.

## Roadmap

These are the planned enhancements, in rough order of value.

| # | Enhancement | Why |
|---|---|---|
| 1 | **Publish to npm** (`npx docdeck`) | Any project runs it without cloning this repo |
| 2 | **Build in CI** (a GitHub Action) | Every push to a project rebuilds its PDFs and attaches them to the run |
| 3 | **Speaker notes** (`:::notes`) and a presenter view with a timer | Present from `deck.html` without a separate script |
| 4 | **More languages**: `lang` per chapter set, Devanagari and other scripts in the footer font, bilingual builds | Marathi / Hindi client documents from the same chapters |
| 5 | **Diagram block** (Mermaid rendered to SVG at build) | Simple flows without screenshots |
| 6 | **Chart block** (bar/line from provider data) | Figures such as files per month, or response times |
| 7 | **Annotated screens**: highlight or number regions, mobile viewport shots | Point at the part of a screen being described |
| 8 | **Theme presets** (`theme: "ink"`, `"paper"`, `"slate"`) | A good look for projects with no design tokens |
| 9 | **PowerPoint export** of the deck | For clients who must edit slides |
| 10 | **Glossary and figure list**, generated | Long documents stay navigable |
| 11 | **Edition summary**: a generated "what is new in this edition" page, from the chapters that changed | Tells a returning reader what changed, without commit history |

Changes to the engine go through `pnpm test`. Every new config key gets a row
in the customisation table above and a line in `skill/reference.md`.
