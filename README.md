# management-tools

Tools for presenting and managing client projects. Each tool lives in its own
folder and works with any project.

| Tool | What it does |
|---|---|
| [docdeck](docdeck/) | Builds a client **deck** (16:9) and a product **document** (A4) as HTML and PDF. Uses the project's own theme, logo and fonts, tables read from the project's code, and screenshots of the running app. Comes with a Claude Code skill, `client-docs`. |

## Setup

```bash
git clone git@github.com:mohittambi/management-tools.git
cd management-tools
pnpm install
npx playwright-core install chromium      # once, for PDF output and screenshots
node docdeck/bin/docdeck.mjs install-skill  # adds /client-docs to Claude Code
```

## Use docdeck in a project

Run these from the project's root:

```bash
node /path/to/management-tools/docdeck/bin/docdeck.mjs init
node /path/to/management-tools/docdeck/bin/docdeck.mjs build --open
```

The project does not need to install anything. Its config and providers
`import … from "docdeck"`, and the engine resolves that to itself. See
[docdeck/README.md](docdeck/README.md).
