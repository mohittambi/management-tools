import { defineConfig } from "docdeck";

// docdeck documents itself. Build from the repo root:
//   node docdeck/bin/docdeck.mjs -c docs/docdeck.config.ts build
export default defineConfig({
  root: "..",
  project: {
    name: "docdeck",
    title: "The client document engine",
    tagline: "A themed deck and product document for any project, from chapters and live project data.",
    audience: "Teams presenting software to their clients",
    edition: "auto",
  },
  brand: { logo: "docs/brand/logo.svg", logoOnDark: "docs/brand/logo-on-dark.svg", mark: "docs/brand/mark.svg" },
  theme: {
    css: "docs/brand/theme.css",
    map: { paper: "--paper", ink: "--ink", surface: "--surface", accent: "--blue", accent2: "--pine", attention: "--amber", rule: "--rule", muted: "--muted" },
  },
  // Showcase: a gradient deck cover, blue chapter openers, a dark book cover.
  background: {
    deckCover: { gradient: "linear-gradient(135deg, #1c2127 0%, #1c2127 45%, #2b5d8a 100%)" },
    chapter: "accent",
    cover: "ink",
  },
  chapters: "docs/chapters",
  providers: "docs/providers.ts",
  out: "docs/output",
  outputs: ["deck", "book"],
});
