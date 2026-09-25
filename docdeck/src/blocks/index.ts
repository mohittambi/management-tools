import type MarkdownIt from "markdown-it";
import { asCards, asFlow, asSummary, asTable, type Cell, type Tone } from "../providers.ts";

export type BlockContext = {
  sources: Map<string, unknown>;
  /** Screen name → data URI, or null when the capture was skipped / failed. */
  screens: Map<string, string | null>;
  md: MarkdownIt;
};

export type BlockAttrs = Record<string, string>;

/** Blocks and whether they take Markdown content between the fences. */
export const BLOCKS = ["table", "matrix", "flow", "compare", "cards", "callout", "screen", "decisions", "columns", "stats"] as const;
export type BlockName = (typeof BLOCKS)[number];

export function parseAttrs(info: string): BlockAttrs {
  const out: BlockAttrs = {};
  for (const m of info.matchAll(/(\w+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const TONES = new Set(["accent", "accent2", "attention", "muted"]);
function tone(t: string | undefined, fallback: Tone = "accent"): Tone {
  return (t && TONES.has(t) ? t : fallback) as Tone;
}

function need(ctx: BlockContext, attrs: BlockAttrs, key: string, block: string): unknown {
  const src = attrs[key];
  if (!src) throw new Error(`:::${block} needs ${key}="…"`);
  if (!ctx.sources.has(src)) throw new Error(`:::${block} ${key}="${src}" was not resolved`);
  return ctx.sources.get(src);
}

function cell(c: Cell, md: MarkdownIt): string {
  if (c === true) return '<span class="dd-yes" aria-label="yes">●</span>';
  if (c === false) return '<span class="dd-no" aria-label="no">–</span>';
  if (c === null || c === undefined || c === "") return '<span class="dd-no">–</span>';
  if (typeof c === "number") return `<span class="dd-num">${c}</span>`;
  if (typeof c === "object" && "chip" in c) return `<span class="dd-chip dd-tone-${tone(c.tone)}">${esc(c.chip)}</span>`;
  if (typeof c === "object" && "code" in c) return `<code>${esc(c.code)}</code>`;
  return md.renderInline(String(c));
}

/** Opening HTML (data blocks render fully here) and closing HTML. */
export function renderBlock(name: BlockName, attrs: BlockAttrs, ctx: BlockContext): { open: string; close: string } {
  const { md } = ctx;
  switch (name) {
    case "table":
    case "matrix": {
      const t = asTable(need(ctx, attrs, "source", name), attrs.source);
      const caption = attrs.caption ?? t.caption;
      const head = t.columns.map((c, i) => `<th${i > 0 && name === "matrix" ? ' class="dd-c"' : ""}>${esc(c)}</th>`).join("");
      const body = t.rows
        .map((r) => `<tr>${r.map((c, i) => `<td${i > 0 && name === "matrix" ? ' class="dd-c"' : ""}>${cell(c, md)}</td>`).join("")}</tr>`)
        .join("");
      const note = t.note ? `<p class="dd-note">${md.renderInline(t.note)}</p>` : "";
      return {
        open: `<figure class="dd-table-block${name === "matrix" ? " dd-matrix" : ""}${t.columns.length <= 2 && name === "table" ? " dd-narrow" : ""}">${caption ? `<figcaption>${esc(caption)}</figcaption>` : ""}<div class="dd-table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${note}<div class="dd-block-note">`,
        close: "</div></figure>",
      };
    }
    case "flow": {
      const f = asFlow(need(ctx, attrs, "source", name), attrs.source);
      const current = attrs.current !== undefined ? Number(attrs.current) : f.current;
      const steps = f.steps
        .map((s, i) => {
          const state = current === undefined ? "" : i < current ? " dd-done" : i === current ? " dd-current" : " dd-later";
          return `<li class="dd-step${state}"><span class="dd-step-n">${String(i + 1).padStart(2, "0")}</span><span class="dd-step-label">${esc(s.label)}</span>${s.who ? `<span class="dd-who dd-tone-${tone(s.tone, "muted")}">${esc(s.who)}</span>` : ""}${s.note ? `<span class="dd-step-note">${md.renderInline(s.note)}</span>` : ""}</li>`;
        })
        .join("");
      const caption = attrs.caption ?? f.caption;
      return {
        open: `<figure class="dd-flow-block">${caption ? `<figcaption>${esc(caption)}</figcaption>` : ""}<ol class="dd-flow" style="--dd-steps: ${Math.min(f.steps.length, 9)}">${steps}</ol><div class="dd-block-note">`,
        close: "</div></figure>",
      };
    }
    case "compare": {
      const side = (key: "left" | "right", fallback: Tone) => {
        const s = asSummary(need(ctx, attrs, key, name), attrs[key]);
        return `<div class="dd-side dd-tone-${tone(s.tone, fallback)}"><h4>${esc(s.title)}</h4>${s.lead ? `<p class="dd-lead">${md.renderInline(s.lead)}</p>` : ""}<ul>${s.points.map((p) => `<li>${md.renderInline(p)}</li>`).join("")}</ul></div>`;
      };
      return {
        open: `<div class="dd-compare">${side("left", "accent")}${side("right", "accent2")}</div><div class="dd-block-note">`,
        close: "</div>",
      };
    }
    case "cards": {
      if (attrs.source) {
        const cards = asCards(need(ctx, attrs, "source", name), attrs.source);
        const html = cards
          .map(
            (c) =>
              `<div class="dd-card dd-tone-${tone(c.tone)}">${c.tag ? `<span class="dd-tag">${esc(c.tag)}</span>` : ""}<h4>${esc(c.title)}</h4>${c.body ? `<p>${md.renderInline(c.body)}</p>` : ""}${c.points ? `<ul>${c.points.map((p) => `<li>${md.renderInline(p)}</li>`).join("")}</ul>` : ""}</div>`,
          )
          .join("");
        return { open: `<div class="dd-cards">${html}</div><div class="dd-block-note">`, close: "</div>" };
      }
      // Inline: each list item of the content becomes a card.
      return { open: '<div class="dd-cards dd-cards-inline">', close: "</div>" };
    }
    case "stats": {
      const v = need(ctx, attrs, "source", name);
      if (!Array.isArray(v)) throw new Error(`"${attrs.source}" must be a list of { value, label } to use in stats`);
      const html = (v as Array<{ value: string | number; label: string; tone?: Tone }>)
        .map((s) => `<div class="dd-stat dd-tone-${tone(s.tone)}"><span class="dd-stat-value">${esc(s.value)}</span><span class="dd-stat-label">${md.renderInline(String(s.label))}</span></div>`)
        .join("");
      return { open: `<div class="dd-stats">${html}</div><div class="dd-block-note">`, close: "</div>" };
    }
    case "callout":
      return {
        open: `<aside class="dd-callout dd-tone-${tone(attrs.tone, "accent")}">${attrs.title ? `<div class="dd-callout-title">${esc(attrs.title)}</div>` : ""}`,
        close: "</aside>",
      };
    case "decisions":
      return { open: `<div class="dd-decisions"${attrs.ask ? ` data-ask="${esc(attrs.ask)}"` : ""}>`, close: "</div>" };
    case "columns":
      return { open: '<div class="dd-columns">', close: "</div>" };
    case "screen": {
      const nameAttr = attrs.name;
      if (!nameAttr) throw new Error(':::screen needs name="…"');
      const uri = ctx.screens.get(nameAttr);
      const caption = attrs.caption ? `<figcaption>${esc(attrs.caption)}</figcaption>` : "";
      const img = uri
        ? `<div class="dd-screen-frame"><img src="${uri}" alt="${esc(attrs.caption ?? nameAttr)}"></div>`
        : `<div class="dd-screen-frame dd-screen-missing"><span>Screen “${esc(nameAttr)}” appears here when the build runs with the app available.</span></div>`;
      return { open: `<figure class="dd-screen">${img}${caption}<div class="dd-block-note">`, close: "</div></figure>" };
    }
  }
}
