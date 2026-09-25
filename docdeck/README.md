# docdeck

**docdeck turns a folder of Markdown chapters into two things you can hand a
client: a slide deck to present, and a full product document to leave behind.**
Both come out as HTML and PDF, in the project's own colours, fonts and logo.

| You get | What it is |
|---|---|
| `deck.pdf` | 16:9 slides. Every chapter opens with a title slide, then one slide per section. Text is fitted to the slide. |
| `deck.html` | The same slides in a browser. Present with the arrow keys; press **F** for full screen. |
| `book.pdf` | An A4 book (A4 by default, or any page size you set). It has a cover, an index with real page numbers, a running footer, and PDF bookmarks for every chapter and section. |
| `book.html` | The same book as a single web page, with the index linked to each chapter. |

What makes docdeck different from a slide tool:

- **The tables come from the product's code.** Role lists, statuses,
  categories and permissions are read from the project at build time, so the
  document cannot fall behind the product.
- **Screenshots come from the running app.** docdeck signs in and captures
  the screens a chapter asks for, fresh on every build.
- **One source, two lengths.** A chapter can go deep in the book and stay
  brief on the slides.
- **Always the current truth.** You edit chapters in place. `docdeck check`
  rejects commit hashes, pull-request numbers and changelog wording, so the
  client never reads history, only how the product works today.

---

## Contents

