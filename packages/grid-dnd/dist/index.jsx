// src/DumbGridDnd.tsx
import { createMemo as createMemo2, For as For2 } from "solid-js";

// src/solid.ts
import { createSignal as createSignal2, onCleanup as onCleanup2 } from "solid-js";

// src/dndCore.ts
import {
  draggable,
  dropTargetForElements,
  monitorForElements
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

// ../shared/dist/index.js
function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function shouldAnimate(explicit) {
  if (explicit !== void 0) return explicit;
  return !prefersReducedMotion();
}
var DUR = 380;
var EASE = "cubic-bezier(.2,.8,.2,1)";
var C = { x1: 0.2, y1: 0.8, x2: 0.2, y2: 1 };
var curve = (a, b, t) => {
  const u = 1 - t;
  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
};
function progress(p) {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  let t = p;
  for (let i = 0; i < 4; i++) {
    const x = curve(C.x1, C.x2, t) - p;
    const u = 1 - t;
    const d = 3 * u * u * C.x1 + 6 * u * t * (C.x2 - C.x1) + 3 * t * t * (1 - C.x2);
    if (Math.abs(d) < 1e-6) break;
    t -= x / d;
  }
  return curve(C.y1, C.y2, Math.max(0, Math.min(1, t)));
}
function createFlip(animate) {
  const live = /* @__PURE__ */ new Map();
  function at(cur) {
    if (!cur) return { x: 0, y: 0 };
    if (!cur.anim) return { x: cur.toX, y: cur.toY };
    const e = progress(Number(cur.anim.currentTime ?? 0) / DUR);
    return {
      x: cur.fromX + (cur.toX - cur.fromX) * e,
      y: cur.fromY + (cur.toY - cur.fromY) * e
    };
  }
  function release(el, anim) {
    anim.finished.then(() => {
      if (live.get(el)?.anim !== anim) return;
      anim.cancel();
      live.delete(el);
    }).catch(() => {
    });
  }
  return {
    nudge(el, dx, dy) {
      const cur = live.get(el);
      const now = at(cur);
      cur?.anim?.cancel();
      const fromX = now.x + dx;
      const fromY = now.y + dy;
      if (!animate || !fromX && !fromY) {
        el.style.transform = "";
        live.delete(el);
        return;
      }
      const anim = el.animate(
        [
          { transform: `translate(${fromX}px,${fromY}px)` },
          { transform: "translate(0px,0px)" }
        ],
        { duration: DUR, easing: EASE, fill: "forwards" }
      );
      live.set(el, { anim, fromX, fromY, toX: 0, toY: 0 });
      release(el, anim);
    },
    to(el, dx, dy) {
      const cur = live.get(el);
      const atX = cur ? cur.toX : 0;
      const atY = cur ? cur.toY : 0;
      if (atX === dx && atY === dy) return;
      if (!animate) {
        el.style.transform = dx || dy ? `translate(${dx}px,${dy}px)` : "";
        if (dx || dy)
          live.set(el, {
            anim: null,
            fromX: dx,
            fromY: dy,
            toX: dx,
            toY: dy
          });
        else live.delete(el);
        return;
      }
      const now = at(cur);
      const fromX = now.x;
      const fromY = now.y;
      cur?.anim?.cancel();
      const anim = el.animate(
        [
          { transform: `translate(${fromX}px,${fromY}px)` },
          { transform: `translate(${dx}px,${dy}px)` }
        ],
        { duration: DUR, easing: EASE, fill: "forwards" }
      );
      live.set(el, { anim, fromX, fromY, toX: dx, toY: dy });
      if (!dx && !dy) release(el, anim);
    },
    clear() {
      for (const [el, st] of live) {
        st.anim?.cancel();
        el.style.transform = "";
      }
      live.clear();
    }
  };
}
var EDGE = 48;
var MAX_SPEED = 18;
var ACCEL = 3.5;
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
var SCROLLABLE = /(auto|scroll|overlay)/;
var MAX_STEP = 18;
function createAutoScroller() {
  let levels = [];
  let x = 0;
  let y = 0;
  let raf = 0;
  let live = false;
  let echo = 0;
  const onNativeDrag = (ev) => {
    if (!ev.clientX && !ev.clientY) return;
    x = ev.clientX;
    y = ev.clientY;
    wake();
  };
  const onScroll = (ev) => {
    if (echo > 0) {
      echo = 0;
      return;
    }
    const t = ev.target;
    for (const level of levels) {
      if (level.el ? t === level.el : t === document || t === document.documentElement) {
        level.pos = level.el ? level.el.scrollTop : window.scrollY;
        return;
      }
    }
  };
  function step() {
    for (const level of levels) {
      if (x < level.left - EDGE || x > level.right + EDGE) continue;
      const speed = autoScrollSpeed({
        pointerY: y,
        viewTop: level.top,
        clientH: level.bottom - level.top,
        scrollY: level.pos,
        scrollMax: level.max
      });
      if (!speed) continue;
      const capped = Math.max(-MAX_STEP, Math.min(MAX_STEP, speed));
      const next = Math.max(0, Math.min(level.max, level.pos + capped));
      if (next === level.pos) continue;
      level.pos = next;
      echo++;
      if (level.el) level.el.scrollTop = next;
      else window.scrollTo(window.scrollX, next);
      return true;
    }
    return false;
  }
  function frame() {
    if (!live) return;
    if (!step()) {
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  function wake() {
    if (live && !raf) raf = requestAnimationFrame(frame);
  }
  return {
    start(el) {
      levels = [];
      let node = el;
      while (node && node !== document.body && node !== document.documentElement) {
        const style2 = getComputedStyle(node);
        if (SCROLLABLE.test(style2.overflowY) || SCROLLABLE.test(style2.overflowX)) {
          const r = node.getBoundingClientRect();
          levels.push({
            el: node,
            top: r.top,
            bottom: r.bottom,
            left: r.left,
            right: r.right,
            max: node.scrollHeight - node.clientHeight,
            pos: node.scrollTop
          });
        }
        node = node.parentElement;
      }
      levels.push({
        el: null,
        top: 0,
        bottom: window.innerHeight,
        left: 0,
        right: window.innerWidth,
        max: (document.scrollingElement?.scrollHeight ?? 0) - window.innerHeight,
        pos: window.scrollY
      });
      live = true;
      document.addEventListener("drag", onNativeDrag, true);
      document.addEventListener("scroll", onScroll, { capture: true, passive: true });
      wake();
    },
    move(nextX, nextY) {
      x = nextX;
      y = nextY;
      wake();
    },
    stop() {
      live = false;
      echo = 0;
      document.removeEventListener("drag", onNativeDrag, true);
      document.removeEventListener("scroll", onScroll, true);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      levels = [];
    }
  };
}

// ../grid/dist/index.js
import { delegateEvents, use, insert, createComponent, effect, setStyleProperty, memo, setAttribute, className, style, template } from "solid-js/web";
import { createSignal, onCleanup, createMemo, Show, For } from "solid-js";

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
  if (!config$1 && !store$4) return DEFAULT_CONFIG;
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
function string(message$1) {
  return {
    kind: "schema",
    type: "string",
    reference: string,
    expects: "string",
    async: false,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config$1) {
      if (typeof dataset.value === "string") dataset.typed = true;
      else _addIssue(this, "type", dataset, config$1);
      return dataset;
    }
  };
}

// ../grid/dist/index.js
function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
function createOccupancy() {
  const busy = /* @__PURE__ */ new Map();
  const free = (col, row, w, h) => {
    for (let r = row; r < row + h; r++) {
      const set = busy.get(r);
      if (!set) continue;
      for (let k = col; k < col + w; k++) if (set.has(k)) return false;
    }
    return true;
  };
  return {
    free,
    take(col, row, w, h) {
      for (let r = row; r < row + h; r++) {
        let set = busy.get(r);
        if (!set) busy.set(r, set = /* @__PURE__ */ new Set());
        for (let k = col; k < col + w; k++) set.add(k);
      }
    },
    /** первое свободное место от (col,row): вправо до края, потом строкой ниже */
    findFrom(col, row, w, h, cols) {
      let c = col;
      let r = row;
      for (; ; ) {
        if (c + w > cols) {
          c = 0;
          r++;
          continue;
        }
        if (free(c, r, w, h)) return { col: c, row: r };
        c++;
      }
    }
  };
}
var PRESETS = {
  full: [1, 1],
  half: [1, 2],
  third: [1, 3],
  quarter: [1, 4],
  "two-thirds": [2, 3],
  "three-quarters": [3, 4]
};
function resolveSpan(value, cols) {
  const c = Math.max(1, Math.floor(cols));
  if (value === void 0) return 1;
  if (typeof value === "number") return clamp(Math.round(value) || 1, 1, c);
  const named = PRESETS[value];
  const frac = named ?? (/^\d+\/\d+$/.test(value) ? value.split("/").map(Number) : null);
  if (!frac) return 1;
  const [num, den] = frac;
  if (!den || !Number.isFinite(num)) return 1;
  return clamp(Math.floor(c * num / den), 1, c);
}
function colWidth(contentW, cols, gapX) {
  const c = Math.max(1, Math.floor(cols));
  return Math.max(0, (contentW - gapX * (c - 1)) / c);
}
function spanSize(n, unit, gap) {
  return n * unit + (n - 1) * gap;
}
function packFlow(items, cols, mode = "flow") {
  const c = Math.max(1, Math.floor(cols));
  const grid = createOccupancy();
  const out = [];
  let curCol = 0;
  let curRow = 0;
  for (const it of items) {
    const w = clamp(Math.round(it.w) || 1, 1, c);
    const h = Math.max(1, Math.round(it.h) || 1);
    const { col, row } = grid.findFrom(mode === "dense" ? 0 : curCol, mode === "dense" ? 0 : curRow, w, h, c);
    grid.take(col, row, w, h);
    out.push({ id: it.id, w, h, col, row });
    curCol = col + w;
    curRow = row;
    if (curCol >= c) {
      curCol = 0;
      curRow = row + 1;
    }
  }
  return out;
}
function rowCount(placed) {
  let n = 0;
  for (const p of placed) n = Math.max(n, p.row + p.h);
  return n;
}
function cellRect(p, m) {
  return {
    x: p.col * (m.colW + m.gapX),
    y: p.row * (m.rowH + m.gapY),
    width: spanSize(p.w, m.colW, m.gapX),
    height: spanSize(p.h, m.rowH, m.gapY)
  };
}
function reorder(list, from, to) {
  const next = list.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
function moveDeltas(args) {
  const { base, next, m, skipId } = args;
  const to = /* @__PURE__ */ new Map();
  for (const p of next) to.set(p.id, p);
  const out = [];
  for (const p of base) {
    if (p.id === skipId) continue;
    const t = to.get(p.id);
    if (!t) continue;
    if (t.col === p.col && t.row === p.row) {
      out.push({ id: p.id, dx: 0, dy: 0 });
      continue;
    }
    const a = cellRect(p, m);
    const b = cellRect(t, m);
    out.push({ id: p.id, dx: b.x - a.x, dy: b.y - a.y });
  }
  return out;
}
var LayoutSchema = array(object({
  id: string(),
  w: number(),
  h: number(),
  x: optional(number()),
  y: optional(number())
}));
delegateEvents(["click"]);

// src/dndCore.ts
function insertIndexReading(args) {
  const { base, dragId, m, x, y } = args;
  let k = 0;
  for (const p of base) {
    if (p.id === dragId) continue;
    const r = cellRect(p, m);
    if (p.w >= m.cols) {
      if (y > r.y + r.height / 2) k++;
      continue;
    }
    if (y > r.y + r.height) k++;
    else if (y >= r.y && x > r.x + r.width / 2) k++;
  }
  return k;
}
function planDrop(args) {
  const { spans, m, x, y, drag } = args;
  const home = drag.fromIndex !== null;
  const layout = packFlow(spans, m.cols);
  const base = args.base ?? layout;
  const index = insertIndexReading({ base, dragId: drag.id, m, x, y });
  let next;
  if (home) {
    next = packFlow(reorder(spans, drag.fromIndex, index), m.cols);
  } else {
    const merged = spans.slice();
    merged.splice(index, 0, { id: drag.id, w: Math.min(drag.w, m.cols), h: drag.h });
    next = packFlow(merged, m.cols);
  }
  const me = next.find((b) => b.id === drag.id);
  return {
    index,
    next,
    // сдвиги считаем от НАСТОЯЩЕЙ укладки: transform у блоков абсолютный,
    // а не накопительный — иначе они уезжали бы дважды
    moves: moveDeltas({ base: layout, next, m, skipId: drag.id }),
    rect: me ? cellRect(me, m) : null
  };
}
var SLIDE = "transform .18s cubic-bezier(.2,.8,.2,1)";
var PREVIEW_BG = "rgba(59,130,246,.10)";
var PREVIEW_LINE = "2px dashed rgba(59,130,246,.85)";
function createGridDndEngine(opts = {}) {
  const zones = /* @__PURE__ */ new Map();
  let drag = null;
  let over = null;
  let stopMonitor = null;
  const boxes = /* @__PURE__ */ new Map();
  const scroller = createAutoScroller();
  const setOver = (name) => {
    if (over === name) return;
    over = name;
    opts.onOver?.(name);
  };
  const metricsOf = (z) => {
    const cols = Math.max(1, Math.floor(z.opts.cols()));
    const gapX = z.opts.gapX();
    return { cols, colW: colWidth(z.contentW, cols, gapX), rowH: z.opts.rowHeight(), gapX, gapY: z.opts.gapY() };
  };
  function snapshotZones(cb) {
    const targets = [];
    for (const z of zones.values()) if (z.el) targets.push(z.el);
    if (!targets.length || typeof IntersectionObserver !== "function") {
      cb();
      return;
    }
    let batches = 0;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const name = e.target.dataset.dndZone;
        if (name) boxes.set(name, { left: e.boundingClientRect.left, top: e.boundingClientRect.top });
      }
      batches++;
      if (boxes.size < targets.length && batches < 4) return;
      io.disconnect();
      cb();
    });
    for (const t of targets) io.observe(t);
  }
  function snapOf(zone) {
    const box = zone.el ? boxes.get(zone.name) : null;
    if (!zone.el || !box) return null;
    const m = metricsOf(zone);
    const spans = zone.opts.order().map((id) => ({ id, ...zone.opts.spanOf(id) }));
    return {
      zone,
      m,
      base: packFlow(spans, m.cols),
      left: box.left + zone.padLeft,
      top: box.top + zone.padTop,
      winX: window.scrollX,
      winY: window.scrollY
    };
  }
  function pointIn(s, x, y) {
    return {
      x: x - (s.left - (window.scrollX - s.winX)),
      y: y - (s.top - (window.scrollY - s.winY))
    };
  }
  const snapFor = (d, zone) => {
    let s = d.snaps.get(zone.name);
    if (!s) {
      const fresh = snapOf(zone);
      if (!fresh) return null;
      d.snaps.set(zone.name, s = fresh);
    }
    return s;
  };
  function slide(d, zone, moves) {
    for (const mv of moves) {
      const el = zone.els.get(mv.id);
      if (!el || el === d.el) continue;
      d.touched.add(el);
      d.flip.to(el, mv.dx, mv.dy);
    }
  }
  function calm(d) {
    for (const el of d.touched) d.flip.to(el, 0, 0);
    d.touched.clear();
  }
  function unarm(d) {
    d.flip.clear();
    d.touched.clear();
  }
  function showPreview(d, zone, rect) {
    if (!zone.el) return;
    if (d.preview && d.previewZone !== zone.name) {
      d.preview.remove();
      d.preview = null;
    }
    if (!d.preview) {
      const box = document.createElement("div");
      box.dataset.dndGhost = "";
      box.setAttribute("aria-hidden", "true");
      box.style.cssText = [
        "position:absolute",
        "left:0",
        "top:0",
        "pointer-events:none",
        "box-sizing:border-box",
        "border-radius:10px",
        "z-index:5",
        `background:${PREVIEW_BG}`,
        `outline:${PREVIEW_LINE}`,
        "outline-offset:-2px"
      ].join(";");
      if (shouldAnimate(opts.animate)) box.style.transition = SLIDE;
      zone.el.appendChild(box);
      d.preview = box;
      d.previewZone = zone.name;
    }
    d.preview.style.width = `${rect.width}px`;
    d.preview.style.height = `${rect.height}px`;
    d.preview.style.transform = `translate(${rect.x}px,${rect.y}px)`;
  }
  function update(d, zone, x, y) {
    if (!boxes.size) return;
    const s = snapFor(d, zone);
    if (!s) return;
    const home = zone.name === d.fromZone;
    const p = pointIn(s, x, y);
    const plan = planDrop({
      spans: zone.opts.order().map((id) => ({ id, ...zone.opts.spanOf(id) })),
      base: d.toZone === zone.name ? d.view : void 0,
      m: s.m,
      x: p.x,
      y: p.y,
      drag: { id: d.id, ...d.span, fromIndex: home ? d.fromIndex : null }
    });
    const k = plan.index;
    if (zone.name === d.toZone && k === d.toIndex) return;
    if (zone.name !== d.toZone) calm(d);
    d.toZone = zone.name;
    d.toIndex = k;
    d.view = plan.next;
    slide(d, zone, plan.moves);
    if (plan.rect) showPreview(d, zone, plan.rect);
    opts.onRows?.(zone.name, rowCount(plan.next));
  }
  function endDrag() {
    if (!drag) return;
    scroller.stop();
    const d = drag;
    for (const name of d.snaps.keys()) opts.onRows?.(name, 0);
    unarm(d);
    d.preview?.remove();
    d.el.style.opacity = "";
    drag = null;
    setOver(null);
    opts.onActive?.(null);
  }
  function ensureMonitor() {
    if (stopMonitor) return;
    stopMonitor = monitorForElements({
      canMonitor: ({ source }) => Boolean(source.data?.dumbGridId),
      onDrag({ location }) {
        if (!drag) return;
        scroller.move(location.current.input.clientX, location.current.input.clientY);
        for (const target of location.current.dropTargets) {
          const name = target.data?.dumbGridZone;
          const zone = typeof name === "string" ? zones.get(name) : null;
          if (!zone) continue;
          setOver(zone.name);
          update(drag, zone, location.current.input.clientX, location.current.input.clientY);
          return;
        }
        setOver(null);
      },
      onDrop({ location }) {
        const d = drag;
        if (!d) return;
        const dropped = location.current.dropTargets.some(
          (t) => t.data?.dumbGridZone === d.toZone
        );
        const { toZone, toIndex, fromZone, fromIndex, id } = d;
        endDrag();
        if (!dropped || toIndex < 0) return;
        if (toZone !== fromZone) {
          opts.onTransfer?.({ grid: fromZone, id, index: fromIndex }, { grid: toZone, index: toIndex });
          return;
        }
        if (toIndex !== fromIndex) zones.get(fromZone)?.opts.onReorder?.(fromIndex, toIndex);
      }
    });
  }
  return {
    grid(name, zoneOpts) {
      const zone = zones.get(name) ?? {
        name,
        el: null,
        els: /* @__PURE__ */ new Map(),
        opts: zoneOpts,
        ro: null,
        contentW: 0,
        padLeft: 0,
        padTop: 0
      };
      zone.opts = zoneOpts;
      zones.set(name, zone);
      ensureMonitor();
      return {
        attachContainer(el) {
          zone.el = el;
          el.dataset.dndZone = zone.name;
          const stop = dropTargetForElements({
            element: el,
            // данные статичны: считать что-то в getData значило бы считать это
            // на каждое движение — место мы вычисляем сами и по снимку
            getData: () => ({ dumbGridZone: zone.name }),
            canDrop: ({ source }) => {
              const from = source.data?.dumbGridZone;
              if (typeof from !== "string") return false;
              if (from === zone.name) return true;
              return !zone.opts.accepts || zone.opts.accepts(from);
            }
          });
          let ro = null;
          if (typeof ResizeObserver === "function") {
            ro = new ResizeObserver((entries) => {
              const r = entries[entries.length - 1]?.contentRect;
              if (!r) return;
              zone.contentW = r.width;
              zone.padLeft = r.left;
              zone.padTop = r.top;
            });
            ro.observe(el);
            zone.ro = ro;
          }
          return () => {
            stop();
            ro?.disconnect();
            delete el.dataset.dndZone;
            if (zone.ro === ro) zone.ro = null;
            if (zone.el === el) zone.el = null;
          };
        },
        attach(el, id) {
          zone.els.set(id, el);
          el.dataset.dndBlock = id;
          const stop = draggable({
            element: el,
            canDrag: () => {
              if (zone.opts.disabled?.()) return false;
              return zone.opts.order().includes(id);
            },
            getInitialData: () => ({ dumbGridZone: zone.name, dumbGridId: id }),
            onDragStart() {
              const index = zone.opts.order().indexOf(id);
              if (index < 0) return;
              const span = zone.opts.spanOf(id);
              boxes.clear();
              drag = {
                fromZone: zone.name,
                id,
                fromIndex: index,
                el,
                span,
                toZone: zone.name,
                toIndex: index,
                snaps: /* @__PURE__ */ new Map(),
                view: [],
                touched: /* @__PURE__ */ new Set(),
                flip: createFlip(shouldAnimate(opts.animate)),
                preview: null,
                previewZone: null
              };
              setOver(zone.name);
              opts.onActive?.({ grid: zone.name, id, ...span });
              el.style.opacity = "0.4";
              scroller.start(zone.el ?? el);
              snapshotZones(() => {
                if (!drag || drag.id !== id) return;
                const snap = snapOf(zone);
                if (!snap) return;
                drag.snaps.set(zone.name, snap);
                drag.view = snap.base;
              });
            }
            // ЗДЕСЬ убирать за собой нельзя: этот обработчик срабатывает раньше
            // монитора, а тому ещё нужно прочитать, куда блок сел. Всё вместе —
            // и уборку, и коммит — делает монитор.
          });
          return () => {
            stop();
            delete el.dataset.dndBlock;
            if (zone.els.get(id) === el) zone.els.delete(id);
          };
        }
      };
    },
    active: () => drag ? { grid: drag.fromZone, id: drag.id, ...drag.span } : null,
    over: () => over,
    destroy() {
      endDrag();
      stopMonitor?.();
      stopMonitor = null;
      for (const z of zones.values()) {
        z.ro?.disconnect();
        z.ro = null;
        z.els.clear();
        z.el = null;
      }
      zones.clear();
    }
  };
}
var dndSupported = () => typeof DataTransfer === "function" && typeof DragEvent === "function";
var DND_MIME = "application/x-dumb-grid";

