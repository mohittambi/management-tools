---
title: The Claude Code skill
summary: Ask for the client deck in plain words; the skill writes the chapters and runs the engine.
---

## What the skill does

:::flow source="skillLoop"
:::

## Shaped to each project

A project's `GUIDE.md` tells the skill who reads the document, which words to use, the chapter order and where the facts live in the code. For deeper changes, a project installs its own copy of the skill and edits its steps; that copy wins over the shared one.

:::book
## Installing

- For every project: `docdeck install-skill` puts it in `~/.claude/skills/client-docs`.
- For one project: `docdeck install-skill --project` puts an editable copy in `.claude/skills/client-docs`, kept in the project's repository.
- After pulling a new engine, run the install again.
:::
