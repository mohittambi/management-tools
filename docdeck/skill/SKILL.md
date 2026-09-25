---
name: client-docs
description: Create or update a project's client deck (16:9) and product document (A4) as HTML and PDF with the docdeck engine, using the project's own theme, logo, live data tables and app screenshots. Use when the user asks for a client deck, a demo deck, a product walkthrough, a system overview for a client, "the client docs", or to add, refine or update a chapter (e.g. user management, types of inward/outward, dashboard). Not for engineering docs (HLD, LLD, ADR) or architecture diagrams.
---

# client-docs

You drive **docdeck**, a local engine that turns Markdown chapters plus live
project data into four files: `deck.html`, `deck.pdf`, `book.html`, `book.pdf`.
The engine does the layout, theme, cover, index and page numbers. Your job is
the chapters: accurate, plain, written for a client.

## 1. Find the engine and the project

Run commands from the project root.

- Engine command, in this order: `pnpm exec docdeck`, `npx docdeck`, or
  `node __DOCDECK_BIN__`. Call it `DOCDECK` below.
- Config: `docdeck.config.ts` or `docs/client/docdeck.config.ts`. Read it: it
  names the chapters folder, the providers file, the theme source, the logo
  and the screens the app can capture.
- **Project guide:** if a `GUIDE.md` sits next to the config, read it before
  writing anything. It holds this project's audience, words to use and avoid,
  chapter order and anything else specific to it, and it overrides the
  defaults below wherever they differ.
- No config yet: run `DOCDECK init --name "<Project>" --logo <path> --css <stylesheet>`
  after asking the user only for what you cannot find yourself (look for a
  logo under `public/`, and a stylesheet that declares colour tokens in
  `:root`). Then map the theme roles in the config to the project's tokens.

## 2. Decide which chapters change

Map the request to chapter files in the chapters folder:

- "prepare the client deck" → check every chapter against the code.
- "refine outward" / "update user management" → only that chapter.
- "add a chapter on X" → a new `NN-slug.md`; renumber file prefixes only if
  the order must change.

Read the relevant code before writing: domain constants, status machines,
permissions, seed data, the screens. Never describe a feature from memory.

## 3. Write the chapters

Each chapter is one Markdown file:

```md
---
title: Types of outward
summary: One sentence the client will remember.
---

Intro paragraph (on the deck it sits on the chapter's opening slide).

## A section heading       ← one slide in the deck
Short prose, then a block.
```

Rules:

- **Current truth only.** Edit the chapter in place. No commit ids, PR
  numbers, "changelog", "v2 adds", "previously", dates of changes. The cover
  carries the edition date; that is the only date. `check` fails on commit
  hashes and changelog wording.
- **Client language.** Name things the way the office sees them on screen.
  No table names, file paths, function names or internal codes in prose.
- **Data from the system goes in a block, not typed by hand.** If a table
  lists roles, categories, statuses, templates or permissions, it comes from a
  provider. Add the provider to the providers file (read the real constants or
  seed data there) and reference it: `:::table source="roles"`.
- **One idea per section.** A `##` section is one slide: a short paragraph
  plus at most one or two blocks. If `check` says a slide does not fit, split
  the section.
- **Open questions are decisions, not footnotes.** Put anything the client
  must decide in the decisions chapter with a `:::decisions` block.
- **Contradictions are reported.** If the code disagrees with the spec or an
  earlier chapter, write what the code does and tell the user.

The block reference is in [reference.md](reference.md).

## 4. Check, build, report

```bash
DOCDECK check          # lint, providers, screens, slide fit
DOCDECK build          # all four files; add --no-screens if the app is not running
```

Fix everything `check` reports before building. Screens are captured from the
running app (the config has the URL and login); if it is not running, build
with `--no-screens` and the last captured screens are reused.

Finish by telling the user, briefly:

- the output paths (`<out>/deck.pdf`, `<out>/book.pdf`, and the two HTML files),
- which chapters you created or changed,
- any facts where the code and the spec disagree.

Use `DOCDECK preview` when the user wants to watch the pages while editing.
