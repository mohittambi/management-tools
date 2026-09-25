import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Browser, BrowserContext } from "playwright-core";
import type { DocdeckConfig } from "./config.ts";

type Screens = NonNullable<DocdeckConfig["screens"]>;
type Login = NonNullable<Screens["login"]>;

export type ScreenResult = { uris: Map<string, string | null>; warnings: string[] };

async function reachable(url: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), redirect: "manual" });
    return res.status > 0;
  } catch {
    return false;
  }
}

async function signIn(context: BrowserContext, baseUrl: string, login: Login) {
  const page = await context.newPage();
  await page.goto(new URL(login.path, baseUrl).href, { waitUntil: "domcontentloaded" });
  await page.fill(login.fields.email, login.email);
  await page.fill(login.fields.password, login.password);
  await page.click(login.submit);
  await page.waitForURL((u) => !u.pathname.startsWith(login.path), { timeout: 60_000 });
  await page.close();
}

/**
 * Captures each screen the chapters ask for. Captures are cached in
 * <out>/.screens so a --no-screens build can reuse the last good set.
 */
export async function captureScreens(
  browser: Browser | null,
  screens: Screens | undefined,
  wanted: string[],
  outDir: string,
  opts: { capture: boolean },
): Promise<ScreenResult> {
  const uris = new Map<string, string | null>();
  const warnings: string[] = [];
  const cache = join(outDir, ".screens");
  mkdirSync(cache, { recursive: true });
  const cached = (name: string) => {
    const f = join(cache, `${name}.png`);
    return existsSync(f) ? `data:image/png;base64,${readFileSync(f).toString("base64")}` : null;
  };
  for (const n of wanted) uris.set(n, cached(n));
  if (!opts.capture || !screens || wanted.length === 0 || !browser) return { uris, warnings };

  if (!(await reachable(screens.baseUrl))) {
    warnings.push(`${screens.baseUrl} is not reachable, so screens were not refreshed. Start the app, or build with --no-screens.`);
    return { uris, warnings };
  }

  const contexts = new Map<string, BrowserContext>();
  const contextFor = async (as?: string) => {
    const key = as ?? "_default";
    if (contexts.has(key)) return contexts.get(key)!;
    const context = await browser.newContext({ viewport: screens.viewport, deviceScaleFactor: 2 });
    const login = as ? screens.logins[as] : screens.login;
    if (as && !login) throw new Error(`screens.logins.${as} is not defined`);
    if (login) await signIn(context, screens.baseUrl, login);
    contexts.set(key, context);
    return context;
  };

  for (const name of wanted) {
    const spec = screens.shots[name];
    if (!spec) {
      warnings.push(`Screen "${name}" is not listed under screens.shots in the config.`);
      continue;
    }
    const shot = typeof spec === "string" ? { path: spec, fullPage: false } : spec;
    try {
      const context = await contextFor(typeof spec === "string" ? undefined : spec.as);
      const page = await context.newPage();
      await page.goto(new URL(shot.path, screens.baseUrl).href, { waitUntil: "networkidle", timeout: 60_000 });
      if ("click" in shot && shot.click) {
        await page.click(shot.click, { timeout: 15_000 });
        await page.waitForLoadState("networkidle");
      }
      if ("wait" in shot && shot.wait) await page.waitForSelector(shot.wait, { timeout: 15_000 });
      await page.evaluate(() => document.fonts.ready);
      const png = await page.screenshot({ fullPage: shot.fullPage ?? false });
      writeFileSync(join(cache, `${name}.png`), png);
      uris.set(name, `data:image/png;base64,${png.toString("base64")}`);
      await page.close();
    } catch (e) {
      warnings.push(`Screen "${name}" failed: ${(e instanceof Error ? e.message : String(e)).split("\n")[0]}`);
    }
  }
  for (const c of contexts.values()) await c.close();
  return { uris, warnings };
}
