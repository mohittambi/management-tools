---
title: Writing chapters
summary: Plain Markdown, one file per chapter, one slide per section.
---

A chapter is one Markdown file. Its number sets the order, its title and summary appear in the index, and each `##` section becomes a slide.

## Blocks

Blocks drop real content into a chapter: tables and paths from the code, comparisons, screenshots, decisions.

:::table source="blocks"
:::

## Deep in the book, brief in the deck

:::compare left="sides.book" right="sides.deck"
:::

Wrap detail in a `:::book` block and it stays out of the slides. Put a one-slide summary in `:::deck` and it stays out of the book.
