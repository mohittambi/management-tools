import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { Browser } from "playwright-core";
import type { LoadedConfig } from "./config.ts";
import { lintChapter, loadChapters, referencedScreens, referencedSources, type Chapter, type LintIssue } from "./content.ts";
import { buildBookPdf, buildDeckPdf, launch, measureDeck, type StampOptions } from "./pdf.ts";
import { hasSource, loadProviders, resolveSources } from "./providers.ts";
import { baseCss, dataUri, renderBook, renderChapters, renderDeck, type RenderInput, type RenderedChapter } from "./render.ts";
import { captureScreens } from "./screens.ts";
import { fontCss, resolveFonts, resolveTokens, stampFontFile, themeCss } from "./theme.ts";

export function editionLabel(edition: string, now = new Date()) {
  if (edition !== "auto") return edition;
  return now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

type Prepared = {
  chapters: Chapter[];
  input: RenderInput;
  rendered: RenderedChapter[];
  stamp: StampOptions;
  warnings: string[];
};

async function prepare(loaded: LoadedConfig, opts: { browser: Browser | null; captureScreens: boolean }): Promise<Prepared> {
  const { config } = loaded;
  const chapters = loadChapters(loaded.path(config.chapters));
  const providers = await loadProviders(config.providers ? loaded.path(config.providers) : undefined);
  const sources = await resolveSources(providers, [...new Set(chapters.flatMap((c) => referencedSources(c.body)))]);
  const tokens = resolveTokens(loaded);
  const fonts = resolveFonts(loaded);
  const out = loaded.path(config.out);
  const wantedScreens = [...new Set(chapters.flatMap((c) => referencedScreens(c.body)))];
  const shots = await captureScreens(opts.browser, config.screens, wantedScreens, out, { capture: opts.captureScreens });
  const input: RenderInput = {
    project: { ...config.project, edition: editionLabel(config.project.edition) },
    logo: dataUri(loaded.path(config.brand.logo)),
    logoOnDark: config.brand.logoOnDark ? dataUri(loaded.path(config.brand.logoOnDark)) : null,
    mark: config.brand.mark ? dataUri(loaded.path(config.brand.mark)) : null,
    css: { base: baseCss(), theme: themeCss(tokens), fonts: fontCss(fonts) },
    labels: config.labels,
    page: { size: config.book.size, margin: config.book.margin, paper: tokens.paper },
    extraCss: config.styles.map((f) => readFileSync(loaded.path(f), "utf8")).join("\n"),
    sources,
    screens: shots.uris,
    templatesDir: config.templates ? loaded.path(config.templates) : undefined,
  };
  const warnings = [...shots.warnings];
  if (!input.logo) warnings.push(`Logo not found at ${config.brand.logo}; the cover shows the project name instead.`);
  return {
    chapters,
    input,
    rendered: renderChapters(chapters, input),
    stamp: { fontFile: stampFontFile(fonts.body), muted: tokens.muted, margin: config.book.margin, footer: config.book.footer },
    warnings,
  };
}

export type CheckResult = { issues: LintIssue[]; warnings: string[] };

/** Everything that can be wrong without writing a PDF. */
export async function check(loaded: LoadedConfig, opts: { deck?: boolean } = {}): Promise<CheckResult> {
  const { config } = loaded;
  const chapters = loadChapters(loaded.path(config.chapters));
  const issues: LintIssue[] = chapters.flatMap(lintChapter);
  const providers = await loadProviders(config.providers ? loaded.path(config.providers) : undefined);
  for (const ch of chapters) {
    const name = relative(loaded.path(config.chapters), ch.file);
    for (const src of referencedSources(ch.body)) {
      if (!hasSource(providers, src)) issues.push({ file: name, line: 0, message: `no provider for "${src}"`, level: "error" });
    }
    for (const s of referencedScreens(ch.body)) {
      if (!config.screens?.shots[s]) issues.push({ file: name, line: 0, message: `screen "${s}" is not in screens.shots`, level: "error" });
    }
  }
  resolveTokens(loaded);
  resolveFonts(loaded);
  const warnings: string[] = [];
  if (opts.deck !== false && config.outputs.includes("deck") && !issues.some((i) => i.level === "error")) {
    const browser = await launch();
    try {
      const prepared = await prepare(loaded, { browser, captureScreens: false });
      warnings.push(...prepared.warnings);
      const { page, overflow } = await measureDeck(browser, renderDeck(prepared.rendered, prepared.input, { print: true }));
      await page.close();
      for (const o of overflow) {
        issues.push({ file: "deck", line: o.slide, message: `slide ${o.slide} (${o.label}) does not fit; split the section or shorten it`, level: "error" });
      }
    } finally {
      await browser.close();
    }
  }
  return { issues, warnings };
}

export type BuildResult = { files: string[]; warnings: string[] };

export async function build(
  loaded: LoadedConfig,
  opts: { deck?: boolean; book?: boolean; pdf?: boolean; screens?: boolean } = {},
): Promise<BuildResult> {
  const { config } = loaded;
  const out = loaded.path(config.out);
  mkdirSync(out, { recursive: true });
  const wantDeck = (opts.deck ?? true) && config.outputs.includes("deck");
  const wantBook = (opts.book ?? true) && config.outputs.includes("book");
  const needBrowser = opts.pdf !== false || opts.screens !== false;
  const browser = needBrowser ? await launch() : null;
  const files: string[] = [];
  try {
    const p = await prepare(loaded, { browser, captureScreens: opts.screens !== false });
    const warnings = [...p.warnings];
    const write = (name: string, data: string | Uint8Array) => {
      const f = join(out, name);
      writeFileSync(f, data);
      files.push(f);
    };
    if (wantBook) {
      let pages: Record<number, number> | undefined;
      if (opts.pdf !== false && browser) {
        const book = await buildBookPdf(browser, p.rendered, p.input, p.stamp);
        write("book.pdf", book.pdf);
        pages = book.pages;
        warnings.push(...book.warnings);
      }
      write("book.html", renderBook(p.rendered, p.input, { pages }));
    }
    if (wantDeck) {
      write("deck.html", renderDeck(p.rendered, p.input));
      if (opts.pdf !== false && browser) {
        const deck = await buildDeckPdf(browser, p.rendered, p.input);
        write("deck.pdf", deck.pdf);
        for (const o of deck.overflow) warnings.push(`Slide ${o.slide} (${o.label}) does not fit and is cut off.`);
      }
    }
    return { files, warnings };
  } finally {
    await browser?.close();
  }
}

/** HTML only, for live preview. */
export async function buildHtml(loaded: LoadedConfig) {
  return build(loaded, { pdf: false, screens: false });
}
