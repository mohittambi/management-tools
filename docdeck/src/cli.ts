import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import { homedir } from "node:os";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { build, check } from "./build.ts";
import { findConfig, loadConfig, type LoadedConfig } from "./config.ts";

const engineDir = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(join(engineDir, "package.json"), "utf8")) as { version: string };

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;

async function loaded(opts: { config?: string }): Promise<LoadedConfig> {
  const cwd = process.cwd();
  const file = findConfig(cwd, opts.config);
  if (!file) {
    throw new Error(`No docdeck config found in ${cwd}. Looked for docdeck.config.ts and docs/client/docdeck.config.ts.\nRun \`docdeck init\` to create one.`);
  }
  return loadConfig(file, cwd);
}

function rel(f: string) {
  return relative(process.cwd(), f) || f;
}

const program = new Command();
program
  .name("docdeck")
  .description("Themed client deck (16:9) and document (A4) as HTML and PDF, from Markdown chapters and live project data.")
  .version(pkg.version)
  .option("-c, --config <file>", "path to docdeck.config.ts");

program
  .command("build")
  .description("write deck.html, deck.pdf, book.html and book.pdf")
  .option("--deck", "deck only")
  .option("--book", "book only")
  .option("--no-pdf", "HTML only")
  .option("--no-screens", "reuse the last captured screens instead of opening the app")
  .option("--open", "open the PDFs (or HTML) when done")
  .action(async (o: { deck?: boolean; book?: boolean; pdf: boolean; screens: boolean; open?: boolean }) => {
    const l = await loaded(program.opts());
    const only = o.deck && !o.book ? "deck" : o.book && !o.deck ? "book" : null;
    const started = Date.now();
    const r = await build(l, { deck: only !== "book", book: only !== "deck", pdf: o.pdf, screens: o.screens });
    for (const w of r.warnings) console.log(yellow(`! ${w}`));
    for (const f of r.files) console.log(`${green("✓")} ${rel(f)}`);
    console.log(dim(`built in ${((Date.now() - started) / 1000).toFixed(1)}s`));
    if (o.open) {
      const show = r.files.filter((f) => f.endsWith(o.pdf ? ".pdf" : ".html"));
      const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
      for (const f of show) spawn(opener, [f], { detached: true, stdio: "ignore" }).unref();
    }
  });

program
  .command("check")
  .description("validate config, chapters, providers, screens and slide fit without writing files")
  .option("--no-deck", "skip the slide-fit check (no browser)")
  .action(async (o: { deck: boolean }) => {
    const l = await loaded(program.opts());
    const r = await check(l, { deck: o.deck });
    for (const w of r.warnings) console.log(yellow(`! ${w}`));
    for (const i of r.issues) {
      const where = i.line ? `${i.file}:${i.line}` : i.file;
      console.log(`${i.level === "error" ? red("✗") : yellow("!")} ${where}  ${i.message}`);
    }
    const errors = r.issues.filter((i) => i.level === "error").length;
    if (errors) {
      console.log(red(`${errors} error(s)`));
      process.exitCode = 1;
    } else {
      console.log(green("✓ chapters, providers and slides are good"));
    }
  });

program
  .command("preview")
  .description("serve the HTML and rebuild on every change to chapters, providers or config")
  .option("-p, --port <port>", "port", "4777")
  .action(async (o: { port: string }) => {
    const l = await loaded(program.opts());
    const { default: chokidar } = await import("chokidar");
    const out = l.path(l.config.out);
    const clients = new Set<ServerResponse>();
    let building = false;
    const rebuild = () => {
      if (building) return;
      building = true;
      // A fresh process per rebuild, so edited providers and config are
      // re-imported rather than served from the module cache.
      const child = spawn(process.execPath, [join(engineDir, "bin", "docdeck.mjs"), "-c", l.file, "build", "--no-pdf", "--no-screens"], {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
      });
      let log = "";
      child.stdout.on("data", (d) => (log += d));
      child.stderr.on("data", (d) => (log += d));
      child.on("close", (code) => {
        building = false;
        if (code === 0) {
          for (const line of log.split("\n").filter((x) => x.includes("!"))) console.log(line);
          console.log(`${green("✓")} rebuilt ${dim(new Date().toLocaleTimeString())}`);
          for (const c of clients) c.write("data: reload\n\n");
        } else {
          console.log(log.trim());
        }
      });
    };
    rebuild();
    const reload = `<script>new EventSource("/__reload").onmessage=()=>location.reload()</script>`;
    createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://x");
      if (url.pathname === "/__reload") {
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
        clients.add(res);
        req.on("close", () => clients.delete(res));
        return;
      }
      const name = url.pathname === "/" ? "" : basename(url.pathname);
      if (!name) {
        res.writeHead(200, { "content-type": "text/html" });
        res.end(`<!doctype html><meta charset="utf-8"><title>docdeck preview</title><body style="font-family:system-ui;padding:40px"><h1>${l.config.project.name}</h1><ul><li><a href="/book.html">Document</a></li><li><a href="/deck.html">Deck</a></li></ul>${reload}`);
        return;
      }
      const file = join(out, name);
      if (!existsSync(file)) {
        res.writeHead(404).end("not found");
        return;
      }
      const type = extname(file) === ".html" ? "text/html; charset=utf-8" : extname(file) === ".pdf" ? "application/pdf" : "application/octet-stream";
      res.writeHead(200, { "content-type": type });
      res.end(type.startsWith("text/html") ? readFileSync(file, "utf8").replace("</body>", `${reload}</body>`) : readFileSync(file));
    }).listen(Number(o.port), () => console.log(`preview on ${green(`http://localhost:${o.port}`)}  ${dim("(ctrl+c to stop)")}`));
    const watched = [l.path(l.config.chapters), l.file, l.config.providers && l.path(l.config.providers), l.config.templates && l.path(l.config.templates)].filter(Boolean) as string[];
    chokidar.watch(watched, { ignoreInitial: true }).on("all", () => rebuild());
  });

