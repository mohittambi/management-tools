import MarkdownIt, { type PluginWithParams } from "markdown-it";
import anchor from "markdown-it-anchor";
import container from "markdown-it-container";
import { BLOCKS, parseAttrs, renderBlock, type BlockContext, type BlockName } from "./blocks/index.ts";
import { slugify } from "./content.ts";

/**
 * One markdown-it instance per render. `::: name attrs` … `:::` fences become
 * docdeck blocks; everything else is ordinary Markdown. Raw HTML is off so a
 * chapter cannot break the page layout.
 */
export function createMarkdown(ctx: Omit<BlockContext, "md">, idPrefix = ""): MarkdownIt {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
  md.use(anchor, { slugify: (s: string) => `${idPrefix}${slugify(s)}`, level: [2, 3] });
  const full: BlockContext = { ...ctx, md };
  for (const name of BLOCKS) {
    md.use(container as unknown as PluginWithParams, name, {
      validate: (params: string) => new RegExp(`^${name}(\\s|$)`).test(params.trim()),
      render: (tokens: Array<{ nesting: number; info: string; meta?: unknown }>, idx: number) => {
        const token = tokens[idx];
        if (token.nesting === 1) {
          const attrs = parseAttrs(token.info.trim().slice(name.length));
          const out = renderBlock(name as BlockName, attrs, full);
          token.meta = out.close;
          return out.open;
        }
        // Find the matching opener to reuse its close markup.
        let depth = 0;
        for (let i = idx - 1; i >= 0; i--) {
          const t = tokens[i];
          if (t.nesting === -1 && (t as { type?: string }).type === `container_${name}_close`) depth++;
          if (t.nesting === 1 && (t as { type?: string }).type === `container_${name}_open`) {
            if (depth === 0) return String(t.meta ?? "");
            depth--;
          }
        }
        return "";
      },
    });
  }
  return md;
}