1. [A first document in ten minutes](#1-a-first-document-in-ten-minutes)
2. [How a project is laid out](#2-how-a-project-is-laid-out)
3. [Writing chapters](#3-writing-chapters)
4. [Blocks: tables, paths, screens and more](#4-blocks-tables-paths-screens-and-more)
5. [Data providers: tables from your code](#5-data-providers-tables-from-your-code)
6. [Screenshots from the running app](#6-screenshots-from-the-running-app)
7. [Customising the look](#7-customising-the-look)
8. [Backgrounds](#8-backgrounds)
9. [Every setting](#9-every-setting)
10. [Commands](#10-commands)
11. [The Claude Code skill](#11-the-claude-code-skill)
12. [How it works inside](#12-how-it-works-inside)
13. [Troubleshooting](#13-troubleshooting)
14. [Roadmap](#14-roadmap)

---

## 1. A first document in ten minutes

**What you need:** Node 22 and pnpm. The first build also needs Chromium,
which Playwright downloads once.

```bash
# 1. Get the engine (once per machine)
git clone git@github.com:mohittambi/management-tools.git
cd management-tools
pnpm install
npx playwright-core install chromium

# 2. Go to the project you want to document
cd /path/to/your-project

# 3. Create the docs folder. It asks for the name, the logo and the stylesheet with your colours.
node /path/to/management-tools/docdeck/bin/docdeck.mjs init

# 4. Build and open the four files
node /path/to/management-tools/docdeck/bin/docdeck.mjs build --open
```

You now have a two-chapter sample in `docs/client/dist/`. Open
`docs/client/chapters/01-introduction.md`, change the words, and run `build`
again. That is the whole loop.

> **Tip:** add a script to the project's `package.json` so the team runs
> `pnpm docs:build`:
> `"docs:build": "node ../management-tools/docdeck/bin/docdeck.mjs build"`.

---

## 2. How a project is laid out

`init` creates one folder. Nothing is installed in the project itself: the
project's files `import … from "docdeck"`, and the engine answers that import
directly, wherever it lives.

```
docs/client/
  docdeck.config.ts   ← name, logo, colours, fonts, backgrounds, screens (section 9)
  providers.ts        ← data read from your code (section 5)
  GUIDE.md            ← how to write for this client; the skill follows it (section 11)
  package.json        ← { "type": "module" }; leave it as it is
  chapters/
    01-introduction.md
    02-how-it-works.md
  dist/               ← the four outputs (add to .gitignore)
```

**Paths in the config** are relative to `root`, which `init` points at the
project root. So `brand.logo: "public/logo.png"` means `<project>/public/logo.png`.

---

## 3. Writing chapters

A chapter is one Markdown file named `NN-slug.md`. The number sets the order.

```md
---
title: Types of outward             ← the chapter's name, in the index and on slides
summary: Every letter the office sends gets its own number.   ← one line under the title
deck: true                          ← false keeps this chapter out of the slides
book: true                          ← false keeps it out of the book
---

This paragraph, before the first heading, is the chapter's introduction.
In the deck it sits on the chapter's opening slide.

## Two kinds of outward             ← every "##" section is one slide

A short paragraph, then a block.

:::compare left="outward.reply" right="outward.independent"
:::
```

**How the two outputs read a chapter:**

| In the book | In the deck |
|---|---|
| The chapter starts on a new page with its title and summary | An opening slide with the number, title, summary, intro and a list of its sections |
| Every `##` section flows on, page after page | Every `##` section becomes one slide |
| `:::book` blocks are included | `:::book` blocks are left out |
| `:::deck` blocks are left out | `:::deck` blocks are included |

**Deep in the book, brief in the deck.** Wrap detail in `:::book` and give
the slides a short version in `:::deck`. Both can hold whole sections:

```md
:::book
## Every permission
:::table source="access.catalog"
:::
:::

:::deck
## Access in one slide
Three layers: the account, the role, the modules.
:::
```

**Writing rules the check enforces.** No commit hashes, no "commit", "PR #12"
or "changelog", and no leftover TODO. Chapters describe the product as it
is. The cover shows the edition date; that is the only date the client needs.

---

## 4. Blocks: tables, paths, screens and more

A block is fenced with `:::name attributes` on one line and `:::` on another.
**Data blocks** read a value from the providers file by its path, e.g.
`source="inward.path"`. **Content blocks** wrap ordinary Markdown.

| Block | Shows | Example |
|---|---|---|
| `table` | Rows from a provider | `:::table source="roles" caption="Roles"` |
| `matrix` | A yes / no grid (● and –) | `:::matrix source="access"` |
| `flow` | Numbered steps, each with who acts | `:::flow source="inward.path" current="3"` |
| `compare` | Two sides, side by side | `:::compare left="inward" right="outward"` |
| `cards` | A grid of short items, from a provider or a list | `:::cards source="modules"` |
| `stats` | Three or four big figures | `:::stats source="numbers"` |
| `screen` | A screenshot of the running app | `:::screen name="dashboard" caption="The dashboard"` |
| `callout` | A highlighted note | `:::callout tone="attention" title="To confirm"` |
| `decisions` | Numbered questions for the client | see below |
| `columns` | Paragraphs side by side | `:::columns` |
| `book` / `deck` | Content for one output only | section 3 |

**Content blocks, written inline:**

```md
:::cards
- **Nothing is deleted** Closed files stay on record.
- **Everything is recorded** Each step is on the timeline.
:::

:::decisions
### C1 · Who can see confidential files
Today: the Office Admin and the assigned PA.
> Should the OSD see them too?
:::
```

Tones for cards, chips, callouts and steps: `accent`, `accent2`, `attention`,
`muted`. The shape of the data each block expects is in
[skill/reference.md](skill/reference.md).

---

## 5. Data providers: tables from your code

`providers.ts` exports an object. Chapters address its values by dotted path.
A value is data, or a function that returns data (async is fine). **Read the
real thing**: constants, seed data, an API. When the product changes, the
next build changes the tables.

```ts
import { defineProviders } from "docdeck";
import { ROLES } from "../../src/auth/roles";           // the product's own constant

export default defineProviders({
  // :::table source="roles"
  roles: () => ({
    columns: ["Role", "Can do"],
    rows: ROLES.map((r) => [r.label, r.summary]),
  }),

  // :::flow source="order.path"
  order: {
    path: { steps: [{ label: "Placed", who: "Customer" }, { label: "Packed", who: "Warehouse", tone: "accent2" }] },
  },

  // :::stats source="numbers"
  numbers: async () => [{ value: (await countUsers()), label: "active users" }],
});
```

| Block | Provider returns |
|---|---|
| `table`, `matrix` | `{ columns, rows, note? }`, or an array of objects (keys become columns) |
| `flow` | `string[]`, or `{ steps: [{ label, who?, note?, tone? }] }` |
| `compare` | two values, each `{ title, lead?, points: string[], tone? }` |
| `cards` | `[{ title, body?, tag?, points?, tone? }]` |
| `stats` | `[{ value, label, tone? }]` |

**Table cells** can be text (inline Markdown works), numbers, `true`/`false`
(● / –), `null` (–), `{ chip: "Pending", tone: "attention" }` or
`{ code: "INW-2026-000001" }`.

A chapter asking for a provider that does not exist fails `docdeck check`,
naming the chapter.

---

## 6. Screenshots from the running app

Tell docdeck where the app runs, how to sign in, and which screens exist:

```ts
screens: {
  baseUrl: "http://localhost:3000",
  viewport: { width: 1440, height: 900 },
  login: {                                  // the default sign-in
    path: "/login",
    email: "demo@example.com",
    password: "demo-password",
    fields: { email: 'input[name="email"]', password: 'input[name="password"]' },
    submit: 'button[type="submit"]',
  },
  logins: { admin: { path: "/login", email: "admin@example.com", password: "…" } },  // named extras
  shots: {
    dashboard: "/",                                               // a path
    settings: { path: "/settings", as: "admin" },                 // signed in as "admin"
    firstOrder: { path: "/orders", click: "table a", wait: ".order-detail" },  // click, then wait
    longPage: { path: "/reports", fullPage: true },
  },
},
```

Then use them in a chapter: `:::screen name="dashboard" caption="Your dashboard"`.

- Start the app before `docdeck build`. Each build signs in and captures the
  screens the chapters use.
- If the app is not running, or you pass `--no-screens`, the last captures
  are reused from `dist/.screens/`.
- Captures are taken at 2× for sharp PDFs.

---

## 7. Customising the look

docdeck never hard-codes a colour. Every colour in its templates is one of
**eight theme roles**, and the project decides what each role is.

| Role | Used for |
|---|---|
| `paper` | The page and slide ground |
| `ink` | Text |
| `surface` | Cards, tables, the book cover on screen |
| `accent` | The main brand colour: links, the current step, chapter numbers and rules |
| `accent2` | The second brand colour: "the other side" in comparisons, done steps |
| `attention` | Decisions, warnings, "please confirm" |
| `rule` | Hairlines and borders |
| `muted` | Secondary text |

**Option A: point at your stylesheet.** If the project already has design
tokens in CSS, map them:

```ts
theme: {
  css: "src/styles/tokens.css",   // any stylesheet; only plain custom properties are read
  selector: ":root",              // the block that holds them
  map: {
    paper: "--background", ink: "--foreground", surface: "--card",
    accent: "--primary", accent2: "--secondary", attention: "--warning",
    rule: "--border", muted: "--muted-foreground",
  },
},
```

Tailwind files work: nested `@media` and `@theme` blocks are skipped, and
`var(--x)` references are followed.

**Option B: give colours directly.**

```ts
theme: { tokens: { paper: "#fbf8f2", ink: "#1f1a17", accent: "#8a3b2a", accent2: "#2f6b5a" } },
```

Roles you don't set keep a neutral default.

**Fonts.** There are three roles: `display` (titles), `body` (text) and `mono`
(labels and numbers). Give an `@fontsource` package name or your own files.
Fonts are embedded in every output, so PDFs look the same everywhere.

```ts
theme: {
  fonts: {
    display: "@fontsource/playfair-display",             // pnpm add -D it in the project, or in the engine
    body: "@fontsource/inter",
    mono: { family: "Brand Mono", files: { "400": "brand/mono-400.woff2", "600": "brand/mono-600.woff2" } },
  },
},
```

**Logo.**

```ts
brand: {
  logo: "public/logo.png",        // png, jpg, svg or webp
  logoOnDark: "public/logo-white.png",   // used automatically on any dark cover
  mark: "public/mark.svg",        // small square for slide footers
},
```

**Page, footer and words.**

```ts
book: {
  size: "A4",                     // "A4", "Letter", "A5", or "210mm 297mm"
  margin: "24mm 22mm 26mm 22mm",  // top right bottom left; the page colour runs under them
  footer: "{project}  ·  {chapter}  ·  {page} / {pages}",
},
labels: {                         // for a document in another language
  contents: "अनुक्रमणिका", index: "अनुक्रमणिका", chapter: "प्रकरण",
  preparedFor: "यांच्यासाठी", edition: "आवृत्ती",
},
```

**When settings are not enough:**

1. **`styles`**: extra CSS applied last. Use the role variables (`--dd-accent`,
   `--dd-ink`, …) so it follows the theme.
   ```ts
   styles: ["docs/client/brand.css"],
   ```
   ```css
   .dd-slide h2 { letter-spacing: -0.02em; }
   .dd-table-wrap th { background: var(--dd-accent); color: var(--dd-paper); }
   ```
2. **`templates`**: to change the structure of the cover, the index or the
   slides, copy the engine's `templates/` folder into the project, point
   `templates` at it, and edit. Files you don't copy keep the engine's version.

---

## 8. Backgrounds

Every surface can have its own background:

| Surface | What it covers | Default |
|---|---|---|
| `page` | Every page of the book, edge to edge, under the margins | `"paper"` |
| `cover` | The book's cover page | `"paper"` |
| `slide` | Every slide | `"paper"` |
| `deckCover` | The first slide | `"ink"` (dark) |
| `chapter` | Each chapter's opening slide | `"paper"` |

A background is written in one of four ways.

**1. A theme role or a colour**

```ts
background: { deckCover: "accent", chapter: "#12303f" },
```

**2. A gradient** (any CSS gradient)

```ts
background: {
  deckCover: "linear-gradient(135deg, #1c2127 0%, #1c2127 45%, #2b5d8a 100%)",
},
```

**3. An image**, cover-fitted by default, with an optional overlay to keep
text readable

```ts
background: {
  deckCover: { image: "brand/city.jpg", overlay: "rgba(10, 20, 30, 0.6)" },
  cover:     { image: "brand/cover.png", size: "cover", position: "top center" },
},
```

**4. A pattern**, an image tiled across the surface

```ts
background: {
  page: { color: "paper", image: "brand/dots.svg", size: "24px", repeat: "repeat" },
},
```

All the options for the object form:

| Option | Meaning | Default |
|---|---|---|
| `color` | A theme role or CSS colour under everything | none |
| `gradient` | A CSS gradient | none |
| `image` | An image file (png, jpg, svg, webp), embedded | none |
| `size` | `cover`, `contain`, `auto`, or a size like `24px` | `cover` |
| `position` | Where the image sits, e.g. `center`, `top right` | `center` |
| `repeat` | `no-repeat`, `repeat`, `repeat-x`, `repeat-y` | `no-repeat` |
| `overlay` | A colour laid over the image or gradient, e.g. `rgba(0,0,0,.5)` | none |
| `text` | `auto`, `light` or `dark` | `auto` |

**Text follows the background.** With `text: "auto"`, docdeck measures the
overlay, then the colour, then the gradient's first colour. On a dark ground
it switches text, rules, cards and chips to light versions, and it picks
`brand.logoOnDark` for a dark cover. For a photo with no overlay it cannot
tell, so say `text: "light"` or `"dark"`.

**Recipes**

```ts
// A dark deck, light book
background: { slide: "ink", chapter: "accent", deckCover: "ink" },

// A branded book cover and a quiet page texture
background: {
  cover: { gradient: "linear-gradient(160deg, #0f2a44, #2b5d8a)" },
  page:  { color: "paper", image: "brand/grain.png", size: "400px", repeat: "repeat" },
},

// A photo cover with the title kept readable
background: { deckCover: { image: "brand/hero.jpg", overlay: "rgba(0,0,0,0.55)", text: "light" } },
```

> Keep page backgrounds quiet. Text sits on them for dozens of pages; save
> photos and strong gradients for covers and chapter openers.

---

## 9. Every setting

All in `docdeck.config.ts`. Only `project.name`, `brand.logo` and `chapters`
are required.

| Setting | What it changes | Default |
|---|---|---|
| `root` | Where the paths below start, relative to the config file | the folder you run from |
| `project.name` | Name on the cover, footer and slides | required |
| `project.title` | The document's title, e.g. "Product walkthrough" | `"Product overview"` |
| `project.tagline` | One line under the title | `""` |
| `project.audience` | "Prepared for …" on the cover | `""` |
| `project.edition` | The date on the cover; `"auto"` is the build date | `"auto"` |
| `brand.logo` / `logoOnDark` / `mark` | Logos (section 7) | `logo` required |
| `theme.css` / `selector` / `map` / `tokens` | Colours (section 7) | neutral palette |
| `theme.fonts.display` / `body` / `mono` | Fonts (section 7) | Source Serif 4, Geist, Geist Mono |
| `background.page` / `cover` / `slide` / `deckCover` / `chapter` | Backgrounds (section 8) | see section 8 |
| `styles` | Extra CSS files, applied last | `[]` |
| `templates` | Folder of replacement templates | the engine's |
| `book.size` / `margin` / `footer` | The printed book (section 7) | A4, 24/22/26/22 mm, `"{project}  ·  {chapter}"` |
| `labels` | Words the templates print | English |
| `chapters` | The chapters folder | required |
| `providers` | The providers file | none |
| `screens` | Screenshot capture (section 6) | none |
| `outputs` | `["deck", "book"]`, or just one | both |
| `out` | Output folder | `docs/client/dist` |

---

## 10. Commands

Run from the project root. `-c <file>` points at a config that is not in
`./docdeck.config.ts` or `./docs/client/docdeck.config.ts`.

| Command | Does |
|---|---|
| `docdeck init` | Creates `docs/client/` with a config, providers, a guide and two sample chapters. `--name`, `--logo`, `--css` and `--yes` skip the questions. |
| `docdeck check` | Lints the chapters, checks every provider and screen, and lays out every slide to find ones that don't fit. Exits non-zero on errors, so it works in CI. |
| `docdeck build` | Writes the four files. `--deck` or `--book` for one; `--no-pdf` for HTML only; `--no-screens` to reuse the last captures; `--open` to open the results. |
| `docdeck preview` | Serves the HTML on `http://localhost:4777` and rebuilds on every save. |
| `docdeck install-skill` | Installs the Claude Code skill: for you (`~/.claude/skills`), or `--project` for this project only. |

---

## 11. The Claude Code skill

`client-docs` lets you ask for the document in plain words, for example
"prepare the client deck", "refine the outward chapter" or "add a chapter on
reports". Claude then:

1. reads the config and the project's `GUIDE.md`;
2. checks the code for facts, never working from memory;
3. edits only the chapters the request touches, in client language, with
   tables as blocks;
4. runs `docdeck check`, fixes what it reports, then `docdeck build`;
5. tells you where the files are, and anything where the code and the spec
   disagree.

**Install it once for all your projects:**

```bash
node /path/to/management-tools/docdeck/bin/docdeck.mjs install-skill
```

**Customise it for one project.** There are two ways; start with the first.

1. **`docs/client/GUIDE.md`** (`init` creates one). The skill reads it before
   writing and follows it over its own defaults. Write down:
   - who reads the document;
   - words to use, and words never to use;
   - the chapter order;
   - what stays out of the deck;
   - where the facts live in the code.

   Keep it with the project so everyone gets the same result.
2. **A project copy of the skill**, when you need different steps:

   ```bash
   cd your-project
   node /path/to/management-tools/docdeck/bin/docdeck.mjs install-skill --project
   # edit .claude/skills/client-docs/SKILL.md
   ```

   Claude Code uses the project's copy instead of the shared one. Keep it in
   the project's repository.

After updating the engine, run `install-skill` again, plus `--project` for
projects that keep their own copy. Then re-apply the project's edits.

---

## 12. How it works inside

```
config + providers ──► chapters ──► blocks resolved ──► HTML (Nunjucks) ──► Chromium ──► PDF ──► pdf-lib
     (tsx)             (book / deck      (data, screens)     fonts, logo,       layout,      footers,
                        split)                               images inlined     fit check    metadata
```

1. **Load.** The config and providers are TypeScript, loaded with tsx. A resolve
   hook (`bin/resolve.mjs`) maps `"docdeck"` to the engine.
2. **Split.** Each chapter is read twice: once for the book, once for the
   deck (`:::book` / `:::deck`).
3. **Data.** Every `source="…"` is resolved once per build. Screens are
   captured with Playwright and cached.
4. **HTML.** Markdown and blocks render through Nunjucks templates. Fonts,
   logos, backgrounds and screens are inlined, so each HTML file stands alone.
5. **Deck.** Chromium lays out every 1600×900 slide and shrinks text a
   little if needed. A slide that still overflows fails `check`.
6. **Book.** Each part is printed alone to count its pages. The index is
   filled in with the real page numbers. The whole book is printed once, so
   Chromium writes the bookmarks. pdf-lib stamps the running footer.

| Path | What |
|---|---|
| `bin/docdeck.mjs`, `bin/resolve.mjs` | Entry point; `"docdeck"` import resolution |
| `src/cli.ts` | Commands |
| `src/config.ts` | The config schema |
| `src/theme.ts` | Colours from CSS, embedded fonts |
| `src/background.ts` | Backgrounds and text on dark grounds |
| `src/content.ts` | Chapters, sections, book/deck split, lint |
| `src/markdown.ts`, `src/blocks/` | Markdown and blocks |
| `src/providers.ts` | Project data |
| `src/screens.ts` | App screenshots |
| `src/render.ts`, `templates/`, `styles/` | HTML |
| `src/pdf.ts` | PDF: page counts, index, bookmarks, footers |
| `skill/` | The Claude Code skill |
| `../docs/` | docdeck's own deck and book, built with docdeck |

Tests: `pnpm --filter docdeck test`. They cover the parts, then build a
fixture project with real Chromium.

---

## 13. Troubleshooting

| You see | Do this |
|---|---|
| `Could not start Chromium for PDF output` | Run `npx playwright-core install chromium` once. |
| `No docdeck config found` | Run from the project root, or pass `-c path/to/docdeck.config.ts`. |
| `request for './config.ts' is from a module not been linked` | The chapters folder's parent is missing `package.json` with `"type": "module"`. `init` writes it; add it by hand if you moved the folder. |
| `No provider for "x"` | The chapter asks for `source="x"`; add `x` to `providers.ts` or fix the name. |
| `slide 12 (…) does not fit` | That section is too long for one slide. Split it into two `##` sections, or move detail into `:::book`. |
| `theme.map.accent points at --primary, which … does not declare` | The token isn't in a plain `selector { }` block of that stylesheet. Check the selector, or use `theme.tokens`. |
| `Font package … is not installed` | `pnpm add -D @fontsource/<name>` in the project (or the engine). |
| `background image not found` | Image paths are relative to `root`, like every other path. |
| Screens are placeholders | The app wasn't reachable at `screens.baseUrl`. Start it, then build. |
| Text is hard to read on a photo background | Add an `overlay`, or set `text: "light"` / `"dark"`. |
| `looks like a commit hash` on a real word | Put the word in backticks, or rephrase. |

---

## 14. Roadmap

These are planned, in rough order of value. Every new setting gets a row in
section 9 and a line in `skill/reference.md`.

| # | Enhancement | Why |
|---|---|---|
| 1 | **Publish to npm** (`npx docdeck`) | Any project runs it without cloning this repo |
| 2 | **Build in CI** (a GitHub Action) | Every push rebuilds a project's PDFs and attaches them to the run |
| 3 | **Speaker notes** (`:::notes`) and a presenter view with a timer | Present from `deck.html` without a separate script |
| 4 | **More languages**: `lang` per chapter set, Devanagari and other scripts in the footer font, bilingual builds | Marathi and Hindi documents from the same chapters |
| 5 | **Diagram block** (Mermaid rendered to SVG) | Simple flows without screenshots |
| 6 | **Chart block** (bar and line from provider data) | Figures such as files per month |
| 7 | **Annotated screens**: highlight or number regions, mobile viewport shots | Point at the part of a screen being described |
| 8 | **Theme presets** (`theme: "ink"`, `"paper"`, `"slate"`) | A good look for projects without design tokens |
| 9 | **PowerPoint export** | For clients who must edit slides |
| 10 | **Glossary and figure list**, generated | Long documents stay navigable |
| 11 | **Edition summary**: a generated "what's new in this edition" page | Tells a returning reader what changed, without commit history |
