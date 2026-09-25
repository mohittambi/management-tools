import { THEME_ROLES, type ThemeRole } from "./config.ts";
import { dataUri } from "./render.ts";

/**
 * Backgrounds for each surface: book pages, the book cover, deck slides, the
 * deck cover and chapter openers. A background is a theme role, a colour, a
 * CSS gradient, or an image, with an optional overlay, and text that turns
 * light on dark grounds so it stays readable.
 */
export const SURFACES = ["page", "cover", "slide", "deckCover", "chapter"] as const;
export type Surface = (typeof SURFACES)[number];

export type BackgroundSpec =
  | string
  | {
      color?: string;
      gradient?: string;
      image?: string;
      size?: string;
      position?: string;
      repeat?: string;
      overlay?: string;
      text?: "auto" | "light" | "dark";
    };

/** What each surface looks like when the project says nothing. */
export const DEFAULT_BACKGROUNDS: Record<Surface, BackgroundSpec> = {
  page: "paper",
  cover: "paper",
  slide: "paper",
  deckCover: "ink",
  chapter: "paper",
};

const SELECTOR: Record<Exclude<Surface, "page">, string> = {
  cover: ".dd-cover",
  slide: ".dd-slide",
  deckCover: ".dd-slide.dd-slide-cover",
  chapter: ".dd-slide.dd-slide-chapter",
};

type Tokens = Record<ThemeRole, string>;

function isRole(v: string): v is ThemeRole {
  return (THEME_ROLES as readonly string[]).includes(v);
}

/** A role name, or any CSS colour, as a CSS colour. */
export function colour(v: string, tokens: Tokens): string {
  return isRole(v) ? tokens[v] : v;
}

