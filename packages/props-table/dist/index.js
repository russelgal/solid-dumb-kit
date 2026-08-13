import { createMemo, createComponent, Show, For, flatten, sharedConfig, createRenderEffect } from 'solid-js';

// ../../node_modules/.pnpm/@solidjs+web@2.0.0-rc.0_solid-js@2.0.0-rc.0/node_modules/@solidjs/web/dist/web.js
var $$SLOT = /* @__PURE__ */ Symbol("slot");
var transparentOptions = {
  transparent: true,
  sync: true
};
var effect = (fn, effectFn, options) => createRenderEffect(fn, effectFn, options ? {
  sync: true,
  ...options,
  transparent: !options.scope
} : transparentOptions);
function reconcileArrays(parentNode, a, b, marker) {
  let bLength = b.length, aEnd = a.length, bEnd = bLength, aStart = 0, bStart = 0, tail = a[aEnd - 1], tailTag = tail[$$SLOT], after = tail.parentNode === parentNode && (!tailTag || tailTag === marker) ? tail.nextSibling : marker || null, map = null, anchor, anchorTag;
  while (aStart < aEnd || bStart < bEnd) {
    if (a[aStart] === b[bStart]) {
      aStart++;
      bStart++;
      continue;
    }
    while (a[aEnd - 1] === b[bEnd - 1]) {
      aEnd--;
      bEnd--;
    }
    if (aEnd === aStart) {
      let node;
      if (bEnd < bLength) {
        if (bStart) {
          const prev = b[bStart - 1];
          const prevTag = prev[$$SLOT];
          node = prev.parentNode === parentNode && (!prevTag || prevTag === marker) ? prev.nextSibling : after;
        } else node = b[bEnd - bStart];
      } else node = after;
      while (bStart < bEnd) {
        const n = b[bStart++];
        parentNode.insertBefore(n, node);
        if (marker) n[$$SLOT] = marker;
      }
    } else if (bEnd === bStart) {
      while (aStart < aEnd) {
        const n = a[aStart++];
        if (!map || !map.has(n)) {
          const tag = n[$$SLOT];
          if (n.parentNode === parentNode && (!tag || tag === marker)) n.remove();
        }
      }
    } else if ((anchor = a[aStart]) === b[bEnd - 1] && b[bStart] === a[aEnd - 1] && anchor.parentNode === parentNode && (!(anchorTag = anchor[$$SLOT]) || anchorTag === marker)) {
      if (marker) {
        do {
          const n = a[--aEnd];
          parentNode.insertBefore(n, anchor);
          n[$$SLOT] = marker;
          bStart++;
          if (aStart >= aEnd - 1 || bStart >= bEnd) break;
        } while (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]);
      } else {
        do {
          parentNode.insertBefore(a[--aEnd], anchor);
          bStart++;
          if (aStart >= aEnd - 1 || bStart >= bEnd) break;
        } while (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]);
      }
    } else {
      if (!map) {
        map = /* @__PURE__ */ new Map();
        let i = bStart;
        while (i < bEnd) map.set(b[i], i++);
      }
      const index = map.get(a[aStart]);
      if (index != null) {
        if (bStart < index && index < bEnd) {
          let i = aStart, sequence = 1, t;
          while (++i < aEnd && i < bEnd) {
            if ((t = map.get(a[i])) == null || t !== index + sequence) break;
            sequence++;
          }
          if (sequence > index - bStart) {
            const head = a[aStart];
            const headTag = head[$$SLOT];
            const node = head.parentNode === parentNode && (!headTag || headTag === marker) ? head : after;
            while (bStart < index) {
              const n = b[bStart++];
              parentNode.insertBefore(n, node);
              if (marker) n[$$SLOT] = marker;
            }
          } else {
            const oldNode = a[aStart++];
            const newNode = b[bStart++];
            const oldTag = oldNode[$$SLOT];
            if (oldNode.parentNode === parentNode && (!oldTag || oldTag === marker)) {
              parentNode.replaceChild(newNode, oldNode);
            } else {
              parentNode.insertBefore(newNode, after);
            }
            if (marker) newNode[$$SLOT] = marker;
          }
        } else aStart++;
      } else {
        const n = a[aStart++];
        const nTag = n[$$SLOT];
        if (n.parentNode === parentNode && (!nTag || nTag === marker)) n.remove();
      }
    }
  }
}
var INNER_OWNED = {};
function create(html, bypassGuard, flag) {
  const t = document.createElement("template");
  t.innerHTML = html;
  return flag === 2 ? t.content.firstChild.firstChild : t.content.firstChild;
}
function template(html, flag) {
  let node;
  const fn = (bypassGuard) => (node || (node = create(html, bypassGuard, flag))).cloneNode(true);
  return fn;
}
function setAttribute(node, name, value) {
  if (isHydrating(node)) return;
  if (value == null || value === false) node.removeAttribute(name);
  else node.setAttribute(name, value === true ? "" : value);
}
function className(node, value, prev) {
  if (isHydrating(node)) return;
  if (value == null || value === false) {
    prev && node.removeAttribute("class");
    return;
  }
  if (typeof value === "string") {
    value !== prev && node.setAttribute("class", value);
    return;
  }
  if (typeof prev === "string") {
    prev = {};
    node.removeAttribute("class");
  } else prev = classListToObject(prev || {});
  value = classListToObject(value);
  const classKeys = Object.keys(value || {});
  const prevKeys = Object.keys(prev);
  let i, len;
  for (i = 0, len = prevKeys.length; i < len; i++) {
    const key = prevKeys[i];
    if (!key || key === "undefined" || value[key]) continue;
    node.classList.remove(key);
  }
  for (i = 0, len = classKeys.length; i < len; i++) {
    const key = classKeys[i], classValue = !!value[key];
    if (!key || key === "undefined" || prev[key] === classValue || !classValue) continue;
    node.classList.add(key);
  }
}
function setStyleProperty(node, name, value) {
  value != null ? node.style.setProperty(name, value) : node.style.removeProperty(name);
}
var SCOPE_OPTIONS = {
  scope: true
};
var hydrationRt = null;
function insert(parent, accessor, marker, initial, options) {
  const multi = marker !== void 0;
  if (multi && !initial) initial = [];
  if (hydrationRt !== null) initial = hydrationRt.claimInitial(parent, multi, initial);
  if (typeof accessor !== "function") {
    accessor = normalize(accessor, initial, multi, true);
    if (typeof accessor !== "function") {
      insertExpression(parent, accessor, initial, marker);
      return;
    }
  }
  if (multi && initial.length === 0) {
    const placeholder = document.createTextNode("");
    parent.insertBefore(placeholder, marker);
    initial = [placeholder];
  }
  let current = initial;
  effect(
    (prev) => {
      if (hydrationRt !== null) current = hydrationRt.reclaimRegion(current, parent, marker);
      const value = normalize(accessor(), current, multi, true);
      if (typeof value !== "function") return value;
      effect(() => (hydrationRt !== null && (current = hydrationRt.reclaimRegion(current, parent, marker)), normalize(value, current, multi)), (inner) => {
        current = insertExpression(parent, inner, current, marker);
      }, prev !== void 0 && true ? {
        ...options,
        schedule: true
      } : options);
      return INNER_OWNED;
    },
    (value) => {
      if (value === INNER_OWNED) return;
      current = insertExpression(parent, value, current, marker);
    },
    accessor.$s ? SCOPE_OPTIONS : options
  );
}
function isHydrating(node) {
  if (!sharedConfig.hydrating) return false;
  if (!node || node.isConnected) return true;
  const roots = sharedConfig.claimRoots;
  if (roots) {
    for (let i = 0; i < roots.length; i++) {
      if (roots[i].contains(node)) return true;
    }
  }
  return false;
}
function classListToObject(classList) {
  if (Array.isArray(classList)) {
    const result = {};
    flattenClassList(classList, result);
    classList = result;
  }
  if (classList && typeof classList === "object") {
    const result = {}, keys = Object.keys(classList);
    for (let i = 0, len = keys.length; i < len; i++) {
      const key = keys[i];
      if (!classList[key]) continue;
      const classNames = key.trim().split(/\s+/);
      for (let j = 0, nameLen = classNames.length; j < nameLen; j++) classNames[j] && (result[classNames[j]] = true);
    }
    return result;
  }
  return classList;
}
function flattenClassList(list, result) {
  for (let i = 0, len = list.length; i < len; i++) {
    const item = list[i];
    if (Array.isArray(item)) flattenClassList(item, result);
    else if (typeof item === "object" && item != null) Object.assign(result, item);
    else if (item || item === 0) result[item] = true;
  }
}
function insertExpression(parent, value, current, marker) {
  if (hydrationRt !== null && isHydrating(parent)) {
    if (value && value !== current) {
      for (const n of Array.isArray(value) ? value : [value]) if (n && n.nodeType && !isHydrating(n)) return current;
    }
    return value;
  }
  if (value === current) return value;
  const t = typeof value, multi = marker !== void 0;
  if (t === "string" || t === "number") {
    const tc = typeof current;
    if (tc === "string" || tc === "number") {
      parent.firstChild.data = value;
    } else {
      if (ownsAllChildren(parent, current)) parent.textContent = value;
      else {
        removeOwnedChildren(parent, current);
        parent.insertBefore(document.createTextNode(value), parent.firstChild);
      }
    }
  } else if (value === void 0) {
    cleanChildren(parent, current, marker);
  } else if (value.nodeType) {
    if (Array.isArray(current)) {
      cleanChildren(parent, current, multi ? marker : null, value);
    } else if (current && current.nodeType) {
      current.parentNode === parent ? parent.replaceChild(value, current) : parent.appendChild(value);
    } else if (current && parent.firstChild) {
      parent.replaceChild(value, parent.firstChild);
    } else {
      parent.appendChild(value);
    }
    if (marker) value[$$SLOT] = marker;
  } else if (Array.isArray(value)) {
    const currentArray = current && Array.isArray(current);
    if (value.length === 0) {
      cleanChildren(parent, current, marker);
    } else if (currentArray) {
      if (current.length === 0) {
        appendNodes(parent, value, marker);
      } else reconcileArrays(parent, current, value, marker);
    } else {
      current && cleanChildren(parent, current);
      appendNodes(parent, value);
    }
  } else ;
  return value;
}
function normalize(value, current, multi, doNotUnwrap) {
  value = flatten(value, {
    skipNonRendered: true,
    doNotUnwrap
  });
  if (doNotUnwrap && typeof value === "function") return value;
  if (multi && !Array.isArray(value)) value = [value != null ? value : ""];
  if (Array.isArray(value)) {
    for (let i = 0, len = value.length; i < len; i++) {
      const item = value[i], prev = current && current[i], t = typeof item;
      if (t === "string" || t === "number") value[i] = prev && prev.nodeType === 3 && (sharedConfig.hydrating || prev.data === "" + item) ? prev : document.createTextNode(item);
    }
  }
  return value;
}
function appendNodes(parent, array, marker = null) {
  for (let i = 0, len = array.length; i < len; i++) {
    const n = array[i];
    parent.insertBefore(n, marker);
    if (marker) n[$$SLOT] = marker;
  }
}
function ownsAllChildren(parent, current) {
  if (current == null) return true;
  if (Array.isArray(current)) {
    return current.length ? parent.firstChild === current[0] && parent.lastChild === current[current.length - 1] : parent.firstChild === null;
  }
  if (current === "") return parent.firstChild === null;
  if (current.nodeType) return parent.firstChild === current && parent.lastChild === current;
  const first = parent.firstChild;
  return first !== null && first.nodeType === 3 && parent.lastChild === first;
}
function removeOwnedChildren(parent, current) {
  if (Array.isArray(current)) {
    for (let i = 0; i < current.length; i++) {
      const el = current[i];
      if (el.parentNode === parent) el.remove();
    }
  } else if (current.nodeType) {
    if (current.parentNode === parent) current.remove();
  } else {
    const first = parent.firstChild;
    if (first && first.nodeType === 3) first.remove();
  }
}
function cleanChildren(parent, current, marker, replacement) {
  if (marker === void 0) {
    if (ownsAllChildren(parent, current)) return parent.textContent = "";
    return removeOwnedChildren(parent, current);
  }
  if (current.length) {
    let inserted = false;
    for (let i = current.length - 1; i >= 0; i--) {
      const el = current[i];
      if (replacement !== el) {
        const tag = el[$$SLOT];
        const owns = el.parentNode === parent && (!tag || tag === marker);
        if (replacement && !inserted && !i) owns ? parent.replaceChild(replacement, el) : parent.insertBefore(replacement, marker);
        else if (owns) el.remove();
      } else inserted = true;
    }
  } else if (replacement) parent.insertBefore(replacement, marker);
  if (replacement && marker) replacement[$$SLOT] = marker;
}

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
      effect(() => ({
        e: `whitespace-nowrap ${r.depth === 0 ? "font-bold" : ""}`,
        t: `${r.depth * (props.indent ?? 14)}px`,
        a: KIND_COLOR[r.kind],
        o: r.path
      }), ({
        e,
        t,
        a,
        o
      }, _p$) => {
        className(_el$7, e, _p$?.e);
        t !== _p$?.t && setStyleProperty(_el$7, "padding-left", t);
        a !== _p$?.a && setStyleProperty(_el$7, "color", a);
        o !== _p$?.o && setAttribute(_el$7, "title", o);
      });
      return _el$6;
    })()
  }));
  effect(() => props.class, (_v$, _$p) => {
    className(_el$, _v$, _$p);
  });
  return _el$;
}

export { DumbPropsTable, describe, dumpProps };
