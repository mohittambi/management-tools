import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import nunjucks from "nunjucks";
import type { Chapter, Section } from "./content.ts";
import { forMode, splitSections } from "./content.ts";
import { createMarkdown } from "./markdown.ts";

const engineDir = dirname(dirname(fileURLToPath(import.meta.url)));

export type Project = { name: string; title: string; tagline: string; audience: string; edition: string };

export type RenderedChapter = {
  number: number;
  slug: string;
  title: string;
  summary: string;
  deck: boolean;
  book: boolean;
  bookHtml: string;
  introHtml: string;
  /** Deck sections (one slide each). */
  sections: Array<Section & { html: string }>;
  /** Book sections, for the index. */
  bookSections: Section[];
  firstSlide?: number;
};

export type Slide =
  | { kind: "cover"; label: string }
  | { kind: "index"; label: string }
  | { kind: "chapter"; label: string; chapter: RenderedChapter; html: string }
  | { kind: "section"; label: string; chapter: RenderedChapter; heading: string; html: string };

export type Labels = { contents: string; index: string; chapter: string; preparedFor: string; edition: string };

export type RenderInput = {
  project: Project;
  labels: Labels;
  /** Page size and margins for the printed book, and its page background. */
  page: { size: string; margin: string; background: string };
  /** Background CSS for every surface (see background.ts). */
  backgroundCss: string;
  /** Surfaces whose background is dark, so the light logo is used there. */
  dark: { cover: boolean; deckCover: boolean };
  /** Project stylesheets, applied last. */
  extraCss: string;
  logo: string | null;
  logoOnDark: string | null;
  mark: string | null;
  css: { base: string; theme: string; fonts: string };
  sources: Map<string, unknown>;
  screens: Map<string, string | null>;
  templatesDir?: string;
};

const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp" };

export function dataUri(file: string | undefined): string | null {
  if (!file || !existsSync(file)) return null;
  const mime = MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
  return `data:${mime};base64,${readFileSync(file).toString("base64")}`;
}

export function engineFile(...parts: string[]) {
  return join(engineDir, ...parts);
}

export function renderChapters(chapters: Chapter[], input: RenderInput): RenderedChapter[] {
  return chapters.map((ch) => {
    const ctx = { sources: input.sources, screens: input.screens };
    const bookMd = createMarkdown(ctx, `${ch.slug}-`);
    const bookBody = forMode(ch.body, "book");
    const { intro, sections } = splitSections(forMode(ch.body, "deck"));
    const deckMd = createMarkdown(ctx, `d-${ch.slug}-`);
    return {
      number: ch.number,
      slug: ch.slug,
      title: ch.title,
      summary: ch.summary,
      deck: ch.deck,
      book: ch.book,
      bookHtml: bookMd.render(bookBody),
      bookSections: splitSections(bookBody).sections,
      introHtml: intro ? deckMd.render(intro) : "",
      sections: sections.map((s) => ({ ...s, html: deckMd.render(s.body) })),
    };
  });
}

function env(templatesDir?: string) {
  const dirs = [templatesDir, engineFile("templates")].filter((d): d is string => Boolean(d && existsSync(d)));
  const e = new nunjucks.Environment(new nunjucks.FileSystemLoader(dirs, { noCache: true }), { autoescape: true });
  e.addFilter("pad", (n: number) => String(n).padStart(2, "0"));
  return e;
}

function css(input: RenderInput, extra: string) {
  return [input.css.fonts, input.css.theme, input.css.base, extra, input.backgroundCss, input.extraCss].join("\n");
}

const PAGE_HEIGHT: Record<string, string> = { a4: "297mm", a5: "210mm", a3: "420mm", letter: "279.4mm", legal: "355.6mm" };

/** Page rules need literal values; custom properties do not reach @page. */
function pageCss(input: RenderInput) {
  const { size, margin, background } = input.page;
  const height = PAGE_HEIGHT[size.trim().split(/\s+/)[0].toLowerCase()] ?? "100vh";
  return [
    `@page { size: ${size}; margin: ${margin}; ${background} }`,
    "@page cover { margin: 0; }",
    `.dd-print .dd-cover { height: ${height}; }`,
  ].join("\n");
}

export type BookParts = { cover: boolean; index: boolean; chapters: number[] | "all" };

export function renderBook(
  rendered: RenderedChapter[],
  input: RenderInput,
  opts: { print?: boolean; parts?: BookParts; pages?: Record<number, number> } = {},
): string {
  const parts = opts.parts ?? { cover: true, index: true, chapters: "all" };
  const bookChapters = rendered.filter((c) => c.book);
  const chapters = parts.chapters === "all" ? bookChapters : bookChapters.filter((c) => (parts.chapters as number[]).includes(c.number));
  return env(input.templatesDir).render("book.njk", {
    project: input.project,
    logo: input.dark.cover ? (input.logoOnDark ?? input.logo) : input.logo,
    css: css(input, readFileSync(engineFile("styles", "book.css"), "utf8") + "\n" + pageCss(input)),
    print: Boolean(opts.print),
    labels: input.labels,
    show: { cover: parts.cover, index: parts.index },
    allChapters: bookChapters,
    chapters,
    pages: opts.pages ?? null,
  });
}

export function buildSlides(rendered: RenderedChapter[]): Slide[] {
  const slides: Slide[] = [
    { kind: "cover", label: "Cover" },
    { kind: "index", label: "Index" },
  ];
  for (const ch of rendered.filter((c) => c.deck)) {
    ch.firstSlide = slides.length + 1;
    slides.push({ kind: "chapter", label: `${ch.number}. ${ch.title}`, chapter: ch, html: ch.introHtml });
    for (const s of ch.sections) {
      slides.push({ kind: "section", label: `${ch.number}. ${ch.title} › ${s.heading}`, chapter: ch, heading: s.heading, html: s.html });
    }
  }
  return slides;
}

export function renderDeck(rendered: RenderedChapter[], input: RenderInput, opts: { print?: boolean } = {}): string {
  const slides = buildSlides(rendered);
  return env(input.templatesDir).render("deck.njk", {
    project: input.project,
    logo: input.logo,
    coverLogo: input.dark.deckCover ? (input.logoOnDark ?? input.logo) : input.logo,
    mark: input.mark,
    css: css(input, readFileSync(engineFile("styles", "deck.css"), "utf8")),
    print: Boolean(opts.print),
    labels: input.labels,
    slides,
    allChapters: rendered,
    deckScript: readFileSync(engineFile("templates", "deck.js"), "utf8"),
  });
}

export function baseCss() {
  return readFileSync(engineFile("styles", "base.css"), "utf8");
}