function isGradient(v: string) {
  return /gradient\(/.test(v);
}

/** Relative luminance 0–1 of a hex or rgb() colour; null when unknown. */
export function luminance(c: string): number | null {
  let r: number, g: number, b: number;
  const hex = c.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  const rgb = c.trim().match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((x) => x + x).join("") : hex[1];
    [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  } else if (rgb) {
    [r, g, b] = [rgb[1], rgb[2], rgb[3]].map(Number);
  } else {
    return null;
  }
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function firstColourIn(v: string): string | null {
  return v.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/i)?.[0] ?? null;
}

export type ResolvedBackground = {
  color: string | null;
  layers: Array<{ image: string; size: string; position: string; repeat: string }>;
  text: "light" | "dark" | null;
};

export function resolveBackground(spec: BackgroundSpec, tokens: Tokens, path: (p: string) => string): ResolvedBackground {
  const s = typeof spec === "string" ? (isGradient(spec) ? { gradient: spec } : { color: spec }) : spec;
  const color = s.color ? colour(s.color, tokens) : null;
  const layers: ResolvedBackground["layers"] = [];
  if (s.overlay) {
    const o = colour(s.overlay, tokens);
    layers.push({ image: `linear-gradient(${o}, ${o})`, size: "100% 100%", position: "center", repeat: "no-repeat" });
  }
  if (s.gradient) layers.push({ image: s.gradient, size: "100% 100%", position: "center", repeat: "no-repeat" });
  if (s.image) {
    const uri = dataUri(path(s.image));
    if (!uri) throw new Error(`background image not found: ${s.image}`);
    layers.push({ image: `url("${uri}")`, size: s.size ?? "cover", position: s.position ?? "center", repeat: s.repeat ?? "no-repeat" });
  }
  // Which way should text go? An explicit choice wins; otherwise judge by the
  // overlay, then the colour, then the gradient's first colour.
  let text: ResolvedBackground["text"] = s.text && s.text !== "auto" ? s.text : null;
  if (!text) {
    const probe = (s.overlay && colour(s.overlay, tokens)) || color || (s.gradient && firstColourIn(s.gradient));
    const l = probe ? luminance(probe) : null;
    if (l !== null) text = l < 0.4 ? "light" : "dark";
  }
  return { color, layers, text };
}

function declarations(bg: ResolvedBackground): string[] {
  const out: string[] = [];
  out.push(`background-color: ${bg.color ?? "transparent"};`);
  if (bg.layers.length) {
    out.push(`background-image: ${bg.layers.map((l) => l.image).join(", ")};`);
    out.push(`background-size: ${bg.layers.map((l) => l.size).join(", ")};`);
    out.push(`background-position: ${bg.layers.map((l) => l.position).join(", ")};`);
    out.push(`background-repeat: ${bg.layers.map((l) => l.repeat).join(", ")};`);
  } else {
    out.push("background-image: none;");
  }
  return out;
}

/**
 * Text colours for a surface, re-derived so tints and rules follow. Only when
 * the surface flips against the theme: dark text on a light theme's light
 * ground needs nothing.
 */
function textScope(text: ResolvedBackground["text"], natural: "light" | "dark"): string[] {
  if (!text || text === natural) return [];
  const ink = text === "light" ? "var(--dd-light)" : "var(--dd-dark)";
  return [
    `--dd-ink: ${ink};`,
    "--dd-muted: color-mix(in oklab, var(--dd-ink) 68%, transparent);",
    "--dd-rule: color-mix(in oklab, var(--dd-ink) 22%, transparent);",
    ...(text === "light"
      ? [
          "--dd-surface: color-mix(in oklab, var(--dd-ink) 8%, transparent);",
          "--dd-accent-tint: color-mix(in oklab, var(--dd-accent) 30%, transparent);",
          "--dd-accent2-tint: color-mix(in oklab, var(--dd-accent2) 30%, transparent);",
          "--dd-attention-tint: color-mix(in oklab, var(--dd-attention) 30%, transparent);",
          "--dd-muted-tint: color-mix(in oklab, var(--dd-ink) 12%, transparent);",
          "--dd-attention-ink: var(--dd-ink);",
          "--dd-emphasis: color-mix(in oklab, var(--dd-accent) 38%, var(--dd-light));",
        ]
      : []),
    "color: var(--dd-ink);",
  ];
}

/** The lighter and the darker of paper and ink, for text on any ground. */
export function contrastPair(tokens: Tokens) {
  const lp = luminance(tokens.paper) ?? 1;
  const li = luminance(tokens.ink) ?? 0;
  return lp >= li ? { light: tokens.paper, dark: tokens.ink } : { light: tokens.ink, dark: tokens.paper };
}

/**
 * CSS for every surface. `page` goes on @page so it reaches the page edge on
 * every page of the book; the rest are element backgrounds.
 */
export function backgroundCss(specs: Partial<Record<Surface, BackgroundSpec>>, tokens: Tokens, path: (p: string) => string) {
  const merged = { ...DEFAULT_BACKGROUNDS, ...specs };
  const pair = contrastPair(tokens);
  // Which way the theme's own text runs: dark ink on light paper, or the reverse.
  const natural: "light" | "dark" = (luminance(tokens.ink) ?? 0) < 0.4 ? "dark" : "light";
  const dark: Partial<Record<Surface, boolean>> = {};
  const rules: string[] = [`:root { --dd-light: ${pair.light}; --dd-dark: ${pair.dark}; }`];
  const page = resolveBackground(merged.page, tokens, path);
  const pageDecl = declarations(page).join(" ");
  // @page carries the page background edge to edge. The root and body stay
  // clear in print so they do not paint over it.
  rules.push(`@media print { .dd-book-root, .dd-book-root body { background: transparent !important; } }`);
  rules.push(`@media screen { .dd-book-root { ${pageDecl} background-attachment: fixed; } .dd-book-root body { background: transparent; } }`);
  rules.push(`.dd-book { ${textScope(page.text, natural).join(" ")} }`);
  dark.page = (page.text ?? natural) === "light";
  for (const surface of ["cover", "slide", "chapter", "deckCover"] as const) {
    const bg = resolveBackground(merged[surface], tokens, path);
    rules.push(`${SELECTOR[surface]} { ${[...declarations(bg), ...textScope(bg.text, natural)].join(" ")} }`);
    dark[surface] = (bg.text ?? natural) === "light";
  }
  /** Surfaces whose text runs light, so the renderer can pick the on-dark logo. */
  return { css: rules.join("\n"), pageDeclarations: pageDecl, dark };
}
