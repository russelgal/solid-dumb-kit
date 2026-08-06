// src/DumbPropsTable.tsx
import { For, Show, createMemo } from "solid-js";

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
var KIND_COLOR = {
  object: "var(--dumb-props-object, var(--color-secondary, #6d28d9))",
  array: "var(--dumb-props-array, var(--color-accent, #0e7490))",
  function: "var(--dumb-props-function, var(--color-warning, #9a3412))",
  primitive: "inherit"
};
function DumbPropsTable(props) {
  const rows = createMemo(
    () => dumpProps(props.value, { depth: props.depth, maxItems: props.maxItems, skip: props.skip })
  );
  return <div class={props.class}>
      <Show when={props.title}>
        <div class="mb-1 font-bold">{props.title}</div>
      </Show>
      {
    /* table table-xs из daisyUI: отладочная таблица должна быть плотной */
  }
      <table class="table table-xs font-mono">
        <Show when={!props.headless}>
          <thead>
            <tr>
              <th>проп</th>
              <th>тип</th>
              <th>значение</th>
            </tr>
          </thead>
        </Show>
        <tbody>
          <For each={rows()}>
            {(r) => <tr>
                <td
    class={`whitespace-nowrap ${r.depth === 0 ? "font-bold" : ""}`}
    style={{
      "padding-left": `${r.depth * (props.indent ?? 14)}px`,
      color: KIND_COLOR[r.kind]
    }}
    title={r.path}
  >
                  {r.key}
                </td>
                {
    /* тип — подсказка, а не главное; вторичность даётся ЦВЕТОМ,
       а не прозрачностью: полупрозрачный текст не читается */
  }
                <td
    class="whitespace-nowrap"
    style={{ color: "var(--dumb-props-dim, var(--color-base-content, #475569))" }}
  >
                  {r.type}
                </td>
                <td class="break-all whitespace-pre-wrap">{r.value}</td>
              </tr>}
          </For>
        </tbody>
      </table>
    </div>;
}
export {
  DumbPropsTable,
  describe,
  dumpProps
};
