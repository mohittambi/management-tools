import { defineConfig } from "../../../src/index.ts";

export default defineConfig({
  root: ".",
  project: { name: "Fixture", title: "Fixture walkthrough", tagline: "A test project", edition: "1 January 2030" },
  brand: { logo: "logo.png" },
  theme: {
    css: "theme.css",
    map: { paper: "--bg", ink: "--fg", accent: "--brand", accent2: "--brand-2", attention: "--warn" },
  },
  chapters: "chapters",
  providers: "providers.ts",
  screens: { baseUrl: "http://127.0.0.1:9", shots: { home: "/" } },
  out: "dist",
});
