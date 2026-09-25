# docdeck block reference

Blocks are fenced with `:::name attributes` and a closing `:::`. Data blocks
read a provider from the project's providers file by path (`source="inward.path"`).

## Data blocks

| Block | Provider shape | Use for |
|---|---|---|
| `:::table source="x" caption="…"` | `{ columns: string[], rows: Cell[][], note? }` or an array of objects | Lists: roles, categories, templates, statuses |
| `:::matrix source="x"` | same as table, cells mostly `true` / `false` | Who can do what; renders ● and – |
| `:::flow source="x" current="3"` | `string[]` or `{ steps: [{ label, who?, note?, tone? }] }` | The path a record takes; `current` highlights a step |
| `:::compare left="a" right="b"` | each `{ title, lead?, points: string[], tone? }` | Two things side by side (inward vs outward) |
| `:::cards source="x"` | `[{ title, body?, tag?, points?, tone? }]` | A grid of short items (modules, account types) |
| `:::screen name="dashboard" caption="…"` | a key under `screens.shots` in the config | A screenshot of the running app |
| `:::stats source="x"` | `[{ value, label, tone? }]` | Three or four headline figures |

Cells: text (inline Markdown allowed), numbers, `true`/`false`, `null`,
`{ chip: "Pending", tone: "attention" }`, `{ code: "INW-2026-000001" }`.
Tones: `accent`, `accent2`, `attention`, `muted`.

## Content blocks

```md
:::callout tone="attention" title="To confirm"
Any Markdown.
:::

:::cards
- **Title** — text of the card
- **Another** — text
:::

:::columns
First column paragraph.

Second column paragraph.
:::

:::decisions
### C1 · The Department PA is whoever the file is assigned to
What the product does today.
> The question the client must answer?
### C2 · …
:::
```

## Book-only and deck-only content

The book can go deep while the deck stays brief. Wrap detail in `:::book`
and a short version in `:::deck`. Either can hold whole `##` sections.

```md
:::deck
## Access in one slide
Three layers: account, role, modules.
:::

:::book
## Every permission
:::table source="access.catalog"
:::
:::
```

## Providers file

```ts
import { defineProviders } from "docdeck";
import { ROLES } from "../../src/roles"; // read the real code

export default defineProviders({
  roles: () => ({ columns: ["Role", "Can do"], rows: ROLES.map((r) => [r.label, r.summary]) }),
  inward: {
    path: () => ({ steps: [{ label: "Received", who: "Reception" }, …] }),
  },
});
```

Values can be data or (async) functions. Nested objects are addressed with
dots: `inward.path`.
