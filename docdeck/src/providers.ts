import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * A project's providers module default-exports an object. Keys may be nested
 * ({ inward: { path: … } }) or dotted ("inward.path"). Values are data or a
 * function returning data (sync or async). Chapters ask for them by path.
 */
export type ProviderModule = Record<string, unknown>;

export type Cell = string | number | boolean | null | undefined | { chip: string; tone?: Tone } | { code: string };
export type Tone = "accent" | "accent2" | "attention" | "muted";

export type TableData = { columns: string[]; rows: Cell[][]; caption?: string; note?: string };
export type FlowStep = { label: string; who?: string; note?: string; tone?: Tone };
export type FlowData = { steps: FlowStep[]; current?: number; caption?: string };
export type CardData = { title: string; body?: string; tag?: string; tone?: Tone; points?: string[] };
export type SummaryData = { title: string; lead?: string; points: string[]; tone?: Tone };

export async function loadProviders(file: string | undefined): Promise<ProviderModule> {
  if (!file) return {};
  if (!existsSync(file)) throw new Error(`providers file not found: ${file}`);
  const mod = await import(pathToFileURL(file).href);
  const value = mod.default ?? mod.providers;
  if (!value || typeof value !== "object") throw new Error(`${file} must default-export an object of providers`);
  return value as ProviderModule;
}

function lookup(mod: ProviderModule, path: string): unknown {
  if (path in mod) return mod[path];
  let cur: unknown = mod;
  for (const part of path.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return cur;
}

export function hasSource(mod: ProviderModule, path: string) {
  return lookup(mod, path) !== undefined;
}

/** Resolves every requested source once per build. */
export async function resolveSources(mod: ProviderModule, paths: string[]): Promise<Map<string, unknown>> {
  const out = new Map<string, unknown>();
  for (const p of paths) {
    const v = lookup(mod, p);
    if (v === undefined) throw new Error(`No provider for "${p}". Add it to the providers file or fix the chapter.`);
    out.set(p, typeof v === "function" ? await (v as () => unknown)() : v);
  }
  return out;
}

/** Accepts { columns, rows } or an array of plain objects (keys become columns). */
export function asTable(v: unknown, source: string): TableData {
  if (Array.isArray(v)) {
    if (v.length === 0) return { columns: [], rows: [] };
    const columns = Object.keys(v[0] as object);
    return { columns, rows: v.map((r) => columns.map((c) => (r as Record<string, Cell>)[c])) };
  }
  if (v && typeof v === "object" && Array.isArray((v as TableData).columns) && Array.isArray((v as TableData).rows)) return v as TableData;
  throw new Error(`"${source}" must be { columns, rows } or an array of objects to use in a table`);
}

export function asFlow(v: unknown, source: string): FlowData {
  if (Array.isArray(v)) return { steps: v.map((s) => (typeof s === "string" ? { label: s } : (s as FlowStep))) };
  if (v && typeof v === "object" && Array.isArray((v as FlowData).steps)) return v as FlowData;
  throw new Error(`"${source}" must be a list of steps to use in a flow`);
}

export function asCards(v: unknown, source: string): CardData[] {
  if (Array.isArray(v)) return v.map((c) => (typeof c === "string" ? { title: c } : (c as CardData)));
  throw new Error(`"${source}" must be a list of cards`);
}

export function asSummary(v: unknown, source: string): SummaryData {
  if (v && typeof v === "object" && Array.isArray((v as SummaryData).points)) return v as SummaryData;
  throw new Error(`"${source}" must be { title, points: [...] } to use in a compare block`);
}
