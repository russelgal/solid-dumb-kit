import { delegateEvents, insert, createComponent, effect, setAttribute, memo, className, style, setStyleProperty, addEventListener, use, isServer, template } from 'solid-js/web';
import { createSignal, createEffect, on, onCleanup, createMemo, untrack, batch, For, Show, onMount, createUniqueId } from 'solid-js';
import { createFileUploader } from '@solid-primitives/upload';
import { reconcile } from 'solid-js/store';

// src/DumbFinder.tsx
var EDGE = 48;
var MAX_SPEED = 18;
var ACCEL = 3.5;
function scrollParent(el, includeSelf = false) {
  let n = includeSelf ? el : el.parentElement;
  while (n) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll" || oy === "overlay") && n.scrollHeight > n.clientHeight) return n;
    n = n.parentElement;
  }
  return null;
}
function measure(scroller) {
  if (scroller) {
    const r = scroller.getBoundingClientRect();
    return {
      top: r.top,
      left: r.left,
      clientH: scroller.clientHeight,
      clientW: scroller.clientWidth,
      max: scroller.scrollHeight - scroller.clientHeight,
      scrollW: scroller.scrollWidth,
      scrollH: scroller.scrollHeight,
      winX: window.scrollX,
      winY: window.scrollY
    };
  }
  const se = document.scrollingElement || document.documentElement;
  return {
    top: 0,
    left: 0,
    clientH: window.innerHeight,
    clientW: window.innerWidth,
    max: se.scrollHeight - window.innerHeight,
    scrollW: se.scrollWidth,
    scrollH: se.scrollHeight,
    winX: 0,
    winY: 0
  };
}
function scrollOf(scroller) {
  return scroller ? { sx: scroller.scrollLeft, sy: scroller.scrollTop } : { sx: window.scrollX, sy: window.scrollY };
}
function doScroll(scroller, dx, dy) {
  if (scroller) {
    if (dy) scroller.scrollTop += dy;
  } else {
    window.scrollBy(dx, dy);
  }
}
function viewOrigin(geom, winX, winY) {
  return { top: geom.top - (winY - geom.winY), left: geom.left - (winX - geom.winX) };
}
function autoScrollSpeed(args) {
  const { pointerY, viewTop, clientH, scrollY, scrollMax } = args;
  const distTop = pointerY - viewTop;
  const distBot = viewTop + clientH - pointerY;
  if (distTop < EDGE && scrollY > 0) {
    const over = (EDGE - distTop) / EDGE;
    return -Math.min(MAX_SPEED * ACCEL, MAX_SPEED * over);
  }
  if (distBot < EDGE && scrollY < scrollMax) {
    const over = (EDGE - distBot) / EDGE;
    return Math.min(MAX_SPEED * ACCEL, MAX_SPEED * over);
  }
  return 0;
}
function suppressTextSelection() {
  if (typeof document === "undefined") return;
  const s = document.body.style;
  s.userSelect = "none";
  s.webkitUserSelect = "none";
  const sel = window.getSelection?.();
  if (sel && !sel.isCollapsed) sel.removeAllRanges();
}
function restoreTextSelection() {
  if (typeof document === "undefined") return;
  const s = document.body.style;
  s.userSelect = "";
  s.webkitUserSelect = "";
}
function areaFrom(x1, y1, x2, y2) {
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1)
  };
}
function clampPoint(x, y, b) {
  return {
    x: Math.min(Math.max(x, b.minX), b.maxX),
    y: Math.min(Math.max(y, b.minY), b.maxY)
  };
}
function hits(area, cell, mode) {
  const aRight = area.left + area.width;
  const aBottom = area.top + area.height;
  const cRight = cell.left + cell.width;
  const cBottom = cell.top + cell.height;
  if (mode === "center") {
    const cx = cell.left + cell.width / 2;
    const cy = cell.top + cell.height / 2;
    return cx >= area.left && cx <= aRight && cy >= area.top && cy <= aBottom;
  }
  if (mode === "cover") {
    return cell.left >= area.left && cRight <= aRight && cell.top >= area.top && cBottom <= aBottom;
  }
  return cell.left < aRight && cRight > area.left && cell.top < aBottom && cBottom > area.top;
}
function pickHits(area, cells, mode) {
  const out = [];
  for (let i = 0; i < cells.length; i++) if (hits(area, cells[i], mode)) out.push(i);
  return out;
}
function resolveSelection(args) {
  const { base, touched, additive } = args;
  if (!additive) return new Set(touched);
  return /* @__PURE__ */ new Set([...base, ...touched]);
}
function tapSelection(args) {
  const { current, key, additive } = args;
  if (key === null) return additive ? new Set(current) : /* @__PURE__ */ new Set();
  if (!additive) return /* @__PURE__ */ new Set([key]);
  const next = new Set(current);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}
