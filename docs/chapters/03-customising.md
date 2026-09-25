---
title: Customising the look
summary: Map eight theme roles to the project's tokens and the whole document takes its colours, fonts and logo.
---

## Eight roles

Every colour in docdeck's templates is one of eight roles. A project maps its own design tokens onto them, and nothing else needs to change.

:::table source="roles"
:::

## One config file

:::book
:::table source="config"
:::
:::

:::deck
Name and logo, theme, fonts, page size and margins, footer, labels, screens and outputs all sit in one config file.
:::

## Backgrounds

Every surface can have its own background: a theme role, a colour, a gradient, an image with an overlay, or a tiled pattern. Text turns light by itself on a dark ground, and a dark cover picks the light logo.

:::cards source="backgroundKinds"
:::

:::book
:::table source="surfaces"
:::

This document uses three: a gradient on the deck's cover, the accent blue on chapter openers, and ink on the book cover.
:::

## Three levels of change

:::cards
- **Settings** Colours, fonts, logo, page size, margins, footer and labels, all in the config.
- **Styles** An extra stylesheet for spacing, headings or table rules, using the theme roles.
- **Templates** Replace the cover, index or slide layout by copying the engine's templates into the project.
:::
