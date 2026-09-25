import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import matter from "gray-matter";
import { z } from "zod";

const frontmatterSchema = z.object({
  title: z.string().min(1),
  summary: z.string().default(""),
  /** Leave a chapter out of the deck (book only), or out of the book. */
  deck: z.boolean().default(true),
  book: z.boolean().default(true),
});

export type Chapter = {
  file: string;
  slug: string;
  number: number;
  title: string;
  summary: string;
  body: string;
  deck: boolean;
  book: boolean;
};

export type Section = { heading: string; slug: string; body: string };

const CHAPTER_FILE = /^(\d+)[-_](.+)\.md$/;

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

export function loadChapters(dir: string): Chapter[] {
  if (!existsSync(dir)) throw new Error(`Chapters folder not found: ${dir}`);
  const files = readdirSync(dir).filter((f) => CHAPTER_FILE.test(f)).sort((a, b) => {
    const na = Number(a.match(CHAPTER_FILE)![1]);
    const nb = Number(b.match(CHAPTER_FILE)![1]);
    return na - nb || a.localeCompare(b);
  });
  if (files.length === 0) throw new Error(`No chapters in ${dir}. Name them like 01-introduction.md`);
  return files.map((f, index) => {
    const file = join(dir, f);
    const { data, content } = matter(readFileSync(file, "utf8"));
    const fm = frontmatterSchema.safeParse(data);
    if (!fm.success) {
      const issues = fm.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`${f}: frontmatter ${issues}. Every chapter starts with ---\\ntitle: …\\n---`);
    }
    const m = f.match(CHAPTER_FILE)!;
    return {
      file,
      slug: slugify(m[2]),
      number: index + 1,
      title: fm.data.title,
      summary: fm.data.summary,
      body: content.trim(),
      deck: fm.data.deck,
      book: fm.data.book,
    };
  });
}

export type Mode = "book" | "deck";

/**
 * Keeps what belongs to one output. `:::book` … `:::` is book-only detail and
 * `:::deck` … `:::` is deck-only summary; the other output drops the block, and
 * its own output keeps the content without the fence. Both may wrap whole
 * `##` sections, so a chapter can be long in the book and brief in the deck.
 */
export function forMode(body: string, mode: Mode): string {
  const out: string[] = [];
  let fence = false;
  // Stack of open ::: blocks: "keep" (ordinary block), "unwrap" (this mode's
  // own block, fence dropped), "drop" (the other mode's block).
  const stack: Array<"keep" | "unwrap" | "drop"> = [];
  const dropping = () => stack.includes("drop");
  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (!fence) {
      const open = line.match(/^:::\s*(\w+)/);
      if (open) {
        const kind = open[1] === mode ? "unwrap" : open[1] === "book" || open[1] === "deck" ? "drop" : "keep";
        const wasDropping = dropping();
        stack.push(kind);
        if (!wasDropping && kind === "keep") out.push(line);
        continue;
      }
      if (/^:::\s*$/.test(line) && stack.length) {
        const kind = stack.pop()!;
        if (!dropping() && kind === "keep") out.push(line);
        continue;
      }
    }
    if (!dropping()) out.push(line);
  }
  return out.join("\n").trim();
}

/**
 * Splits a chapter at its `## ` headings. Headings inside code fences or
 * ::: blocks do not split. The text before the first heading is the intro.
 */
export function splitSections(body: string): { intro: string; sections: Section[] } {
  const lines = body.split(/\r?\n/);
  let intro: string[] = [];
  const sections: Section[] = [];
  let current: { heading: string; lines: string[] } | null = null;
  let fence = false;
  let container = 0;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (!fence) {
      if (/^:::\s*\w/.test(line)) container++;
      else if (/^:::\s*$/.test(line)) container = Math.max(0, container - 1);
    }
    const h = !fence && container === 0 ? line.match(/^##\s+(.+?)\s*#*\s*$/) : null;
    if (h) {
      if (current) sections.push(toSection(current));
      current = { heading: h[1], lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      intro.push(line);
    }
  }
  if (current) sections.push(toSection(current));
  return { intro: intro.join("\n").trim(), sections };
}

function toSection(s: { heading: string; lines: string[] }): Section {
  return { heading: s.heading, slug: slugify(s.heading), body: s.lines.join("\n").trim() };
}

// ---------------------------------------------------------------------------
// Lint — chapters are the current truth, written for a client. No commit
// hashes, no changelog talk, no leftover TODOs.
// ---------------------------------------------------------------------------

export type LintIssue = { file: string; line: number; message: string; level: "error" | "warning" };

export const LINT_RULES: Array<{ re: RegExp; message: string; level: LintIssue["level"] }> = [
  { re: /\b(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)[0-9a-f]{7,40}\b/, message: "looks like a commit hash; describe the change in the chapter instead", level: "error" },
  { re: /\bcommit(s|ted)?\b/i, message: "mentions commits; clients read the current state, not history", level: "error" },
  { re: /\b(PR|pull request)\s*#?\d+/i, message: "mentions a pull request", level: "error" },
  { re: /\bchange ?log\b/i, message: "mentions a changelog; update the chapter in place", level: "error" },
  { re: /\bTODO\b|\bFIXME\b|\bTBD\b/, message: "leftover TODO / FIXME / TBD", level: "warning" },
];

/** Strips fenced and inline code, keeping line numbers stable. */
function proseLines(body: string): string[] {
  let fence = false;
  return body.split(/\r?\n/).map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fence = !fence;
      return "";
    }
    return fence ? "" : line.replace(/`[^`]*`/g, "");
  });
}

export function lintChapter(ch: Pick<Chapter, "file" | "body" | "title">): LintIssue[] {
  const issues: LintIssue[] = [];
  const name = basename(ch.file);
  if (!ch.body.trim()) issues.push({ file: name, line: 1, message: "chapter is empty", level: "error" });
  proseLines(ch.body).forEach((line, idx) => {
    for (const rule of LINT_RULES) {
      if (rule.re.test(line)) issues.push({ file: name, line: idx + 1, message: rule.message, level: rule.level });
    }
  });
  return issues;
}

/** Every `source="…"` and `left/right="…"` a chapter asks a provider for. */
export function referencedSources(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(/^:::\s*\w+([^\n]*)$/gm)) {
    for (const a of m[1].matchAll(/\b(source|left|right)="([^"]+)"/g)) out.add(a[2]);
  }
  return [...out];
}

export function referencedScreens(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(/^:::\s*screen\b([^\n]*)$/gm)) {
    const n = m[1].match(/\bname="([^"]+)"/);
    if (n) out.add(n[1]);
  }
  return [...out];
}
