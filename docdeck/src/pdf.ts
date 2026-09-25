import { readFileSync } from "node:fs";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { chromium, type Browser, type Page } from "playwright-core";
import { renderBook, renderDeck, type RenderInput, type RenderedChapter } from "./render.ts";

export async function launch(): Promise<Browser> {
  try {
    return await chromium.launch();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Could not start Chromium for PDF output.\n${msg.split("\n")[0]}\nInstall it once with: npx playwright-core install chromium`);
  }
}

async function load(page: Page, html: string) {
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
}

async function a4(page: Page, html: string, outline = false): Promise<Uint8Array> {
  await load(page, html);
  return page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, outline, tagged: outline });
}

async function pageCount(bytes: Uint8Array) {
  return (await PDFDocument.load(bytes)).getPageCount();
}

/**
 * Start page of each chapter, given the page counts of the parts. Pages are
 * numbered from the cover (page 1), the way a printed book is.
 */
export function startPages(coverPages: number, indexPages: number, chapterPages: Array<{ number: number; pages: number }>) {
  const starts: Record<number, number> = {};
  let next = coverPages + indexPages + 1;
  for (const c of chapterPages) {
    starts[c.number] = next;
    next += c.pages;
  }
  return { starts, total: next - 1 };
}

function hexToRgb(hex: string) {
  const m = hex.trim().match(/^#([0-9a-f]{6})$/i);
  if (!m) return rgb(0.4, 0.42, 0.47);
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export type BookPdfResult = { pdf: Uint8Array; pages: Record<number, number>; total: number; warnings: string[] };

export async function buildBookPdf(
  browser: Browser,
  rendered: RenderedChapter[],
  input: RenderInput,
  stamp: { fontFile: string | null; muted: string },
): Promise<BookPdfResult> {
  const warnings: string[] = [];
  const page = await browser.newPage();
  const bookChapters = rendered.filter((c) => c.book);

  // Pass 1: measure every part on its own.
  const cover = await pageCount(await a4(page, renderBook(rendered, input, { print: true, parts: { cover: true, index: false, chapters: [] } })));
  const placeholder = Object.fromEntries(bookChapters.map((c) => [c.number, 888]));
  const index = await pageCount(
    await a4(page, renderBook(rendered, input, { print: true, parts: { cover: false, index: true, chapters: [] }, pages: placeholder })),
  );
  const chapterPages: Array<{ number: number; pages: number }> = [];
  for (const ch of bookChapters) {
    const bytes = await a4(page, renderBook(rendered, input, { print: true, parts: { cover: false, index: false, chapters: [ch.number] } }));
    chapterPages.push({ number: ch.number, pages: await pageCount(bytes) });
  }
  const { starts, total } = startPages(cover, index, chapterPages);

  // Pass 2: the whole book in one render, so Chromium writes the bookmarks.
  const full = await a4(page, renderBook(rendered, input, { print: true, pages: starts }), true);
  await page.close();
  const doc = await PDFDocument.load(full);
  if (doc.getPageCount() !== total) {
    warnings.push(`Index page numbers may be off: parts measured ${total} pages, the full book has ${doc.getPageCount()}.`);
  }

  // Running footer on every page after the cover.
  doc.registerFontkit(fontkit);
  let font: PDFFont;
  try {
    font = stamp.fontFile ? await doc.embedFont(readFileSync(stamp.fontFile), { subset: true }) : await doc.embedFont(StandardFonts.Helvetica);
  } catch {
    font = await doc.embedFont(StandardFonts.Helvetica);
  }
  const color = hexToRgb(stamp.muted);
  const ranges = chapterPages.map((c) => ({ from: starts[c.number], to: starts[c.number] + c.pages - 1, title: bookChapters.find((b) => b.number === c.number)!.title }));
  doc.getPages().forEach((p, i) => {
    const n = i + 1;
    if (n <= cover) return;
    const label = n <= cover + index ? "Index" : (ranges.find((r) => n >= r.from && n <= r.to)?.title ?? "");
    const left = `${input.project.name}  ·  ${label}`;
    const size = 8;
    const { width } = p.getSize();
    const margin = 51; // 18 mm
    p.drawText(left, { x: margin, y: 28, size, font, color });
    const num = String(n);
    p.drawText(num, { x: width - margin - font.widthOfTextAtSize(num, size), y: 28, size, font, color });
  });
  doc.setTitle(`${input.project.name} · ${input.project.title}`);
  doc.setCreator("docdeck");
  return { pdf: await doc.save(), pages: starts, total: doc.getPageCount(), warnings };
}

export type Overflow = { slide: number; label: string };

export async function measureDeck(browser: Browser, html: string): Promise<{ page: Page; overflow: Overflow[] }> {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await load(page, html);
  await page.waitForFunction(() => (window as unknown as { __ddFitted?: boolean }).__ddFitted === true);
  const overflow = await page.evaluate(() => (window as unknown as { __ddOverflow: Overflow[] }).__ddOverflow);
  return { page, overflow };
}

export async function buildDeckPdf(browser: Browser, rendered: RenderedChapter[], input: RenderInput) {
  const { page, overflow } = await measureDeck(browser, renderDeck(rendered, input, { print: true }));
  const bytes = await page.pdf({ width: "1600px", height: "900px", printBackground: true, preferCSSPageSize: true, outline: true, tagged: true });
  await page.close();
  const doc = await PDFDocument.load(bytes);
  doc.setTitle(`${input.project.name} · ${input.project.title}`);
  doc.setCreator("docdeck");
  return { pdf: await doc.save(), overflow, slides: doc.getPageCount() };
}