// src/solid.ts
function createDumbGridDndGroup(opts = {}) {
  const [active, setActive] = createSignal2(null);
  const [over, setOver] = createSignal2(null);
  const [rows, setRows] = createSignal2({});
  const engine = createGridDndEngine({
    ...opts,
    onActive: (state) => {
      setActive(state);
      opts.onActive?.(state);
    },
    onOver: (name) => {
      setOver(name);
      opts.onOver?.(name);
    },
    onRows: (grid, n) => {
      setRows((prev) => prev[grid] === n ? prev : { ...prev, [grid]: n });
      opts.onRows?.(grid, n);
    }
  });
  onCleanup2(engine.destroy);
  return {
    grid(name, zoneOpts) {
      const zone = engine.grid(name, zoneOpts);
      return {
        container: (el) => onCleanup2(zone.attachContainer(el)),
        bind: (id) => (el) => onCleanup2(zone.attach(el, id)),
        active: () => {
          const a = active();
          return a && a.grid === name ? a.id : null;
        }
      };
    },
    active,
    over,
    rows: (grid) => rows()[grid] ?? 0
  };
}

// src/DumbGridDnd.tsx
var DEFAULT_COLS = 12;
var DEFAULT_ROW_H = 80;
var DEFAULT_GAP = 12;
function DumbGridDnd(props) {
  const cols = () => Math.max(1, Math.floor(props.cols ?? DEFAULT_COLS));
  const rowH = () => props.rowHeight ?? DEFAULT_ROW_H;
  const gap = () => props.gap ?? DEFAULT_GAP;
  const spans = createMemo2(
    () => props.items.map((it) => ({
      id: it.id,
      w: resolveSpan(it.w, cols()),
      h: Math.max(1, Math.round(it.h ?? 1) || 1)
    }))
  );
  const group = props.group ?? createDumbGridDndGroup();
  const name = () => props.name ?? "grid";
  const g = group.grid(name(), {
    order: () => props.items.map((it) => it.id),
    spanOf: (id) => spans().find((s) => s.id === id) ?? { w: 1, h: 1 },
    // метрики нужны движку, чтобы считать место вставки арифметикой,
    // а не по тому, какой блок сейчас под курсором
    cols,
    rowHeight: rowH,
    gapX: gap,
    gapY: gap,
    disabled: () => props.disabled === true,
    onReorder: (from, to) => props.onReorder?.(from, to)
  });
  const placed = createMemo2(() => packFlow(spans(), cols()));
  const posById = createMemo2(() => new Map(placed().map((p) => [p.id, p])));
  const rows = createMemo2(() => rowCount(placed()));
  const liveRows = () => {
    const base = Math.max(rows(), group.rows(name()));
    const a = group.active();
    const mine = a && (a.grid === name() || group.over() === name());
    return mine ? base + 1 : base;
  };
  return <div
    ref={g.container}
    class={props.class}
    style={{
      display: "grid",
      // контур будущего места движок кладёт сюда абсолютом — без этого он
      // считался бы от body и улетал в угол страницы
      position: "relative",
      "grid-template-columns": `repeat(${cols()}, minmax(0, 1fr))`,
      "grid-auto-rows": `${rowH()}px`,
      gap: `${gap()}px`,
      "min-height": `${(() => {
        const n = liveRows();
        return n * rowH() + Math.max(0, n - 1) * gap();
      })()}px`,
      // высота меняется на входе гостя — плавно, чтобы не прыгало
      transition: "min-height .15s ease",
      ...props.style
    }}
  >
      <For2 each={props.items}>
        {(it) => {
    const pos = () => posById().get(it.id);
    const dragging = () => g.active() === it.id;
    return <div
      ref={props.disabled ? void 0 : g.bind(it.id)}
      class={props.blockClass}
      style={{
        // позицию считаем мы, браузер её не домысливает
        "grid-column": `${(pos()?.col ?? 0) + 1} / span ${pos()?.w ?? 1}`,
        "grid-row": `${(pos()?.row ?? 0) + 1} / span ${pos()?.h ?? 1}`,
        position: "relative",
        "min-width": "0",
        "min-height": "0",
        "box-sizing": "border-box",
        cursor: props.disabled ? "default" : "grab",
        ...props.blockStyle
      }}
    >
              {it.content()}
            </div>;
  }}
      </For2>
    </div>;
}
export {
  DND_MIME,
  DumbGridDnd,
  createDumbGridDndGroup,
  createGridDndEngine,
  dndSupported,
  planDrop
};