function diffSelection(prev, next) {
  const added = [];
  const removed = [];
  for (const id of next) if (!prev.has(id)) added.push(id);
  for (const id of prev) if (!next.has(id)) removed.push(id);
  return { added, removed };
}
var IGNORE = "button, a, input, select, textarea, [data-no-select], [data-drag-handle]";
function createSelectionEngine(opts) {
  const threshold = opts.threshold ?? 10;
  let drag = null;
  let pending = null;
  function snapshot(host, cb) {
    const els = Array.from(host.querySelectorAll(opts.selectables));
    if (!els.length) {
      cb([], []);
      return;
    }
    const scroller = scrollParent(host, true);
    const geom = measure(scroller);
    const origin = scroller ? viewOrigin(geom, window.scrollX, window.scrollY) : { top: 0, left: 0 };
    const s = scrollOf(scroller);
    const rects = /* @__PURE__ */ new Map();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) rects.set(e.target, e.boundingClientRect);
      io.disconnect();
      const cells = [];
      const keys = [];
      const attr = opts.keyAttr ?? "data-key";
      for (const el of els) {
        const r = rects.get(el);
        const key = el.getAttribute(attr);
        if (!r || key == null) continue;
        cells.push({
          left: r.left - origin.left + s.sx,
          top: r.top - origin.top + s.sy,
          width: r.width,
          height: r.height
        });
        keys.push(key);
      }
      cb(cells, keys);
    });
    for (const el of els) io.observe(el);
  }
  function frame() {
    if (!drag) return;
    const d = drag;
    const origin = d.scroller ? viewOrigin(d.geom, window.scrollX, window.scrollY) : { top: 0, left: 0 };
    let { sx, sy } = scrollOf(d.scroller);
    const speed = autoScrollSpeed({
      pointerY: d.lastY,
      viewTop: origin.top,
      clientH: d.geom.clientH,
      scrollY: sy,
      scrollMax: d.geom.max
    });
    if (speed) {
      doScroll(d.scroller, 0, speed);
      ({ sx, sy } = scrollOf(d.scroller));
    }
    const p = clampPoint(d.lastX - origin.left + sx, d.lastY - origin.top + sy, d.bounds);
    const area = areaFrom(d.x0, d.y0, p.x, p.y);
    d.box.style.transform = `translate(${area.left - d.hostX}px,${area.top - d.hostY}px)`;
    d.box.style.width = `${area.width}px`;
    d.box.style.height = `${area.height}px`;
    if (d.ready) {
      const touched = pickHits(area, d.cells, opts.intersect?.() ?? "touch").map((i) => d.keys[i]);
      const next = resolveSelection({ base: d.base, touched, additive: d.additive });
      const info = diffSelection(d.prev, next);
      if (info.added.length || info.removed.length) {
        d.prev = next;
        opts.onChange(next, info);
      }
    }
    d.raf = requestAnimationFrame(frame);
  }
  function begin(ev) {
    const host = opts.container();
    if (!host) return;
    const scroller = scrollParent(host, true);
    const geom = measure(scroller);
    const origin = scroller ? viewOrigin(geom, window.scrollX, window.scrollY) : { top: 0, left: 0 };
    const s = scrollOf(scroller);
    const box = document.createElement("div");
    if (opts.areaClass) box.className = opts.areaClass;
    Object.assign(box.style, {
      position: "absolute",
      top: "0",
      left: "0",
      pointerEvents: "none",
      willChange: "transform",
      zIndex: "9999",
      background: "oklch(from currentColor l c h / 0.08)",
      border: "1.5px solid oklch(from currentColor l c h / 0.3)",
      borderRadius: "4px"
    });
    host.appendChild(box);
    let hostX = 0, hostY = 0;
    let bounds;
    if (scroller === host) {
      bounds = { minX: 0, minY: 0, maxX: geom.scrollW, maxY: geom.scrollH };
    } else {
      const hr = host.getBoundingClientRect();
      hostX = hr.left - origin.left + s.sx;
      hostY = hr.top - origin.top + s.sy;
      bounds = { minX: hostX, minY: hostY, maxX: hostX + hr.width, maxY: hostY + hr.height };
    }
    const additive = ev.shiftKey || ev.metaKey || ev.ctrlKey;
    drag = {
      pid: ev.pointerId,
      x0: ev.clientX - origin.left + s.sx,
      y0: ev.clientY - origin.top + s.sy,
      lastX: ev.clientX,
      lastY: ev.clientY,
      scroller,
      geom,
      hostX,
      hostY,
      bounds,
      cells: [],
      keys: [],
      base: additive ? new Set(opts.current()) : /* @__PURE__ */ new Set(),
      prev: new Set(opts.current()),
      additive,
      box,
      raf: 0,
      ready: false
    };
    if (!additive && drag.prev.size) {
      const empty = /* @__PURE__ */ new Set();
      opts.onChange(empty, diffSelection(drag.prev, empty));
      drag.prev = empty;
    }
    snapshot(host, (cells, keys) => {
      if (!drag) return;
      drag.cells = cells;
      drag.keys = keys;
      drag.ready = true;
    });
    suppressTextSelection();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    drag.raf = requestAnimationFrame(frame);
  }
  function onMove(ev) {
    if (!drag || ev.pointerId !== drag.pid) return;
    drag.lastX = ev.clientX;
    drag.lastY = ev.clientY;
    ev.preventDefault();
  }
  function cleanup() {
    if (!drag) return;
    if (drag.raf) cancelAnimationFrame(drag.raf);
    drag.box.remove();
    restoreTextSelection();
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    drag = null;
  }
  function onUp(ev) {
    if (!drag || ev.pointerId !== drag.pid) return;
    const selected = drag.prev;
    cleanup();
    opts.onStop?.(selected);
  }
  function pendMove(ev) {
    if (!pending || ev.pointerId !== pending.pid) return;
    if (Math.abs(ev.clientX - pending.x) < threshold && Math.abs(ev.clientY - pending.y) < threshold) return;
    const start = pending.ev;
    clearPending();
    begin(start);
    if (drag) {
      drag.lastX = ev.clientX;
      drag.lastY = ev.clientY;
    }
  }
  function pendUp(ev) {
    if (!pending || ev.pointerId !== pending.pid) return;
    const down = pending.ev;
    clearPending();
    const attr = opts.keyAttr ?? "data-key";
    const el = ev.target?.closest(opts.selectables);
    const key = el?.getAttribute(attr) ?? null;
    const additive = down.shiftKey || down.metaKey || down.ctrlKey;
    const current = opts.current();
    const next = tapSelection({ current, key, additive });
    const info = diffSelection(current, next);
    if (!info.added.length && !info.removed.length) return;
    opts.onChange(next, info);
    opts.onStop?.(next);
  }
  function clearPending() {
    if (!drag) restoreTextSelection();
    pending = null;
    window.removeEventListener("pointermove", pendMove);
    window.removeEventListener("pointerup", pendUp);
    window.removeEventListener("pointercancel", pendUp);
  }
  function onDown(ev) {
    if (ev.button !== 0 || drag || pending) return;
    const target = ev.target;
    if (target?.closest(IGNORE)) return;
    if (opts.onBeforeStart?.(ev) === false) return;
    suppressTextSelection();
    pending = { pid: ev.pointerId, x: ev.clientX, y: ev.clientY, ev };
    window.addEventListener("pointermove", pendMove);
    window.addEventListener("pointerup", pendUp);
    window.addEventListener("pointercancel", pendUp);
  }
  return {
    attach(el) {
      el.addEventListener("pointerdown", onDown);
      return () => el.removeEventListener("pointerdown", onDown);
    },
    destroy() {
      clearPending();
      cleanup();
    }
  };
}
function createSelectionArea(opts) {
  const engine = createSelectionEngine(opts);
  onCleanup(engine.destroy);
  return {
    /** повесить жест на контейнер */
    attach(el) {
      onCleanup(engine.attach(el));
    }
  };
}
var _tmpl$ = /* @__PURE__ */ template(`<div style=position:relative>`);
function SelectionArea(props) {
  let containerRef;
  onMount(() => {
    const area = createSelectionArea({
      container: () => containerRef,
      selectables: props.selectables,
      keyAttr: props.keyAttr,
      intersect: () => props.intersect ?? "touch",
      threshold: props.threshold,
      areaClass: props.areaClass,
      current: () => props.selected(),
      onBeforeStart: (ev) => props.onBeforeStart?.(ev),
      onChange: (selected) => props.onChange(selected),
      onStop: (selected) => props.onStop?.(selected)
    });
    area.attach(containerRef);
  });
  return (() => {
    var _el$ = _tmpl$();
    var _ref$ = containerRef;
    typeof _ref$ === "function" ? use(_ref$, _el$) : containerRef = _el$;
    insert(_el$, () => props.children);
    effect((_p$) => {
      var _v$ = props.class, _v$2 = {
        ...props.style
      };
      _v$ !== _p$.e && className(_el$, _p$.e = _v$);
      _p$.t = style(_el$, _v$2, _p$.t);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$;
  })();
}
function makePersisted(signal, options = {}) {
  const storage = options.storage || globalThis.localStorage;
  const name = options.name || `storage-${createUniqueId()}`;
  if (!storage) {
    return [signal[0], signal[1], null];
  }
  const storageOptions = options.storageOptions;
  const serialize = options.serialize || JSON.stringify.bind(JSON);
  const deserialize = options.deserialize || JSON.parse.bind(JSON);
  const init = storage.getItem(name, storageOptions);
  const set = typeof signal[0] === "function" ? (data) => {
    try {
      const value = deserialize(data);
      signal[1](() => value);
    } catch (e) {
    }
  } : (data) => {
    try {
      const value = deserialize(data);
      signal[1](reconcile(value));
    } catch (e) {
    }
  };
  let unchanged = true;
  if (init instanceof Promise)
    init.then((data) => unchanged && data && set(data));
  else if (init)
    set(init);
  if (typeof options.sync?.[0] === "function") {
    const get = typeof signal[0] === "function" ? signal[0] : () => signal[0];
    options.sync[0]((data) => {
      if (data.key !== name || !isServer && (data.url || globalThis.location.href) !== globalThis.location.href || data.newValue === serialize(untrack(get))) {
        return;
      }
      set(data.newValue);
    });
  }
  return [
    signal[0],
    typeof signal[0] === "function" ? (value) => {
      const output = signal[1](value);
      const serialized = value != null ? serialize(output) : value;
      options.sync?.[1](name, serialized);
      if (serialized != null)
        storage.setItem(name, serialized, storageOptions);
      else
        storage.removeItem(name, storageOptions);
      unchanged = false;
      return output;
    } : (...args) => {
      signal[1](...args);
      const value = serialize(untrack(() => signal[0]));
      options.sync?.[1](name, value);
      storage.setItem(name, value, storageOptions);
      unchanged = false;
    },
    init
  ];
}

// ../../node_modules/.pnpm/valibot@1.4.2_typescript@6.0.3/node_modules/valibot/dist/index.mjs
var store$4;
var DEFAULT_CONFIG = {
  lang: void 0,
  message: void 0,
  abortEarly: void 0,
  abortPipeEarly: void 0
};
// @__NO_SIDE_EFFECTS__
function getGlobalConfig(config$1) {
  if (!store$4) return DEFAULT_CONFIG;
  return {
    lang: config$1?.lang ?? store$4?.lang,
    message: config$1?.message,
    abortEarly: config$1?.abortEarly ?? store$4?.abortEarly,
    abortPipeEarly: config$1?.abortPipeEarly ?? store$4?.abortPipeEarly
  };
}
var store$3;
// @__NO_SIDE_EFFECTS__
function getGlobalMessage(lang) {
  return store$3?.get(lang);
}
var store$2;
// @__NO_SIDE_EFFECTS__
function getSchemaMessage(lang) {
  return store$2?.get(lang);
}
var store$1;
// @__NO_SIDE_EFFECTS__
function getSpecificMessage(reference, lang) {
  return store$1?.get(reference)?.get(lang);
}
// @__NO_SIDE_EFFECTS__
function _stringify(input) {
  const type = typeof input;
  if (type === "string") return `"${input}"`;
  if (type === "number" || type === "bigint" || type === "boolean") return `${input}`;
  if (type === "object" || type === "function") return (input && Object.getPrototypeOf(input)?.constructor?.name) ?? "null";
  return type;
}
function _addIssue(context, label, dataset, config$1, other) {
  const input = other && "input" in other ? other.input : dataset.value;
  const expected = other?.expected ?? context.expects ?? null;
  const received = other?.received ?? /* @__PURE__ */ _stringify(input);
  const issue = {
    kind: context.kind,
    type: context.type,
    input,
    expected,
    received,
    message: `Invalid ${label}: ${expected ? `Expected ${expected} but r` : "R"}eceived ${received}`,
    requirement: context.requirement,
    path: other?.path,
    issues: other?.issues,
    lang: config$1.lang,
    abortEarly: config$1.abortEarly,
    abortPipeEarly: config$1.abortPipeEarly
  };
  const isSchema = context.kind === "schema";
  const message$1 = other?.message ?? context.message ?? /* @__PURE__ */ getSpecificMessage(context.reference, issue.lang) ?? (isSchema ? /* @__PURE__ */ getSchemaMessage(issue.lang) : null) ?? config$1.message ?? /* @__PURE__ */ getGlobalMessage(issue.lang);
  if (message$1 !== void 0) issue.message = typeof message$1 === "function" ? message$1(issue) : message$1;
  if (isSchema) dataset.typed = false;
  if (dataset.issues) dataset.issues.push(issue);
  else dataset.issues = [issue];
}
var _standardCache = /* @__PURE__ */ new WeakMap();
// @__NO_SIDE_EFFECTS__
function _getStandardProps(context) {
  let cached = _standardCache.get(context);
  if (!cached) {
    cached = {
      version: 1,
      vendor: "valibot",
      validate(value$1) {
        return context["~run"]({ value: value$1 }, /* @__PURE__ */ getGlobalConfig());
      }
    };
    _standardCache.set(context, cached);
  }
  return cached;
}
// @__NO_SIDE_EFFECTS__
function getFallback(schema, dataset, config$1) {
  return typeof schema.fallback === "function" ? schema.fallback(dataset, config$1) : schema.fallback;
}
// @__NO_SIDE_EFFECTS__
function getDefault(schema, dataset, config$1) {
  return typeof schema.default === "function" ? schema.default(dataset, config$1) : schema.default;
}
// @__NO_SIDE_EFFECTS__
function array(item, message$1) {
  return {
    kind: "schema",
    type: "array",
    reference: array,
    expects: "Array",
    async: false,
    item,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config$1) {
      const input = dataset.value;
      if (Array.isArray(input)) {
        dataset.typed = true;
        dataset.value = [];
        for (let key = 0; key < input.length; key++) {
          const value$1 = input[key];
          const itemDataset = this.item["~run"]({ value: value$1 }, config$1);
          if (itemDataset.issues) {
            const pathItem = {
              type: "array",
              origin: "value",
              input,
              key,
              value: value$1
            };
            for (const issue of itemDataset.issues) {
              if (issue.path) issue.path.unshift(pathItem);
              else issue.path = [pathItem];
              dataset.issues?.push(issue);
            }
            if (!dataset.issues) dataset.issues = itemDataset.issues;
            if (config$1.abortEarly) {
              dataset.typed = false;
              break;
            }
          }
          if (!itemDataset.typed) dataset.typed = false;
          dataset.value.push(itemDataset.value);
        }
      } else _addIssue(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function number(message$1) {
  return {
    kind: "schema",
    type: "number",
    reference: number,
    expects: "number",
    async: false,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config$1) {
      if (typeof dataset.value === "number" && !isNaN(dataset.value)) dataset.typed = true;
      else _addIssue(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function object(entries$1, message$1) {
  return {
    kind: "schema",
    type: "object",
    reference: object,
    expects: "Object",
    async: false,
    entries: entries$1,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config$1) {
      const input = dataset.value;
      if (input && typeof input === "object") {
        dataset.typed = true;
        dataset.value = {};
        for (const key in this.entries) {
          const valueSchema = this.entries[key];
          if (key in input || (valueSchema.type === "exact_optional" || valueSchema.type === "optional" || valueSchema.type === "nullish") && valueSchema.default !== void 0) {
            const value$1 = key in input ? input[key] : /* @__PURE__ */ getDefault(valueSchema);
            const valueDataset = valueSchema["~run"]({ value: value$1 }, config$1);
            if (valueDataset.issues) {
              const pathItem = {
                type: "object",
                origin: "value",
                input,
                key,
                value: value$1
              };
              for (const issue of valueDataset.issues) {
                if (issue.path) issue.path.unshift(pathItem);
                else issue.path = [pathItem];
                dataset.issues?.push(issue);
              }
              if (!dataset.issues) dataset.issues = valueDataset.issues;
              if (config$1.abortEarly) {
                dataset.typed = false;
                break;
              }
            }
            if (!valueDataset.typed) dataset.typed = false;
            dataset.value[key] = valueDataset.value;
          } else if (valueSchema.fallback !== void 0) dataset.value[key] = /* @__PURE__ */ getFallback(valueSchema);
          else if (valueSchema.type !== "exact_optional" && valueSchema.type !== "optional" && valueSchema.type !== "nullish") {
            _addIssue(this, "key", dataset, config$1, {
              input: void 0,
              expected: `"${key}"`,
              path: [{
                type: "object",
                origin: "key",
                input,
                key,
                value: input[key]
              }]
            });
            if (config$1.abortEarly) break;
          }
        }
      } else _addIssue(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function optional(wrapped, default_) {
  return {
    kind: "schema",
    type: "optional",
    reference: optional,
    expects: `(${wrapped.expects} | undefined)`,
    async: false,
    wrapped,
    default: default_,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config$1) {
      if (dataset.value === void 0) {
        if (this.default !== void 0) dataset.value = /* @__PURE__ */ getDefault(this, dataset, config$1);
        if (dataset.value === void 0) {
          dataset.typed = true;
          return dataset;
        }
      }
      return this.wrapped["~run"](dataset, config$1);
    }
  };
}
// @__NO_SIDE_EFFECTS__
function safeParse(schema, input, config$1) {
  const dataset = schema["~run"]({ value: input }, /* @__PURE__ */ getGlobalConfig(config$1));
  return {
    typed: dataset.typed,
    success: !dataset.issues,
    output: dataset.value,
    issues: dataset.issues
  };
}

// ../resizable-grid/dist/index.js
function suppressTextSelection2() {
  if (typeof document === "undefined") return;
  const s = document.body.style;
  s.userSelect = "none";
  s.webkitUserSelect = "none";
  const sel = window.getSelection?.();
  if (sel && !sel.isCollapsed) sel.removeAllRanges();
}
function restoreTextSelection2() {
  if (typeof document === "undefined") return;
  const s = document.body.style;
  s.userSelect = "";
  s.webkitUserSelect = "";
}
var _tmpl$2 = /* @__PURE__ */ template(`<div class=resizable-grid-handle-row>`);
var _tmpl$22 = /* @__PURE__ */ template(`<div style=display:grid;min-height:0>`);
var _tmpl$3 = /* @__PURE__ */ template(`<div style=display:grid;height:100%;width:100%;overflow:hidden><div style=display:grid;min-height:0>`);
var _tmpl$4 = /* @__PURE__ */ template(`<div class=resizable-grid-handle-col>`);
var _tmpl$5 = /* @__PURE__ */ template(`<div style=min-width:0;min-height:0;overflow:auto>`);
var HANDLE_SIZE = 6;
var DEFAULT_MIN = 100;
var SizesSchema = object({
  cols: array(number()),
  rows: optional(array(number())),
  rowSplit: optional(array(number()))
});
function validateSizes(raw, defaults) {
  const result = safeParse(SizesSchema, raw);
  if (!result.success) return defaults;
  const s = result.output;
  if (!s.cols.length || s.cols.some((n) => n <= 0 || !isFinite(n))) return defaults;
  if (s.cols.length !== defaults.cols.length) return defaults;
  return s;
}
function ResizableGrid(props) {
  const meta = {
    colMins: props.cols.map((c) => c.min ?? DEFAULT_MIN),
    colInitials: props.cols.map((c) => c.initial ?? 1),
    rowMins: props.rows?.map((r) => r.min ?? DEFAULT_MIN) ?? [],
    rowInitials: props.rows?.map((r) => r.initial ?? 1) ?? []
  };
  const defaults = {
    cols: [...meta.colInitials],
    rows: meta.rowInitials.length ? [...meta.rowInitials] : void 0,
    rowSplit: props.rows ? [props.rowInitial ?? 1, props.row2Initial ?? 1] : void 0
  };
  const [sizes, setSizes] = makePersisted(createSignal(defaults), {
    name: props.storageKey,
    deserialize: (raw) => validateSizes(JSON.parse(raw), defaults)
  });
  const colSizes = () => {
    const s = sizes();
    if (!s || !s.cols || s.cols.length !== meta.colInitials.length) return meta.colInitials;
    return s.cols;
  };
  const rowSizes = () => {
    const s = sizes();
    if (!meta.rowInitials.length) return void 0;
    if (!s || !s.rows || s.rows.length !== meta.rowInitials.length) return meta.rowInitials;
    return s.rows;
  };
  const rowSplit = () => {
    const s = sizes();
    if (!meta.rowInitials.length) return void 0;
    return s?.rowSplit ?? [props.rowInitial ?? 1, props.row2Initial ?? 1];
  };
  let containerRef;
  function startColResize(index, e) {
    e.preventDefault();
    const rect = containerRef.getBoundingClientRect();
    const totalWidth = rect.width - HANDLE_SIZE * (meta.colMins.length - 1);
    const currentSizes = [...colSizes()];
    const totalFr = currentSizes.reduce((a, b) => a + b, 0);
    const startX = e.clientX;
    const leftFr = currentSizes[index];
    const rightFr = currentSizes[index + 1];
    const leftMin = meta.colMins[index] / totalWidth * totalFr;
    const rightMin = meta.colMins[index + 1] / totalWidth * totalFr;
    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dFr = dx / totalWidth * totalFr;
      const newLeft = Math.max(leftMin, leftFr + dFr);
      const newRight = Math.max(rightMin, rightFr - dFr);
      if (newLeft <= leftMin && dFr < 0) return;
      if (newRight <= rightMin && dFr > 0) return;
      currentSizes[index] = newLeft;
      currentSizes[index + 1] = newRight;
      setSizes((prev) => ({
        ...prev,
        cols: [...currentSizes]
      }));
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      restoreTextSelection2();
    }
    document.body.style.cursor = "col-resize";
    suppressTextSelection2();
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }
  function startRow2ColResize(index, e) {
    e.preventDefault();
    if (!meta.rowMins.length) return;
    const rect = containerRef.getBoundingClientRect();
    const totalWidth = rect.width - HANDLE_SIZE * (meta.rowMins.length - 1);
    const currentSizes = [...rowSizes() || [...meta.rowInitials]];
    const totalFr = currentSizes.reduce((a, b) => a + b, 0);
    const startX = e.clientX;
    const leftFr = currentSizes[index];
    const rightFr = currentSizes[index + 1];
    const leftMin = meta.rowMins[index] / totalWidth * totalFr;
    const rightMin = meta.rowMins[index + 1] / totalWidth * totalFr;
    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dFr = dx / totalWidth * totalFr;
      const newLeft = Math.max(leftMin, leftFr + dFr);
      const newRight = Math.max(rightMin, rightFr - dFr);
      if (newLeft <= leftMin && dFr < 0) return;
      if (newRight <= rightMin && dFr > 0) return;
      currentSizes[index] = newLeft;
      currentSizes[index + 1] = newRight;
      setSizes((prev) => ({
        ...prev,
        rows: [...currentSizes]
      }));
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      restoreTextSelection2();
    }
    document.body.style.cursor = "col-resize";
    suppressTextSelection2();
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }
  function startRowResize(e) {
    e.preventDefault();
    if (!props.rows) return;
    const rect = containerRef.getBoundingClientRect();
    const totalHeight = rect.height - HANDLE_SIZE;
    const currentSplit = [...rowSplit() || [1, 1]];
    const totalFr = currentSplit[0] + currentSplit[1];
    const startY = e.clientY;
    const topFr = currentSplit[0];
    const bottomFr = currentSplit[1];
    const rowMinPx = props.rowMin ?? DEFAULT_MIN;
    const topMin = rowMinPx / totalHeight * totalFr;
    const bottomMin = rowMinPx / totalHeight * totalFr;
    function onMove(ev) {
      const dy = ev.clientY - startY;
      const dFr = dy / totalHeight * totalFr;
      const newTop = Math.max(topMin, topFr + dFr);
      const newBottom = Math.max(bottomMin, bottomFr - dFr);
      if (newTop <= topMin && dFr < 0) return;
      if (newBottom <= bottomMin && dFr > 0) return;
      setSizes((prev) => ({
        ...prev,
        rowSplit: [newTop, newBottom]
      }));
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      restoreTextSelection2();
    }
    document.body.style.cursor = "row-resize";
    suppressTextSelection2();
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }
  const colTemplate = () => {
    const s = colSizes();
    return s.map((v2) => `${v2}fr`).join(` ${HANDLE_SIZE}px `);
  };
  const row2Template = () => {
    const s = rowSizes();
    if (!s) return "";
    return s.map((v2) => `${v2}fr`).join(` ${HANDLE_SIZE}px `);
  };
  const rowTemplate = () => {
    const split = rowSplit();
    if (!split) return "1fr";
    return `${split[0]}fr ${HANDLE_SIZE}px ${split[1]}fr`;
  };
  const hasRows = () => !!props.rows && props.rows.length > 0;
  return (() => {
    var _el$ = _tmpl$3(), _el$2 = _el$.firstChild;
    var _ref$ = containerRef;
    typeof _ref$ === "function" ? use(_ref$, _el$) : containerRef = _el$;
    insert(_el$2, createComponent(For, {
      get each() {
        return props.cols;
      },
      children: (col, i) => [createComponent(Show, {
        get when() {
          return i() > 0;
        },
        get children() {
          var _el$5 = _tmpl$4();
          _el$5.$$mousedown = (e) => startColResize(i() - 1, e);
          return _el$5;
        }
      }), (() => {
        var _el$6 = _tmpl$5();
        insert(_el$6, () => col.content());
        return _el$6;
      })()]
    }));
    insert(_el$, createComponent(Show, {
      get when() {
        return hasRows();
      },
      get children() {
        var _el$3 = _tmpl$2();
        _el$3.$$mousedown = startRowResize;
        return _el$3;
      }
    }), null);
    insert(_el$, createComponent(Show, {
      get when() {
        return hasRows();
      },
      get children() {
        var _el$4 = _tmpl$22();
        insert(_el$4, createComponent(For, {
          get each() {
            return props.rows;
          },
          children: (panel, i) => [createComponent(Show, {
            get when() {
              return i() > 0;
            },
            get children() {
              var _el$7 = _tmpl$4();
              _el$7.$$mousedown = (e) => startRow2ColResize(i() - 1, e);
              return _el$7;
            }
          }), (() => {
            var _el$8 = _tmpl$5();
            insert(_el$8, () => panel.content());
            return _el$8;
          })()]
        }));
        effect((_$p) => setStyleProperty(_el$4, "grid-template-columns", row2Template()));
        return _el$4;
      }
    }), null);
    effect((_p$) => {
      var _v$ = props.class, _v$2 = rowTemplate(), _v$3 = colTemplate();
      _v$ !== _p$.e && className(_el$, _p$.e = _v$);
      _v$2 !== _p$.t && setStyleProperty(_el$, "grid-template-rows", _p$.t = _v$2);
      _v$3 !== _p$.a && setStyleProperty(_el$2, "grid-template-columns", _p$.a = _v$3);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0
    });
    return _el$;
  })();
}
var stylesInjected = false;
if (typeof document !== "undefined" && !stylesInjected) {
  stylesInjected = true;
  const style2 = document.createElement("style");
  style2.textContent = `
/* \u0420\u0443\u0447\u043A\u0443 \u0432\u0438\u0434\u043D\u043E \u0421\u0420\u0410\u0417\u0423, \u0431\u0435\u0437 \u043D\u0430\u0432\u0435\u0434\u0435\u043D\u0438\u044F: \u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u0430\u044F \u043F\u043E\u043B\u043E\u0441\u0430 \u2014 \u044D\u0442\u043E \u0440\u0443\u0447\u043A\u0430, \u043A\u043E\u0442\u043E\u0440\u0443\u044E
   \u043D\u0430\u0445\u043E\u0434\u044F\u0442 \u043C\u044B\u0448\u044C\u044E \u043D\u0430\u0443\u0433\u0430\u0434. \u041F\u043E\u043B\u043E\u0441\u0430 \u0440\u0438\u0441\u0443\u0435\u0442\u0441\u044F \u043B\u0438\u043D\u0438\u0435\u0439 \u043F\u043E \u0446\u0435\u043D\u0442\u0440\u0443, \u0446\u0432\u0435\u0442 \u043F\u0435\u0440\u0435\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F
   \u043F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u043E\u0439, \u043D\u043E \u0434\u0435\u0444\u043E\u043B\u0442 \u043E\u0431\u044F\u0437\u0430\u043D \u0447\u0438\u0442\u0430\u0442\u044C\u0441\u044F (\u0441\u043C. \u043F\u0440\u0430\u0432\u0438\u043B\u043E \u043A\u043E\u043D\u0442\u0440\u0430\u0441\u0442\u0430 \u0432 CLAUDE.md). */
.resizable-grid-handle-col {
  cursor: col-resize;
  background: linear-gradient(to right,
    transparent calc(50% - 0.5px),
    var(--dumb-grid-handle, #64748b) calc(50% - 0.5px),
    var(--dumb-grid-handle, #64748b) calc(50% + 0.5px),
    transparent calc(50% + 0.5px));
  transition: background-color 0.15s;
  z-index: 1;
}
.resizable-grid-handle-col:hover,
.resizable-grid-handle-col:active {
  background: oklch(from currentColor l c h / 0.2);
}
.resizable-grid-handle-row {
  cursor: row-resize;
  background: linear-gradient(to bottom,
    transparent calc(50% - 0.5px),
    var(--dumb-grid-handle, #64748b) calc(50% - 0.5px),
    var(--dumb-grid-handle, #64748b) calc(50% + 0.5px),
    transparent calc(50% + 0.5px));
  transition: background-color 0.15s;
  z-index: 1;
}
.resizable-grid-handle-row:hover,
.resizable-grid-handle-row:active {
  background: oklch(from currentColor l c h / 0.2);
}`;
  document.head.appendChild(style2);
}
delegateEvents(["mousedown"]);

// ../shared/dist/index.js
var done = /* @__PURE__ */ new Set();
function injectStyle(id, css) {
  if (typeof document === "undefined") return;
  if (done.has(id)) return;
  done.add(id);
  if (document.querySelector(`style[data-dumb-kit="${id}"]`)) return;
  const el = document.createElement("style");
  el.setAttribute("data-dumb-kit", id);
  el.textContent = css;
  document.head.appendChild(el);
}
function createUploadQueue(upload, events = {}, concurrency = 3) {
  const waiting = [];
  const running = /* @__PURE__ */ new Map();
  let dead = false;
  function pump() {
    while (!dead && running.size < concurrency && waiting.length) {
      const next = waiting.shift();
      start(next.id, next.file);
    }
  }
  function start(id, file) {
    const ctrl = new AbortController();
    running.set(id, ctrl);
    events.onStart?.(id);
    upload(file, {
      signal: ctrl.signal,
      onProgress: (f) => {
        if (running.get(id) === ctrl) events.onProgress?.(id, clamp(f));
      }
    }).then((res) => {
      if (running.get(id) !== ctrl) return;
      running.delete(id);
      events.onDone?.(id, res);
    }).catch((err) => {
      if (running.get(id) !== ctrl) return;
      running.delete(id);
      events.onError?.(id, message(err));
    }).finally(pump);
  }
  return {
    add(id, file) {
      if (dead) return;
      waiting.push({ id, file });
      pump();
    },
    cancel(id) {
      const i = waiting.findIndex((w) => w.id === id);
      if (i >= 0) {
        waiting.splice(i, 1);
        return;
      }
      const ctrl = running.get(id);
      if (!ctrl) return;
      running.delete(id);
      ctrl.abort();
      pump();
    },
    destroy() {
      dead = true;
      waiting.length = 0;
      for (const ctrl of running.values()) ctrl.abort();
      running.clear();
    },
    pending: () => waiting.length + running.size
  };
}
var clamp = (f) => f < 0 ? 0 : f > 1 ? 1 : f;
function message(err) {
  if (err instanceof Error) return err.message;
  return String(err);
}
function putWithProgress(file, p, ctx) {
  return new Promise((resolve, reject) => {
    if (ctx.signal.aborted) return reject(new Error("\u043E\u0442\u043C\u0435\u043D\u0435\u043D\u043E"));
    const xhr = new XMLHttpRequest();
    xhr.open(p.method ?? "PUT", p.url, true);
    for (const [k, v] of Object.entries(p.headers ?? {})) xhr.setRequestHeader(k, v);
    const onAbort = () => xhr.abort();
    ctx.signal.addEventListener("abort", onAbort, { once: true });
    const done2 = () => ctx.signal.removeEventListener("abort", onAbort);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) ctx.onProgress(ev.loaded / ev.total);
    };
    xhr.onload = () => {
      done2();
      if (xhr.status >= 200 && xhr.status < 300) {
        ctx.onProgress(1);
        resolve({ url: p.publicUrl ?? stripQuery(p.url), key: p.key });
      } else {
        reject(new Error(`\u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435 \u043E\u0442\u0432\u0435\u0442\u0438\u043B\u043E ${xhr.status}${reason(xhr.responseText)}`));
      }
    };
    xhr.onerror = () => {
      done2();
      reject(new Error("\u0441\u0435\u0442\u044C \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430"));
    };
    xhr.onabort = () => {
      done2();
      reject(new Error("\u043E\u0442\u043C\u0435\u043D\u0435\u043D\u043E"));
    };
    xhr.send(file);
  });
}
var stripQuery = (url) => url.split("?")[0];
function reason(body) {
  const m = body && /<Message>([^<]+)<\/Message>/.exec(body);
  return m ? `: ${m[1]}` : "";
}
var initialMulticharmap = {
  // multibyte devanagari characters (hindi, sanskrit, etc.)
  \u092B\u093C: "Fi",
  \u0917\u093C: "Ghi",
  \u0916\u093C: "Khi",
  \u0915\u093C: "Qi",
  \u0921\u093C: "ugDha",
  \u0922\u093C: "ugDhha",
  \u092F\u093C: "Yi",
  \u091C\u093C: "Za",
  // hebrew
  // Refs: http://www.eki.ee/wgrs/rom1_he.pdf
  // Refs: https://en.wikipedia.org/wiki/Niqqud
  \u05D1\u05B4\u05D9: "i",
  \u05D1\u05B5: "e",
  \u05D1\u05B5\u05D9: "e",
  \u05D1\u05B6: "e",
  \u05D1\u05B7: "a",
  \u05D1\u05B8: "a",
  \u05D1\u05B9: "o",
  \u05D5\u05B9: "o",
  \u05D1\u05BB: "u",
  \u05D5\u05BC: "u",
  \u05D1\u05BC: "b",
  \u05DB\u05BC: "k",
  \u05DA\u05BC: "k",
  \u05E4\u05BC: "p",
  \u05E9\u05C1: "sh",
  \u05E9\u05C2: "s",
  \u05D1\u05B0: "e",
  \u05D7\u05B1: "e",
  \u05D7\u05B2: "a",
  \u05D7\u05B3: "o",
  \u05D1\u05B4: "i"
};
var initialCharmap = {
  // latin
  \u00C0: "A",
  \u00C1: "A",
  \u00C2: "A",
  \u00C3: "A",
  \u00C4: "A",
  \u00C5: "A",
  \u00C6: "AE",
  \u00C7: "C",
  \u00C8: "E",
  \u00C9: "E",
  \u00CA: "E",
  \u00CB: "E",
  \u00CC: "I",
  \u00CD: "I",
  \u00CE: "I",
  \u00CF: "I",
  \u00D0: "D",
  \u00D1: "N",
  \u00D2: "O",
  \u00D3: "O",
  \u00D4: "O",
  \u00D5: "O",
  \u00D6: "O",
  \u0150: "O",
  \u00D8: "O",
  \u014C: "O",
  \u00D9: "U",
  \u00DA: "U",
  \u00DB: "U",
  \u00DC: "U",
  \u0170: "U",
  \u00DD: "Y",
  \u00DE: "TH",
  \u00DF: "ss",
  \u00E0: "a",
  \u00E1: "a",
  \u00E2: "a",
  \u00E3: "a",
  \u00E4: "a",
  \u00E5: "a",
  \u00E6: "ae",
  \u00E7: "c",
  \u00E8: "e",
  \u00E9: "e",
  \u00EA: "e",
  \u00EB: "e",
  \u00EC: "i",
  \u00ED: "i",
  \u00EE: "i",
  \u00EF: "i",
  \u00F0: "d",
  \u00F1: "n",
  \u00F2: "o",
  \u00F3: "o",
  \u00F4: "o",
  \u00F5: "o",
  \u00F6: "o",
  \u0151: "o",
  \u00F8: "o",
  \u014D: "o",
  \u0152: "OE",
  \u0153: "oe",
  \u00F9: "u",
  \u00FA: "u",
  \u00FB: "u",
  \u00FC: "u",
  \u0171: "u",
  \u00FD: "y",
  \u00FE: "th",
  \u00FF: "y",
  "\u1E9E": "SS",
  // greek
  \u03B1: "a",
  \u03B2: "b",
  \u03B3: "g",
  \u03B4: "d",
  \u03B5: "e",
  \u03B6: "z",
  \u03B7: "h",
  \u03B8: "th",
  \u03B9: "i",
  \u03BA: "k",
  \u03BB: "l",
  \u03BC: "m",
  \u03BD: "n",
  \u03BE: "3",
  \u03BF: "o",
  \u03C0: "p",
  \u03C1: "r",
  \u03C3: "s",
  \u03C4: "t",
  \u03C5: "y",
  \u03C6: "f",
  \u03C7: "x",
  \u03C8: "ps",
  \u03C9: "w",
  \u03AC: "a",
  \u03AD: "e",
  \u03AF: "i",
  \u03CC: "o",
  \u03CD: "y",
  \u03AE: "h",
  \u03CE: "w",
  \u03C2: "s",
  \u03CA: "i",
  \u03B0: "y",
  \u03CB: "y",
  \u0390: "i",
  \u0391: "A",
  \u0392: "B",
  \u0393: "G",
  \u0394: "D",
  \u0395: "E",
  \u0396: "Z",
  \u0397: "H",
  \u0398: "Th",
  \u0399: "I",
  \u039A: "K",
  \u039B: "L",
  \u039C: "M",
  \u039D: "N",
  \u039E: "3",
  \u039F: "O",
  \u03A0: "P",
  \u03A1: "R",
  \u03A3: "S",
  \u03A4: "T",
  \u03A5: "Y",
  \u03A6: "F",
  \u03A7: "X",
  \u03A8: "PS",
  \u03A9: "W",
  \u0386: "A",
  \u0388: "E",
  \u038A: "I",
  \u038C: "O",
  \u038E: "Y",
  \u0389: "H",
  \u038F: "W",
  \u03AA: "I",
  \u03AB: "Y",
  // turkish
  \u015F: "s",
  \u015E: "S",
  \u0131: "i",
  \u0130: "I",
  \u011F: "g",
  \u011E: "G",
  // russian
  \u0430: "a",
  \u0431: "b",
  \u0432: "v",
  \u0433: "g",
  \u0434: "d",
  \u0435: "e",
  \u0451: "yo",
  \u0436: "zh",
  \u0437: "z",
  \u0438: "i",
  \u0439: "j",
  \u043A: "k",
  \u043B: "l",
  \u043C: "m",
  \u043D: "n",
  \u043E: "o",
  \u043F: "p",
  \u0440: "r",
  \u0441: "s",
  \u0442: "t",
  \u0443: "u",
  \u0444: "f",
  \u0445: "h",
  \u0446: "c",
  \u0447: "ch",
  \u0448: "sh",
  \u0449: "sh",
  \u044A: "u",
  \u044B: "y",
  \u044C: "",
  \u044D: "e",
  \u044E: "yu",
  \u044F: "ya",
  \u0410: "A",
  \u0411: "B",
  \u0412: "V",
  \u0413: "G",
  \u0414: "D",
  \u0415: "E",
  \u0401: "Yo",
  \u0416: "Zh",
  \u0417: "Z",
  \u0418: "I",
  \u0419: "J",
  \u041A: "K",
  \u041B: "L",
  \u041C: "M",
  \u041D: "N",
  \u041E: "O",
  \u041F: "P",
  \u0420: "R",
  \u0421: "S",
  \u0422: "T",
  \u0423: "U",
  \u0424: "F",
  \u0425: "H",
  \u0426: "C",
  \u0427: "Ch",
  \u0428: "Sh",
  \u0429: "Sh",
  \u042A: "U",
  \u042B: "Y",
  \u042C: "",
  \u042D: "E",
  \u042E: "Yu",
  \u042F: "Ya",
  // ukranian
  \u0404: "Ye",
  \u0406: "I",
  \u0407: "Yi",
  \u0490: "G",
  \u0454: "ye",
  \u0456: "i",
  \u0457: "yi",
  \u0491: "g",
  // czech
  \u010D: "c",
  \u010F: "d",
  \u011B: "e",
  \u0148: "n",
  \u0159: "r",
  \u0161: "s",
  \u0165: "t",
  \u016F: "u",
  \u017E: "z",
  \u010C: "C",
  \u010E: "D",
  \u011A: "E",
  \u0147: "N",
  \u0158: "R",
  \u0160: "S",
  \u0164: "T",
  \u016E: "U",
  \u017D: "Z",
  // slovak
  \u013E: "l",
  \u013A: "l",
  \u0155: "r",
  \u013D: "L",
  \u0139: "L",
  \u0154: "R",
  // polish
  \u0105: "a",
  \u0107: "c",
  \u0119: "e",
  \u0142: "l",
  \u0144: "n",
  \u015B: "s",
  \u017A: "z",
  \u017C: "z",
  \u0104: "A",
  \u0106: "C",
  \u0118: "E",
  \u0141: "L",
  \u0143: "N",
  \u015A: "S",
  \u0179: "Z",
  \u017B: "Z",
  // latvian
  \u0101: "a",
  \u0113: "e",
  \u0123: "g",
  \u012B: "i",
  \u0137: "k",
  \u013C: "l",
  \u0146: "n",
  \u016B: "u",
  \u0100: "A",
  \u0112: "E",
  \u0122: "G",
  \u012A: "I",
  \u0136: "K",
  \u013B: "L",
  \u0145: "N",
  \u016A: "U",
  // arabic
  \u0623: "a",
  \u0625: "i",
  \u0628: "b",
  \u062A: "t",
  \u062B: "th",
  \u062C: "g",
  \u062D: "h",
  \u062E: "kh",
  \u062F: "d",
  \u0630: "th",
  \u0631: "r",
  \u0632: "z",
  \u0633: "s",
  \u0634: "sh",
  \u0635: "s",
  \u0636: "d",
  \u0637: "t",
  \u0638: "th",
  \u0639: "aa",
  \u063A: "gh",
  \u0641: "f",
  \u0642: "k",
  \u0643: "k",
  \u0644: "l",
  \u0645: "m",
  \u0646: "n",
  \u0647: "h",
  \u0648: "o",
  \u064A: "y",
  \u0621: "aa",
  \u0629: "a",
  // farsi
  \u0622: "a",
  \u0627: "a",
  \u067E: "p",
  \u0698: "zh",
  \u06AF: "g",
  \u0686: "ch",
  \u06A9: "k",
  \u06CC: "i",
  // lithuanian
  \u0117: "e",
  \u012F: "i",
  \u0173: "u",
  \u0116: "E",
  \u012E: "I",
  \u0172: "U",
  // romanian
  \u021B: "t",
  \u021A: "T",
  \u0163: "t",
  \u0162: "T",
  \u0219: "s",
  \u0218: "S",
  \u0103: "a",
  \u0102: "A",
  // vietnamese
  \u1EA0: "A",
  \u1EA2: "A",
  \u1EA6: "A",
  \u1EA4: "A",
  \u1EAC: "A",
  \u1EA8: "A",
  \u1EAA: "A",
  \u1EB0: "A",
  \u1EAE: "A",
  \u1EB6: "A",
  \u1EB2: "A",
  \u1EB4: "A",
  \u1EB8: "E",
  \u1EBA: "E",
  \u1EBC: "E",
  \u1EC0: "E",
  \u1EBE: "E",
  \u1EC6: "E",
  \u1EC2: "E",
  \u1EC4: "E",
  \u1ECA: "I",
  \u1EC8: "I",
  \u0128: "I",
  \u1ECC: "O",
  \u1ECE: "O",
  \u1ED2: "O",
  \u1ED0: "O",
  \u1ED8: "O",
  \u1ED4: "O",
  \u1ED6: "O",
  \u01A0: "O",
  \u1EDC: "O",
  \u1EDA: "O",
  \u1EE2: "O",
  \u1EDE: "O",
  \u1EE0: "O",
  \u1EE4: "U",
  \u1EE6: "U",
  \u0168: "U",
  \u01AF: "U",
  \u1EEA: "U",
  \u1EE8: "U",
  \u1EF0: "U",
  \u1EEC: "U",
  \u1EEE: "U",
  \u1EF2: "Y",
  \u1EF4: "Y",
  \u1EF6: "Y",
  \u1EF8: "Y",
  \u0110: "D",
  \u1EA1: "a",
  \u1EA3: "a",
  \u1EA7: "a",
  \u1EA5: "a",
  \u1EAD: "a",
  \u1EA9: "a",
  \u1EAB: "a",
  \u1EB1: "a",
  \u1EAF: "a",
  \u1EB7: "a",
  \u1EB3: "a",
  \u1EB5: "a",
  \u1EB9: "e",
  \u1EBB: "e",
  \u1EBD: "e",
  \u1EC1: "e",
  \u1EBF: "e",
  \u1EC7: "e",
  \u1EC3: "e",
  \u1EC5: "e",
  \u1ECB: "i",
  \u1EC9: "i",
  \u0129: "i",
  \u1ECD: "o",
  \u1ECF: "o",
  \u1ED3: "o",
  \u1ED1: "o",
  \u1ED9: "o",
  \u1ED5: "o",
  \u1ED7: "o",
  \u01A1: "o",
  \u1EDD: "o",
  \u1EDB: "o",
  \u1EE3: "o",
  \u1EDF: "o",
  \u1EE1: "o",
  \u1EE5: "u",
  \u1EE7: "u",
  \u0169: "u",
  \u01B0: "u",
  \u1EEB: "u",
  \u1EE9: "u",
  \u1EF1: "u",
  \u1EED: "u",
  \u1EEF: "u",
  \u1EF3: "y",
  \u1EF5: "y",
  \u1EF7: "y",
  \u1EF9: "y",
  \u0111: "d",
  // kazakh
  \u04D8: "AE",
  \u04D9: "ae",
  \u0492: "GH",
  \u0493: "gh",
  \u049A: "KH",
  \u049B: "kh",
  \u04A2: "NG",
  \u04A3: "ng",
  \u04AE: "UE",
  \u04AF: "ue",
  \u04B0: "U",
  \u04B1: "u",
  \u04BA: "H",
  \u04BB: "h",
  \u04E8: "OE",
  \u04E9: "oe",
  // serbian
  \u0452: "dj",
  \u0458: "j",
  \u0459: "lj",
  \u045A: "nj",
  \u045B: "c",
  \u045F: "dz",
  \u0402: "Dj",
  \u0408: "j",
  \u0409: "Lj",
  \u040A: "Nj",
  \u040B: "C",
  \u040F: "Dz",
  \u01CC: "nj",
  \u01C9: "lj",
  \u01CB: "NJ",
  \u01C8: "LJ",
  // hindi
  \u0905: "a",
  \u0906: "aa",
  \u090F: "e",
  \u0908: "ii",
  \u090D: "ei",
  \u090E: "ae",
  \u0910: "ai",
  \u0907: "i",
  \u0913: "o",
  \u0911: "oi",
  \u0912: "oii",
  \u090A: "uu",
  \u0914: "ou",
  \u0909: "u",
  \u092C: "B",
  \u092D: "Bha",
  \u091A: "Ca",
  \u091B: "Chha",
  \u0921: "Da",
  \u0922: "Dha",
  \u092B: "Fa",
  \u0917: "Ga",
  \u0918: "Gha",
  \u0917\u093C: "Ghi",
  \u0939: "Ha",
  \u091C: "Ja",
  \u091D: "Jha",
  \u0915: "Ka",
  \u0916: "Kha",
  \u0916\u093C: "Khi",
  \u0932: "L",
  \u0933: "Li",
  \u090C: "Li",
  \u0934: "Lii",
  \u0961: "Lii",
  \u092E: "Ma",
  \u0928: "Na",
  \u0919: "Na",
  \u091E: "Nia",
  \u0923: "Nae",
  \u0929: "Ni",
  \u0950: "oms",
  \u092A: "Pa",
  \u0915\u093C: "Qi",
  \u0930: "Ra",
  \u090B: "Ri",
  \u0960: "Ri",
  \u0931: "Ri",
  \u0938: "Sa",
  \u0936: "Sha",
  \u0937: "Shha",
  \u091F: "Ta",
  \u0924: "Ta",
  \u0920: "Tha",
  \u0926: "Tha",
  \u0925: "Tha",
  \u0927: "Thha",
  \u0921\u093C: "ugDha",
  \u0922\u093C: "ugDhha",
  \u0935: "Va",
  \u092F: "Ya",
  \u092F\u093C: "Yi",
  \u091C\u093C: "Za",
  // azerbaijani
  \u0259: "e",
  \u018F: "E",
  // georgian
  \u10D0: "a",
  \u10D1: "b",
  \u10D2: "g",
  \u10D3: "d",
  \u10D4: "e",
  \u10D5: "v",
  \u10D6: "z",
  \u10D7: "t",
  \u10D8: "i",
  \u10D9: "k",
  \u10DA: "l",
  \u10DB: "m",
  \u10DC: "n",
  \u10DD: "o",
  \u10DE: "p",
  \u10DF: "zh",
  \u10E0: "r",
  \u10E1: "s",
  \u10E2: "t",
  \u10E3: "u",
  \u10E4: "p",
  \u10E5: "k",
  \u10E6: "gh",
  \u10E7: "q",
  \u10E8: "sh",
  \u10E9: "ch",
  \u10EA: "ts",
  \u10EB: "dz",
  \u10EC: "ts",
  \u10ED: "ch",
  \u10EE: "kh",
  \u10EF: "j",
  \u10F0: "h",
  // hebrew
  \u05D1: "v",
  \u05D2\u05BC: "g",
  \u05D2: "g",
  \u05D3: "d",
  \u05D3\u05BC: "d",
  \u05D4: "h",
  \u05D5: "v",
  \u05D6: "z",
  \u05D7: "h",
  \u05D8: "t",
  \u05D9: "y",
  \u05DB: "kh",
  \u05DA: "kh",
  \u05DC: "l",
  \u05DE: "m",
  \u05DD: "m",
  \u05E0: "n",
  \u05DF: "n",
  \u05E1: "s",
  \u05E4: "f",
  \u05E3: "f",
  \u05E5: "ts",
  \u05E6: "ts",
  \u05E7: "k",
  \u05E8: "r",
  \u05EA\u05BC: "t",
  \u05EA: "t"
};
Object.assign({}, initialCharmap);
Object.assign({}, initialMulticharmap);
var DateTimeShortFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});
function toDate(v) {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
function fmtDateTimeShort(v) {
  const d = toDate(v);
  return d ? DateTimeShortFmt.format(d) : "";
}
function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} \u0411`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} \u041A\u0411`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} \u041C\u0411`;
}

// src/finderPath.ts
function nameOf(key) {
  const clean = key.endsWith("/") ? key.slice(0, -1) : key;
  const i = clean.lastIndexOf("/");
  return i < 0 ? clean : clean.slice(i + 1);
}
function parentOf(key) {
  const clean = key.endsWith("/") ? key.slice(0, -1) : key;
  const i = clean.lastIndexOf("/");
  return i < 0 ? "" : clean.slice(0, i + 1);
}
function joinPrefix(prefix, name) {
  const base = !prefix || prefix.endsWith("/") ? prefix : `${prefix}/`;
  return `${base}${name}`;
}
function crumbs(prefix, rootLabel = "\u0412\u0441\u0451") {
  const out = [{ name: rootLabel, prefix: "" }];
  let acc = "";
  for (const part of prefix.split("/")) {
    if (!part) continue;
    acc += `${part}/`;
    out.push({ name: part, prefix: acc });
  }
  return out;
}
function canMove(key, to) {
  if (parentOf(key) === to) return false;
  if (!key.endsWith("/")) return true;
  return to !== key && !to.startsWith(key);
}
function sortEntries(entries, key = "name", desc = false) {
  const dir = desc ? -1 : 1;
  return [...entries].sort((a, b) => {
    if (!!a.dir !== !!b.dir) return a.dir ? -1 : 1;
    if (key === "size") return dir * ((a.size ?? 0) - (b.size ?? 0));
    if (key === "modified") return dir * (stamp(a) - stamp(b));
    return dir * a.name.localeCompare(b.name, void 0, { numeric: true, sensitivity: "base" });
  });
}
var stamp = (e) => {
  if (e.modified === void 0) return 0;
  const t = typeof e.modified === "number" ? e.modified : Date.parse(e.modified);
  return Number.isNaN(t) ? 0 : t;
};
var KINDS = [
  ["image", /\.(jpe?g|png|gif|webp|svg|avif|bmp|ico|heic)$/i],
  ["video", /\.(mp4|webm|mov|m4v|avi|mkv|ogv)$/i],
  ["audio", /\.(mp3|wav|ogg|flac|m4a|aac)$/i],
  ["pdf", /\.pdf$/i],
  ["archive", /\.(zip|rar|7z|tar|gz|bz2|xz)$/i],
  ["text", /\.(txt|md|json|ya?ml|csv|log|xml|html?|css|[jt]sx?)$/i]
];
function kindOf(name) {
  for (const [kind, re] of KINDS) if (re.test(name)) return kind;
  return "file";
}
var ICONS = {
  dir: "\u{1F4C1}",
  image: "\u{1F5BC}",
  video: "\u{1F3AC}",
  audio: "\u{1F3B5}",
  pdf: "\u{1F4D5}",
  archive: "\u{1F5DC}",
  text: "\u{1F4C4}",
  file: "\u{1F4E6}"
};

// src/DumbFinder.tsx
var _tmpl$6 = /* @__PURE__ */ template(`<span>`);
var _tmpl$23 = /* @__PURE__ */ template(`<button type=button class=dumb-finder-twist data-no-select>`);
var _tmpl$32 = /* @__PURE__ */ template(`<span class=dumb-finder-weight> \xB7 `);
var _tmpl$42 = /* @__PURE__ */ template(`<ul>`);
var _tmpl$52 = /* @__PURE__ */ template(`<li><div class=dumb-finder-node><span class=dumb-finder-node-name>`);
var _tmpl$62 = /* @__PURE__ */ template(`<span class=dumb-finder-twist>`);
var _tmpl$7 = /* @__PURE__ */ template(`<nav class=dumb-finder-side><input class=dumb-finder-find placeholder=\u043F\u0430\u043F\u043A\u0430><ul class=dumb-finder-tree>`);
var _tmpl$8 = /* @__PURE__ */ template(`<div class=dumb-finder-head><span></span><span></span><button type=button>\u0418\u043C\u044F </button><button type=button>\u0420\u0430\u0437\u043C\u0435\u0440 </button><button type=button>\u0418\u0437\u043C\u0435\u043D\u0451\u043D </button><span>\u0412\u0438\u0434`);
var _tmpl$9 = /* @__PURE__ */ template(`<div class=dumb-finder-empty>`);
var _tmpl$0 = /* @__PURE__ */ template(`<div class=dumb-finder-view tabindex=0><div class=dumb-finder-items>`);
var _tmpl$1 = /* @__PURE__ */ template(`<div class=dumb-finder-item>`);
var _tmpl$10 = /* @__PURE__ */ template(`<span class=dumb-finder-indent>`);
var _tmpl$11 = /* @__PURE__ */ template(`<button type=button class=dumb-finder-twist data-no-select data-no-drag>`);
var _tmpl$12 = /* @__PURE__ */ template(`<img alt loading=lazy>`, true, false, false);
var _tmpl$13 = /* @__PURE__ */ template(`<div class=dumb-finder-thumb>`);
var _tmpl$14 = /* @__PURE__ */ template(`<div class=dumb-finder-name>`);
var _tmpl$15 = /* @__PURE__ */ template(`<div class=dumb-finder-meta>`);
var _tmpl$16 = /* @__PURE__ */ template(`<span class=dumb-finder-bar-progress><i>`);
var _tmpl$17 = /* @__PURE__ */ template(`<div class=dumb-finder-item data-pending=1><div class=dumb-finder-thumb>\u2B06</div><div class=dumb-finder-name></div><div class=dumb-finder-meta>`);
var _tmpl$18 = /* @__PURE__ */ template(`<button type=button class=dumb-finder-btn><span>`);
var _tmpl$19 = /* @__PURE__ */ template(`<div class=dumb-finder-bar><span class=dumb-finder-err>\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0431\u0435\u0437\u0432\u043E\u0437\u0432\u0440\u0430\u0442\u043D\u043E: </span><button type=button>\u0414\u0430, \u0443\u0434\u0430\u043B\u0438\u0442\u044C</button><button type=button>\u041E\u0442\u043C\u0435\u043D\u0430`);
var _tmpl$20 = /* @__PURE__ */ template(`<div class=dumb-finder-err>`);
var _tmpl$21 = /* @__PURE__ */ template(`<div><div class=dumb-finder-bar><nav class=dumb-finder-crumbs><ul></ul></nav></div><div class=dumb-finder-main></div><div class=dumb-finder-status>`);
var _tmpl$222 = /* @__PURE__ */ template(`<li><button type=button class=dumb-finder-crumb>`);
var _tmpl$232 = /* @__PURE__ */ template(`<div class=dumb-finder-bar><input autofocus placeholder="\u0438\u043C\u044F \u043F\u0430\u043F\u043A\u0438"><button type=button>\u0413\u043E\u0442\u043E\u0432\u043E</button><button type=button>\u041E\u0442\u043C\u0435\u043D\u0430`);
var CSS = `
  /* \u041A\u0435\u0433\u043B\u044C \u041E\u0414\u0418\u041D \u043D\u0430 \u0432\u0435\u0441\u044C \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442: \u043E\u0442 \u043D\u0435\u0433\u043E \u0435\u0434\u0443\u0442 \u0438 \u0434\u0435\u0440\u0435\u0432\u043E \u0441\u043B\u0435\u0432\u0430, \u0438 \u0441\u0442\u0440\u043E\u043A\u0438
     \u0441\u043F\u0438\u0441\u043A\u0430, \u0438 \u043F\u043E\u0434\u043F\u0438\u0441\u0438 \u043F\u043B\u0438\u0442\u043E\u043A. \u0414\u0435\u0440\u0435\u0432\u0443 \u043C\u043E\u0436\u043D\u043E \u0437\u0430\u0434\u0430\u0442\u044C \u0441\u0432\u043E\u0439 (--dumb-finder-tree-size),
     \u043D\u043E \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u043E\u043D\u043E \u0431\u0435\u0440\u0451\u0442 \u043E\u0431\u0449\u0438\u0439. */
  .dumb-finder { display: flex; flex-direction: column; min-height: 0;
                 font-size: var(--dumb-finder-size, 13px);
                 color: var(--dumb-finder-fg, #0f172a) }
  .dumb-finder-bar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
                     padding: 6px 2px }
  .dumb-finder-crumbs { min-width: 0; flex: 1 }
  .dumb-finder-crumbs ul { display: flex; align-items: center; flex-wrap: wrap;
                           list-style: none; margin: 0; padding: 0 }
  .dumb-finder-crumbs li { display: flex; align-items: center }
  /* \u0440\u0430\u0437\u0434\u0435\u043B\u0438\u0442\u0435\u043B\u044C \u0433\u0430\u0441\u0438\u0442\u0441\u044F \u043F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u043E\u0439: \u0441 \u0433\u043E\u0442\u043E\u0432\u044B\u043C\u0438 \u043A\u0440\u043E\u0448\u043A\u0430\u043C\u0438 \u043E\u043D \u0443\u0436\u0435 \u0441\u0432\u043E\u0439 */
  .dumb-finder-crumbs li + li::before { content: var(--dumb-finder-crumb-sep, '\u203A');
                                        opacity: .55; padding: 0 2px }
  .dumb-finder-crumb { padding: 2px 7px; border-radius: 6px; cursor: pointer;
                       border: 1px solid transparent; background: none; font: inherit;
                       color: inherit; white-space: nowrap }
  .dumb-finder-crumb:hover { background: var(--dumb-finder-hover, rgb(0 0 0 / .06)) }
  .dumb-finder-crumb[aria-current="true"] { font-weight: 600 }
  /* \u0446\u0435\u043B\u044C \u043F\u0435\u0440\u0435\u043D\u043E\u0441\u0430 \u043F\u043E\u0434\u0441\u0432\u0435\u0447\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u044F\u0440\u043A\u043E: \u043F\u0440\u043E\u043C\u0430\u0445\u043D\u0443\u0442\u044C\u0441\u044F \u043C\u0438\u043C\u043E \u043F\u0430\u043F\u043A\u0438 \u2014 \u043E\u0431\u044B\u0447\u043D\u043E\u0435 \u0434\u0435\u043B\u043E */
  .dumb-finder [data-drop="1"] { outline: 2px solid var(--dumb-finder-drop, #2563eb);
                                 outline-offset: 1px;
                                 background: var(--dumb-finder-drop-bg, rgb(37 99 235 / .1)) }
  .dumb-finder-sep { opacity: .55 }
  /* \u0437\u043D\u0430\u0447\u043E\u043A \u0438 \u043F\u043E\u0434\u043F\u0438\u0441\u044C \u0432 \u043E\u0434\u043D\u0443 \u0441\u0442\u0440\u043E\u043A\u0443; \u0433\u043E\u043B\u044B\u0439 \u0437\u043D\u0430\u0447\u043E\u043A \u2014 \u043F\u0440\u044F\u0447\u044C \u043F\u043E\u0434\u043F\u0438\u0441\u044C \u0441\u0432\u043E\u0438\u043C CSS */
  .dumb-finder-btn { display: inline-flex; align-items: center; gap: 5px }
  .dumb-finder-btn .dumb-finder-glyph { width: 15px; height: 15px; flex: none }

  /* \u0434\u0435\u0440\u0435\u0432\u043E \u0441\u043B\u0435\u0432\u0430 \u0438 \u0444\u0430\u0439\u043B\u044B \u0441\u043F\u0440\u0430\u0432\u0430 \u2014 \u043E\u0434\u0438\u043D \u0440\u044F\u0434, \u0432\u044B\u0441\u043E\u0442\u0430 \u0437\u0430\u0434\u0430\u0451\u0442\u0441\u044F \u0435\u043C\u0443, \u0430 \u043D\u0435 \u0438\u043C \u043E\u0431\u043E\u0438\u043C */
  .dumb-finder-main { display: flex; min-height: 0; gap: 6px }
  /*
    \u041F\u0440\u043E\u043A\u0440\u0443\u0442\u043A\u0430 \u0442\u0443\u0442 \u0420\u041E\u0412\u041D\u041E \u041E\u0414\u041D\u0410 \u2014 \u043F\u0430\u043D\u0435\u043B\u0438 ResizableGrid. \u041D\u0438 \u0441\u0430\u0439\u0434\u0431\u0430\u0440, \u043D\u0438 \u0441\u0430\u043C\u043E \u0434\u0435\u0440\u0435\u0432\u043E
    \u043D\u0435 \u0441\u043A\u0440\u043E\u043B\u043B\u044F\u0442\u0441\u044F: \u0442\u0440\u0438 \u0432\u043B\u043E\u0436\u0435\u043D\u043D\u044B\u0445 \u0441\u043A\u0440\u043E\u043B\u043B\u0435\u0440\u0430 \u0434\u0430\u044E\u0442 \u0434\u0432\u0435 \u043B\u0438\u0448\u043D\u0438\u0435 \u043F\u043E\u043B\u043E\u0441\u044B, \u043E\u0434\u043D\u0430 \u0438\u0437
    \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u0432\u0438\u0441\u0438\u0442 \u043F\u043E\u0441\u0440\u0435\u0434\u0438 \u043F\u0443\u0441\u0442\u043E\u0433\u043E \u043C\u0435\u0441\u0442\u0430.
  */
  /* clip, \u0430 \u043D\u0435 hidden: hidden \u043F\u043E \u043E\u0434\u043D\u043E\u0439 \u043E\u0441\u0438 \u0434\u0435\u043B\u0430\u0435\u0442 \u044D\u043B\u0435\u043C\u0435\u043D\u0442 \u0441\u043A\u0440\u043E\u043B\u043B\u0435\u0440\u043E\u043C \u0438 \u043F\u043E
     \u0432\u0442\u043E\u0440\u043E\u0439 \u2014 \u0432\u0435\u0440\u043D\u0443\u043B\u0430\u0441\u044C \u0431\u044B \u0432\u0442\u043E\u0440\u0430\u044F \u0432\u0435\u0440\u0442\u0438\u043A\u0430\u043B\u044C\u043D\u0430\u044F \u043F\u043E\u043B\u043E\u0441\u0430. clip \u043F\u0440\u043E\u0441\u0442\u043E \u0440\u0435\u0436\u0435\u0442. */
  .dumb-finder-side { width: 100%; overflow-x: clip; overflow-y: visible;
                      padding: 2px 2px; box-sizing: border-box }
  /* \u043F\u043E\u0438\u0441\u043A \u043F\u043E \u043F\u0430\u043F\u043A\u0430\u043C \u2014 \u0441\u0442\u0440\u043E\u043A\u0430, \u0430 \u043D\u0435 \u043F\u0430\u043D\u0435\u043B\u044C: \u043E\u043D \u0442\u0443\u0442 \u0432\u0441\u043F\u043E\u043C\u043E\u0433\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 */
  .dumb-finder-tree > label { margin-bottom: 4px !important; height: 26px; min-height: 26px }
  .dumb-finder-side * { box-sizing: border-box }
  .dumb-finder-split { height: 100% }
  /* \u2500\u2500 \u0434\u0435\u0440\u0435\u0432\u043E \u043F\u0430\u043F\u043E\u043A \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  .dumb-finder-find { width: 100%; box-sizing: border-box; margin-bottom: 4px;
                      padding: 3px 7px; font: inherit; font-size: 12px; border-radius: 6px;
                      border: 1px solid var(--dumb-finder-line, rgb(0 0 0 / .2)) }
  /*
    \u0420\u0430\u0437\u043C\u0435\u0440 \u0434\u0435\u0440\u0435\u0432\u0430 \u0437\u0430\u0434\u0430\u0451\u0442\u0441\u044F \u041E\u0414\u041D\u0418\u041C \u0448\u0440\u0438\u0444\u0442\u043E\u043C: \u0432\u044B\u0441\u043E\u0442\u0430 \u0441\u0442\u0440\u043E\u043A\u0438 \u043D\u0438\u0436\u0435 \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u043D\u0430 \u043A 1lh,
    \u043F\u043E\u044D\u0442\u043E\u043C\u0443 \u043E\u0442 \u043A\u0435\u0433\u043B\u044F \u0435\u0434\u0435\u0442 \u0432\u0441\u0451 \u0440\u0430\u0437\u043E\u043C \u2014 \u0438 \u0441\u0442\u0440\u043E\u043A\u0438, \u0438 \u043F\u043E\u043B\u043E\u0441\u044B, \u0438 \u043E\u0442\u0441\u0442\u0443\u043F\u044B.
  */
  .dumb-finder-tree { list-style: none; margin: 0; padding: 0;
                      font-size: var(--dumb-finder-tree-size, 1em); line-height: 1.4;
    /*
      \u041F\u043E\u043B\u043E\u0441\u0430\u0442\u043E\u0441\u0442\u044C \u2014 \u041E\u0414\u041D\u0418\u041C \u0433\u0440\u0430\u0434\u0438\u0435\u043D\u0442\u043E\u043C \u043D\u0430 \u0432\u0441\u0451 \u0434\u0435\u0440\u0435\u0432\u043E, \u0441 \u0448\u0430\u0433\u043E\u043C \u0432 \u0441\u0442\u0440\u043E\u043A\u0443 (1lh), \u0430 \u043D\u0435
      \u043A\u043B\u0430\u0441\u0441\u043E\u043C \u043D\u0430 \u043A\u0430\u0436\u0434\u0443\u044E \u0432\u0442\u043E\u0440\u0443\u044E \u0441\u0442\u0440\u043E\u043A\u0443. \u0418\u043D\u0430\u0447\u0435 \u043F\u0440\u0438 \u0440\u0430\u0441\u043A\u0440\u044B\u0442\u0438\u0438 \u0432\u043B\u043E\u0436\u0435\u043D\u043D\u044B\u0445 \u043F\u043E\u043B\u043E\u0441\u044B
      \u0441\u0447\u0438\u0442\u0430\u044E\u0442\u0441\u044F \u0437\u0430\u043D\u043E\u0432\u043E \u0432\u043D\u0443\u0442\u0440\u0438 \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u0443\u0440\u043E\u0432\u043D\u044F \u0438 \u0441\u0431\u0438\u0432\u0430\u044E\u0442\u0441\u044F \u0441 \u043E\u0431\u0449\u0435\u0433\u043E \u0440\u0438\u0442\u043C\u0430.
      local \u2014 \u0447\u0442\u043E\u0431\u044B \u0444\u043E\u043D \u0435\u0445\u0430\u043B \u0432\u043C\u0435\u0441\u0442\u0435 \u0441 \u043F\u0440\u043E\u043A\u0440\u0443\u0442\u043A\u043E\u0439, \u0430 \u043D\u0435 \u0441\u0442\u043E\u044F\u043B \u043D\u0430 \u043C\u0435\u0441\u0442\u0435.
    */
                      background-image: repeating-linear-gradient(to bottom,
                        transparent 0, transparent 1lh,
                        var(--dumb-finder-zebra, rgb(0 0 0 / .035)) 1lh,
                        var(--dumb-finder-zebra, rgb(0 0 0 / .035)) 2lh);
                      background-attachment: local }
  .dumb-finder-tree ul { list-style: none; margin: 0; padding-left: 1rem }
  /* \u0441\u0442\u0440\u043E\u043A\u0430 \u0440\u043E\u0432\u043D\u043E \u0432 \u043E\u0434\u043D\u0443 \u0441\u0442\u0440\u043E\u043A\u0443 \u0442\u0435\u043A\u0441\u0442\u0430: \u043D\u0430 \u044D\u0442\u043E\u043C \u0434\u0435\u0440\u0436\u0438\u0442\u0441\u044F \u0440\u0438\u0442\u043C \u043F\u043E\u043B\u043E\u0441 */
  .dumb-finder-node { display: flex; align-items: center; gap: 0; height: 1lh;
                      padding: 0 3px; border-radius: 3px; cursor: default }
  .dumb-finder-node:hover { background: var(--dumb-finder-hover, rgb(0 0 0 / .06)) }
  .dumb-finder-node[data-here="1"] { font-weight: 500;
                                     color: var(--dumb-finder-drop, #2563eb);
                                     background: var(--dumb-finder-sel, rgb(37 99 235 / .16)) }
  .dumb-finder-node-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis;
                           white-space: nowrap; padding-left: 5px }
  /* \u0437\u043D\u0430\u0447\u043A\u0438 \u0432 em, \u0430 \u043D\u0435 \u0432 px: \u0440\u0430\u0437\u043C\u0435\u0440 \u0434\u0435\u0440\u0435\u0432\u0430 \u0437\u0430\u0434\u0430\u0451\u0442\u0441\u044F \u043A\u0435\u0433\u043B\u0435\u043C, \u0438 \u043F\u0430\u043F\u043A\u0430 \u0441\u043E \u0441\u0442\u0440\u0435\u043B\u043A\u043E\u0439
     \u043E\u0431\u044F\u0437\u0430\u043D\u044B \u0435\u0445\u0430\u0442\u044C \u0441\u043B\u0435\u0434\u043E\u043C, \u0438\u043D\u0430\u0447\u0435 \u043D\u0430 \u043A\u0440\u0443\u043F\u043D\u043E\u043C \u0434\u0435\u0440\u0435\u0432\u0435 \u043E\u043D\u0438 \u043E\u0441\u0442\u0430\u044E\u0442\u0441\u044F \u0442\u043E\u0447\u043A\u0430\u043C\u0438 */
  .dumb-finder-node .dumb-finder-glyph { width: 1.15em; height: 1.15em; flex: none }
  .dumb-finder-node > .dumb-finder-twist { width: 1em; min-width: 1em; height: 1lh;
                                           display: grid; place-items: center }
  /* \u043E\u0434\u0438\u043D \u0437\u043D\u0430\u0447\u043E\u043A \u043D\u0430 \u043E\u0431\u0430 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F: \u0440\u0430\u0441\u043A\u0440\u044B\u0442\u0430\u044F \u0432\u0435\u0442\u043A\u0430 \u2014 \u0442\u043E\u0442 \u0436\u0435, \u043F\u043E\u0432\u0451\u0440\u043D\u0443\u0442\u044B\u0439 */
  .dumb-finder-node > button.dumb-finder-twist > .dumb-finder-glyph {
    width: .8em; height: .8em; transition: transform .12s }
  .dumb-finder-node[data-open="1"] > button.dumb-finder-twist > .dumb-finder-glyph {
    transform: rotate(90deg) }
  /* \u0432\u0435\u0441 \u043F\u0440\u0438\u0436\u0430\u0442 \u0432\u043F\u0440\u0430\u0432\u043E \u0438 \u0441\u0436\u0438\u043C\u0430\u0435\u043C: \u0432 \u0443\u0437\u043A\u043E\u0439 \u043A\u043E\u043B\u043E\u043D\u043A\u0435 \u043B\u0443\u0447\u0448\u0435 \u043E\u0431\u0440\u0435\u0437\u0430\u0442\u044C \u0435\u0433\u043E,
     \u0447\u0435\u043C \u0440\u0430\u0441\u043F\u0438\u0440\u0430\u0442\u044C \u0434\u0435\u0440\u0435\u0432\u043E \u043D\u0430\u0440\u0443\u0436\u0443 */
  .dumb-finder-weight { flex: 0 1 auto; min-width: 0; margin-left: auto; padding-left: 6px;
                        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                        font-size: .82em; font-variant-numeric: tabular-nums;
                        color: var(--dumb-finder-dim, #475569) }
  /* \u0432\u0435\u0442\u043A\u0430 \u043F\u043E\u0434 \u043A\u0443\u0440\u0441\u043E\u0440\u043E\u043C \u043F\u0435\u0440\u0435\u043D\u043E\u0441\u0430: \u0440\u0430\u043C\u043A\u043E\u0439, \u043A\u0430\u043A \u043F\u0430\u043F\u043A\u0430 \u0441\u043F\u0440\u0430\u0432\u0430 */
  .dumb-finder-node-drop { outline: 2px solid var(--dumb-finder-drop, #2563eb);
                           background: var(--dumb-finder-drop-bg, rgb(37 99 235 / .1)) }
  /* \u0437\u043D\u0430\u0447\u043A\u0438 \u0434\u0435\u0440\u0435\u0432\u0430: \u044D\u043C\u043E\u0434\u0437\u0438 \u0447\u0435\u0440\u0435\u0437 ::before \u2014 \u043D\u0438 \u0448\u0440\u0438\u0444\u0442\u0430, \u043D\u0438 \u0441\u043F\u0440\u0430\u0439\u0442\u0430 \u043D\u0435 \u043D\u0430\u0434\u043E */
  .dumb-finder-i { display: inline-grid; place-items: center; font-size: 12px;
                   line-height: 1; font-style: normal }
  /* \u0437\u043D\u0430\u0447\u043E\u043A \u043E\u0442 \u043F\u043E\u0442\u0440\u0435\u0431\u0438\u0442\u0435\u043B\u044F: \u043A\u043B\u0430\u0441\u0441 \u043D\u0435\u0441\u0451\u0442 \u0441\u0430\u043C\u0443 \u043A\u0430\u0440\u0442\u0438\u043D\u043A\u0443, \u0440\u0430\u0437\u043C\u0435\u0440 \u0437\u0430\u0434\u0430\u0451\u043C \u043C\u044B */
  .dumb-finder-glyph { display: block; width: 60%; height: 60%; margin: auto }
  .dumb-finder-view[data-view="list"] .dumb-finder-glyph { width: 18px; height: 18px }
  .dumb-finder-i-folder::before { content: '\\1F4C1' }
  .dumb-finder-i-folder-open::before { content: '\\1F4C2' }
  .dumb-finder-i-down::before { content: '\\25BE' }
  .dumb-finder-i-right::before { content: '\\25B8' }
  .dumb-finder-i-search::before { content: '\\1F50D' }
  .dumb-finder-i-sort::before { content: '\\2195' }
  .dumb-finder-i-grip::before { content: '\\2630' }

  .dumb-finder-body { flex: 1; min-width: 0; min-height: 0; overflow: auto;
                      overscroll-behavior: contain; padding: 4px; scrollbar-gutter: stable }
  .dumb-finder-view { min-height: 100%; outline: none }
  .dumb-finder-view:focus-visible { outline: 2px solid var(--dumb-finder-drop, #2563eb);
                                    outline-offset: -2px }
  .dumb-finder-view[data-view="grid"] .dumb-finder-items {
    display: grid; gap: 8px;
    grid-template-columns: repeat(auto-fill, var(--dumb-finder-tile, minmax(132px, 1fr))) }
  .dumb-finder-view[data-view="list"] .dumb-finder-items { display: flex; flex-direction: column }

  .dumb-finder-item { position: relative; cursor: default; border-radius: 8px;
                      border: 1px solid transparent; user-select: none }
  .dumb-finder-item[data-selected="1"] { background: var(--dumb-finder-sel, rgb(37 99 235 / .16));
                                         border-color: var(--dumb-finder-drop, #2563eb) }
  .dumb-finder-item:hover { background: var(--dumb-finder-hover, rgb(0 0 0 / .06)) }
  .dumb-finder-item[data-selected="1"]:hover { background: var(--dumb-finder-sel, rgb(37 99 235 / .16)) }

  /* \u043F\u043B\u0438\u0442\u043A\u0430 */
  .dumb-finder-view[data-view="grid"] .dumb-finder-item { padding: 6px; text-align: center }
  .dumb-finder-thumb { position: relative; aspect-ratio: 1; border-radius: 6px; overflow: hidden;
                       display: grid; place-items: center; font-size: 34px; line-height: 1;
                       background: var(--dumb-finder-thumb-bg, rgb(0 0 0 / .05)) }
  .dumb-finder-thumb img { width: 100%; height: 100%; object-fit: cover; display: block }
  .dumb-finder-name { margin-top: 4px; font-size: .92em; line-height: 1.25;
                      overflow-wrap: anywhere;
                      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
                      overflow: hidden }
  .dumb-finder-meta { font-size: .85em; color: var(--dumb-finder-dim, #475569) }

  /* \u0441\u0442\u0440\u043E\u043A\u0430 \u0441\u043F\u0438\u0441\u043A\u0430 */
  .dumb-finder-view[data-view="list"] .dumb-finder-item {
    display: grid; grid-template-columns: auto 18px 22px 1fr 90px 130px 90px;
    align-items: center; gap: 6px; padding: 0 .6em; font-size: 1em; line-height: 1.4;
    /* \u0441\u0442\u0440\u043E\u043A\u0430 \u0441\u043F\u0438\u0441\u043A\u0430 \u0440\u043E\u0432\u043D\u043E \u0432 \u043E\u0434\u043D\u0443 \u0441\u0442\u0440\u043E\u043A\u0443 \u0442\u0435\u043A\u0441\u0442\u0430 \u2014 \u043A\u0430\u043A \u0441\u0442\u0440\u043E\u043A\u0430 \u0434\u0435\u0440\u0435\u0432\u0430 \u0441\u043B\u0435\u0432\u0430:
       \u043A\u0435\u0433\u043B\u044C, \u043C\u0435\u0436\u0441\u0442\u0440\u043E\u0447\u043D\u044B\u0439 \u0438 \u0432\u044B\u0441\u043E\u0442\u0430 \u0443 \u043D\u0438\u0445 \u043E\u0431\u044F\u0437\u0430\u043D\u044B \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u0442\u044C \u0434\u043E \u043F\u0438\u043A\u0441\u0435\u043B\u044F */
    height: 1lh }
  /* \u043F\u043E\u043B\u043E\u0441\u0430\u0442\u043E\u0441\u0442\u044C \u0441\u0442\u0440\u043E\u043A \u2014 \u043A\u0430\u043A \u0432 Finder: \u0433\u043B\u0430\u0437\u0443 \u043B\u0435\u0433\u0447\u0435 \u0432\u0435\u0441\u0442\u0438 \u0441\u0442\u0440\u043E\u043A\u0443 \u0434\u043E \u043F\u0440\u0430\u0432\u043E\u0433\u043E \u043A\u0440\u0430\u044F */
  .dumb-finder-view[data-view="list"] .dumb-finder-item:nth-child(even) {
    background: var(--dumb-finder-zebra, rgb(0 0 0 / .035)) }
  .dumb-finder-view[data-view="list"] .dumb-finder-item[data-selected="1"]:nth-child(even) {
    background: var(--dumb-finder-sel, rgb(37 99 235 / .16)) }
  .dumb-finder-indent { display: block; height: 1px; flex: none }
  .dumb-finder-view[data-view="list"] .dumb-finder-thumb { aspect-ratio: auto; background: none;
    font-size: 1.1em; width: 1.25em; height: 1.25em }
  .dumb-finder-view[data-view="list"] .dumb-finder-name { margin: 0; font-size: 1em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block }
  .dumb-finder-head { display: grid; grid-template-columns: 18px 22px 1fr 90px 130px 90px; gap: 6px;
                      padding: 2px .6em; font-size: .92em; font-weight: 600;
                      color: var(--dumb-finder-dim, #475569);
                      border-bottom: 1px solid var(--dumb-finder-line, rgb(0 0 0 / .12)) }
  .dumb-finder-head button { font: inherit; color: inherit; background: none; border: 0;
                             padding: 0; cursor: pointer; text-align: left }

  /* \u0437\u0430\u043B\u0438\u0432\u043A\u0430 */
  .dumb-finder-item button.dumb-finder-twist > .dumb-finder-glyph { width: 10px; height: 10px;
                                                                    transition: transform .12s }
  .dumb-finder-item[data-open="1"] button.dumb-finder-twist > .dumb-finder-glyph {
    transform: rotate(90deg) }
  .dumb-finder-item[data-pending="1"] { opacity: .75 }
  .dumb-finder-bar-progress { position: absolute; left: 6px; right: 6px; bottom: 4px; height: 3px;
                              border-radius: 2px; background: rgb(0 0 0 / .15) }
  .dumb-finder-bar-progress > i { display: block; height: 100%; border-radius: 2px;
                                  background: var(--dumb-finder-drop, #2563eb);
                                  transition: width .12s linear }
  .dumb-finder-item[data-failed="1"] { outline: 2px solid var(--dumb-finder-bad, #b91c1c) }

  .dumb-finder-status { padding: 4px 6px; font-size: .92em;
                        color: var(--dumb-finder-dim, #475569) }
  .dumb-finder-empty { padding: 24px; text-align: center;
                       color: var(--dumb-finder-dim, #475569) }
  .dumb-finder-err { padding: 6px 8px; border-radius: 6px; font-size: 13px;
                     color: var(--dumb-finder-bad, #b91c1c);
                     background: var(--dumb-finder-bad-bg, rgb(185 28 28 / .1)) }
  /* \u043F\u0440\u0438\u0451\u043C \u0444\u0430\u0439\u043B\u043E\u0432 \u0438\u0437 \u0441\u0438\u0441\u0442\u0435\u043C\u044B: \u0440\u0430\u043C\u043A\u0430 \u043F\u043E \u0432\u0441\u0435\u0439 \u043E\u0431\u043B\u0430\u0441\u0442\u0438 */
  .dumb-finder-view[data-files="1"] { outline: 2px dashed var(--dumb-finder-drop, #2563eb);
                                      outline-offset: -3px }
`;
function DumbFinder(props) {
  injectStyle("finder", CSS);
  const editable = () => props.editable !== false;
  const [ownPath, setOwnPath] = createSignal("");
  const path = () => props.path ?? ownPath();
  const goto = (next) => {
    batch(() => {
      setOwnPath(next);
      setSelection(/* @__PURE__ */ new Set());
      props.onPathChange?.(next);
      props.onSelectionChange?.(/* @__PURE__ */ new Set());
    });
  };
  const [ownSel, setOwnSel] = createSignal(/* @__PURE__ */ new Set());
  const selected = () => props.selected ?? ownSel();
  const setSelection = (next) => {
    setOwnSel(next);
    props.onSelectionChange?.(next);
  };
  const [ownView, setOwnView] = createSignal("grid");
  const view = () => props.view ?? ownView();
  const setView = (next) => {
    setOwnView(next);
    props.onViewChange?.(next);
  };
  const [sort, setSort] = createSignal({
    key: "name",
    desc: false
  });
  const flipSort = (key) => setSort((was) => ({
    key,
    desc: was.key === key ? !was.desc : false
  }));
  const [entries, setEntries] = createSignal([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal(null);
  let listing = null;
  async function reload(prefix = untrack(path)) {
    listing?.abort();
    const ctrl = new AbortController();
    listing = ctrl;
    setLoading(true);
    try {
      const got = await props.source.list(prefix, {
        signal: ctrl.signal
      });
      if (ctrl.signal.aborted) return;
      batch(() => {
        setEntries(got);
        setError(null);
      });
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setEntries([]);
      fail(err);
    } finally {
      if (listing === ctrl) {
        listing = null;
        setLoading(false);
      }
    }
  }
  createEffect(on(path, (p) => void reload(p)));
  onCleanup(() => listing?.abort());
  function fail(err) {
    const msg = err instanceof Error ? err.message : String(err);
    setError(msg);
    props.onError?.(msg);
  }
  const shown = createMemo(() => sortEntries(entries(), sort().key, sort().desc));
  const byKey = createMemo(() => new Map(shown().map((e) => [e.key, e])));
  const picked = createMemo(() => [...selected()].filter((k) => byKey().has(k)));
  const [tree, setTree] = createSignal({});
  const inflight = /* @__PURE__ */ new Set();
  const bumpTree = () => {
    setTree({});
    setWhole(null);
  };
  async function ensure(prefix) {
    if (inflight.has(prefix) || prefix in untrack(tree)) return;
    inflight.add(prefix);
    try {
      const got = await props.source.list(prefix, {
        signal: new AbortController().signal
      });
      setTree((was) => ({
        ...was,
        [prefix]: got.filter((e) => e.dir)
      }));
    } catch {
      setTree((was) => ({
        ...was,
        [prefix]: []
      }));
    } finally {
      inflight.delete(prefix);
    }
  }
  const [whole, setWhole] = createSignal(null);
  let wholeFlight = false;
  async function loadWhole() {
    if (wholeFlight || !props.source.tree) return;
    wholeFlight = true;
    try {
      setWhole(await props.source.tree({
        signal: new AbortController().signal
      }));
    } catch (err) {
      setWhole([]);
      fail(err);
    } finally {
      wholeFlight = false;
    }
  }
  createEffect(() => {
    if (props.sidebar === false) return;
    if (props.source.tree) {
      if (whole() === null) void loadWhole();
      return;
    }
    tree();
    const here = path();
    for (const c of crumbs(here)) void ensure(c.prefix);
    const kids = untrack(tree)[here] ?? [];
    if (kids.length <= 24) for (const k of kids) void ensure(k.key);
  });
  const weights = createMemo(() => {
    const m = /* @__PURE__ */ new Map();
    for (const e of whole() ?? []) m.set(e.key, {
      size: e.size,
      count: e.count
    });
    return m;
  });
  const weightOf = (e) => e.dir ? weights().get(e.key) : void 0;
  const [openRows, setOpenRows] = createSignal(/* @__PURE__ */ new Set());
  const [sub, setSub] = createSignal({});
  const subFlight = /* @__PURE__ */ new Set();
  async function ensureSub(prefix) {
    if (subFlight.has(prefix) || prefix in untrack(sub)) return;
    subFlight.add(prefix);
    try {
      const got = await props.source.list(prefix, {
        signal: new AbortController().signal
      });
      setSub((was) => ({
        ...was,
        [prefix]: got
      }));
    } catch (err) {
      setSub((was) => ({
        ...was,
        [prefix]: []
      }));
      fail(err);
    } finally {
      subFlight.delete(prefix);
    }
  }
  const toggleRow = (key) => batch(() => {
    setOpenRows((was) => {
      const next = new Set(was);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
    void ensureSub(key);
  });
  createEffect(on(path, () => batch(() => {
    setOpenRows(/* @__PURE__ */ new Set());
    setSub({});
  }), {
    defer: true
  }));
  createEffect(() => {
    const cache = sub();
    for (const k of openRows()) if (!(k in cache)) void ensureSub(k);
  });
  const rows = createMemo(() => {
    if (view() !== "list") return shown().map((e) => ({
      e,
      depth: 0
    }));
    const out = [];
    const walk = (list, depth) => {
      for (const e of sortEntries(list, sort().key, sort().desc)) {
        out.push({
          e,
          depth
        });
        if (e.dir && openRows().has(e.key)) walk(sub()[e.key] ?? [], depth + 1);
      }
    };
    walk(entries(), 0);
    return out;
  });
  const [pending, setPending] = createSignal([]);
  const patchPending = (id, next) => setPending((was) => was.map((p) => p.id === id ? {
    ...p,
    ...next
  } : p));
  const dest = /* @__PURE__ */ new WeakMap();
  const queue = createUploadQueue((file, ctx) => {
    const up = props.source.upload;
    if (!up) return Promise.reject(new Error("\u0437\u0430\u043B\u0438\u0432\u043A\u0430 \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u0430"));
    const to = dest.get(file) ?? untrack(path);
    return up(file, {
      prefix: to,
      onProgress: ctx.onProgress,
      signal: ctx.signal
    }).then(() => ({
      // очереди нужен `url`, а файндеру он не нужен: список всё равно
      // перечитывается — хранилище отдаст и размер, и дату, и адрес
      url: ""
    }));
  }, {
    onProgress: (id, f) => patchPending(id, {
      progress: f
    }),
    onDone: (id) => {
      setPending((was) => was.filter((p) => p.id !== id));
      if (!queue.pending()) void reload();
    },
    onError: (id, msg) => {
      patchPending(id, {
        error: msg
      });
      props.onError?.(msg);
      if (!queue.pending()) void reload();
    }
  }, props.concurrency ?? 3);
  onCleanup(() => queue.destroy());
  function enqueue(files, prefix) {
    if (!editable() || !props.source.upload || !files.length) return;
    const added = files.map((f, i) => ({
      id: `u${Date.now().toString(36)}${i}`,
      name: f.name,
      prefix,
      progress: 0
    }));
    setPending((was) => [...was, ...added]);
    added.forEach((p, i) => {
      dest.set(files[i].file, prefix);
      queue.add(p.id, files[i].file);
    });
  }
  const picker = createFileUploader({
    accept: props.accept ?? "*",
    multiple: true
  });
  const pickFiles = () => picker.selectFiles((files) => enqueue(files.map((f) => ({
    name: f.name,
    file: f.file
  })), untrack(path)));
  const ghosts = createMemo(() => pending().filter((p) => p.prefix === path()));
  const [dragging, setDragging] = createSignal([]);
  const [dropAt, setDropAt] = createSignal(null);
  const [overFiles, setOverFiles] = createSignal(false);
  const canMoveTo = (to) => !!props.source.move && editable() && dragging().length > 0 && dragging().every((k) => canMove(k, to));
  function startDrag(ev, entry) {
    if (!props.source.move || !editable()) return;
    const keys = selected().has(entry.key) ? picked() : [entry.key];
    setDragging(keys);
    ev.dataTransfer?.setData("text/plain", keys.join("\n"));
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = "move";
  }
  async function drop(to, ev) {
    ev.preventDefault();
    setDropAt(null);
    setOverFiles(false);
    const files = [...ev.dataTransfer?.files ?? []];
    if (files.length) {
      enqueue(files.map((f) => ({
        name: f.name,
        file: f
      })), to);
      return;
    }
    const keys = dragging().filter((k) => canMove(k, to));
    setDragging([]);
    if (!keys.length || !props.source.move) return;
    try {
      await props.source.move(keys, to);
      setSelection(/* @__PURE__ */ new Set());
      bumpTree();
      setSub({});
      await reload();
    } catch (err) {
      fail(err);
    }
  }
  const hasFiles = (ev) => !!ev.dataTransfer?.types?.includes("Files");
  function over(to, ev) {
    const files = hasFiles(ev);
    if (files ? !(editable() && props.source.upload) : !canMoveTo(to)) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = files ? "copy" : "move";
    setDropAt(to);
  }
  const [busy, setBusy] = createSignal(false);
  const [confirming, setConfirming] = createSignal(false);
  const [asking, setAsking] = createSignal(null);
  const closeAsk = () => {
    setConfirming(false);
    setAsking(null);
  };
  async function run(job) {
    setBusy(true);
    try {
      await job();
      bumpTree();
      setSub({});
      await reload();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
      closeAsk();
    }
  }
  const doRemove = () => {
    const keys = picked();
    if (!keys.length || !props.source.remove) return;
    void run(async () => {
      await props.source.remove(keys);
      setSelection(/* @__PURE__ */ new Set());
    });
  };
  const doMkdir = (name) => {
    const clean = name.trim().replace(/^\/+|\/+$/g, "");
    if (!clean || !props.source.mkdir) return closeAsk();
    void run(() => props.source.mkdir(`${joinPrefix(path(), clean)}/`));
  };
  const doAsk = () => {
    const a = asking();
    if (a) doMkdir(a.value);
  };
  function onKey(ev) {
    if (ev.key === "Escape") return setSelection(/* @__PURE__ */ new Set());
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "a") {
      ev.preventDefault();
      return setSelection(new Set(shown().map((e) => e.key)));
    }
    if (ev.key === "Backspace" && path()) {
      ev.preventDefault();
      return goto(parentOf(path()));
    }
    if (ev.key === "Delete" && picked().length && props.source.remove && canWrite()) {
      ev.preventDefault();
      return setConfirming(true);
    }
    if (ev.key === "Enter") {
      const one = byKey().get(picked()[0]);
      if (one) open(one);
    }
  }
  const open = (entry) => entry.dir ? goto(entry.key) : props.onOpen?.(entry);
  const totals = createMemo(() => {
    let dirs = 0;
    let files = 0;
    let size = 0;
    for (const e of entries()) {
      if (e.dir) dirs++;
      else {
        files++;
        size += e.size ?? 0;
      }
    }
    return {
      dirs,
      files,
      size
    };
  });
  const canWrite = () => editable() && !busy();
  const memKey = () => `${props.treeKey ?? "dumb-finder"}:opened`;
  const [opened, setOpened] = createSignal((() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(memKey()) ?? "[]"));
    } catch {
      return /* @__PURE__ */ new Set();
    }
  })());
  const toggleNode = (key) => setOpened((was) => {
    const next = new Set(was);
    next.has(key) ? next.delete(key) : next.add(key);
    try {
      localStorage.setItem(memKey(), JSON.stringify([...next]));
    } catch {
    }
    return next;
  });
  const [find, setFind] = createSignal("");
  const matched = createMemo(() => {
    const q = find().trim().toLowerCase();
    if (!q) return null;
    const keep = /* @__PURE__ */ new Set();
    for (const key of kidsOf().keys()) {
      for (const k of kidsOf().get(key) ?? []) {
        if (!k.name.toLowerCase().includes(q)) continue;
        let cur = k.key;
        while (cur) {
          keep.add(cur);
          cur = parentOf(cur);
        }
      }
    }
    return keep;
  });
  const kidsOf = createMemo(() => {
    const m = /* @__PURE__ */ new Map();
    const put = (parent, e) => {
      const a = m.get(parent) ?? [];
      if (!a.some((x) => x.key === e.key)) a.push(e);
      m.set(parent, a);
    };
    const all = whole();
    if (all) {
      for (const e of all) {
        const key = e.key.endsWith("/") ? e.key : `${e.key}/`;
        put(parentOf(key), {
          ...e,
          key,
          name: nameOf(key)
        });
      }
    } else {
      for (const [prefix, kids] of Object.entries(tree())) for (const k of kids) put(prefix, k);
    }
    for (const a of m.values()) a.sort((x, y) => x.name.localeCompare(y.name, void 0, {
      numeric: true
    }));
    return m;
  });
  function Branch(p) {
    const kids = () => {
      const all = kidsOf().get(p.prefix) ?? [];
      const keep = matched();
      return keep ? all.filter((k) => keep.has(k.key)) : all;
    };
    return createComponent(For, {
      get each() {
        return kids();
      },
      children: (e) => {
        const open2 = () => opened().has(e.key) || !!matched();
        const w = () => weights().get(e.key);
        return (() => {
          var _el$ = _tmpl$52(), _el$2 = _el$.firstChild, _el$5 = _el$2.firstChild;
          _el$2.addEventListener("drop", (ev) => {
            ev.stopPropagation();
            void drop(e.key, ev);
          });
          _el$2.addEventListener("dragleave", () => setDropAt(null));
          _el$2.addEventListener("dragover", (ev) => over(e.key, ev));
          _el$2.$$click = () => goto(e.key);
          insert(_el$2, createComponent(Show, {
            get when() {
              return (kidsOf().get(e.key)?.length ?? 0) > 0;
            },
            get fallback() {
              return _tmpl$62();
            },
            get children() {
              var _el$3 = _tmpl$23();
              _el$3.$$click = (ev) => {
                ev.stopPropagation();
                toggleNode(e.key);
              };
              insert(_el$3, createComponent(Show, {
                get when() {
                  return props.icons?.twist;
                },
                get fallback() {
                  return open2() ? "\u25BE" : "\u25B8";
                },
                get children() {
                  var _el$4 = _tmpl$6();
                  effect(() => className(_el$4, `dumb-finder-glyph ${props.icons.twist}`));
                  return _el$4;
                }
              }));
              effect(() => setAttribute(_el$3, "title", open2() ? "\u0441\u0432\u0435\u0440\u043D\u0443\u0442\u044C" : "\u0440\u0430\u0437\u0432\u0435\u0440\u043D\u0443\u0442\u044C"));
              return _el$3;
            }
          }), _el$5);
          insert(_el$2, createComponent(Glyph, {
            entry: e,
            get open() {
              return open2();
            }
          }), _el$5);
          insert(_el$5, () => e.name);
          insert(_el$2, createComponent(Show, {
            get when() {
              return w()?.size !== void 0;
            },
            get children() {
              var _el$6 = _tmpl$32(), _el$7 = _el$6.firstChild;
              insert(_el$6, () => w().count ?? 0, _el$7);
              insert(_el$6, () => fmtSize(w().size), null);
              return _el$6;
            }
          }), null);
          insert(_el$, createComponent(Show, {
            get when() {
              return open2();
            },
            get children() {
              var _el$8 = _tmpl$42();
              insert(_el$8, createComponent(Branch, {
                get prefix() {
                  return e.key;
                },
                get depth() {
                  return p.depth + 1;
                }
              }));
              return _el$8;
            }
          }), null);
          effect((_p$) => {
            var _v$ = path() === e.key ? "1" : void 0, _v$2 = open2() ? "1" : void 0, _v$3 = dropAt() === e.key && path() !== e.key ? "1" : void 0, _v$4 = e.name;
            _v$ !== _p$.e && setAttribute(_el$2, "data-here", _p$.e = _v$);
            _v$2 !== _p$.t && setAttribute(_el$2, "data-open", _p$.t = _v$2);
            _v$3 !== _p$.a && setAttribute(_el$2, "data-drop", _p$.a = _v$3);
            _v$4 !== _p$.o && setAttribute(_el$2, "title", _p$.o = _v$4);
            return _p$;
          }, {
            e: void 0,
            t: void 0,
            a: void 0,
            o: void 0
          });
          return _el$;
        })();
      }
    });
  }
  const SIDE = () => (() => {
    var _el$0 = _tmpl$7(), _el$1 = _el$0.firstChild, _el$10 = _el$1.nextSibling;
    _el$1.$$input = (ev) => setFind(ev.currentTarget.value);
    insert(_el$10, createComponent(Branch, {
      prefix: "",
      depth: 0
    }));
    effect(() => _el$1.value = find());
    return _el$0;
  })();
  const FILES = () => createComponent(SelectionArea, {
    selectables: ".dumb-finder-item",
    selected,
    onChange: setSelection,
    "class": "dumb-finder-body",
    style: {
      height: "100%"
    },
    onBeforeStart: (ev) => {
      const el = ev.target?.closest(".dumb-finder-item");
      const key = el?.getAttribute("data-key");
      return !(key && selected().has(key));
    },
    get children() {
      var _el$11 = _tmpl$0(), _el$21 = _el$11.firstChild;
      _el$11.addEventListener("drop", (ev) => void drop(path(), ev));
      _el$11.addEventListener("dragleave", (ev) => {
        if (ev.relatedTarget) return;
        setOverFiles(false);
        setDropAt(null);
      });
      _el$11.addEventListener("dragover", (ev) => {
        if (hasFiles(ev)) {
          if (!(editable() && props.source.upload)) return;
          ev.preventDefault();
          setOverFiles(true);
        } else if (canMoveTo(path())) {
          ev.preventDefault();
          setDropAt(path());
        }
      });
      _el$11.$$keydown = onKey;
      insert(_el$11, createComponent(Show, {
        get when() {
          return view() === "list";
        },
        get children() {
          var _el$12 = _tmpl$8(), _el$13 = _el$12.firstChild, _el$14 = _el$13.nextSibling, _el$15 = _el$14.nextSibling; _el$15.firstChild; var _el$17 = _el$15.nextSibling; _el$17.firstChild; var _el$19 = _el$17.nextSibling; _el$19.firstChild;
          _el$15.$$click = () => flipSort("name");
          insert(_el$15, () => mark(sort(), "name"), null);
          _el$17.$$click = () => flipSort("size");
          insert(_el$17, () => mark(sort(), "size"), null);
          _el$19.$$click = () => flipSort("modified");
          insert(_el$19, () => mark(sort(), "modified"), null);
          return _el$12;
        }
      }), _el$21);
      insert(_el$21, createComponent(For, {
        get each() {
          return rows();
        },
        children: (row) => {
          const entry = row.e;
          return (() => {
            var _el$23 = _tmpl$1();
            _el$23.addEventListener("drop", (ev) => {
              if (!entry.dir) return;
              ev.stopPropagation();
              void drop(entry.key, ev);
            });
            _el$23.addEventListener("dragleave", () => entry.dir && setDropAt(null));
            _el$23.addEventListener("dragover", (ev) => entry.dir && over(entry.key, ev));
            _el$23.addEventListener("dragend", () => {
              setDragging([]);
              setDropAt(null);
            });
            _el$23.addEventListener("dragstart", (ev) => startDrag(ev, entry));
            _el$23.$$dblclick = () => open(entry);
            insert(_el$23, () => props.children?.(entry, {
              selected: selected().has(entry.key),
              view: view()
            }) ?? [createComponent(Show, {
              get when() {
                return view() === "list";
              },
              get children() {
                return [(() => {
                  var _el$24 = _tmpl$10();
                  effect((_$p) => setStyleProperty(_el$24, "width", `${row.depth * 15}px`));
                  return _el$24;
                })(), createComponent(Show, {
                  get when() {
                    return entry.dir;
                  },
                  get fallback() {
                    return _tmpl$62();
                  },
                  get children() {
                    var _el$25 = _tmpl$11();
                    _el$25.$$click = (ev) => {
                      ev.stopPropagation();
                      toggleRow(entry.key);
                    };
                    setAttribute(_el$25, "draggable", false);
                    insert(_el$25, createComponent(Show, {
                      get when() {
                        return props.icons?.twist;
                      },
                      get fallback() {
                        return openRows().has(entry.key) ? "\u25BE" : "\u25B8";
                      },
                      get children() {
                        var _el$26 = _tmpl$6();
                        effect(() => className(_el$26, `dumb-finder-glyph ${props.icons.twist}`));
                        return _el$26;
                      }
                    }));
                    effect(() => setAttribute(_el$25, "title", openRows().has(entry.key) ? "\u0441\u0432\u0435\u0440\u043D\u0443\u0442\u044C" : "\u0440\u0430\u0437\u0432\u0435\u0440\u043D\u0443\u0442\u044C"));
                    return _el$25;
                  }
                })];
              }
            }), (() => {
              var _el$27 = _tmpl$13();
              insert(_el$27, createComponent(Show, {
                get when() {
                  return memo(() => !!(!entry.dir && entry.url))() && kindOf(entry.name) === "image";
                },
                get fallback() {
                  return createComponent(Glyph, {
                    entry,
                    get open() {
                      return openRows().has(entry.key);
                    }
                  });
                },
                get children() {
                  var _el$28 = _tmpl$12();
                  setAttribute(_el$28, "draggable", false);
                  effect(() => setAttribute(_el$28, "src", entry.url));
                  return _el$28;
                }
              }));
              return _el$27;
            })(), (() => {
              var _el$29 = _tmpl$14();
              insert(_el$29, () => entry.name);
              return _el$29;
            })(), createComponent(Show, {
              get when() {
                return view() === "list";
              },
              get children() {
                return [(() => {
                  var _el$30 = _tmpl$15();
                  insert(_el$30, (() => {
                    var _c$ = memo(() => !!entry.dir);
                    return () => _c$() ? memo(() => weightOf(entry)?.size !== void 0)() ? fmtSize(weightOf(entry).size) : "" : fmtSize(entry.size ?? 0);
                  })());
                  return _el$30;
                })(), (() => {
                  var _el$31 = _tmpl$15();
                  insert(_el$31, (() => {
                    var _c$2 = memo(() => !!entry.modified);
                    return () => _c$2() ? fmtDateTimeShort(entry.modified) : "";
                  })());
                  return _el$31;
                })(), (() => {
                  var _el$32 = _tmpl$15();
                  insert(_el$32, (() => {
                    var _c$3 = memo(() => !!(entry.dir && weightOf(entry)?.count !== void 0));
                    return () => _c$3() ? `${weightOf(entry).count} \u0444\u0430\u0439\u043B.` : kindLabel(entry);
                  })());
                  return _el$32;
                })()];
              }
            }), createComponent(Show, {
              get when() {
                return memo(() => !!(view() === "grid" && !entry.dir))() && entry.size !== void 0;
              },
              get children() {
                var _el$33 = _tmpl$15();
                insert(_el$33, () => fmtSize(entry.size));
                return _el$33;
              }
            }), createComponent(Show, {
              get when() {
                return memo(() => !!(view() === "grid" && entry.dir))() && weightOf(entry)?.size !== void 0;
              },
              get children() {
                var _el$34 = _tmpl$15();
                insert(_el$34, () => fmtSize(weightOf(entry).size), null);
                insert(_el$34, (() => {
                  var _c$4 = memo(() => !!weightOf(entry).count);
                  return () => _c$4() ? ` \xB7 ${weightOf(entry).count}` : "";
                })(), null);
                return _el$34;
              }
            })]);
            effect((_p$) => {
              var _v$7 = entry.key, _v$8 = selected().has(entry.key) ? "1" : void 0, _v$9 = entry.dir ? "1" : void 0, _v$0 = openRows().has(entry.key) ? "1" : void 0, _v$1 = entry.dir && dropAt() === entry.key ? "1" : void 0, _v$10 = canWrite() && !!props.source.move, _v$11 = entry.name;
              _v$7 !== _p$.e && setAttribute(_el$23, "data-key", _p$.e = _v$7);
              _v$8 !== _p$.t && setAttribute(_el$23, "data-selected", _p$.t = _v$8);
              _v$9 !== _p$.a && setAttribute(_el$23, "data-dir", _p$.a = _v$9);
              _v$0 !== _p$.o && setAttribute(_el$23, "data-open", _p$.o = _v$0);
              _v$1 !== _p$.i && setAttribute(_el$23, "data-drop", _p$.i = _v$1);
              _v$10 !== _p$.n && setAttribute(_el$23, "draggable", _p$.n = _v$10);
              _v$11 !== _p$.s && setAttribute(_el$23, "title", _p$.s = _v$11);
              return _p$;
            }, {
              e: void 0,
              t: void 0,
              a: void 0,
              o: void 0,
              i: void 0,
              n: void 0,
              s: void 0
            });
            return _el$23;
          })();
        }
      }), null);
      insert(_el$21, createComponent(For, {
        get each() {
          return ghosts();
        },
        children: (p) => (() => {
          var _el$36 = _tmpl$17(), _el$37 = _el$36.firstChild, _el$38 = _el$37.nextSibling, _el$39 = _el$38.nextSibling;
          insert(_el$38, () => p.name);
          insert(_el$39, () => p.error ?? `${Math.round(p.progress * 100)}%`);
          insert(_el$36, createComponent(Show, {
            get when() {
              return !p.error;
            },
            get children() {
              var _el$40 = _tmpl$16(), _el$41 = _el$40.firstChild;
              effect((_$p) => setStyleProperty(_el$41, "width", `${Math.round(p.progress * 100)}%`));
              return _el$40;
            }
          }), null);
          effect(() => setAttribute(_el$36, "data-failed", p.error ? "1" : void 0));
          return _el$36;
        })()
      }), null);
      insert(_el$11, createComponent(Show, {
        get when() {
          return memo(() => !!(!shown().length && !ghosts().length))() && !loading();
        },
        get children() {
          var _el$22 = _tmpl$9();
          insert(_el$22, () => editable() && props.source.upload ? "\u041F\u0443\u0441\u0442\u043E. \u0411\u0440\u043E\u0441\u044C \u0441\u044E\u0434\u0430 \u0444\u0430\u0439\u043B\u044B." : "\u041F\u0443\u0441\u0442\u043E.");
          return _el$22;
        }
      }), null);
      effect((_p$) => {
        var _v$5 = view(), _v$6 = overFiles() ? "1" : void 0;
        _v$5 !== _p$.e && setAttribute(_el$11, "data-view", _p$.e = _v$5);
        _v$6 !== _p$.t && setAttribute(_el$11, "data-files", _p$.t = _v$6);
        return _p$;
      }, {
        e: void 0,
        t: void 0
      });
      return _el$11;
    }
  });
  function BarButton(p) {
    return (() => {
      var _el$42 = _tmpl$18(), _el$44 = _el$42.firstChild;
      addEventListener(_el$42, "click", p.onClick, true);
      insert(_el$42, createComponent(Show, {
        get when() {
          return p.icon;
        },
        get children() {
          var _el$43 = _tmpl$6();
          effect(() => className(_el$43, `dumb-finder-glyph ${p.icon}`));
          return _el$43;
        }
      }), _el$44);
      insert(_el$44, () => p.children);
      return _el$42;
    })();
  }
  function Glyph(p) {
    const kind = () => p.entry.dir ? p.open ? "dirOpen" : "dir" : kindOf(p.entry.name);
    const cls = () => {
      const set = props.icons;
      if (!set) return void 0;
      return set[kind()] ?? (kind() === "dirOpen" ? set.dir : void 0);
    };
    return createComponent(Show, {
      get when() {
        return cls();
      },
      get fallback() {
        return memo(() => !!p.entry.dir)() ? memo(() => !!p.open)() ? "\u{1F4C2}" : ICONS.dir : ICONS[kindOf(p.entry.name)];
      },
      get children() {
        var _el$45 = _tmpl$6();
        effect(() => className(_el$45, `dumb-finder-glyph ${cls()}`));
        return _el$45;
      }
    });
  }
  return (() => {
    var _el$46 = _tmpl$21(), _el$47 = _el$46.firstChild, _el$48 = _el$47.firstChild, _el$49 = _el$48.firstChild, _el$56 = _el$47.nextSibling, _el$57 = _el$56.nextSibling;
    insert(_el$49, createComponent(For, {
      get each() {
        return crumbs(path(), props.rootLabel ?? "\u0412\u0441\u0451");
      },
      children: (c) => (() => {
        var _el$58 = _tmpl$222(), _el$59 = _el$58.firstChild;
        _el$59.addEventListener("drop", (ev) => void drop(c.prefix, ev));
        _el$59.addEventListener("dragleave", () => setDropAt(null));
        _el$59.addEventListener("dragover", (ev) => c.prefix !== path() && over(c.prefix, ev));
        _el$59.$$click = () => goto(c.prefix);
        insert(_el$59, () => c.name);
        effect((_p$) => {
          var _v$15 = c.prefix === path(), _v$16 = dropAt() === c.prefix && c.prefix !== path() ? "1" : void 0;
          _v$15 !== _p$.e && setAttribute(_el$59, "aria-current", _p$.e = _v$15);
          _v$16 !== _p$.t && setAttribute(_el$59, "data-drop", _p$.t = _v$16);
          return _p$;
        }, {
          e: void 0,
          t: void 0
        });
        return _el$58;
      })()
    }));
    insert(_el$47, createComponent(BarButton, {
      get icon() {
        return props.icons?.refresh;
      },
      onClick: () => {
        bumpTree();
        void reload();
      },
      children: "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C"
    }), null);
    insert(_el$47, createComponent(BarButton, {
      get icon() {
        return memo(() => view() === "grid")() ? props.icons?.viewList : props.icons?.viewGrid;
      },
      onClick: () => setView(view() === "grid" ? "list" : "grid"),
      get children() {
        return view() === "grid" ? "\u0421\u043F\u0438\u0441\u043A\u043E\u043C" : "\u041F\u043B\u0438\u0442\u043A\u0430\u043C\u0438";
      }
    }), null);
    insert(_el$47, createComponent(Show, {
      get when() {
        return memo(() => !!canWrite())() && props.source.mkdir;
      },
      get children() {
        return createComponent(BarButton, {
          get icon() {
            return props.icons?.mkdir;
          },
          onClick: () => setAsking({
            kind: "mkdir",
            value: ""
          }),
          children: "\u041D\u043E\u0432\u0430\u044F \u043F\u0430\u043F\u043A\u0430"
        });
      }
    }), null);
    insert(_el$47, createComponent(Show, {
      get when() {
        return memo(() => !!canWrite())() && props.source.upload;
      },
      get children() {
        return createComponent(BarButton, {
          get icon() {
            return props.icons?.upload;
          },
          onClick: pickFiles,
          children: "\u0417\u0430\u043B\u0438\u0442\u044C"
        });
      }
    }), null);
    insert(_el$47, createComponent(Show, {
      get when() {
        return memo(() => !!(canWrite() && props.source.remove))() && picked().length > 0;
      },
      get children() {
        return createComponent(BarButton, {
          get icon() {
            return props.icons?.remove;
          },
          onClick: () => setConfirming(true),
          get children() {
            return ["\u0423\u0434\u0430\u043B\u0438\u0442\u044C ", memo(() => picked().length)];
          }
        });
      }
    }), null);
    insert(_el$46, createComponent(Show, {
      get when() {
        return memo(() => !!confirming())() && picked().length;
      },
      get children() {
        var _el$50 = _tmpl$19(), _el$51 = _el$50.firstChild; _el$51.firstChild; var _el$53 = _el$51.nextSibling, _el$54 = _el$53.nextSibling;
        insert(_el$51, () => picked().map(nameOf).join(", "), null);
        _el$53.$$click = doRemove;
        _el$54.$$click = closeAsk;
        return _el$50;
      }
    }), _el$56);
    insert(_el$46, createComponent(Show, {
      get when() {
        return asking();
      },
      children: (a) => (() => {
        var _el$60 = _tmpl$232(), _el$61 = _el$60.firstChild, _el$62 = _el$61.nextSibling, _el$63 = _el$62.nextSibling;
        _el$61.$$keydown = (ev) => {
          if (ev.key === "Escape") closeAsk();
          if (ev.key === "Enter") doAsk();
        };
        _el$61.$$input = (ev) => setAsking({
          kind: "mkdir",
          value: ev.currentTarget.value
        });
        _el$62.$$click = doAsk;
        _el$63.$$click = closeAsk;
        effect(() => _el$61.value = a().value);
        return _el$60;
      })()
    }), _el$56);
    insert(_el$46, createComponent(Show, {
      get when() {
        return error();
      },
      get children() {
        var _el$55 = _tmpl$20();
        insert(_el$55, error);
        return _el$55;
      }
    }), _el$56);
    insert(_el$56, createComponent(Show, {
      get when() {
        return props.sidebar !== false;
      },
      get fallback() {
        return FILES();
      },
      get children() {
        return createComponent(ResizableGrid, {
          "class": "dumb-finder-split",
          get storageKey() {
            return `${props.treeKey ?? "dumb-finder"}:split`;
          },
          cols: [{
            id: "tree",
            content: SIDE,
            min: 170,
            initial: 1
          }, {
            id: "files",
            content: FILES,
            min: 320,
            initial: 3.2
          }]
        });
      }
    }));
    insert(_el$57, createComponent(Show, {
      get when() {
        return loading();
      },
      get fallback() {
        return ["\u043F\u0430\u043F\u043E\u043A: ", memo(() => totals().dirs), " \xB7 \u0444\u0430\u0439\u043B\u043E\u0432: ", memo(() => totals().files), " \xB7 ", memo(() => fmtSize(totals().size)), createComponent(Show, {
          get when() {
            return picked().length;
          },
          get children() {
            return ` \xB7 \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043E: ${picked().length}`;
          }
        }), createComponent(Show, {
          get when() {
            return pending().length;
          },
          get children() {
            return ` \xB7 \u0437\u0430\u043B\u0438\u0432\u0430\u0435\u0442\u0441\u044F: ${pending().length}`;
          }
        })];
      },
      children: "\u0447\u0438\u0442\u0430\u044E\u2026"
    }));
    effect((_p$) => {
      var _v$12 = `dumb-finder ${props.class ?? ""}`, _v$13 = props.style, _v$14 = props.height ?? "60vh";
      _v$12 !== _p$.e && className(_el$46, _p$.e = _v$12);
      _p$.t = style(_el$46, _v$13, _p$.t);
      _v$14 !== _p$.a && setStyleProperty(_el$56, "height", _p$.a = _v$14);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0
    });
    return _el$46;
  })();
}
var KIND_LABEL = {
  image: "\u041A\u0430\u0440\u0442\u0438\u043D\u043A\u0430",
  video: "\u0412\u0438\u0434\u0435\u043E",
  audio: "\u0417\u0432\u0443\u043A",
  pdf: "PDF",
  archive: "\u0410\u0440\u0445\u0438\u0432",
  text: "\u0422\u0435\u043A\u0441\u0442",
  file: "\u0424\u0430\u0439\u043B"
};
var kindLabel = (e) => e.dir ? "\u041F\u0430\u043F\u043A\u0430" : KIND_LABEL[kindOf(e.name)];
var mark = (s, key) => s.key === key ? s.desc ? "\u2193" : "\u2191" : "";
delegateEvents(["click", "input", "keydown", "dblclick"]);

// src/sources.ts
function createHttpSource(opts) {
  const f = opts.fetch ?? ((...args) => fetch(...args));
  const at = (name) => `${opts.base}/${opts.paths?.[name] ?? name}`;
  const off = (what) => opts.without?.includes(what);
  async function call(url, init) {
    const res = await f(url, {
      ...init,
      headers: { ...opts.headers?.() ?? {}, ...init?.headers ?? {} }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) {
      throw new Error(data?.error ?? `\u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435 \u043E\u0442\u0432\u0435\u0442\u0438\u043B\u043E ${res.status}`);
    }
    return data;
  }
  const post = (url, body, signal) => call(url, { method: "POST", body: JSON.stringify(body), signal }).then(() => void 0);
  const source = {
    list: (prefix, ctx) => call(
      `${at("list")}?prefix=${encodeURIComponent(prefix)}`,
      { signal: ctx.signal }
    ).then((r) => r.entries ?? [])
  };
  if (!off("tree")) {
    source.tree = (ctx) => call(at("tree"), { signal: ctx.signal }).then(
      (r) => r.entries ?? []
    );
  }
  if (opts.upload) {
    source.upload = (file, ctx) => putWithProgress(
      file,
      {
        url: `${opts.upload}?prefix=${encodeURIComponent(ctx.prefix)}&name=${encodeURIComponent(file.name)}`,
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          ...opts.headers?.() ?? {}
        }
      },
      ctx
    ).then(() => void 0);
  } else if (opts.sign) {
    source.upload = async (file, ctx) => {
      const signed = await call(opts.sign, {
        method: "POST",
        body: JSON.stringify({ name: file.name, type: file.type, prefix: ctx.prefix }),
        signal: ctx.signal
      });
      await putWithProgress(file, signed, ctx);
    };
  }
  if (!off("remove")) source.remove = (keys) => post(at("delete"), { keys });
  if (!off("move")) source.move = (keys, to) => post(at("move"), { keys, to });
  if (!off("mkdir")) source.mkdir = (prefix) => post(at("mkdir"), { prefix });
  return source;
}
function createS3Source(opts) {
  return createHttpSource({ ...opts, sign: opts.sign ?? `${opts.base}/sign` });
}
function createNodeSource(opts) {
  return createHttpSource({ ...opts, upload: opts.upload ?? `${opts.base}/upload` });
}
function createWebdavSource(opts) {
  const f = opts.fetch ?? ((...args) => fetch(...args));
  const root = opts.base.replace(/\/+$/, "");
  const url = (path) => `${root}/${path.split("/").filter(Boolean).map(encodeURIComponent).join("/")}${path.endsWith("/") && path ? "/" : ""}`;
  const send = async (method, path, init = {}) => {
    const res = await f(url(path), {
      method,
      ...init,
      headers: { ...opts.headers?.() ?? {}, ...init.headers ?? {} }
    });
    if (!res.ok) throw new Error(`${method} ${path || "/"} \u2014 \u0441\u0435\u0440\u0432\u0435\u0440 \u043E\u0442\u0432\u0435\u0442\u0438\u043B ${res.status}`);
    return res;
  };
  const parse = (xml, prefix) => {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const out = [];
    const rootPath = new URL(url(prefix), location.href).pathname.replace(/\/+$/, "");
    for (const el of Array.from(doc.getElementsByTagNameNS("DAV:", "response"))) {
      const href = el.getElementsByTagNameNS("DAV:", "href")[0]?.textContent ?? "";
      const path = decodeURIComponent(new URL(href, location.href).pathname).replace(/\/+$/, "");
      if (!path || path === rootPath) continue;
      const dir = !!el.getElementsByTagNameNS("DAV:", "collection").length;
      const name = path.slice(path.lastIndexOf("/") + 1);
      const size = Number(el.getElementsByTagNameNS("DAV:", "getcontentlength")[0]?.textContent ?? 0);
      const modified = el.getElementsByTagNameNS("DAV:", "getlastmodified")[0]?.textContent;
      out.push({
        key: `${prefix}${name}${dir ? "/" : ""}`,
        name,
        dir: dir || void 0,
        size: dir ? void 0 : size,
        modified: modified ? Date.parse(modified) : void 0,
        url: dir ? void 0 : url(`${prefix}${name}`)
      });
    }
    return out;
  };
  return {
    list: async (prefix, ctx) => {
      const res = await send("PROPFIND", prefix, {
        // Depth: 1 — только прямое содержимое. Без заголовка иные серверы
        // понимают запрос как «всё поддерево» и отдают мегабайты XML
        headers: { Depth: "1", "Content-Type": "application/xml" },
        signal: ctx.signal
      });
      return parse(await res.text(), prefix);
    },
    upload: (file, ctx) => putWithProgress(
      file,
      {
        url: url(`${ctx.prefix}${file.name}`),
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          ...opts.headers?.() ?? {}
        }
      },
      ctx
    ).then(() => void 0),
    // DELETE по коллекции сносит её вместе с содержимым — это поведение самого
    // протокола, отдельно обходить дерево не нужно
    remove: async (keys) => {
      for (const key of keys) await send("DELETE", key);
    },
    move: async (keys, to) => {
      for (const key of keys) {
        const name = key.endsWith("/") ? nameOf(key) + "/" : nameOf(key);
        await send("MOVE", key, {
          headers: { Destination: new URL(url(`${to}${name}`), location.href).href }
        });
      }
    },
    mkdir: async (prefix) => {
      await send("MKCOL", prefix);
    }
  };
}
function createMemorySource(opts = {}) {
  const files = /* @__PURE__ */ new Map();
  for (const [key, size] of Object.entries(opts.seed ?? {})) {
    files.set(key, { size, modified: Date.now() });
  }
  const wait = (v) => new Promise((ok) => setTimeout(() => ok(v), opts.latency ?? 150));
  const weigh = () => {
    const acc = /* @__PURE__ */ new Map();
    for (const [key, meta] of files) {
      let cut = key.indexOf("/");
      while (cut >= 0) {
        const prefix = key.slice(0, cut + 1);
        const was = acc.get(prefix) ?? { size: 0, count: 0 };
        was.size += meta.size;
        was.count++;
        acc.set(prefix, was);
        cut = key.indexOf("/", cut + 1);
      }
    }
    return acc;
  };
  return {
    list: (prefix) => {
      const dirs = /* @__PURE__ */ new Set();
      const out = [];
      for (const [key, meta] of files) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        const slash = rest.indexOf("/");
        if (slash >= 0) dirs.add(rest.slice(0, slash + 1));
        else out.push({ key, name: rest, ...meta });
      }
      for (const d of dirs) out.push({ key: prefix + d, name: d.slice(0, -1), dir: true });
      return wait(out);
    },
    tree: () => wait(
      [...weigh()].map(([key, v]) => ({
        key,
        name: nameOf(key),
        dir: true,
        size: v.size,
        count: v.count
      }))
    ),
    upload: (file, ctx) => {
      const started = performance.now();
      return new Promise((done2, fail) => {
        const tick = () => {
          if (ctx.signal.aborted) return fail(new Error("\u043E\u0442\u043C\u0435\u043D\u0435\u043D\u043E"));
          const f = Math.min(1, (performance.now() - started) / (opts.latency ?? 150) / 8);
          ctx.onProgress(f);
          if (f < 1) return void requestAnimationFrame(tick);
          files.set(`${ctx.prefix}${file.name}`, {
            size: file.size,
            modified: Date.now(),
            url: file.type.startsWith("image/") ? URL.createObjectURL(file) : void 0
          });
          done2();
        };
        requestAnimationFrame(tick);
      });
    },
    remove: (keys) => {
      for (const k of keys) {
        for (const key of [...files.keys()]) if (key === k || key.startsWith(k)) files.delete(key);
      }
      return wait(void 0);
    },
    move: (keys, to) => {
      for (const k of keys) {
        const cut = k.endsWith("/") ? parentOf(k).length : 0;
        for (const [key, meta] of [...files]) {
          if (key !== k && !key.startsWith(k)) continue;
          files.delete(key);
          files.set(`${to}${k.endsWith("/") ? key.slice(cut) : nameOf(key)}`, meta);
        }
      }
      return wait(void 0);
    },
    // пустой папки в S3 не существует, и подделка врать не должна: кладём
    // в неё файл-заглушку, иначе показать её будет негде
    mkdir: (prefix) => {
      files.set(`${prefix}.keep`, { size: 0, modified: Date.now() });
      return wait(void 0);
    }
  };
}

export { DumbFinder, ICONS, canMove, createHttpSource, createMemorySource, createNodeSource, createS3Source, createWebdavSource, crumbs, joinPrefix, kindOf, nameOf, parentOf, sortEntries };
