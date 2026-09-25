import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, PDFName } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { editionLabel } from "../src/build.ts";
import { forMode, lintChapter, referencedScreens, referencedSources, splitSections } from "../src/content.ts";
import { createMarkdown } from "../src/markdown.ts";
import { footerText, sideMargins, startPages } from "../src/pdf.ts";
import { asTable } from "../src/providers.ts";
import { parseCssVars, DEFAULT_TOKENS } from "../src/theme.ts";
import { backgroundCss, luminance, resolveBackground } from "../src/background.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, "fixtures", "project");
const bin = join(here, "..", "bin", "docdeck.mjs");

describe("theme", () => {
  it("reads only the top-level custom properties of the selector", () => {
    const vars = parseCssVars(readFileSync(join(fixture, "theme.css"), "utf8"), ":root");
    expect(vars["--brand"]).toBe("#7a2e8c");
    expect(vars["--brand-2"]).toBe("var(--teal)");
    expect(vars["--ignored"]).toBeUndefined();
    expect(parseCssVars(readFileSync(join(fixture, "theme.css"), "utf8"), ".dark")["--bg"]).toBe("#000000");
  });
});

describe("content", () => {
  it("splits at ## but not inside fences or blocks", () => {
    const { intro, sections } = splitSections("Intro\n\n## One\nA\n```\n## not a heading\n```\n:::callout\n## nor this\n:::\n## Two\nB");
    expect(intro).toBe("Intro");
    expect(sections.map((s) => s.heading)).toEqual(["One", "Two"]);
    expect(sections[0].body).toContain("## not a heading");
  });

  it("keeps book-only detail out of the deck and deck-only summary out of the book", () => {
    const body = "Intro\n\n:::deck\n## Brief\nShort.\n:::\n\n:::book\n## Detail\n:::table source=\"t\"\n:::\nLong.\n:::\n\n## Both\nX";
    const book = forMode(body, "book");
    const deck = forMode(body, "deck");
    expect(splitSections(book).sections.map((s) => s.heading)).toEqual(["Detail", "Both"]);
    expect(splitSections(deck).sections.map((s) => s.heading)).toEqual(["Brief", "Both"]);
    expect(book).toContain(':::table source="t"\n:::');
    expect(book).not.toContain(":::book");
    expect(deck).not.toContain("Long.");
  });

  it("flags commit noise but not ordinary words or code", () => {
    const issues = lintChapter({
      file: "x.md",
      title: "X",
      body: "Fixed in a1b2c3d.\nSee the changelog.\nMerged PR #42.\nThe office added effaced records.\n`deadbeef1` is code\nTODO: later",
    });
    expect(issues.map((i) => i.line)).toEqual([1, 2, 3, 6]);
    expect(issues.find((i) => i.line === 6)?.level).toBe("warning");
  });

  it("collects the sources and screens a chapter asks for", () => {
    const body = ':::table source="roles"\n:::\n:::compare left="a" right="b"\n:::\n:::screen name="home"\n:::';
    expect(referencedSources(body).sort()).toEqual(["a", "b", "roles"]);
    expect(referencedScreens(body)).toEqual(["home"]);
  });
});

describe("blocks", () => {
  const sources = new Map<string, unknown>([
    ["t", { columns: ["A", "B"], rows: [["x", true], ["**y**", false]] }],
    ["f", ["One", "Two", "Three"]],
    ["l", { title: "Left", points: ["p1"] }],
    ["r", { title: "Right", points: ["p2"], tone: "accent2" }],
  ]);
  const md = createMarkdown({ sources, screens: new Map([["home", null]]) });

  it("renders a table with inline Markdown and yes/no cells", () => {
    const html = md.render(':::table source="t" caption="Cap"\n:::');
    expect(html).toContain("<figcaption>Cap</figcaption>");
    expect(html).toContain("<strong>y</strong>");
    expect(html).toContain('class="dd-yes"');
    expect(html).toContain('class="dd-no"');
  });

  it("renders a flow with the current step marked", () => {
    const html = md.render(':::flow source="f" current="1"\n:::');
    expect(html.match(/dd-step dd-done/g)).toHaveLength(1);
    expect(html).toContain("dd-step dd-current");
    expect(html.match(/dd-step dd-later/g)).toHaveLength(1);
  });

  it("renders compare, callout content and a screen placeholder", () => {
    const html = md.render(':::compare left="l" right="r"\n:::\n\n:::callout tone="attention"\nHello **there**\n:::\n\n:::screen name="home"\n:::');
    expect(html).toContain("dd-side dd-tone-accent2");
    expect(html).toContain('<aside class="dd-callout dd-tone-attention"><p>Hello <strong>there</strong></p>');
    expect(html).toContain("dd-screen-missing");
  });

  it("renders headline stats", () => {
    const m = createMarkdown({ sources: new Map([["s", [{ value: 12, label: "Statuses", tone: "accent2" }]]]), screens: new Map() });
    const html = m.render(':::stats source="s"\n:::');
    expect(html).toContain('<div class="dd-stat dd-tone-accent2"><span class="dd-stat-value">12</span>');
  });

  it("fails loudly on an unresolved source", () => {
    expect(() => md.render(':::table source="nope"\n:::')).toThrow(/was not resolved/);
  });

  it("accepts an array of objects as a table", () => {
    expect(asTable([{ Role: "A", Can: "x" }], "s")).toEqual({ columns: ["Role", "Can"], rows: [["A", "x"]] });
  });
});

