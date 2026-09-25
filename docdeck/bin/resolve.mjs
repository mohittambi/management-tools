// Lets a project's config and providers `import … from "docdeck"` without
// installing the engine in that project: the bare specifier resolves to this
// engine, wherever it lives.
const INDEX = new URL("../src/index.ts", import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier === "docdeck") return { url: INDEX, shortCircuit: true };
  return next(specifier, context);
}
