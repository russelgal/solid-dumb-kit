import { LOC_ATTR } from '../chunk/PF3E7QT2.js';
import { parse } from '@babel/parser';

var isOwnMarkup = (id) => id.endsWith(".tsx") && !id.endsWith(".test.tsx") && !id.includes("/node_modules/");
function tagPositions(node, found) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) tagPositions(item, found);
    return;
  }
  const record = node;
  if (record.type === "JSXOpeningElement") {
    const name = record.name;
    const loc = record.loc;
    const first = name.name?.[0] ?? "";
    if (name.type === "JSXIdentifier" && first !== first.toUpperCase() && name.end && loc) {
      found.push({ at: name.end, line: loc.start.line, column: loc.start.column + 1 });
    }
  }
  for (const value of Object.values(record)) tagPositions(value, found);
}
function markLocations(code, file, attribute = LOC_ATTR) {
  const found = [];
  tagPositions(parse(code, { sourceType: "module", plugins: ["jsx", "typescript"] }).program, found);
  let marked = code;
  for (const tag of found.sort((a, b) => b.at - a.at)) {
    marked = `${marked.slice(0, tag.at)} ${attribute}="${file}:${tag.line}:${tag.column}"${marked.slice(tag.at)}`;
  }
  return marked;
}
var relativeTo = (root, file) => file.startsWith(`${root}/`) ? file.slice(root.length + 1) : file;
function locator(options = {}) {
  const attribute = options.attribute ?? LOC_ATTR;
  const include = options.include ?? isOwnMarkup;
  let root = "";
  return {
    name: "dumb-locator",
    // Только дев-сервер: в сборке ни атрибутов, ни браузерной половины нет.
    apply: "serve",
    enforce: "pre",
    config() {
      const env = globalThis.process;
      if (options.editor && env && !env.env.LAUNCH_EDITOR) env.env.LAUNCH_EDITOR = options.editor;
    },
    configResolved(config) {
      root = config.root;
    },
    transform(code, id, transformOptions) {
      const file = id.split("?")[0];
      if (!include(file)) return null;
      const marked = markLocations(code, relativeTo(root, file), attribute);
      return options.entry && !transformOptions?.ssr && file === `${root}/${options.entry}` ? `import { createLocator as __locator } from '@solid-dumb-kit/locator';
__locator(${attribute === LOC_ATTR ? "" : JSON.stringify({ attribute })});
${marked}` : marked;
    }
  };
}

export { locator, markLocations };
