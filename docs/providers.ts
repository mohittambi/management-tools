// Data for docdeck's own document, read from the engine's code so the
// document describes the engine that built it.
import { BLOCKS, DEFAULT_BACKGROUNDS, DEFAULT_TOKENS, LINT_RULES, SURFACES, THEME_ROLES, defineProviders, type Cell } from "docdeck";
import { configSchema } from "../docdeck/src/config.ts";

const ROLE_USE: Record<(typeof THEME_ROLES)[number], string> = {
  paper: "Page ground",
  ink: "Text",
  surface: "Cards and tables",
  accent: "Links, the current step, chapter rules",
  accent2: "The other side of a comparison",
  attention: "Decisions and warnings",
  rule: "Hairlines",
  muted: "Secondary text",
};

const BLOCK_USE: Record<(typeof BLOCKS)[number], [string, string]> = {
  table: ["Rows from a provider", "Roles, categories, templates, statuses"],
  matrix: ["A yes / no grid", "Who can do what"],
  flow: ["Numbered steps, with who acts", "The path a record takes"],
  compare: ["Two sides", "One thing against another"],
  cards: ["A grid of short items", "Modules, account types, principles"],
  stats: ["Three or four headline figures", "Counts that make a point"],
  callout: ["A highlighted note", "Something to confirm, a limit"],
  decisions: ["Numbered questions for the client", "What the client must decide"],
  columns: ["Side-by-side prose", "Two short explanations"],
  screen: ["A screenshot of the running app", "Showing the real screen"],
};

const CONFIG_USE: Record<string, string> = {
  root: "Where paths start",
  project: "Name, title, tagline, audience, edition date",
  brand: "Logo, logo on dark, footer mark",
  theme: "Colour tokens and fonts",
  chapters: "Chapters folder",
  providers: "Data providers file",
  templates: "Replacement templates",
  screens: "App address, sign-in and screens to capture",
  styles: "Extra stylesheets",
  book: "Page size, margins, footer",
  labels: "Words on the cover and index",
  out: "Output folder",
  outputs: "Deck, book, or both",
};

const hex = (v: string): Cell => ({ code: v });

export default defineProviders({
  outputs: [
    { title: "deck.pdf", tag: "16:9", tone: "accent", body: "Slides to present or send. One slide per section, text fitted to the slide." },
    { title: "deck.html", tag: "Browser", tone: "accent", body: "The same slides, presented with arrow keys and full screen." },
    { title: "book.pdf", tag: "A4", tone: "accent2", body: "The full document: cover, index with page numbers, running footers, bookmarks." },
    { title: "book.html", tag: "Browser", tone: "accent2", body: "The same document as one page, index linked to each chapter." },
  ],
  loop: ["Write or edit a chapter", "Check", "Build", "Share the PDFs"],
  projectFiles: {
    columns: ["File", "Holds"],
    rows: [
      [{ code: "docdeck.config.ts" }, "Name, logo, theme, chapters folder, screens"],
      [{ code: "providers.ts" }, "Data read from the project's code"],
      [{ code: "GUIDE.md" }, "The project's writing guide, followed by the skill"],
      [{ code: "chapters/NN-slug.md" }, "One chapter per file, in number order"],
      [{ code: "package.json" }, "Marks the folder as ES modules"],
    ],
  },
  roles: () => ({
    columns: ["Role", "Used for", "Neutral default"],
    rows: THEME_ROLES.map((r) => [{ code: r }, ROLE_USE[r], hex(DEFAULT_TOKENS[r])]),
  }),
  config: () => ({
    columns: ["Setting", "Changes"],
    rows: Object.keys(configSchema.shape).map((k) => [{ code: k }, CONFIG_USE[k] ?? ""]),
  }),
  blocks: () => ({
    columns: ["Block", "Shows", "Use for"],
    rows: BLOCKS.map((b) => [{ code: `:::${b}` }, ...BLOCK_USE[b]]),
  }),
  lint: () => ({
    columns: ["Check fails on", "Level"],
    rows: LINT_RULES.map((r) => [r.message.replace(/^./, (c) => c.toUpperCase()), { chip: r.level, tone: r.level === "error" ? "attention" : "muted" }]),
  }),
  skillLoop: {
    steps: [
      { label: "Read the config and GUIDE.md", who: "Skill" },
      { label: "Check the code for facts", who: "Skill" },
      { label: "Edit only the chapters asked for", who: "Skill" },
      { label: "Check, then build", who: "Engine", tone: "accent2" },
      { label: "Report outputs and contradictions", who: "Skill" },
    ],
  },
  sides: {
    book: { title: "The book", tone: "accent2", lead: "Everything, in order.", points: ["Every section and every table", "Index with page numbers", "Running footer and bookmarks", ":::book detail included"] },
    deck: { title: "The deck", tone: "accent", lead: "The story, one idea a slide.", points: ["One slide per section", "Text fitted to the slide", ":::book detail left out", ":::deck summaries added"] },
  },
  numbers: () => [
    { value: BLOCKS.length, label: "content blocks", tone: "accent" },
    { value: THEME_ROLES.length, label: "theme roles to map", tone: "accent2" },
    { value: Object.keys(configSchema.shape).length, label: "settings in one config file", tone: "muted" },
    { value: 4, label: "files from one build", tone: "attention" },
  ],
  surfaces: () => ({
    columns: ["Surface", "Covers", "Default"],
    rows: SURFACES.map((s) => [
      { code: s },
      { page: "Every book page, edge to edge", cover: "The book's cover", slide: "Every slide", deckCover: "The first slide", chapter: "Chapter opening slides" }[s],
      { code: typeof DEFAULT_BACKGROUNDS[s] === "string" ? (DEFAULT_BACKGROUNDS[s] as string) : "custom" },
    ]),
  }),
  backgroundKinds: [
    { title: "A role or colour", tag: "\"ink\"", tone: "accent", body: "Any theme role, or any CSS colour." },
    { title: "A gradient", tag: "linear-gradient(…)", tone: "accent", body: "Any CSS gradient, drawn edge to edge." },
    { title: "An image", tag: "{ image, overlay }", tone: "accent2", body: "Cover-fitted, with an optional overlay to keep text readable." },
    { title: "A pattern", tag: "{ image, repeat }", tone: "accent2", body: "A small image tiled across the surface." },
  ],
  roadmap: {
    columns: ["Next", "Why"],
    rows: [
      ["Publish to npm", "Run it anywhere with npx"],
      ["Build in CI", "Every push rebuilds the PDFs"],
      ["Speaker notes and presenter view", "Present from the HTML deck"],
      ["More languages and scripts", "Marathi, Hindi and bilingual documents"],
      ["Diagram and chart blocks", "Flows and figures without screenshots"],
      ["Annotated and mobile screens", "Point at the part being described"],
      ["Theme presets", "A good look without design tokens"],
      ["PowerPoint export", "For clients who edit slides"],
      ["Glossary and figure list", "Long documents stay navigable"],
      ["Edition summary", "What changed since the last edition, without commit history"],
    ],
  },
});
