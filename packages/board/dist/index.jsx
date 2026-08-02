// src/DumbBoard.tsx
import { For as For2, Show as Show2, createEffect, createMemo as createMemo2, createSignal as createSignal2, onCleanup as onCleanup2, onMount } from "solid-js";

// ../shared/dist/index.js
function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function shouldAnimate(explicit) {
  if (explicit !== void 0) return explicit;
  return !prefersReducedMotion();
}
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
function createStableOrder(id) {
  const seen = /* @__PURE__ */ new Map();
  let next = 0;
  return {
    sort(items) {
      const live = /* @__PURE__ */ new Set();
      for (const it of items) {
        const key = id(it);
        live.add(key);
        if (!seen.has(key)) seen.set(key, next++);
      }
      if (seen.size > live.size) {
        for (const key of seen.keys()) if (!live.has(key)) seen.delete(key);
      }
      return items.slice().sort((a, b) => seen.get(id(a)) - seen.get(id(b)));
    },
    rank(item) {
      return seen.get(id(item)) ?? Number.MAX_SAFE_INTEGER;
    }
  };
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
    const want = clamp(Math.round(it.w) || 1, 1, c);
    const h = Math.max(1, Math.round(it.h) || 1);
    const fromCol = mode === "dense" ? 0 : curCol;
    const fromRow = mode === "dense" ? 0 : curRow;
    const min = clamp(Math.round(it.minW ?? want) || 1, 1, want);
    let best = null;
    for (let w2 = want; w2 >= min; w2--) {
      const spot = grid.findFrom(fromCol, fromRow, w2, h, c);
      if (!best || spot.row < best.row || spot.row === best.row && spot.col < best.col) {
        best = { col: spot.col, row: spot.row, w: w2 };
      }
      if (best.row === fromRow && best.col === fromCol) break;
    }
    const { col, row, w } = best;
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
function snapSpan(args) {
  const { start, dx, dy, m, limits } = args;
  const stepX = m.colW + m.gapX;
  const stepY = m.rowH + m.gapY;
  const lim = limits ?? {};
  const w = stepX > 0 ? Math.round((spanSize(start.w, m.colW, m.gapX) + dx + m.gapX) / stepX) : start.w;
  const h = stepY > 0 ? Math.round((spanSize(start.h, m.rowH, m.gapY) + dy + m.gapY) / stepY) : start.h;
  return {
    w: clamp(w, Math.max(1, lim.minW ?? 1), Math.min(m.cols, lim.maxW ?? m.cols)),
    h: clamp(h, Math.max(1, lim.minH ?? 1), lim.maxH ?? Number.MAX_SAFE_INTEGER)
  };
}
var LayoutSchema = array(object({
  id: string(),
  w: number(),
  h: number(),
  x: optional(number()),
  y: optional(number())
}));
var GRID_LINE = "var(--dumb-grid-line, rgba(100,116,139,.45))";
function gridLinesBackground(args) {
  const {
    cols,
    gapX,
    rowH,
    gapY,
    line
  } = args;
  const col = `calc((100% - ${(cols - 1) * gapX}px) / ${cols})`;
  const stepX = `calc(${col} + ${gapX}px)`;
  const lineW = Math.max(1, line ?? gapX);
  const lineH = Math.max(1, line ?? gapY);
  const stops = ["transparent 0"];
  for (let i = 1; i < cols; i++) {
    const at = `calc(${stepX} * ${i} - ${gapX}px)`;
    const to = `calc(${stepX} * ${i} - ${gapX}px + ${lineW}px)`;
    stops.push(`transparent ${at}`, `${GRID_LINE} ${at}`, `${GRID_LINE} ${to}`, `transparent ${to}`);
  }
  stops.push("transparent 100%");
  const stepY = rowH + gapY;
  return {
    image: [`linear-gradient(to right, ${stops.join(", ")})`, `linear-gradient(to bottom, transparent 0, transparent ${stepY - lineH}px, ${GRID_LINE} ${stepY - lineH}px, ${GRID_LINE} ${stepY}px)`].join(", "),
    // вертикальные линии — на всю ширину (тайлить нельзя, см. выше),
    // горизонтальные — тайлом в одну строку
    size: `100% 100%, 100% ${stepY}px`
  };
}
delegateEvents(["click"]);

// src/boardMath.ts
function panelFlow(order, opts) {
  const { cols, colW, gap, origin } = opts;
  const step = colW + gap;
  const out = {};
  let used = 0;
  let top = 0;
  let rowH = 0;
  for (const p of order) {
    const w = Math.max(1, Math.min(cols, p.span));
    if (used + w > cols && used > 0) {
      top += rowH + gap;
      used = 0;
      rowH = 0;
    }
    out[p.id] = { left: origin.left + used * step, top: origin.top + top };
    used += w;
    rowH = Math.max(rowH, p.height);
  }
  return out;
}
function moveAt(list, from, to) {
  if (from === to || from < 0) return list;
  const next = list.slice();
  next.splice(Math.max(0, Math.min(next.length, to)), 0, next.splice(from, 1)[0]);
  return next;
}

// src/DumbBoard.tsx
var CSS = `
          .dumb-board { display: grid; align-items: start; gap: var(--dumb-board-gap);
                        grid-template-columns: repeat(var(--dumb-board-cols), 1fr) }
          .dumb-board-panel { position: relative; min-width: 0 }
          .dumb-board-panel.held { opacity: .35 }
          .dumb-board-head { display: flex; align-items: center; gap: 6px; margin: 0 0 8px;
                             font: inherit; font-size: 13px; cursor: grab; user-select: none }
          .dumb-board-head:active { cursor: grabbing }
          /* \u0432\u0441\u0451, \u0447\u0442\u043E \u0447\u0438\u0442\u0430\u044E\u0442 \u0438\u043B\u0438 \u0445\u0432\u0430\u0442\u0430\u044E\u0442, \u2014 \u043A\u043E\u043D\u0442\u0440\u0430\u0441\u0442\u043D\u043E\u0435: \u0431\u043B\u0451\u043A\u043B\u0430\u044F \u0440\u0443\u0447\u043A\u0430 \u0438 \u0441\u0435\u0440\u044B\u0439 \u043F\u043E
             \u0441\u0435\u0440\u043E\u043C\u0443 \u043D\u0435 \u0447\u0438\u0442\u0430\u044E\u0442\u0441\u044F \u043D\u0438 \u043D\u0430 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0440\u0435, \u043D\u0438 \u043F\u0440\u0438 \u044F\u0440\u043A\u043E\u043C \u0441\u0432\u0435\u0442\u0435 */
          .dumb-board-grip { color: var(--dumb-board-grip, #64748b) }
          .dumb-board-title { display: flex; align-items: baseline; gap: 6px; min-width: 0 }
          .dumb-board-sub { font-size: 11.5px; font-weight: 400; opacity: .85 }
          .dumb-board-count { padding: 1px 7px; border-radius: 999px; font-size: 11px;
                              background: rgb(0 0 0 / .1) }
          .dumb-board-actions { margin-left: auto; display: flex; gap: 4px }
          /* \u0441\u0435\u0442\u043A\u0430 \u0431\u043B\u043E\u043A\u043E\u0432: \u044F\u0447\u0435\u0439\u043A\u0438 \u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u043E\u0433\u043E \u0448\u0430\u0433\u0430, \u043C\u0435\u0441\u0442\u0430 \u0437\u0430\u0434\u0430\u044E\u0442\u0441\u044F \u044F\u0432\u043D\u043E */
          /* overflow-x \u0438\u043C\u0435\u043D\u043D\u043E clip, \u0430 \u043D\u0435 visible: \u0440\u044F\u0434\u043E\u043C \u0441 overflow-y: auto
             visible \u0432\u044B\u0447\u0438\u0441\u043B\u044F\u0435\u0442\u0441\u044F \u0432 auto, \u0438 FLIP, \u0432\u044B\u043D\u043E\u0441\u044F \u0431\u043B\u043E\u043A \u0437\u0430 \u043F\u0440\u0430\u0432\u044B\u0439 \u043A\u0440\u0430\u0439,
             \u0437\u0430\u0436\u0438\u0433\u0430\u0435\u0442 \u0433\u043E\u0440\u0438\u0437\u043E\u043D\u0442\u0430\u043B\u044C\u043D\u0443\u044E \u043F\u043E\u043B\u043E\u0441\u0443 \u043D\u0430 \u0432\u0440\u0435\u043C\u044F \u0430\u043D\u0438\u043C\u0430\u0446\u0438\u0438. clip \u0442\u0430\u043A\u043E\u0433\u043E \u043D\u0435
             \u0434\u0435\u043B\u0430\u0435\u0442 \u0438 \u043D\u0435 \u043C\u0435\u0448\u0430\u0435\u0442 \u0432\u0435\u0440\u0442\u0438\u043A\u0430\u043B\u044C\u043D\u043E\u0439 \u043E\u0441\u0438 \u043F\u0440\u043E\u043A\u0440\u0443\u0447\u0438\u0432\u0430\u0442\u044C\u0441\u044F */
          .dumb-board-zone { position: relative; display: grid; gap: var(--dumb-board-zone-gap);
                             align-content: start; overflow-x: clip; overflow-y: auto;
                             scrollbar-gutter: stable;
                             grid-template-columns: repeat(var(--dumb-board-inner), minmax(0, 1fr));
                             grid-auto-rows: var(--dumb-board-row) }
          /* \u041F\u043E\u0434\u043B\u043E\u0436\u043A\u0430 \u0441 \u043B\u0438\u043D\u0438\u044F\u043C\u0438: \u043D\u0435 \u0443\u0447\u0430\u0441\u0442\u0432\u0443\u0435\u0442 \u0432 \u0441\u0435\u0442\u043A\u0435 (absolute), \u043F\u043E\u044D\u0442\u043E\u043C\u0443 \u043D\u0435
             \u0437\u0430\u043D\u0438\u043C\u0430\u0435\u0442 \u044F\u0447\u0435\u0435\u043A \u0438 \u043D\u0435 \u0440\u0430\u0441\u0442\u0430\u043B\u043A\u0438\u0432\u0430\u0435\u0442 \u0431\u043B\u043E\u043A\u0438.

             padding: inherit \u0438 background-*: content-box \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B \u2014 \u0441\u0435\u0442\u043A\u0430
             \u043D\u0430\u0447\u0438\u043D\u0430\u0435\u0442\u0441\u044F \u041F\u041E\u0421\u041B\u0415 padding \u0437\u043E\u043D\u044B, \u0430 absolute-\u0441\u043B\u043E\u0439 \u043E\u0442\u0441\u0447\u0438\u0442\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043E\u0442
             padding-box. \u0411\u0435\u0437 \u044D\u0442\u043E\u0433\u043E \u043B\u0438\u043D\u0438\u0438 \u0441\u044A\u0435\u0437\u0436\u0430\u044E\u0442 \u0440\u043E\u0432\u043D\u043E \u043D\u0430 padding. */
          .dumb-board-lines { position: absolute; inset: 0; pointer-events: none; z-index: 0;
                              padding: inherit; box-sizing: border-box;
                              background-origin: content-box; background-clip: content-box;
                              background-repeat: no-repeat, repeat;
                              transition: opacity .15s ease;
                              /* \u0421\u0412\u041E\u0419 \u0421\u041B\u041E\u0419 \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u0435\u043D: \u043F\u043E\u0434\u043B\u043E\u0436\u043A\u0430 \u0440\u0430\u0437\u043C\u0435\u0440\u043E\u043C \u0432\u043E \u0432\u0441\u044E
                                 \u0437\u043E\u043D\u0443 \u0438 \u0441 \u0434\u0432\u0443\u043C\u044F \u0433\u0440\u0430\u0434\u0438\u0435\u043D\u0442\u0430\u043C\u0438, \u0430 \u0433\u0430\u0441\u0438\u0442\u0441\u044F \u0447\u0435\u0440\u0435\u0437
                                 opacity. \u0411\u0435\u0437 \u0441\u043B\u043E\u044F \u0431\u0440\u0430\u0443\u0437\u0435\u0440 \u043F\u0435\u0440\u0435\u0440\u0438\u0441\u043E\u0432\u044B\u0432\u0430\u0435\u0442 \u044D\u0442\u0438
                                 \u0433\u0440\u0430\u0434\u0438\u0435\u043D\u0442\u044B \u043A\u0430\u0436\u0434\u044B\u0439 \u043A\u0430\u0434\u0440 \u0430\u043D\u0438\u043C\u0430\u0446\u0438\u0438 \u2014 \u043D\u0430 \u0437\u0430\u043C\u0435\u0440\u0435 \u044D\u0442\u043E
                                 \u0434\u0432\u0435 \u0442\u0440\u0435\u0442\u0438 \u0432\u0441\u0435\u0445 \u043F\u0435\u0440\u0435\u043A\u0440\u0430\u0441\u043E\u043A \u0437\u0430 \u0436\u0435\u0441\u0442. */
                              will-change: opacity }
          /* \u0440\u0430\u043C\u043A\u0430 \u0431\u0443\u0434\u0443\u0449\u0435\u0433\u043E \u0440\u0430\u0437\u043C\u0435\u0440\u0430: \u0421\u0410\u041C\u0410 grid item, \u043F\u043E\u044D\u0442\u043E\u043C\u0443 \u0432\u0441\u0442\u0430\u0451\u0442 \u0432 \u044F\u0447\u0435\u0439\u043A\u0438 \u0431\u0435\u0437
             \u043F\u0438\u043A\u0441\u0435\u043B\u044C\u043D\u043E\u0439 \u0430\u0440\u0438\u0444\u043C\u0435\u0442\u0438\u043A\u0438 \u2014 \u0438 \u043D\u0435 \u043C\u0435\u0448\u0430\u0435\u0442 \u0431\u043B\u043E\u043A\u0430\u043C, \u0443 \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u043C\u0435\u0441\u0442\u0430 \u044F\u0432\u043D\u044B\u0435 */
          .dumb-board-frame { pointer-events: none; z-index: 3; border-radius: 10px;
                              border: 2px dashed rgba(59,130,246,.9);
                              background: rgba(59,130,246,.08) }
          /* \u0440\u0443\u0447\u043A\u0430 \u0440\u0435\u0441\u0430\u0439\u0437\u0430 \u0431\u043B\u043E\u043A\u0430 \u2014 \u0442\u043E\u0442 \u0436\u0435 \u0443\u0433\u043E\u043B\u043E\u043A, \u0447\u0442\u043E \u0443 \u0441\u0435\u043A\u0446\u0438\u0438: \u0434\u0432\u0435 \u043B\u0438\u043D\u0438\u0438 \u0441\u043E
             \u0441\u043A\u0440\u0443\u0433\u043B\u0435\u043D\u0438\u0435\u043C. \u0420\u0438\u0441\u0443\u0435\u043C \u0441\u0430\u043C\u0438, \u0430 \u043D\u0435 Tailwind'\u043E\u043C: \u043A\u0438\u0442 \u0441\u0430\u043C\u043E\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u0435\u043D */
          .dumb-board-block-grip { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px;
                                   cursor: nwse-resize; touch-action: none; z-index: 2 }
          /* \u0446\u0432\u0435\u0442 \u041A\u041E\u041D\u0422\u0420\u0410\u0421\u0422\u041D\u042B\u0419: \u0440\u0443\u0447\u043A\u0430 \u2014 \u043E\u0440\u0433\u0430\u043D \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F, \u0435\u0451 \u043D\u0430\u0434\u043E \u0432\u0438\u0434\u0435\u0442\u044C, \u0430 \u043D\u0435
             \u0443\u0433\u0430\u0434\u044B\u0432\u0430\u0442\u044C. \u041F\u0435\u0440\u0435\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u043E\u0439, \u043D\u043E \u0431\u043B\u0451\u043A\u043B\u044B\u0439 \u0434\u0435\u0444\u043E\u043B\u0442 \u043D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C */
          .dumb-board-block-grip::after { content: ''; position: absolute; right: 4px; bottom: 4px;
                                          width: 9px; height: 9px;
                                          border-right: 2px solid var(--dumb-board-grip, #475569);
                                          border-bottom: 2px solid var(--dumb-board-grip, #475569);
                                          border-bottom-right-radius: 3px }
          .dumb-board-block-grip:hover::after { border-color: var(--dumb-board-grip-hover, #1e293b) }
          /* \u0431\u043B\u043E\u043A \u0437\u0430\u043D\u0438\u043C\u0430\u0435\u0442 \u0421\u0412\u041E\u0418 \u044F\u0447\u0435\u0439\u043A\u0438 \u0446\u0435\u043B\u0438\u043A\u043E\u043C \u2014 \u0432\u044B\u0441\u043E\u0442\u0430 \u043F\u0440\u0438\u0445\u043E\u0434\u0438\u0442 \u0438\u0437 \u0441\u0435\u0442\u043A\u0438, \u0430 \u043D\u0435
             \u0438\u0437 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u0433\u043E, \u043F\u043E\u044D\u0442\u043E\u043C\u0443 \u043C\u0435\u0440\u0438\u0442\u044C \u0435\u0451 \u043D\u0435 \u043D\u0443\u0436\u043D\u043E \u0432\u043E\u0432\u0441\u0435 */
          .dumb-board-block { min-width: 0; min-height: 0; position: relative; z-index: 1 }
          .dumb-board-block.held { opacity: .35 }
          .dumb-board-grip-x { position: absolute; top: 26px; right: -9px; bottom: 12px; width: 12px;
                               cursor: col-resize; touch-action: none }
          .dumb-board-grip-y { position: absolute; left: 12px; right: 12px; bottom: -9px; height: 12px;
                               cursor: row-resize; touch-action: none }
          .dumb-board-grip-xy { position: absolute; right: -9px; bottom: -9px; width: 16px; height: 16px;
                                cursor: nwse-resize; touch-action: none }
        `;
function DumbBoard(props) {
  injectStyle("board", CSS);
  const cols = () => props.cols ?? 12;
  const gap = () => props.gap ?? 14;
  const rowH = () => props.rowHeight ?? 76;
  const zoneGap = () => props.zoneGap ?? 8;
  const minSpan = () => props.minSpan ?? 3;
  const editable = () => props.editable !== false;
  const resizable = () => props.resizable !== false;
  const showGrid = () => props.showGrid ?? "drag";
  const gridVisible = () => showGrid() === true || showGrid() === "drag" && !!held();
  const spanOf = (s) => Math.max(1, Math.min(cols(), s.span ?? Math.floor(cols() / 2)));
  const colsIn = (s) => Math.max(1, s.cols ?? 3);
  const sectionById = (id) => props.sections.find((s) => s.id === id);
  const itemsOf = (id) => sectionById(id)?.items ?? [];
  const sectionOf = (blockId) => props.sections.find((s) => s.items.some((it) => props.id(it) === blockId));
  const spanOfBlock = (item, s) => {
    const sec = s ?? sectionOf(props.id(item));
    const n = sec ? colsIn(sec) : 1;
    return resolveSpan(props.blockSpan?.(item), n);
  };
  const limitsOf = (item, s) => {
    const lim = props.blockLimits?.(item);
    if (!lim) return {};
    const n = colsIn(s ?? sectionOf(props.id(item)) ?? { cols: 1 });
    return {
      minW: lim.minW === void 0 ? void 0 : resolveSpan(lim.minW, n),
      maxW: lim.maxW === void 0 ? void 0 : resolveSpan(lim.maxW, n),
      minH: lim.minH,
      maxH: lim.maxH
    };
  };
  const rowsOfBlock = (item) => Math.max(1, Math.round(props.blockRows?.(item) ?? 1));
  const stableSections = createStableOrder((s) => s.id);
  const stableItems = createStableOrder(props.id);
  const renderOrder = () => stableSections.sort(props.sections).map((s) => s.id);
  const showOrder = (id) => props.sections.findIndex((s) => s.id === id);
  const ranked = createMemo2(() => stableItems.sort(props.sections.flatMap((s) => s.items)));
  const renderItemsOf = (id) => {
    const own = new Set(itemsOf(id).map(props.id));
    return ranked().filter((it) => own.has(props.id(it)));
  };
  const places = createMemo2(() => {
    const out = /* @__PURE__ */ new Map();
    for (const s of props.sections) s.items.forEach((it, k) => out.set(props.id(it), k));
    return out;
  });
  const placeOf = (item) => places().get(props.id(item)) ?? 0;
  const [held, setHeld] = createSignal2(null);
  const [heldSection, setHeldSection] = createSignal2(null);
  const [sizing, setSizing] = createSignal2(null);
  const blockEls = /* @__PURE__ */ new Map();
  const zoneEls = /* @__PURE__ */ new Map();
  const panelEls = /* @__PURE__ */ new Map();
  let wrapEl;
  let zoneAt = {};
  let panelH = {};
  let wrapAt = { left: 0, top: 0 };
  let colW = 0;
  const zoneW = {};
  const zonePad = {};
  let flip = createFlip(true);
  createEffect(() => {
    flip = createFlip(shouldAnimate(props.animate));
  });
  const scroller = createAutoScroller();
  onCleanup2(() => scroller.stop());
  function measure() {
    const targets = [...zoneEls.values(), ...panelEls.values(), wrapEl].filter(Boolean);
    if (!targets.length || typeof IntersectionObserver !== "function") return;
    const rects = /* @__PURE__ */ new Map();
    let batches = 0;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) rects.set(e.target, e.boundingClientRect);
      batches++;
      if (rects.size < targets.length && batches < 4) return;
      io.disconnect();
      const next = {};
      for (const s of props.sections) {
        const r = rects.get(zoneEls.get(s.id));
        if (r) next[s.id] = { left: r.left, top: r.top };
      }
      zoneAt = next;
      for (const s of props.sections) {
        const r = rects.get(panelEls.get(s.id));
        if (r) panelH[s.id] = r.height;
      }
      const wr = rects.get(wrapEl);
      if (wr) wrapAt = { left: wr.left, top: wr.top };
    });
    for (const t of targets) io.observe(t);
  }
  function measureWhenStill() {
    const anims = [...blockEls.values(), ...panelEls.values()].filter(Boolean).flatMap((el) => el.getAnimations());
    if (!anims.length) {
      measure();
      return;
    }
    Promise.allSettled(anims.map((a) => a.finished)).then(() => measure());
  }
  const sizes = typeof ResizeObserver === "function" ? new ResizeObserver((entries) => {
    for (const e of entries) {
      if (e.target === wrapEl) {
        colW = colWidth(e.contentRect.width, cols(), gap());
        continue;
      }
      const id = e.target.dataset.boardZone;
      if (!id) continue;
      zoneW[id] = e.contentRect.width;
      zonePad[id] = { left: e.contentRect.left, top: e.contentRect.top };
    }
  }) : null;
  onCleanup2(() => sizes?.disconnect());
  onMount(() => {
    measure();
    if (!sizes) return;
    sizes.observe(wrapEl);
    let firstCall = true;
    const ro = new ResizeObserver(() => {
      if (firstCall) {
        firstCall = false;
        return;
      }
      measure();
    });
    ro.observe(wrapEl);
    onCleanup2(() => ro.disconnect());
  });
  const cellsOf = createMemo2(() => {
    const out = /* @__PURE__ */ new Map();
    for (const s of props.sections) {
      out.set(s.id, packFlow(
        s.items.map((it) => ({
          id: props.id(it),
          w: spanOfBlock(it, s),
          h: rowsOfBlock(it),
          minW: limitsOf(it, s).minW
        })),
        colsIn(s)
      ));
    }
    return out;
  });
  const placedIn = (sectionId) => cellsOf().get(sectionId) ?? [];
  const rowsUsed = (sectionId) => rowCount(placedIn(sectionId));
  const cellOf = (sectionId, blockId) => placedIn(sectionId).find((p) => p.id === blockId);
  const linesOf = (s) => {
    const bg = gridLinesBackground({
      cols: colsIn(s),
      gapX: zoneGap(),
      rowH: rowH(),
      gapY: zoneGap(),
      line: 1
    });
    return { "background-image": bg.image, "background-size": bg.size };
  };
  const metricsOf = (s) => ({
    cols: colsIn(s),
    colW: colWidth(zoneW[s.id] ?? 0, colsIn(s), zoneGap()),
    rowH: rowH(),
    gapX: zoneGap(),
    gapY: zoneGap()
  });
  const blockPlaces = (sectionId) => {
    const s = sectionById(sectionId);
    const origin = zoneAt[sectionId];
    if (!s || !origin) return {};
    const m = metricsOf(s);
    const el = zoneEls.get(sectionId);
    const pad = zonePad[sectionId] ?? { left: 0, top: 0 };
    const left = origin.left + pad.left - (el?.scrollLeft ?? 0);
    const top = origin.top + pad.top - (el?.scrollTop ?? 0);
    const out = {};
    for (const p of placedIn(sectionId)) {
      const r = cellRect(p, m);
      out[p.id] = { left: left + r.x, top: top + r.y };
    }
    return out;
  };
  const rectOf = (sectionId, blockId) => {
    const s = sectionById(sectionId);
    const origin = zoneAt[sectionId];
    const p = cellOf(sectionId, blockId);
    if (!s || !origin || !p) return null;
    const el = zoneEls.get(sectionId);
    const pad = zonePad[sectionId] ?? { left: 0, top: 0 };
    const r = cellRect(p, metricsOf(s));
    return {
      x: origin.left + pad.left - (el?.scrollLeft ?? 0) + r.x,
      y: origin.top + pad.top - (el?.scrollTop ?? 0) + r.y,
      width: r.width,
      height: r.height
    };
  };
  const crossedMid = (sectionId, overId, ev, dx, dy) => {
    const r = rectOf(sectionId, overId);
    if (!r) return true;
    if (Math.abs(dx) >= Math.abs(dy)) {
      const mid2 = r.x + r.width / 2;
      return dx > 0 ? ev.clientX > mid2 : ev.clientX < mid2;
    }
    const mid = r.y + r.height / 2;
    return dy > 0 ? ev.clientY > mid : ev.clientY < mid;
  };
  const snapshotPlaces = () => {
    const out = /* @__PURE__ */ new Map();
    for (const s of props.sections) {
      const pos = blockPlaces(s.id);
      for (const id of Object.keys(pos)) out.set(id, pos[id]);
    }
    return out;
  };
  const playBlocks = (was) => {
    for (const s of props.sections) {
      const now = blockPlaces(s.id);
      for (const id of Object.keys(now)) {
        const from = was.get(id);
        const to = now[id];
        if (!from || from.left === to.left && from.top === to.top) continue;
        const el = blockEls.get(id);
        if (el) flip.nudge(el, from.left - to.left, from.top - to.top);
      }
    }
  };
  function moveBlock(item, toSection, toIndex) {
    const bid = props.id(item);
    const was = snapshotPlaces();
    const next = props.sections.map((s) => {
      const has = s.items.some((it) => props.id(it) === bid);
      if (!has && s.id !== toSection) return s;
      const rest = s.items.filter((it) => props.id(it) !== bid);
      if (s.id !== toSection) return { ...s, items: rest };
      const k = Math.max(0, Math.min(rest.length, toIndex));
      return { ...s, items: [...rest.slice(0, k), item, ...rest.slice(k)] };
    });
    props.setSections(next);
    props.onMove?.(item, toSection, toIndex);
    playBlocks(was);
  }
  const panelBoxes = (order) => order.map((s) => ({ id: s.id, span: spanOf(s), height: panelH[s.id] ?? 0 }));
  const flowOpts = () => ({ cols: cols(), colW, gap: gap(), origin: wrapAt });
  const playSections = (order, apply) => {
    const was = panelFlow(panelBoxes(props.sections), flowOpts());
    apply();
    const now = panelFlow(panelBoxes(order), flowOpts());
    for (const s of order) {
      const a = was[s.id];
      const b = now[s.id];
      const el = panelEls.get(s.id);
      if (!a || !b || !el || a.left === b.left && a.top === b.top) continue;
      flip.nudge(el, a.left - b.left, a.top - b.top);
    }
  };
  function moveSection(id, toIndex) {
    const from = props.sections.findIndex((s) => s.id === id);
    if (from < 0 || from === toIndex) return;
    const order = moveAt(props.sections, from, toIndex);
    playSections(order, () => {
      props.setSections(order);
      props.onSectionMove?.(from, toIndex);
    });
  }
  const wasSpan = {};
  function toggleWide(s) {
    const full = spanOf(s) >= cols();
    if (!full) wasSpan[s.id] = spanOf(s);
    const span = full ? wasSpan[s.id] ?? Math.floor(cols() / 2) : cols();
    const order = props.sections.map((x) => x.id === s.id ? { ...x, span } : x);
    playSections(order, () => {
      props.setSections(order);
      props.onSectionResize?.(s.id, { span, rows: s.rows ?? 0 });
    });
    measureWhenStill();
  }
  let sizingFrom = null;
  const onGripDown = (ev) => {
    if (ev.button !== 0) return;
    const grip = ev.target?.closest?.("[data-board-resize]");
    if (!grip || !editable() || !resizable()) return;
    const s = sectionById(grip.dataset.boardResize);
    if (!s) return;
    ev.preventDefault();
    grip.setPointerCapture(ev.pointerId);
    sizingFrom = {
      id: s.id,
      axis: grip.dataset.axis ?? "x",
      x: ev.clientX,
      y: ev.clientY,
      span: spanOf(s),
      // высота «по содержимому» — берём фактическую, чтобы тянуть с того же места
      rows: s.rows || rowsUsed(s.id)
    };
    setSizing(s.id);
  };
  const onGripMove = (ev) => {
    const d = sizingFrom;
    if (!d || !colW) return;
    if (!(ev.buttons & 1)) {
      onGripUp();
      return;
    }
    const s = sectionById(d.id);
    if (!s) return;
    let span = spanOf(s);
    let rows = s.rows ?? d.rows;
    if (d.axis !== "y") span = Math.max(minSpan(), Math.min(cols(), d.span + Math.round((ev.clientX - d.x) / colW)));
    if (d.axis !== "x") rows = Math.max(1, d.rows + Math.round((ev.clientY - d.y) / (rowH() + zoneGap())));
    if (span === spanOf(s) && rows === (s.rows ?? d.rows)) return;
    props.setSections(props.sections.map((x) => x.id === d.id ? { ...x, span, rows } : x));
    props.onSectionResize?.(d.id, { span, rows });
  };
  const onGripUp = () => {
    if (!sizingFrom) return;
    sizingFrom = null;
    setSizing(null);
    measureWhenStill();
  };
  let blockSizingFrom = null;
  const [blockFrame, setBlockFrame] = createSignal2(null);
  const onBlockGripDown = (ev) => {
    if (ev.button !== 0) return;
    const grip = ev.target?.closest?.("[data-board-block-resize]");
    if (!grip || !editable() || !props.onBlockResize) return;
    const id = grip.dataset.boardBlockResize;
    const section = sectionOf(id);
    const at = section && cellOf(section.id, id);
    if (!section || !at) return;
    ev.preventDefault();
    ev.stopPropagation();
    grip.setPointerCapture(ev.pointerId);
    const item = section.items.find((it) => props.id(it) === id);
    blockSizingFrom = {
      id,
      sectionId: section.id,
      x: ev.clientX,
      y: ev.clientY,
      w: spanOfBlock(item, section),
      h: at.h
    };
    setBlockFrame({ sectionId: section.id, id, w: blockSizingFrom.w, h: blockSizingFrom.h });
  };
  const onBlockGripMove = (ev) => {
    const d = blockSizingFrom;
    if (!d) return;
    if (!(ev.buttons & 1)) {
      onBlockGripUp();
      return;
    }
    const s = sectionById(d.sectionId);
    const item = s?.items.find((it) => props.id(it) === d.id);
    if (!s || !item) return;
    const next = snapSpan({
      start: { w: d.w, h: d.h },
      dx: ev.clientX - d.x,
      dy: ev.clientY - d.y,
      m: metricsOf(s),
      limits: limitsOf(item, s)
    });
    const now = blockFrame();
    if (now && now.w === next.w && now.h === next.h) return;
    setBlockFrame({ sectionId: d.sectionId, id: d.id, w: next.w, h: next.h });
  };
  const onBlockGripUp = () => {
    const d = blockSizingFrom;
    const frame = blockFrame();
    blockSizingFrom = null;
    setBlockFrame(null);
    if (!d || !frame) return;
    const s = sectionById(d.sectionId);
    const item = s?.items.find((it) => props.id(it) === d.id);
    if (!item) return;
    if (frame.w === d.w && frame.h === d.h) return;
    const was = snapshotPlaces();
    props.onBlockResize?.(item, { w: frame.w, h: frame.h });
    playBlocks(was);
    measureWhenStill();
  };
  const closestOf = (ev, sel) => ev.target?.closest?.(sel);
  let pressed = null;
  let gesture = null;
  let lastX = -1;
  let lastY = -1;
  const onDragStart = (ev) => {
    if (!editable()) {
      ev.preventDefault();
      return;
    }
    if (pressed?.closest?.("[data-board-block-resize]")) {
      ev.preventDefault();
      return;
    }
    setHeld(null);
    setHeldSection(null);
    const panel = closestOf(ev, "[data-board-section]");
    const block = closestOf(ev, "[data-board-block]");
    if (panel && !block && pressed?.closest?.("[data-board-handle]")) {
      const id2 = panel.dataset.boardSection;
      ev.dataTransfer?.setData("text/plain", id2);
      if (ev.dataTransfer) ev.dataTransfer.effectAllowed = "move";
      lastX = ev.clientX;
      lastY = ev.clientY;
      gesture = id2;
      scroller.start(panel);
      setTimeout(() => {
        if (gesture === id2) setHeldSection(id2);
      });
      return;
    }
    const id = block?.dataset.boardBlock;
    if (!id) {
      ev.preventDefault();
      return;
    }
    ev.dataTransfer?.setData("text/plain", id);
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = "move";
    lastX = ev.clientX;
    lastY = ev.clientY;
    gesture = id;
    scroller.start(block);
    setTimeout(() => {
      if (gesture === id) setHeld(id);
    });
  };
  const onDragOver = (ev) => {
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
    scroller.move(ev.clientX, ev.clientY);
    if (ev.clientX === lastX && ev.clientY === lastY) return;
    const dx = ev.clientX - lastX;
    const dy = ev.clientY - lastY;
    lastX = ev.clientX;
    lastY = ev.clientY;
    const movingSection = heldSection();
    if (movingSection) {
      const overId = closestOf(ev, "[data-board-section]")?.dataset.boardSection;
      if (!overId || overId === movingSection) return;
      if (panelEls.get(overId)?.getAnimations().length) return;
      moveSection(movingSection, props.sections.findIndex((s) => s.id === overId));
      return;
    }
    const id = held();
    if (!id) return;
    const home = sectionOf(id);
    const item = home?.items.find((x) => props.id(x) === id);
    if (!item || !home) return;
    const zoneId = closestOf(ev, "[data-board-zone]")?.dataset.boardZone;
    const zone = zoneId ? sectionById(zoneId) : null;
    if (!zone) return;
    const from = home.id;
    if (zone.accepts && from !== zone.id && !zone.accepts(from)) return;
    const over = closestOf(ev, "[data-board-block]")?.dataset.boardBlock;
    if (over) {
      if (over === id) return;
      if (blockEls.get(over)?.getAnimations().length) return;
      const target = zone.items.find((x) => props.id(x) === over);
      if (!target) return;
      const k = placeOf(target);
      if (from === zone.id && placeOf(item) === k) return;
      if (!crossedMid(zone.id, over, ev, dx, dy)) return;
      moveBlock(item, zone.id, k);
      return;
    }
    if (from === zone.id) return;
    moveBlock(item, zone.id, itemsOf(zone.id).length);
  };
  const finish = () => {
    gesture = null;
    if (!held() && !heldSection()) return;
    setHeld(null);
    setHeldSection(null);
    scroller.stop();
    measureWhenStill();
  };
  return <div
    class={props.class}
    style={props.style}
    onPointerDown={(ev) => {
      pressed = ev.target;
      onGripDown(ev);
      onBlockGripDown(ev);
    }}
    onPointerMove={(ev) => {
      onGripMove(ev);
      onBlockGripMove(ev);
    }}
    onPointerUp={(ev) => {
      onGripUp();
      onBlockGripUp();
    }}
    onPointerCancel={() => {
      onGripUp();
      onBlockGripUp();
    }}
    onDragStart={onDragStart}
    onDragOver={onDragOver}
    onDragEnd={finish}
    onDrop={(ev) => {
      ev.preventDefault();
      finish();
    }}
  >
      <div
    class="dumb-board"
    ref={(el) => {
      wrapEl = el;
    }}
    style={{ "--dumb-board-cols": String(cols()), "--dumb-board-gap": `${gap()}px` }}
  >
        <For2 each={renderOrder()}>
          {(sid) => {
    const s = () => sectionById(sid);
    return <section
      class="dumb-board-panel"
      classList={{ held: heldSection() === sid, sizing: sizing() === sid }}
      data-board-section={sid}
      draggable={editable()}
      ref={(el) => panelEls.set(sid, el)}
      style={{ "grid-column": `span ${spanOf(s())}`, order: String(showOrder(sid)) }}
    >
              <Show2 when={s().title}>
                <h4
      class="dumb-board-head"
      data-board-handle
      onDblClick={() => editable() && toggleWide(s())}
    >
                  <Show2 when={editable()}><span class="dumb-board-grip">⠿</span></Show2>
                  <span class="dumb-board-title">
                    {s().title}
                    <Show2 when={s().subtitle}><span class="dumb-board-sub">{s().subtitle}</span></Show2>
                  </span>
                  <span class="dumb-board-count">{itemsOf(sid).length}</span>
                  <Show2 when={props.sectionActions}>
                    <span class="dumb-board-actions">{props.sectionActions(s())}</span>
                  </Show2>
                </h4>
              </Show2>

              <div
      class="dumb-board-zone"
      data-board-zone={sid}
      ref={(el) => {
        zoneEls.set(sid, el);
        sizes?.observe(el);
      }}
      style={{
        "--dumb-board-inner": String(colsIn(s())),
        "--dumb-board-row": `${rowH()}px`,
        "--dumb-board-zone-gap": `${zoneGap()}px`,
        // высота: заданная секцией либо по числу занятых строк. Строка
        // про запас — чтобы блоку было куда переезжать вниз
        height: `${spanSize(s().rows || rowsUsed(sid) + 1, rowH(), zoneGap())}px`
      }}
    >
                <Show2 when={editable() && showGrid() !== false}>
                  <div
      class="dumb-board-lines"
      aria-hidden="true"
      style={{
        ...linesOf(s()),
        opacity: gridVisible() ? "1" : "0"
      }}
    />
                </Show2>

                {
      /* Итерируем сами элементы, а не их id: иначе содержимое пришлось
         бы искать в массиве прямо в разметке, и оно зависело бы от
         всего массива — любая правка пересоздавала бы ВСЕ блоки. */
    }
                <For2 each={renderItemsOf(sid)}>
                  {(item) => {
      const at = () => cellOf(sid, props.id(item));
      return <div
        class="dumb-board-block"
        classList={{ held: held() === props.id(item) }}
        data-board-block={props.id(item)}
        draggable={editable()}
        ref={(el) => blockEls.set(props.id(item), el)}
        style={{
          // место ЯВНОЕ: браузер ничего не домысливает, поэтому
          // нарисованное совпадает с посчитанным для FLIP
          "grid-column": `${(at()?.col ?? 0) + 1} / span ${at()?.w ?? 1}`,
          "grid-row": `${(at()?.row ?? 0) + 1} / span ${at()?.h ?? 1}`
        }}
      >
                        {props.children(item, s())}

                        <Show2 when={editable() && props.onBlockResize}>
                          <span
        class="dumb-board-block-grip"
        data-board-block-resize={props.id(item)}
        draggable={false}
        title={props.labels?.resizeBlock ?? "\u041F\u043E\u0442\u044F\u043D\u0438, \u0447\u0442\u043E\u0431\u044B \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0440\u0430\u0437\u043C\u0435\u0440"}
      />
                        </Show2>
                      </div>;
    }}
                </For2>

                {
      /* Рамка будущего размера — тоже grid item: браузер сам ставит
         её в нужные ячейки, а перекрытие блока сетке не мешает. */
    }
                <Show2 when={blockFrame()?.sectionId === sid ? blockFrame() : null}>
                  {(f) => {
      const at = () => cellOf(sid, f().id);
      return <div
        class="dumb-board-frame"
        aria-hidden="true"
        style={{
          "grid-column": `${(at()?.col ?? 0) + 1} / span ${f().w}`,
          "grid-row": `${(at()?.row ?? 0) + 1} / span ${f().h}`
        }}
      />;
    }}
                </Show2>
              </div>

              <Show2 when={editable() && resizable()}>
                <div class="dumb-board-grip-x" data-board-resize={sid} data-axis="x" />
                <div class="dumb-board-grip-y" data-board-resize={sid} data-axis="y" />
                <div class="dumb-board-grip-xy" data-board-resize={sid} data-axis="xy" />
              </Show2>
            </section>;
  }}
        </For2>
      </div>

    </div>;
}
export {
  DumbBoard,
  moveAt,
  panelFlow
};
