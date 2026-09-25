import { existsSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";

/**
 * The engine's colour vocabulary. A project maps its own tokens onto these
 * roles; templates and styles only ever use the roles. That is what lets one
 * engine carry any project's theme.
 */
export const THEME_ROLES = ["paper", "ink", "surface", "accent", "accent2", "attention", "rule", "muted"] as const;
export type ThemeRole = (typeof THEME_ROLES)[number];

const fontSchema = z.union([
  z.string(), // a @fontsource package name, e.g. "@fontsource/geist"
  z.object({
    family: z.string(),
    package: z.string().optional(),
    files: z.record(z.string(), z.string()).optional(), // weight → font file path
  }),
]);

const loginSchema = z.object({
  path: z.string().default("/login"),
  email: z.string(),
  password: z.string(),
  fields: z.object({ email: z.string(), password: z.string() }).default({ email: "input[name=email]", password: "input[name=password]" }),
  submit: z.string().default("button[type=submit]"),
});

const shotSchema = z.union([
  z.string(),
  z.object({
    path: z.string(),
    as: z.string().optional(), // key in screens.logins
    click: z.string().optional(), // selector to click before capture, e.g. the first row link
    wait: z.string().optional(), // selector to wait for before capture
    fullPage: z.boolean().default(false),
  }),
]);

export const configSchema = z.object({
  root: z.string().optional(),
  project: z.object({
    name: z.string().min(1),
    /** What this document is, e.g. "Product walkthrough". Shown on the cover. */
    title: z.string().default("Product overview"),
    tagline: z.string().default(""),
    audience: z.string().default(""),
    edition: z.string().default("auto"),
  }),
  brand: z.object({
    logo: z.string(),
    logoOnDark: z.string().optional(),
    /** Small square mark for slide footers; the logo is used if absent. */
    mark: z.string().optional(),
  }),
  theme: z
    .object({
      css: z.string().optional(),
      selector: z.string().default(":root"),
      map: z.record(z.string(), z.string()).default({}),
      tokens: z.record(z.string(), z.string()).default({}),
      fonts: z
        .object({ display: fontSchema.optional(), body: fontSchema.optional(), mono: fontSchema.optional() })
        .default({}),
    })
    .default({ selector: ":root", map: {}, tokens: {}, fonts: {} }),
  chapters: z.string(),
  providers: z.string().optional(),
  templates: z.string().optional(),
  screens: z
    .object({
      baseUrl: z.string(),
      viewport: z.object({ width: z.number(), height: z.number() }).default({ width: 1440, height: 900 }),
      login: loginSchema.optional(),
      logins: z.record(z.string(), loginSchema).default({}),
      shots: z.record(z.string(), shotSchema).default({}),
    })
    .optional(),
  out: z.string().default("docs/client/dist"),
  outputs: z.array(z.enum(["deck", "book"])).default(["deck", "book"]),
});

export type DocdeckConfigInput = z.input<typeof configSchema>;
export type DocdeckConfig = z.output<typeof configSchema>;

/** Typed helper for a project's docdeck.config.ts. */
export function defineConfig(config: DocdeckConfigInput): DocdeckConfigInput {
  return config;
}

export const CONFIG_CANDIDATES = ["docdeck.config.ts", "docdeck.config.mts", "docdeck.config.mjs", "docs/client/docdeck.config.ts", "docs/client/docdeck.config.mts", "docs/client/docdeck.config.mjs"];

export function findConfig(cwd: string, explicit?: string): string | null {
  if (explicit) {
    const p = isAbsolute(explicit) ? explicit : resolve(cwd, explicit);
    return existsSync(p) ? p : null;
  }
  for (const c of CONFIG_CANDIDATES) {
    const p = resolve(cwd, c);
    if (existsSync(p)) return p;
  }
  return null;
}

export type LoadedConfig = {
  config: DocdeckConfig;
  file: string;
  root: string;
  /** Resolve a config path against the project root. */
  path: (p: string) => string;
};

export async function loadConfig(file: string, cwd: string): Promise<LoadedConfig> {
  const mod = await import(pathToFileURL(file).href);
  const raw = mod.default ?? mod.config;
  if (!raw) throw new Error(`${file} must export the config as default (export default defineConfig({...}))`);
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
    throw new Error(`Invalid docdeck config in ${file}:\n${issues}`);
  }
  const config = parsed.data;
  // Paths in the config are relative to the project root: `root` if given
  // (relative to the config file), otherwise the directory docdeck runs from.
  const root = config.root ? resolve(dirname(file), config.root) : cwd;
  return { config, file, root, path: (p: string) => (isAbsolute(p) ? p : resolve(root, p)) };
}