describe("backgrounds", () => {
  const path = (p: string) => join(fixture, p);
  it("reads a role, a colour or a gradient from a plain string", () => {
    expect(resolveBackground("ink", DEFAULT_TOKENS, path).color).toBe(DEFAULT_TOKENS.ink);
    expect(resolveBackground("#fff8e7", DEFAULT_TOKENS, path).text).toBe("dark");
    const g = resolveBackground("linear-gradient(135deg, #102030, #2f4f7f)", DEFAULT_TOKENS, path);
    expect(g.layers[0].image).toContain("linear-gradient");
    expect(g.text).toBe("light");
  });
  it("stacks overlay over image and judges text by the overlay", () => {
    const b = resolveBackground({ image: "logo.png", overlay: "rgba(0,0,0,0.55)", size: "40px", repeat: "repeat" }, DEFAULT_TOKENS, path);
    expect(b.layers.map((l) => l.image.slice(0, 15))).toEqual(["linear-gradient", 'url("data:image']);
    expect(b.layers[1]).toMatchObject({ size: "40px", repeat: "repeat" });
    expect(b.text).toBe("light");
    expect(resolveBackground({ color: "ink", text: "dark" }, DEFAULT_TOKENS, path).text).toBe("dark");
  });
  it("flips text only on surfaces that turn against the theme", () => {
    const { css, dark } = backgroundCss({ chapter: "accent" }, DEFAULT_TOKENS, path);
    expect(dark).toMatchObject({ page: false, slide: false, chapter: true, deckCover: true });
    expect(css).toMatch(/\.dd-slide\.dd-slide-chapter \{[^}]*--dd-ink: var\(--dd-light\)/);
    expect(css).not.toMatch(/\.dd-slide \{[^}]*--dd-ink/);
  });
  it("fails loudly on a missing image", () => {
    expect(() => resolveBackground({ image: "nope.png" }, DEFAULT_TOKENS, path)).toThrow(/not found/);
  });
  it("measures luminance", () => {
    expect(luminance("#ffffff")).toBeCloseTo(1);
    expect(luminance("rgb(0, 0, 0)")).toBe(0);
    expect(luminance("oklch(0.5 0.1 200)")).toBeNull();
  });
});

describe("index page numbers", () => {
  it("numbers from the cover like a printed book", () => {
    const { starts, total } = startPages(1, 2, [
      { number: 1, pages: 3 },
      { number: 2, pages: 1 },
      { number: 3, pages: 4 },
    ]);
    expect(starts).toEqual({ 1: 4, 2: 7, 3: 8 });
    expect(total).toBe(11);
  });

  it("reads side margins from the CSS shorthand and fills the footer pattern", () => {
    const m = sideMargins("24mm 22mm 26mm 20mm");
    expect(Math.round(m.left)).toBe(57);
    expect(Math.round(m.right)).toBe(62);
    expect(Math.round(sideMargins("20mm").left)).toBe(57);
    expect(footerText("{project} · {chapter} · {page}/{pages}", { project: "P", chapter: "C", page: 3, pages: 9 })).toBe("P · C · 3/9");
  });

  it("uses the build date for an automatic edition", () => {
    expect(editionLabel("auto", new Date("2026-09-25T10:00:00"))).toBe("25 September 2026");
    expect(editionLabel("Spring 2027")).toBe("Spring 2027");
  });
});

describe("docdeck build (fixture project, real Chromium)", () => {
  it("writes all four files with the index, footers, bookmarks and theme", async () => {
    try {
      // Same code path as the command line. --no-screens: the fixture app does not exist.
      execFileSync(process.execPath, [bin, "build", "--no-screens"], {
        cwd: fixture,
        stdio: "pipe",
      });
      const dist = join(fixture, "dist");
      for (const f of ["deck.html", "deck.pdf", "book.html", "book.pdf"]) expect(existsSync(join(dist, f)), f).toBe(true);

      const bookHtml = readFileSync(join(dist, "book.html"), "utf8");
      expect(bookHtml).toContain("--dd-accent: #7a2e8c;");
      expect(bookHtml).toContain("--dd-accent2: #11706a;");
      expect(bookHtml).toContain("Fixture walkthrough");
      expect(bookHtml).toContain('class="dd-toc-page">3<');

      const book = await PDFDocument.load(readFileSync(join(dist, "book.pdf")));
      expect(book.getPageCount()).toBeGreaterThanOrEqual(4);
      expect(book.catalog.get(PDFName.of("Outlines")), "bookmarks").toBeDefined();

      const deckHtml = readFileSync(join(dist, "deck.html"), "utf8");
      expect(deckHtml).toContain("linear-gradient(135deg, #101820, #7a2e8c)");
      expect(deckHtml).toMatch(/\.dd-slide\.dd-slide-chapter \{[^}]*--dd-ink: var\(--dd-light\)/);
      expect(bookHtml).toMatch(/@page \{[^}]*background-repeat: repeat/);

      const deck = await PDFDocument.load(readFileSync(join(dist, "deck.pdf")));
      // cover + index + 2 chapter openers + 6 sections
      expect(deck.getPageCount()).toBe(10);
      const { width, height } = deck.getPage(0).getSize();
      expect(Math.round((width / height) * 9)).toBe(16);
    } finally {
      rmSync(join(fixture, "dist"), { recursive: true, force: true });
    }
  }, 120_000);
});
