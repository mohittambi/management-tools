---
title: Setting up a project
summary: One command adds a docs folder; nothing is installed in the project.
---

## One command

Run `docdeck init` in the project. It asks for the project's name, its logo and the stylesheet that holds its colour tokens, and creates a small folder:

:::table source="projectFiles"
:::

## Nothing to install

The engine lives in its own repository. The project's config imports `docdeck`, and the engine answers that import itself, so the project's dependencies stay untouched. A project wraps the command in a script, for example `pnpm docs:build`.

:::book
## Commands

| Command | Does |
|---|---|
| `docdeck init` | Creates the docs folder |
| `docdeck check` | Lints chapters, checks providers and screens, and fits every slide |
| `docdeck build` | Writes the four files; `--open` opens them, `--no-screens` reuses the last screenshots |
| `docdeck preview` | Serves the HTML and rebuilds on every save |
| `docdeck install-skill` | Installs the Claude Code skill, for the user or with `--project` for one project |
:::
