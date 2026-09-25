export { defineConfig, THEME_ROLES, type DocdeckConfigInput, type ThemeRole } from "./config.ts";
export type { CardData, Cell, FlowData, FlowStep, SummaryData, TableData, Tone } from "./providers.ts";
export { build, check } from "./build.ts";
export { BLOCKS } from "./blocks/index.ts";
export { LINT_RULES } from "./content.ts";
export { DEFAULT_TOKENS } from "./theme.ts";

/** Typed helper for a project's providers.ts. */
export function defineProviders<T extends Record<string, unknown>>(providers: T): T {
  return providers;
}
