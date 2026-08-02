import { delegateEvents, use, insert, createComponent, setAttribute, effect, style, memo, setStyleProperty, className, template } from 'solid-js/web';
import { createMemo, createSignal, createEffect, onCleanup, onMount, For, Show } from 'solid-js';

// src/DumbBoard.tsx

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
  const lineW = Math.max(1, line);
  const lineH = Math.max(1, line);
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
var _tmpl$ = /* @__PURE__ */ template(`<div><div class=dumb-board>`);
var _tmpl$2 = /* @__PURE__ */ template(`<span class=dumb-board-grip>\u283F`);
var _tmpl$3 = /* @__PURE__ */ template(`<span class=dumb-board-sub>`);
var _tmpl$4 = /* @__PURE__ */ template(`<span class=dumb-board-actions>`);
var _tmpl$5 = /* @__PURE__ */ template(`<h4 class=dumb-board-head data-board-handle><span class=dumb-board-title></span><span class=dumb-board-count>`);
var _tmpl$6 = /* @__PURE__ */ template(`<div class=dumb-board-lines aria-hidden=true>`);
var _tmpl$7 = /* @__PURE__ */ template(`<div class=dumb-board-grip-x data-axis=x>`);
var _tmpl$8 = /* @__PURE__ */ template(`<div class=dumb-board-grip-y data-axis=y>`);
var _tmpl$9 = /* @__PURE__ */ template(`<div class=dumb-board-grip-xy data-axis=xy>`);
var _tmpl$0 = /* @__PURE__ */ template(`<section class=dumb-board-panel><div class=dumb-board-zone>`);
var _tmpl$1 = /* @__PURE__ */ template(`<span class=dumb-board-block-grip>`);
var _tmpl$10 = /* @__PURE__ */ template(`<div class=dumb-board-block>`);
var _tmpl$11 = /* @__PURE__ */ template(`<div class=dumb-board-frame aria-hidden=true>`);
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
    const n = colsIn(s ?? sectionOf(props.id(item)) ?? {
      cols: 1
    });
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
  const ranked = createMemo(() => stableItems.sort(props.sections.flatMap((s) => s.items)));
  const renderItemsOf = (id) => {
    const own = new Set(itemsOf(id).map(props.id));
    return ranked().filter((it) => own.has(props.id(it)));
  };
  const places = createMemo(() => {
    const out = /* @__PURE__ */ new Map();
    for (const s of props.sections) s.items.forEach((it, k) => out.set(props.id(it), k));
    return out;
  });
  const placeOf = (item) => places().get(props.id(item)) ?? 0;
  const [held, setHeld] = createSignal(null);
  const [heldSection, setHeldSection] = createSignal(null);
  const [sizing, setSizing] = createSignal(null);
  const blockEls = /* @__PURE__ */ new Map();
  const zoneEls = /* @__PURE__ */ new Map();
  const panelEls = /* @__PURE__ */ new Map();
  let wrapEl;
  let zoneAt = {};
  let panelH = {};
  let wrapAt = {
    left: 0,
    top: 0
  };
  let colW = 0;
  const zoneW = {};
  const zonePad = {};
  let flip = createFlip(true);
  createEffect(() => {
    flip = createFlip(shouldAnimate(props.animate));
  });
  const scroller = createAutoScroller();
  onCleanup(() => scroller.stop());
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
        if (r) next[s.id] = {
          left: r.left,
          top: r.top
        };
      }
      zoneAt = next;
      for (const s of props.sections) {
        const r = rects.get(panelEls.get(s.id));
        if (r) panelH[s.id] = r.height;
      }
      const wr = rects.get(wrapEl);
      if (wr) wrapAt = {
        left: wr.left,
        top: wr.top
      };
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
      zonePad[id] = {
        left: e.contentRect.left,
        top: e.contentRect.top
      };
    }
  }) : null;
  onCleanup(() => sizes?.disconnect());
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
    onCleanup(() => ro.disconnect());
  });
  const cellsOf = createMemo(() => {
    const out = /* @__PURE__ */ new Map();
    for (const s of props.sections) {
      out.set(s.id, packFlow(s.items.map((it) => ({
        id: props.id(it),
        w: spanOfBlock(it, s),
        h: rowsOfBlock(it),
        minW: limitsOf(it, s).minW
      })), colsIn(s)));
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
    return {
      "background-image": bg.image,
      "background-size": bg.size
    };
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
    const pad = zonePad[sectionId] ?? {
      left: 0,
      top: 0
    };
    const left = origin.left + pad.left - (el?.scrollLeft ?? 0);
    const top = origin.top + pad.top - (el?.scrollTop ?? 0);
    const out = {};
    for (const p of placedIn(sectionId)) {
      const r = cellRect(p, m);
      out[p.id] = {
        left: left + r.x,
        top: top + r.y
      };
    }
    return out;
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
      if (s.id !== toSection) return {
        ...s,
        items: rest
      };
      const k = Math.max(0, Math.min(rest.length, toIndex));
      return {
        ...s,
        items: [...rest.slice(0, k), item, ...rest.slice(k)]
      };
    });
    props.setSections(next);
    props.onMove?.(item, toSection, toIndex);
    playBlocks(was);
  }
  const panelBoxes = (order) => order.map((s) => ({
    id: s.id,
    span: spanOf(s),
    height: panelH[s.id] ?? 0
  }));
  const flowOpts = () => ({
    cols: cols(),
    colW,
    gap: gap(),
    origin: wrapAt
  });
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
    const order = props.sections.map((x) => x.id === s.id ? {
      ...x,
      span
    } : x);
    playSections(order, () => {
      props.setSections(order);
      props.onSectionResize?.(s.id, {
        span,
        rows: s.rows ?? 0
      });
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
    props.setSections(props.sections.map((x) => x.id === d.id ? {
      ...x,
      span,
      rows
    } : x));
    props.onSectionResize?.(d.id, {
      span,
      rows
    });
  };
  const onGripUp = () => {
    if (!sizingFrom) return;
    sizingFrom = null;
    setSizing(null);
    measureWhenStill();
  };
  let blockSizingFrom = null;
  const [blockFrame, setBlockFrame] = createSignal(null);
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
    setBlockFrame({
      sectionId: section.id,
      id,
      w: blockSizingFrom.w,
      h: blockSizingFrom.h
    });
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
      start: {
        w: d.w,
        h: d.h
      },
      dx: ev.clientX - d.x,
      dy: ev.clientY - d.y,
      m: metricsOf(s),
      limits: limitsOf(item, s)
    });
    const now = blockFrame();
    if (now && now.w === next.w && now.h === next.h) return;
    setBlockFrame({
      sectionId: d.sectionId,
      id: d.id,
      w: next.w,
      h: next.h
    });
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
    props.onBlockResize?.(item, {
      w: frame.w,
      h: frame.h
    });
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
  return (() => {
    var _el$ = _tmpl$(), _el$2 = _el$.firstChild;
    _el$.addEventListener("drop", (ev) => {
      ev.preventDefault();
      finish();
    });
    _el$.addEventListener("dragend", finish);
    _el$.addEventListener("dragover", onDragOver);
    _el$.addEventListener("dragstart", onDragStart);
    _el$.addEventListener("pointercancel", () => {
      onGripUp();
      onBlockGripUp();
    });
    _el$.$$pointerup = (ev) => {
      onGripUp();
      onBlockGripUp();
    };
    _el$.$$pointermove = (ev) => {
      onGripMove(ev);
      onBlockGripMove(ev);
    };
    _el$.$$pointerdown = (ev) => {
      pressed = ev.target;
      onGripDown(ev);
      onBlockGripDown(ev);
    };
    use((el) => {
      wrapEl = el;
    }, _el$2);
    insert(_el$2, createComponent(For, {
      get each() {
        return renderOrder();
      },
      children: (sid) => {
        const s = () => sectionById(sid);
        return (() => {
          var _el$3 = _tmpl$0(), _el$0 = _el$3.firstChild;
          use((el) => panelEls.set(sid, el), _el$3);
          setAttribute(_el$3, "data-board-section", sid);
          insert(_el$3, createComponent(Show, {
            get when() {
              return s().title;
            },
            get children() {
              var _el$4 = _tmpl$5(), _el$6 = _el$4.firstChild, _el$8 = _el$6.nextSibling;
              _el$4.$$dblclick = () => editable() && toggleWide(s());
              insert(_el$4, createComponent(Show, {
                get when() {
                  return editable();
                },
                get children() {
                  return _tmpl$2();
                }
              }), _el$6);
              insert(_el$6, () => s().title, null);
              insert(_el$6, createComponent(Show, {
                get when() {
                  return s().subtitle;
                },
                get children() {
                  var _el$7 = _tmpl$3();
                  insert(_el$7, () => s().subtitle);
                  return _el$7;
                }
              }), null);
              insert(_el$8, () => itemsOf(sid).length);
              insert(_el$4, createComponent(Show, {
                get when() {
                  return props.sectionActions;
                },
                get children() {
                  var _el$9 = _tmpl$4();
                  insert(_el$9, () => props.sectionActions(s()));
                  return _el$9;
                }
              }), null);
              return _el$4;
            }
          }), _el$0);
          use((el) => {
            zoneEls.set(sid, el);
            sizes?.observe(el);
          }, _el$0);
          setAttribute(_el$0, "data-board-zone", sid);
          insert(_el$0, createComponent(Show, {
            get when() {
              return memo(() => !!editable())() && showGrid() !== false;
            },
            get children() {
              var _el$1 = _tmpl$6();
              effect((_$p) => style(_el$1, {
                ...linesOf(s()),
                opacity: gridVisible() ? "1" : "0"
              }, _$p));
              return _el$1;
            }
          }), null);
          insert(_el$0, createComponent(For, {
            get each() {
              return renderItemsOf(sid);
            },
            children: (item) => {
              const at = () => cellOf(sid, props.id(item));
              return (() => {
                var _el$13 = _tmpl$10();
                use((el) => blockEls.set(props.id(item), el), _el$13);
                insert(_el$13, () => props.children(item, s()), null);
                insert(_el$13, createComponent(Show, {
                  get when() {
                    return memo(() => !!editable())() && props.onBlockResize;
                  },
                  get children() {
                    var _el$14 = _tmpl$1();
                    setAttribute(_el$14, "draggable", false);
                    effect((_p$) => {
                      var _v$12 = props.id(item), _v$13 = props.labels?.resizeBlock ?? "\u041F\u043E\u0442\u044F\u043D\u0438, \u0447\u0442\u043E\u0431\u044B \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0440\u0430\u0437\u043C\u0435\u0440";
                      _v$12 !== _p$.e && setAttribute(_el$14, "data-board-block-resize", _p$.e = _v$12);
                      _v$13 !== _p$.t && setAttribute(_el$14, "title", _p$.t = _v$13);
                      return _p$;
                    }, {
                      e: void 0,
                      t: void 0
                    });
                    return _el$14;
                  }
                }), null);
                effect((_p$) => {
                  var _v$14 = !!(held() === props.id(item)), _v$15 = props.id(item), _v$16 = editable(), _v$17 = `${(at()?.col ?? 0) + 1} / span ${at()?.w ?? 1}`, _v$18 = `${(at()?.row ?? 0) + 1} / span ${at()?.h ?? 1}`;
                  _v$14 !== _p$.e && _el$13.classList.toggle("held", _p$.e = _v$14);
                  _v$15 !== _p$.t && setAttribute(_el$13, "data-board-block", _p$.t = _v$15);
                  _v$16 !== _p$.a && setAttribute(_el$13, "draggable", _p$.a = _v$16);
                  _v$17 !== _p$.o && setStyleProperty(_el$13, "grid-column", _p$.o = _v$17);
                  _v$18 !== _p$.i && setStyleProperty(_el$13, "grid-row", _p$.i = _v$18);
                  return _p$;
                }, {
                  e: void 0,
                  t: void 0,
                  a: void 0,
                  o: void 0,
                  i: void 0
                });
                return _el$13;
              })();
            }
          }), null);
          insert(_el$0, createComponent(Show, {
            get when() {
              return memo(() => blockFrame()?.sectionId === sid)() ? blockFrame() : null;
            },
            children: (f) => {
              const at = () => cellOf(sid, f().id);
              return (() => {
                var _el$15 = _tmpl$11();
                effect((_p$) => {
                  var _v$19 = `${(at()?.col ?? 0) + 1} / span ${f().w}`, _v$20 = `${(at()?.row ?? 0) + 1} / span ${f().h}`;
                  _v$19 !== _p$.e && setStyleProperty(_el$15, "grid-column", _p$.e = _v$19);
                  _v$20 !== _p$.t && setStyleProperty(_el$15, "grid-row", _p$.t = _v$20);
                  return _p$;
                }, {
                  e: void 0,
                  t: void 0
                });
                return _el$15;
              })();
            }
          }), null);
          insert(_el$3, createComponent(Show, {
            get when() {
              return memo(() => !!editable())() && resizable();
            },
            get children() {
              return [(() => {
                var _el$10 = _tmpl$7();
                setAttribute(_el$10, "data-board-resize", sid);
                return _el$10;
              })(), (() => {
                var _el$11 = _tmpl$8();
                setAttribute(_el$11, "data-board-resize", sid);
                return _el$11;
              })(), (() => {
                var _el$12 = _tmpl$9();
                setAttribute(_el$12, "data-board-resize", sid);
                return _el$12;
              })()];
            }
          }), null);
          effect((_p$) => {
            var _v$5 = !!(heldSection() === sid), _v$6 = !!(sizing() === sid), _v$7 = editable(), _v$8 = `span ${spanOf(s())}`, _v$9 = String(showOrder(sid)), _v$0 = String(colsIn(s())), _v$1 = `${rowH()}px`, _v$10 = `${zoneGap()}px`, _v$11 = `${spanSize(s().rows || rowsUsed(sid) + 1, rowH(), zoneGap())}px`;
            _v$5 !== _p$.e && _el$3.classList.toggle("held", _p$.e = _v$5);
            _v$6 !== _p$.t && _el$3.classList.toggle("sizing", _p$.t = _v$6);
            _v$7 !== _p$.a && setAttribute(_el$3, "draggable", _p$.a = _v$7);
            _v$8 !== _p$.o && setStyleProperty(_el$3, "grid-column", _p$.o = _v$8);
            _v$9 !== _p$.i && setStyleProperty(_el$3, "order", _p$.i = _v$9);
            _v$0 !== _p$.n && setStyleProperty(_el$0, "--dumb-board-inner", _p$.n = _v$0);
            _v$1 !== _p$.s && setStyleProperty(_el$0, "--dumb-board-row", _p$.s = _v$1);
            _v$10 !== _p$.h && setStyleProperty(_el$0, "--dumb-board-zone-gap", _p$.h = _v$10);
            _v$11 !== _p$.r && setStyleProperty(_el$0, "height", _p$.r = _v$11);
            return _p$;
          }, {
            e: void 0,
            t: void 0,
            a: void 0,
            o: void 0,
            i: void 0,
            n: void 0,
            s: void 0,
            h: void 0,
            r: void 0
          });
          return _el$3;
        })();
      }
    }));
    effect((_p$) => {
      var _v$ = props.class, _v$2 = props.style, _v$3 = String(cols()), _v$4 = `${gap()}px`;
      _v$ !== _p$.e && className(_el$, _p$.e = _v$);
      _p$.t = style(_el$, _v$2, _p$.t);
      _v$3 !== _p$.a && setStyleProperty(_el$2, "--dumb-board-cols", _p$.a = _v$3);
      _v$4 !== _p$.o && setStyleProperty(_el$2, "--dumb-board-gap", _p$.o = _v$4);
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
delegateEvents(["pointerdown", "pointermove", "pointerup", "dblclick"]);

export { DumbBoard, moveAt, panelFlow };