program
  .command("init")
  .description("scaffold docs/client (config, providers, sample chapters) in this project")
  .option("--name <name>", "project name")
  .option("--logo <path>", "logo image, relative to the project root")
  .option("--css <path>", "stylesheet that declares the project's colour tokens")
  .option("--dir <dir>", "where to create the files", "docs/client")
  .option("-y, --yes", "accept defaults, no questions")
  .action(async (o: { name?: string; logo?: string; css?: string; dir: string; yes?: boolean }) => {
    const root = process.cwd();
    const dir = resolve(root, o.dir);
    if (existsSync(join(dir, "docdeck.config.ts"))) throw new Error(`${rel(join(dir, "docdeck.config.ts"))} already exists`);
    const rl = o.yes ? null : createInterface({ input: process.stdin, output: process.stdout });
    const ask = async (q: string, def: string) => (rl ? (await rl.question(`${q} ${dim(`(${def})`)} `)).trim() || def : def);
    const guessName = (() => {
      try {
        return (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { name?: string }).name ?? basename(root);
      } catch {
        return basename(root);
      }
    })();
    const name = o.name ?? (await ask("Project name?", guessName));
    const logo = o.logo ?? (await ask("Logo file?", "public/logo.png"));
    const css = o.css ?? (await ask("Stylesheet with colour tokens? (blank for none)", ""));
    rl?.close();
    const tpl = (f: string) => readFileSync(join(engineDir, "templates", "init", f), "utf8");
    const toRoot = relative(dir, root) || ".";
    mkdirSync(join(dir, "chapters"), { recursive: true });
    writeFileSync(
      join(dir, "docdeck.config.ts"),
      tpl("docdeck.config.ts.txt")
        .replaceAll("__NAME__", name)
        .replaceAll("__ROOT__", toRoot)
        .replaceAll("__LOGO__", logo)
        .replaceAll("__OUT__", relative(root, join(dir, "dist")))
        .replaceAll("__CHAPTERS__", relative(root, join(dir, "chapters")))
        .replaceAll("__PROVIDERS__", relative(root, join(dir, "providers.ts")))
        .replace("__THEME__", css ? `css: "${css}",\n    selector: ":root",\n    map: { paper: "--background", ink: "--foreground", accent: "--primary" },` : `tokens: { accent: "#2f4f7f" },`),
    );
    writeFileSync(join(dir, "providers.ts"), tpl("providers.ts.txt"));
    writeFileSync(join(dir, "GUIDE.md"), tpl("GUIDE.md.txt").replaceAll("__NAME__", name));
    // Scoped ESM, so the TypeScript config loads as a module in any project.
    if (!existsSync(join(dir, "package.json"))) writeFileSync(join(dir, "package.json"), '{\n  "private": true,\n  "type": "module"\n}\n');
    for (const f of readdirSync(join(engineDir, "templates", "init", "chapters"))) {
      writeFileSync(join(dir, "chapters", f), readFileSync(join(engineDir, "templates", "init", "chapters", f), "utf8").replaceAll("__NAME__", name));
    }
    console.log(`${green("✓")} created ${rel(dir)}/  (config, providers.ts, chapters/)`);
    console.log(dim(`next: edit the chapters, then run  docdeck build${o.dir === "docs/client" ? "" : ` -c ${rel(join(dir, "docdeck.config.ts"))}`}`));
  });

program
  .command("install-skill")
  .description("install the client-docs skill for Claude Code (~/.claude/skills, or this project with --project)")
  .option("--dest <dir>", "skills folder", join(homedir(), ".claude", "skills"))
  .option("--project", "install into ./.claude/skills so this project can customise its own copy")
  .action((o: { dest: string; project?: boolean }) => {
    const target = join(o.project ? join(process.cwd(), ".claude", "skills") : o.dest, "client-docs");
    mkdirSync(target, { recursive: true });
    cpSync(join(engineDir, "skill"), target, { recursive: true });
    const skill = join(target, "SKILL.md");
    writeFileSync(skill, readFileSync(skill, "utf8").replaceAll("__DOCDECK_BIN__", join(engineDir, "bin", "docdeck.mjs")));
    console.log(`${green("✓")} installed ${target}`);
    if (o.project) console.log(dim("edit its SKILL.md for this project; a GUIDE.md next to docdeck.config.ts is read too"));
  });

program.parseAsync(process.argv).catch((e: unknown) => {
  console.error(red(e instanceof Error ? e.message : String(e)));
  process.exit(1);
});
