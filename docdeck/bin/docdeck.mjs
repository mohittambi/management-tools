#!/usr/bin/env node
// Runs the TypeScript CLI through tsx, so project configs and data providers
// written in TypeScript load without a build step. The resolve hook maps the
// bare "docdeck" import to this engine, so projects need not install it.
import { register as registerHooks } from "node:module";
import { register } from "tsx/esm/api";

registerHooks("./resolve.mjs", import.meta.url);
register();
await import("../src/cli.ts");
