---
title: Data and screenshots
summary: Tables are read from the project's code, and screens are captured from the running app.
---

## Providers

A providers file reads the project's own constants, seed data or API and hands tables, paths and cards to the chapters. When the product changes, the tables change with it at the next build.

:::book
A provider is data, or a function returning data. Chapters address it by path, for example `inward.path`. A missing provider fails the check, naming the chapter that asked for it.
:::

## Screenshots

The config gives the app's address, a sign-in, and the screens to capture. Each build signs in, opens every screen a chapter asks for, and places the capture in the slide and the page. When the app is not running, the last captures are reused.
