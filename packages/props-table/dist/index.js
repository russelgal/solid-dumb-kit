import { insert, createComponent, effect, className, setStyleProperty, setAttribute, template } from 'solid-js/web';
import { createMemo, Show, For } from 'solid-js';

// src/DumbPropsTable.tsx

// src/propsDump.ts
function describe(v) {
  if (v === null) return "null";
  if (v === void 0) return "undefined";
  if (typeof v === "function") {
    const f = v;
    return `\u0192 ${f.name || "anonymous"}(${f.length})`;
  }
  if (Array.isArray(v)) return `Array(${v.length})`;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    const keys = Object.keys(v);
    return `{${keys.slice(0, 6).join(", ")}${keys.length > 6 ? ", \u2026" : ""}}`;
  }
  if (typeof v === "string") return JSON.stringify(v);
  return String(v);
}
var kindOf = (v) => typeof v === "function" ? "function" : Array.isArray(v) ? "array" : v !== null && typeof v === "object" ? "object" : "primitive";
var WEIGHT = { object: 0, array: 1, function: 2, primitive: 3 };
function dumpProps(source, options = {}) {
  const maxDepth = options.depth ?? 1;
  const maxItems = options.maxItems ?? 8;
  const skip = new Set(options.skip ?? []);
  const out = [];
  const seen = /* @__PURE__ */ new WeakSet();
  const walk = (obj, depth, prefix) => {
    const entries = Object.keys(obj).map((key) => {
      let raw;
      try {
        raw = obj[key];
      } catch (e) {
        raw = `\u2039\u043E\u0448\u0438\u0431\u043A\u0430 \u0447\u0442\u0435\u043D\u0438\u044F: ${e?.message ?? e}\u203A`;
      }
      return { key, raw, kind: kindOf(raw) };
    });
    entries.sort((a, b) => WEIGHT[a.kind] - WEIGHT[b.kind] || a.key.localeCompare(b.key));
    for (const e of entries) {
      const path = prefix ? `${prefix}.${e.key}` : e.key;
      out.push({
        key: e.key,
        path,
        depth,
        type: typeof e.raw,
        kind: e.kind,
        value: describe(e.raw),
        raw: e.raw
      });
      if (depth >= maxDepth || skip.has(path) || skip.has(e.key)) continue;
      if (e.kind !== "object" && e.kind !== "array") continue;
      const child = e.raw;
      if (seen.has(child)) continue;
      seen.add(child);
      if (e.kind === "array") {
        const arr = child;
        for (let i = 0; i < Math.min(arr.length, maxItems); i++) {
          const item = arr[i];
          out.push({
            key: `[${i}]`,
            path: `${path}[${i}]`,
            depth: depth + 1,
            type: typeof item,
            kind: kindOf(item),
            value: describe(item),
            raw: item
          });
        }
        if (arr.length > maxItems) {
          out.push({
            key: `\u2026\u0435\u0449\u0451 ${arr.length - maxItems}`,
            path: `${path}[\u2026]`,
            depth: depth + 1,
            type: "array",
            kind: "primitive",
            value: "",
            raw: void 0
          });
        }
        continue;
      }
      walk(child, depth + 1, path);
    }
  };
  walk(source, 0, "");
  return out;
}

// src/DumbPropsTable.tsx
var _tmpl$ = /* @__PURE__ */ template(`<div class="mb-1 font-bold">`);
var _tmpl$2 = /* @__PURE__ */ template(`<thead><tr><th>\u043F\u0440\u043E\u043F</th><th>\u0442\u0438\u043F</th><th>\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435`);
var _tmpl$3 = /* @__PURE__ */ template(`<div><table class="table table-xs font-mono"><tbody>`);
var _tmpl$4 = /* @__PURE__ */ template(`<tr><td></td><td class=whitespace-nowrap style="color:var(--dumb-props-dim, var(--color-base-content, #475569))"></td><td class="break-all whitespace-pre-wrap">`);
var KIND_COLOR = {
  object: "var(--dumb-props-object, var(--color-secondary, #6d28d9))",
  array: "var(--dumb-props-array, var(--color-accent, #0e7490))",
  function: "var(--dumb-props-function, var(--color-warning, #9a3412))",
  primitive: "inherit"
};
function DumbPropsTable(props) {
  const rows = createMemo(() => dumpProps(props.value, {
    depth: props.depth,
    maxItems: props.maxItems,
    skip: props.skip
  }));
  return (() => {
    var _el$ = _tmpl$3(), _el$3 = _el$.firstChild, _el$5 = _el$3.firstChild;
    insert(_el$, createComponent(Show, {
      get when() {
        return props.title;
      },
      get children() {
        var _el$2 = _tmpl$();
        insert(_el$2, () => props.title);
        return _el$2;
      }
    }), _el$3);
    insert(_el$3, createComponent(Show, {
      get when() {
        return !props.headless;
      },
      get children() {
        return _tmpl$2();
      }
    }), _el$5);
    insert(_el$5, createComponent(For, {
      get each() {
        return rows();
      },
      children: (r) => (() => {
        var _el$6 = _tmpl$4(), _el$7 = _el$6.firstChild, _el$8 = _el$7.nextSibling, _el$9 = _el$8.nextSibling;
        insert(_el$7, () => r.key);
        insert(_el$8, () => r.type);
        insert(_el$9, () => r.value);
        effect((_p$) => {
          var _v$ = `whitespace-nowrap ${r.depth === 0 ? "font-bold" : ""}`, _v$2 = `${r.depth * (props.indent ?? 14)}px`, _v$3 = KIND_COLOR[r.kind], _v$4 = r.path;
          _v$ !== _p$.e && className(_el$7, _p$.e = _v$);
          _v$2 !== _p$.t && setStyleProperty(_el$7, "padding-left", _p$.t = _v$2);
          _v$3 !== _p$.a && setStyleProperty(_el$7, "color", _p$.a = _v$3);
          _v$4 !== _p$.o && setAttribute(_el$7, "title", _p$.o = _v$4);
          return _p$;
        }, {
          e: void 0,
          t: void 0,
          a: void 0,
          o: void 0
        });
        return _el$6;
      })()
    }));
    effect(() => className(_el$, props.class));
    return _el$;
  })();
}

export { DumbPropsTable, describe, dumpProps };
