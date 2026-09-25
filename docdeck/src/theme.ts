import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { THEME_ROLES, type LoadedConfig, type ThemeRole } from "./config.ts";

const engineDir = dirname(dirname(fileURLToPath(import.meta.url)));

/** Neutral fallback, used only for roles a project does not map. */
export const DEFAULT_TOKENS: Record<ThemeRole, string> = {
  paper: "#f7f7f5",
  ink: "#1a1d24",
  surface: "#ffffff",
  accent: "#2f4f7f",
  accent2: "#2e6b5e",
  attention: "#b0782b",
  rule: "#d6d3cc",
  muted: "#5d6270",
};

/**
 * Custom properties declared directly inside `selector { … }` at the top level
 * of a stylesheet. Nested blocks (media queries, @theme) are skipped, so a
 * Tailwind file works as long as its tokens sit in a plain :root block.
 */
export function parseCssVars(css: string, selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let depth = 0;
  let boundary = 0; // index just after the last "{", "}" or ";"
  let i = 0;
  while (i < clean.length) {
    const ch = clean[i];
    if (ch === "{") {
      const headSel = clean.slice(boundary, i).trim();
      boundary = i + 1;
      if (depth === 0 && headSel.split(",").map((s) => s.trim()).includes(selector)) {
        let d = 1;
        let j = i + 1;
        while (j < clean.length && d > 0) {
          if (clean[j] === "{") d++;
          else if (clean[j] === "}") d--;
          j++;
        }
        const body = clean.slice(i + 1, j - 1);
        // Only declarations at this block's own level.
        let level = 0;
        let flat = "";
        for (const c of body) {
          if (c === "{") level++;
          else if (c === "}") level--;
          else if (level === 0) flat += c;
        }
        for (const m of flat.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
        i = j;
        boundary = j;
        continue;
      }
      depth++;
    } else if (ch === "}") {
      depth = Math.max(0, depth - 1);
      boundary = i + 1;
    } else if (ch === ";") {
      boundary = i + 1;
    }
    i++;
  }
  return out;
}

export function resolveTokens(loaded: LoadedConfig): Record<ThemeRole, string> {
  const { theme } = loaded.config;
  const vars = theme.css ? parseCssVars(readFileSync(loaded.path(theme.css), "utf8"), theme.selector) : {};
  const tokens = { ...DEFAULT_TOKENS };
  for (const role of THEME_ROLES) {
    const mapped = theme.map[role];
    if (mapped) {
      const value = mapped.startsWith("--") ? vars[mapped] : mapped;
      if (!value) throw new Error(`theme.map.${role} points at ${mapped}, which ${theme.css} does not declare in ${theme.selector}`);
      tokens[role] = resolveVarRefs(value, vars);
    }
    if (theme.tokens[role]) tokens[role] = theme.tokens[role];
  }
  return tokens;
}

function resolveVarRefs(value: string, vars: Record<string, string>, depth = 0): string {
  const m = value.match(/^var\((--[\w-]+)\)$/);
  if (!m || depth > 5) return value;
  return resolveVarRefs(vars[m[1]] ?? value, vars, depth + 1);
}

export function themeCss(tokens: Record<ThemeRole, string>): string {
  const lines = THEME_ROLES.map((r) => `  --dd-${r}: ${tokens[r]};`);
  return `:root {\n${lines.join("\n")}\n}`;
}

// ---------------------------------------------------------------------------
// Fonts — embedded as data URIs so the HTML and the PDF are self-contained.
// ---------------------------------------------------------------------------

type FontSpec = string | { family: string; package?: string; files?: Record<string, string> };
export type FontRole = "display" | "body" | "mono";

const DEFAULT_FONTS: Record<FontRole, FontSpec> = {
  display: "@fontsource/source-serif-4",
  body: "@fontsource/geist",
  mono: "@fontsource/geist-mono",
};

const FALLBACK_STACK: Record<FontRole, string> = {
  display: 'Georgia, "Times New Roman", serif',
  body: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
};

const WEIGHTS = ["400", "500", "600", "700"];

export type ResolvedFont = { role: FontRole; family: string; faces: Array<{ weight: string; file: string }> };

function familyFromPackage(pkg: string): string {
  const id = pkg.replace(/^@fontsource(-variable)?\//, "");
  return id
    .split("-")
    .map((w) => (/^\d+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function packageDir(pkg: string, root: string): string | null {
  for (const base of [root, engineDir]) {
    try {
      const req = createRequire(join(base, "package.json"));
      return dirname(req.resolve(`${pkg}/package.json`));
    } catch {
      /* try next */
    }
  }
  return null;
}

export function resolveFont(role: FontRole, spec: FontSpec | undefined, loaded: LoadedConfig): ResolvedFont {
  const s = spec ?? DEFAULT_FONTS[role];
  const pkg = typeof s === "string" ? s : s.package;
  const family = typeof s === "string" ? familyFromPackage(s) : s.family;
  const faces: ResolvedFont["faces"] = [];
  if (typeof s !== "string" && s.files) {
    for (const [weight, file] of Object.entries(s.files)) faces.push({ weight, file: loaded.path(file) });
  } else if (pkg) {
    const dir = packageDir(pkg, loaded.root);
    if (!dir) throw new Error(`Font package ${pkg} is not installed (theme.fonts.${role}). Run: pnpm add -D ${pkg}`);
    const files = readdirSync(join(dir, "files"));
    const id = pkg.replace(/^@fontsource(-variable)?\//, "");
    for (const w of WEIGHTS) {
      const f = files.find((n) => n === `${id}-latin-${w}-normal.woff2`);
      if (f) faces.push({ weight: w, file: join(dir, "files", f) });
    }
  }
  return { role, family, faces };
}

export function resolveFonts(loaded: LoadedConfig): Record<FontRole, ResolvedFont> {
  const f = loaded.config.theme.fonts;
  return {
    display: resolveFont("display", f.display, loaded),
    body: resolveFont("body", f.body, loaded),
    mono: resolveFont("mono", f.mono, loaded),
  };
}

const MIME: Record<string, string> = { ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf" };

export function fontCss(fonts: Record<FontRole, ResolvedFont>): string {
  const faces: string[] = [];
  const seen = new Set<string>();
  for (const font of Object.values(fonts)) {
    for (const face of font.faces) {
      const key = `${font.family}|${face.weight}`;
      if (seen.has(key) || !existsSync(face.file)) continue;
      seen.add(key);
      const data = readFileSync(face.file).toString("base64");
      const mime = MIME[extname(face.file)] ?? "font/woff2";
      faces.push(
        `@font-face { font-family: "${font.family}"; font-weight: ${face.weight}; font-style: normal; font-display: block; src: url(data:${mime};base64,${data}) format("${mime.split("/")[1]}"); }`,
      );
    }
  }
  const vars = (Object.keys(fonts) as FontRole[])
    .map((r) => `  --dd-font-${r}: "${fonts[r].family}", ${FALLBACK_STACK[r]};`)
    .join("\n");
  return `${faces.join("\n")}\n:root {\n${vars}\n}`;
}

/** A font file pdf-lib can embed for stamped footers (woff, ttf, otf). */
export function stampFontFile(font: ResolvedFont): string | null {
  for (const face of font.faces) {
    if (face.weight !== "400" && face.weight !== "500") continue;
    const woff = face.file.replace(/\.woff2$/, ".woff");
    if (existsSync(woff)) return woff;
    if (/\.(ttf|otf|woff)$/.test(face.file)) return face.file;
  }
  return null;
}
