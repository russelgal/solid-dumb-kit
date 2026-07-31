import { delegateEvents, use, insert, createComponent, effect, setStyleProperty, memo, setAttribute, className, style, template } from 'solid-js/web';
import { createSignal, onCleanup, createMemo, Show, For } from 'solid-js';
import { makePersisted } from '@solid-primitives/storage';
import * as v from 'valibot';

// src/DumbGrid.tsx

// src/gridMath.ts
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
function placeFree(items, cols) {
  const c = Math.max(1, Math.floor(cols));
  const grid = createOccupancy();
  const out = [];
  for (const it of items) {
    const w = clamp(Math.round(it.w) || 1, 1, c);
    const h = Math.max(1, Math.round(it.h) || 1);
    const hasPos = Number.isFinite(it.x) && Number.isFinite(it.y);
    const wantCol = hasPos ? clamp(Math.round(it.x), 0, c - w) : 0;
    const wantRow = hasPos ? Math.max(0, Math.round(it.y)) : 0;
    const spot = grid.free(wantCol, wantRow, w, h) ? { col: wantCol, row: wantRow } : grid.findFrom(hasPos ? wantCol : 0, wantRow, w, h, c);
    grid.take(spot.col, spot.row, w, h);
    out.push({ id: it.id, w, h, col: spot.col, row: spot.row });
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
function insertIndex(args) {
  const { base, dragId, m, pointerX, pointerY } = args;
  let k = 0;
  for (const p of base) {
    if (p.id === dragId) continue;
    const r = cellRect(p, m);
    if (pointerY > r.y + r.height) k++;
    else if (pointerY >= r.y && pointerX > r.x + r.width / 2) k++;
  }
  return k;
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
function pointToCell(args) {
  const { x, y, w, m } = args;
  const stepX = m.colW + m.gapX;
  const stepY = m.rowH + m.gapY;
  const col = stepX > 0 ? Math.round(x / stepX) : 0;
  const row = stepY > 0 ? Math.round(y / stepY) : 0;
  return {
    col: clamp(col, 0, Math.max(0, m.cols - w)),
    row: Math.max(0, row)
  };
}
function firstFreeCell(args) {
  const { placed, cols, w, h } = args;
  const c = Math.max(1, Math.floor(cols));
  const width = clamp(Math.round(w) || 1, 1, c);
  const height = Math.max(1, Math.round(h) || 1);
  const grid = createOccupancy();
  for (const p of placed) grid.take(p.col, p.row, p.w, p.h);
  const spot = grid.findFrom(0, 0, width, height, c);
  return { x: spot.col, y: spot.row };
}
function overlaps(args) {
  const { placed, id, col, row, w, h } = args;
  for (const p of placed) {
    if (p.id === id) continue;
    if (col < p.col + p.w && p.col < col + w && row < p.row + p.h && p.row < row + h) return true;
  }
  return false;
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
function fitSpan(args) {
  const { placed, id, col, row, want, limits } = args;
  const minW = Math.max(1, limits?.minW ?? 1);
  const minH = Math.max(1, limits?.minH ?? 1);
  let w = Math.max(minW, want.w);
  let h = Math.max(minH, want.h);
  while (w > minW && overlaps({ placed, id, col, row, w, h })) w--;
  while (h > minH && overlaps({ placed, id, col, row, w, h })) h--;
  return { w, h };
}

// ../shared/dist/index.js
function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function shouldAnimate(explicit) {
  if (explicit !== void 0) return explicit;
  return !prefersReducedMotion();
}
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
var NO_DRAG = 'input, textarea, select, option, button, a, label, [contenteditable=""], [contenteditable="true"], [data-no-drag]';
function targetIsInteractive(ev) {
  return ev.target instanceof Element && !!ev.target.closest(NO_DRAG);
}
function focusInside(el) {
  const active = document.activeElement;
  return !!active && active !== document.body && active !== el && el.contains(active);
}
var LONGPRESS = 350;
var MOVE_TOL = 10;
function createPressGate(opts = {}) {
  const pressDelay = opts.pressDelay ?? LONGPRESS;
  const mousePress = opts.mousePressDelay ?? 0;
  const mouseThresh = opts.mouseThreshold ?? 0;
  let wait = null;
  const clear = () => {
    if (!wait) return;
    if (wait.timer) clearTimeout(wait.timer);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onCancel);
    window.removeEventListener("pointercancel", onCancel);
    wait = null;
  };
  const listen = () => {
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onCancel);
    window.addEventListener("pointercancel", onCancel);
  };
  function onMove(ev) {
    if (!wait || ev.pointerId !== wait.pid) return;
    const moved = Math.abs(ev.clientX - wait.x) > wait.thresh || Math.abs(ev.clientY - wait.y) > wait.thresh;
    if (!moved) return;
    if (wait.mode === "press") {
      clear();
      return;
    }
    const w = wait;
    clear();
    w.start(ev.clientX, ev.clientY);
  }
  function onCancel(ev) {
    if (wait && ev.pointerId === wait.pid) clear();
  }
  return {
    arm(ev, start) {
      if (wait) return;
      const touch = ev.pointerType === "touch";
      const delay = touch ? pressDelay : mousePress;
      if (delay > 0) {
        wait = { pid: ev.pointerId, x: ev.clientX, y: ev.clientY, timer: 0, mode: "press", thresh: MOVE_TOL, start };
        wait.timer = setTimeout(() => {
          const w = wait;
          clear();
          if (w) {
            if (touch) navigator.vibrate?.(8);
            w.start(w.x, w.y);
          }
        }, delay);
        listen();
        return;
      }
      if (!touch && mouseThresh > 0) {
        wait = { pid: ev.pointerId, x: ev.clientX, y: ev.clientY, timer: 0, mode: "dist", thresh: mouseThresh, start };
        listen();
        return;
      }
      ev.preventDefault();
      start(ev.clientX, ev.clientY);
    },
    pending: () => wait !== null,
    cancel: clear
  };
}

// src/gridCore.ts
var SLIDE = "transform .18s cubic-bezier(.2,.8,.2,1)";
var LIFT_SHADOW = "0 12px 28px -8px rgba(0,0,0,.32)";
var PREVIEW_BG = "rgba(59,130,246,.10)";
var PREVIEW_LINE = "2px dashed rgba(59,130,246,.85)";
var BLOCKED_BG = "rgba(239,68,68,.10)";
var BLOCKED_LINE = "2px dashed rgba(239,68,68,.85)";
var ACTIVE_Z = 3;
var PREVIEW_Z = 5;
function createGridEngine(opts) {
  const blockEls = /* @__PURE__ */ new Map();
  let container = null;
  let ro = null;
  let contentW = 0;
  let padLeft = 0;
  let padTop = 0;
  let gesture = null;
  let activeState = null;
  const setActive = (state) => {
    activeState = state;
    opts.onActive?.(state);
  };
  const metrics = () => {
    const cols = Math.max(1, Math.floor(opts.cols()));
    const gapX = opts.gapX();
    return { cols, colW: colWidth(contentW, cols, gapX), rowH: opts.rowHeight(), gapX, gapY: opts.gapY() };
  };
  const modeNow = () => opts.mode?.() ?? "flow";
  const place = (blocks, mode, cols) => mode === "free" ? placeFree(blocks, cols) : packFlow(blocks, cols, mode);
  function shift(g) {
    const { sx, sy } = scrollOf(g.scroller);
    const dx = sx - g.sx0 + (g.scroller ? window.scrollX - g.win0X : 0);
    const dy = sy - g.sy0 + (g.scroller ? window.scrollY - g.win0Y : 0);
    return { dx, dy, sy };
  }
  function snapOrigin(cb) {
    const el = container;
    if (!el || typeof IntersectionObserver !== "function") {
      cb(null);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      io.disconnect();
      cb(entries.length ? entries[0].boundingClientRect : null);
    });
    io.observe(el);
  }
  function slide(g, moves) {
    for (const mv of moves) {
      const el = blockEls.get(mv.id);
      if (!el || el === g.el) continue;
      if (!mv.dx && !mv.dy) {
        if (g.touched.has(el)) el.style.transform = "";
        continue;
      }
      if (!g.touched.has(el)) {
        g.touched.add(el);
        el.style.willChange = "transform";
        if (!shouldAnimate(opts.animate)) {
          el.style.transform = `translate(${mv.dx}px,${mv.dy}px)`;
          continue;
        }
        el.style.transition = SLIDE;
        continue;
      }
      el.style.transform = `translate(${mv.dx}px,${mv.dy}px)`;
    }
  }
  function resetStyles(g) {
    const reset = (el) => {
      el.style.transition = "";
      el.style.transform = "";
      el.style.zIndex = "";
      el.style.willChange = "";
      el.style.boxShadow = "";
      el.style.opacity = "";
      el.style.cursor = "";
    };
    reset(g.el);
    for (const el of g.touched) reset(el);
    g.preview?.remove();
    g.preview = null;
  }
  function showPreview(g, rect, blocked = false) {
    if (!container) return;
    if (!g.preview) {
      const box = document.createElement("div");
      box.style.cssText = [
        "position:absolute",
        "pointer-events:none",
        "box-sizing:border-box",
        "border-radius:10px",
        `z-index:${PREVIEW_Z}`,
        "outline-offset:-2px",
        "transition:background .12s ease, outline-color .12s ease"
      ].join(";");
      box.dataset.gridPreview = "";
      container.appendChild(box);
      g.preview = box;
    }
    g.preview.dataset.blocked = blocked ? "" : void 0;
    g.preview.style.background = blocked ? BLOCKED_BG : PREVIEW_BG;
    g.preview.style.outline = blocked ? BLOCKED_LINE : PREVIEW_LINE;
    g.preview.style.width = `${rect.width}px`;
    g.preview.style.height = `${rect.height}px`;
    g.preview.style.transform = `translate(${padLeft + rect.x}px,${padTop + rect.y}px)`;
  }
  function previewFree(g) {
    const me = g.base.find((p) => p.id === g.id);
    if (!me) return;
    showPreview(g, cellRect({ ...me, col: g.cell.col, row: g.cell.row, ...g.span }, g.m), g.blocked);
  }
  function frame() {
    if (!gesture) return;
    const g = gesture;
    if (g.kind === "move") {
      const s = shift(g);
      if (g.moved) {
        const speed = autoScrollSpeed({
          pointerY: g.lastY,
          // позиция скроллера во вьюпорте сейчас — арифметикой от снятой,
          // а не свежим getBoundingClientRect
          viewTop: g.scroller ? viewOrigin(g.geom, window.scrollX, window.scrollY).top : 0,
          clientH: g.geom.clientH,
          scrollY: s.sy,
          scrollMax: g.geom.max
        });
        if (speed) doScroll(g.scroller, 0, speed);
      }
      const d = shift(g);
      g.el.style.transform = `translate(${g.lastX - g.startX + d.dx}px,${g.lastY - g.startY + d.dy}px)`;
      if (!g.ready) {
        g.raf = requestAnimationFrame(frame);
        return;
      }
      if (g.mode === "free") {
        const me = g.base.find((p) => p.id === g.id);
        if (!me) {
          g.raf = requestAnimationFrame(frame);
          return;
        }
        const at = cellRect(me, g.m);
        const cell = pointToCell({
          x: at.x + (g.lastX - g.startX + d.dx),
          y: at.y + (g.lastY - g.startY + d.dy),
          w: g.span.w,
          m: g.m
        });
        const blocked = overlaps({ placed: g.base, id: g.id, ...cell, ...g.span });
        if (cell.col !== g.cell.col || cell.row !== g.cell.row || blocked !== g.blocked) {
          g.cell = cell;
          g.blocked = blocked;
          previewFree(g);
        }
      } else {
        const pX = g.lastX - (g.gridLeft - d.dx);
        const pY = g.lastY - (g.gridTop - d.dy);
        const k = insertIndex({ base: g.base, dragId: g.id, m: g.m, pointerX: pX, pointerY: pY });
        if (k !== g.toIndex) {
          g.toIndex = k;
          const next = packFlow(reorder(g.blocks, g.fromIndex, k), g.m.cols, g.mode);
          slide(g, moveDeltas({ base: g.base, next, m: g.m, skipId: g.id }));
        }
      }
    } else if (g.ready) {
      const d = shift(g);
      const dx = g.lastX - g.startX + d.dx;
      const dy = g.lastY - g.startY + d.dy;
      const limits = g.blocks[g.fromIndex];
      const want = snapSpan({ start: { w: limits.w, h: limits.h }, dx, dy, m: g.m, limits });
      const span = g.mode === "free" ? fitSpan({ placed: g.base, id: g.id, ...g.cell, want, limits }) : want;
      if (span.w !== g.span.w || span.h !== g.span.h) {
        g.span = span;
        if (g.mode === "free") {
          previewFree(g);
        } else {
          const resized = g.blocks.map((b, i) => i === g.fromIndex ? { ...b, ...span } : b);
          const next = packFlow(resized, g.m.cols, g.mode);
          slide(g, moveDeltas({ base: g.base, next, m: g.m, skipId: g.id }));
          const me = next.find((p) => p.id === g.id);
          if (me) showPreview(g, cellRect(me, g.m));
        }
      }
    }
    g.raf = requestAnimationFrame(frame);
  }
  function onMove(ev) {
    if (!gesture || ev.pointerId !== gesture.pid) return;
    if (!gesture.moved && (Math.abs(ev.clientX - gesture.startX) > 2 || Math.abs(ev.clientY - gesture.startY) > 2)) {
      gesture.moved = true;
    }
    gesture.lastX = ev.clientX;
    gesture.lastY = ev.clientY;
  }
  function detach() {
    restoreTextSelection();
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  }
  function cleanup() {
    if (!gesture) return;
    const g = gesture;
    if (g.raf) cancelAnimationFrame(g.raf);
    detach();
    resetStyles(g);
    gesture = null;
    setActive(null);
  }
  function land(g, done) {
    const from = g.base.find((p) => p.id === g.id);
    const to = g.mode === "free" ? from && !g.blocked ? { ...from, col: g.cell.col, row: g.cell.row } : from : place(reorder(g.blocks, g.fromIndex, g.toIndex), g.mode, g.m.cols).find((p) => p.id === g.id);
    if (!shouldAnimate(opts.animate) || !from || !to) {
      done();
      return;
    }
    const a = cellRect(from, g.m);
    const b = cellRect(to, g.m);
    const el = g.el;
    el.style.transition = SLIDE;
    el.style.transform = `translate(${b.x - a.x}px,${b.y - a.y}px)`;
    let fired = false;
    const finish = () => {
      if (fired) return;
      fired = true;
      el.removeEventListener("transitionend", finish);
      done();
    };
    el.addEventListener("transitionend", finish);
    setTimeout(finish, 240);
  }
  function onUp(ev) {
    if (!gesture || ev.pointerId !== gesture.pid) return;
    const g = gesture;
    const { kind, mode, id, fromIndex, toIndex, span, ready } = g;
    if (kind === "resize") {
      const before = g.blocks[fromIndex];
      cleanup();
      if (ready && before && (span.w !== before.w || span.h !== before.h)) opts.onResize(id, span.w, span.h);
      return;
    }
    if (mode === "free") {
      const home = g.base.find((p) => p.id === id);
      const moved = !!home && (g.cell.col !== home.col || g.cell.row !== home.row);
      if (!ready || g.blocked || !moved) {
        cleanup();
        return;
      }
      detach();
      if (g.raf) cancelAnimationFrame(g.raf);
      gesture = null;
      setActive(null);
      land(g, () => {
        resetStyles(g);
        opts.onMove?.(id, g.cell.col, g.cell.row);
      });
      return;
    }
    if (!ready || toIndex === fromIndex) {
      cleanup();
      return;
    }
    detach();
    if (g.raf) cancelAnimationFrame(g.raf);
    gesture = null;
    setActive(null);
    land(g, () => {
      resetStyles(g);
      opts.onReorder(fromIndex, toIndex);
    });
  }
  function begin(kind, id, handle, pid, x, y) {
    const el = blockEls.get(id);
    if (!el || !container) return;
    if (kind === "move" && handle === el && focusInside(el)) return;
    const blocks = opts.blocks();
    const fromIndex = blocks.findIndex((b) => b.id === id);
    if (fromIndex < 0 || blocks[fromIndex].locked) return;
    const m = metrics();
    if (!m.colW) return;
    const mode = modeNow();
    const base = place(blocks, mode, m.cols);
    const home = base.find((p) => p.id === id);
    const scroller = scrollParent(el);
    const geom = measure(scroller);
    const s0 = scrollOf(scroller);
    gesture = {
      kind,
      mode,
      id,
      pid,
      el,
      startX: x,
      startY: y,
      lastX: x,
      lastY: y,
      blocks,
      base,
      m,
      fromIndex,
      toIndex: fromIndex,
      span: { w: blocks[fromIndex].w, h: blocks[fromIndex].h },
      cell: { col: home?.col ?? 0, row: home?.row ?? 0 },
      blocked: false,
      scroller,
      geom,
      sx0: s0.sx,
      sy0: s0.sy,
      win0X: window.scrollX,
      win0Y: window.scrollY,
      gridLeft: 0,
      gridTop: 0,
      ready: false,
      moved: false,
      raf: 0,
      touched: /* @__PURE__ */ new Set(),
      preview: null
    };
    setActive({ id, kind });
    el.style.zIndex = `${ACTIVE_Z}`;
    el.style.willChange = "transform";
    el.style.transition = "box-shadow .15s ease, opacity .15s ease";
    if (kind === "move") {
      el.style.boxShadow = LIFT_SHADOW;
      el.style.opacity = "0.97";
      el.style.cursor = "grabbing";
    }
    suppressTextSelection();
    snapOrigin((rect) => {
      if (!gesture || gesture.id !== id || gesture.pid !== pid) return;
      if (rect) {
        const d = shift(gesture);
        gesture.gridLeft = rect.left + padLeft + d.dx;
        gesture.gridTop = rect.top + padTop + d.dy;
      }
      gesture.ready = true;
      if (gesture.kind === "resize" || gesture.mode === "free") previewFree(gesture);
    });
    try {
      handle.setPointerCapture(pid);
    } catch {
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    gesture.raf = requestAnimationFrame(frame);
  }
  const gate = createPressGate(opts);
  function canStart() {
    return !opts.disabled?.() && !gesture && !gate.pending();
  }
  return {
    attachContainer(el) {
      container = el;
      if (typeof ResizeObserver === "function") {
        ro = new ResizeObserver((entries) => {
          const r = entries[entries.length - 1]?.contentRect;
          if (!r) return;
          contentW = r.width;
          padLeft = r.left;
          padTop = r.top;
        });
        ro.observe(el);
      }
      return () => {
        ro?.disconnect();
        ro = null;
        if (container === el) container = null;
      };
    },
    attach(el, id) {
      blockEls.set(id, el);
      el.dataset.gridBlock = id;
      const down = (ev) => {
        if (ev.button !== 0 || !canStart()) return;
        if (!(ev.target instanceof Element)) return;
        if (ev.target.closest("[data-grid-resize]")) return;
        if (ev.target.closest("[data-flip-id]")) return;
        const nested = ev.target.closest("[data-grid-block]");
        if (nested && nested !== el) return;
        const handle2 = el.querySelector("[data-drag-handle]");
        if (handle2) {
          if (!(ev.target instanceof Node && handle2.contains(ev.target))) return;
        } else if (targetIsInteractive(ev)) {
          return;
        }
        gate.arm(ev, (x, y) => begin("move", id, handle2 || el, ev.pointerId, x, y));
      };
      el.addEventListener("pointerdown", down);
      const handle = el.querySelector("[data-drag-handle]");
      if (handle) handle.style.touchAction = "none";
      return () => {
        el.removeEventListener("pointerdown", down);
        delete el.dataset.gridBlock;
        if (blockEls.get(id) === el) blockEls.delete(id);
      };
    },
    attachResize(el, id) {
      el.dataset.gridResize = "";
      el.style.touchAction = "none";
      const down = (ev) => {
        if (ev.button !== 0 || !canStart() || opts.resizable?.() === false) return;
        ev.stopPropagation();
        ev.preventDefault();
        begin("resize", id, el, ev.pointerId, ev.clientX, ev.clientY);
      };
      el.addEventListener("pointerdown", down);
      return () => el.removeEventListener("pointerdown", down);
    },
    colWidth: () => metrics().colW,
    active: () => activeState,
    destroy() {
      gate.cancel();
      cleanup();
      ro?.disconnect();
      ro = null;
      container = null;
      blockEls.clear();
    }
  };
}

// src/gridGroup.ts
var SLIDE2 = "transform .18s cubic-bezier(.2,.8,.2,1)";
var LIFT_SHADOW2 = "0 12px 28px -8px rgba(0,0,0,.35)";
var PREVIEW_BG2 = "rgba(59,130,246,.10)";
var PREVIEW_LINE2 = "2px dashed rgba(59,130,246,.85)";
var BLOCKED_BG2 = "rgba(239,68,68,.10)";
var BLOCKED_LINE2 = "2px dashed rgba(239,68,68,.85)";
var PREVIEW_Z2 = 5;
var GHOST_STYLE_ID = "dumb-grid-ghost";
var canPopover = () => typeof HTMLElement !== "undefined" && typeof HTMLElement.prototype.showPopover === "function";
function injectGhostReset() {
  if (typeof document === "undefined" || document.getElementById(GHOST_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = GHOST_STYLE_ID;
  style.textContent = `@layer dumb-grid {
  [data-dumb-grid-ghost]:popover-open {
    position: fixed; inset: auto; margin: 0; padding: 0; border: 0;
    background: transparent; color: inherit; overflow: visible;
  }
}`;
  document.head.appendChild(style);
}
function makeGhost(src, r) {
  const ghost = src.cloneNode(true);
  ghost.setAttribute("data-dumb-grid-ghost", "");
  ghost.removeAttribute("id");
  src.insertAdjacentElement("afterend", ghost);
  if (canPopover()) {
    ghost.setAttribute("popover", "manual");
    try {
      ghost.showPopover();
    } catch {
    }
  }
  ghost.style.viewTransitionName = "none";
  ghost.style.boxSizing = "border-box";
  ghost.style.position = "fixed";
  ghost.style.margin = "0";
  ghost.style.top = `${r.top}px`;
  ghost.style.left = `${r.left}px`;
  ghost.style.width = `${r.width}px`;
  ghost.style.height = `${r.height}px`;
  ghost.style.zIndex = "9999";
  ghost.style.pointerEvents = "none";
  ghost.style.willChange = "transform";
  ghost.style.boxShadow = LIFT_SHADOW2;
  ghost.style.cursor = "grabbing";
  for (const el of Array.from(ghost.querySelectorAll("[data-grid-resize],[data-grid-remove]"))) el.remove();
  return ghost;
}
function createGridGroupEngine(opts) {
  const zones = /* @__PURE__ */ new Map();
  let drag = null;
  let activeState = null;
  let overName = null;
  const setActive = (s) => {
    activeState = s;
    opts.onActive?.(s);
  };
  const setOver = (name) => {
    if (overName === name) return;
    overName = name;
    opts.onOver?.(name);
  };
  const metricsOf = (z) => {
    const cols = Math.max(1, Math.floor(z.opts.cols()));
    const gapX = z.opts.gapX();
    return { cols, colW: colWidth(z.contentW, cols, gapX), rowH: z.opts.rowHeight(), gapX, gapY: z.opts.gapY() };
  };
  const placeOf = (blocks, mode, cols) => mode === "free" ? placeFree(blocks, cols) : packFlow(blocks, cols, mode);
  function snapshot(cb) {
    const out = /* @__PURE__ */ new Map();
    const targets = [];
    for (const z of zones.values()) if (z.el) targets.push(z.el);
    if (!targets.length || typeof IntersectionObserver !== "function") {
      cb(out);
      return;
    }
    let batches = 0;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) out.set(e.target, e.boundingClientRect);
      batches++;
      if (out.size < targets.length && batches < 4) return;
      io.disconnect();
      cb(out);
    });
    for (const t of targets) io.observe(t);
  }
  function buildSnaps(rects) {
    const snaps = /* @__PURE__ */ new Map();
    for (const z of zones.values()) {
      if (!z.el) continue;
      const scroller = scrollParent(z.el, true);
      const geom = measure(scroller);
      const s0 = scrollOf(scroller);
      const box = rects.get(z.el);
      const mode = z.opts.mode?.() ?? "flow";
      const m = metricsOf(z);
      const blocks = z.opts.blocks();
      snaps.set(z.name, {
        name: z.name,
        m,
        mode,
        blocks,
        base: placeOf(blocks, mode, m.cols),
        padLeft: z.padLeft,
        padTop: z.padTop,
        // Прямоугольник не пришёл — зона просто не участвует в хиттесте
        // (нулевой размер). Подставлять сюда геометрию скроллера нельзя: для
        // страницы это весь экран, и такая зона перехватывала бы все дропы.
        boxTop: box ? box.top : 0,
        boxLeft: box ? box.left : 0,
        boxW: box ? box.width : 0,
        boxH: box ? box.height : 0,
        boxWinX: window.scrollX,
        boxWinY: window.scrollY,
        scroller,
        geom,
        sx0: s0.sx,
        sy0: s0.sy
      });
    }
    return snaps;
  }
  function boxOf(z) {
    const s = scrollOf(z.scroller);
    const dx = window.scrollX - z.boxWinX + (z.scroller ? s.sx - z.sx0 : 0);
    const dy = window.scrollY - z.boxWinY + (z.scroller ? s.sy - z.sy0 : 0);
    return { left: z.boxLeft - dx, top: z.boxTop - dy, right: z.boxLeft - dx + z.boxW, bottom: z.boxTop - dy + z.boxH };
  }
  function zoneAt(d, x, y) {
    for (const z of d.zones.values()) {
      if (!z.boxW || !z.boxH) continue;
      const b = boxOf(z);
      if (x < b.left || x > b.right || y < b.top || y > b.bottom) continue;
      if (z.name !== d.fromZone) {
        const accepts = zones.get(z.name)?.opts.accepts;
        if (accepts && !accepts(d.fromZone)) continue;
      }
      return z.name;
    }
    return d.target;
  }
  function pointIn(z, x, y) {
    const b = boxOf(z);
    return { x: x - b.left - z.padLeft, y: y - b.top - z.padTop };
  }
  function slide(d, moves, zoneName) {
    const zone = zones.get(zoneName);
    if (!zone) return;
    for (const mv of moves) {
      const el = zone.els.get(mv.id);
      if (!el || el === d.el) continue;
      if (!mv.dx && !mv.dy) {
        if (d.touched.has(el)) el.style.transform = "";
        continue;
      }
      if (!d.touched.has(el)) {
        d.touched.add(el);
        el.style.willChange = "transform";
        if (!shouldAnimate(opts.animate)) {
          el.style.transform = `translate(${mv.dx}px,${mv.dy}px)`;
          continue;
        }
        el.style.transition = SLIDE2;
        continue;
      }
      el.style.transform = `translate(${mv.dx}px,${mv.dy}px)`;
    }
  }
  function calmDown(d) {
    for (const el of d.touched) el.style.transform = "";
  }
  function showPreview(d, zoneName, rect, blocked) {
    const zone = zones.get(zoneName);
    const snap = d.zones.get(zoneName);
    if (!zone?.el || !snap) return;
    if (d.preview && d.previewZone !== zoneName) {
      d.preview.remove();
      d.preview = null;
    }
    if (!d.preview) {
      const box = document.createElement("div");
      box.style.cssText = [
        "position:absolute",
        "pointer-events:none",
        "box-sizing:border-box",
        "border-radius:10px",
        `z-index:${PREVIEW_Z2}`,
        "outline-offset:-2px",
        "transition:background .12s ease, outline-color .12s ease"
      ].join(";");
      box.dataset.gridPreview = "";
      zone.el.appendChild(box);
      d.preview = box;
      d.previewZone = zoneName;
    }
    d.preview.dataset.blocked = blocked ? "" : void 0;
    d.preview.style.background = blocked ? BLOCKED_BG2 : PREVIEW_BG2;
    d.preview.style.outline = blocked ? BLOCKED_LINE2 : PREVIEW_LINE2;
    d.preview.style.width = `${rect.width}px`;
    d.preview.style.height = `${rect.height}px`;
    d.preview.style.transform = `translate(${snap.padLeft + rect.x}px,${snap.padTop + rect.y}px)`;
  }
  function resetStyles(d) {
    const reset = (el) => {
      el.style.transition = "";
      el.style.transform = "";
      el.style.zIndex = "";
      el.style.willChange = "";
      el.style.boxShadow = "";
      el.style.opacity = "";
      el.style.cursor = "";
    };
    reset(d.el);
    for (const el of d.touched) reset(el);
    d.preview?.remove();
    d.preview = null;
    d.previewZone = null;
    d.ghost?.remove();
    d.ghost = null;
  }
  function frame() {
    if (!drag) return;
    const d = drag;
    if (d.kind === "resize") {
      if (d.ready) resizeFrame(d);
      d.raf = requestAnimationFrame(frame);
      return;
    }
    if (d.ghost) d.ghost.style.transform = `translate(${d.lastX - d.startX}px,${d.lastY - d.startY}px)`;
    if (d.ready) {
      const name = zoneAt(d, d.lastX, d.lastY);
      const snap = d.zones.get(name);
      if (snap) {
        if (name !== d.target) {
          d.target = name;
          calmDown(d);
          setOver(name);
        }
        const p = pointIn(snap, d.lastX, d.lastY);
        if (name === d.fromZone) homeFrame(d, snap, p);
        else guestFrame(d, snap, p);
      }
    }
    d.raf = requestAnimationFrame(frame);
  }
  function homeFrame(d, snap, p) {
    if (snap.mode === "free") {
      const me = snap.base.find((b) => b.id === d.id);
      if (!me) return;
      const at = cellRect(me, snap.m);
      const cell = pointToCell({
        x: at.x + (d.lastX - d.startX),
        y: at.y + (d.lastY - d.startY),
        w: d.span.w,
        m: snap.m
      });
      const blocked = overlaps({ placed: snap.base, id: d.id, ...cell, ...d.span });
      if (cell.col !== d.cell.col || cell.row !== d.cell.row || blocked !== d.blocked || d.previewZone !== snap.name) {
        d.cell = cell;
        d.blocked = blocked;
        showPreview(d, snap.name, cellRect({ ...me, ...cell, ...d.span }, snap.m), blocked);
      }
      return;
    }
    const k = insertIndex({ base: snap.base, dragId: d.id, m: snap.m, pointerX: p.x, pointerY: p.y });
    if (k !== d.index || d.previewZone !== snap.name) {
      d.index = k;
      const next = placeOf(reorder(snap.blocks, d.fromIndex, k), snap.mode, snap.m.cols);
      slide(d, moveDeltas({ base: snap.base, next, m: snap.m, skipId: d.id }), snap.name);
      const me = next.find((b) => b.id === d.id);
      if (me) showPreview(d, snap.name, cellRect(me, snap.m), false);
    }
  }
  function guestFrame(d, snap, p) {
    const w = Math.min(d.span.w, snap.m.cols);
    const h = d.span.h;
    if (snap.mode === "free") {
      const cell = pointToCell({ x: p.x, y: p.y, w, m: snap.m });
      const blocked = overlaps({ placed: snap.base, id: d.id, ...cell, w, h });
      if (cell.col !== d.cell.col || cell.row !== d.cell.row || blocked !== d.blocked || d.previewZone !== snap.name) {
        d.cell = cell;
        d.blocked = blocked;
        d.index = snap.blocks.length;
        showPreview(d, snap.name, cellRect({ id: d.id, col: cell.col, row: cell.row, w, h }, snap.m), blocked);
      }
      return;
    }
    const k = insertIndex({ base: snap.base, dragId: d.id, m: snap.m, pointerX: p.x, pointerY: p.y });
    if (k !== d.index || d.previewZone !== snap.name) {
      d.index = k;
      const guest = { id: d.id, w, h };
      const merged = snap.blocks.slice();
      merged.splice(k, 0, guest);
      const next = placeOf(merged, snap.mode, snap.m.cols);
      const me = next.find((b) => b.id === d.id);
      d.blocked = false;
      if (me) showPreview(d, snap.name, cellRect(me, snap.m), false);
    }
  }
  function resizeFrame(d) {
    const snap = d.zones.get(d.fromZone);
    if (!snap) return;
    const limits = snap.blocks[d.fromIndex];
    if (!limits) return;
    const want = snapSpan({
      start: { w: limits.w, h: limits.h },
      dx: d.lastX - d.startX,
      dy: d.lastY - d.startY,
      m: snap.m,
      limits
    });
    const span = snap.mode === "free" ? fitSpan({ placed: snap.base, id: d.id, ...d.cell, want, limits }) : want;
    if (span.w === d.span.w && span.h === d.span.h) return;
    d.span = span;
    if (snap.mode === "free") {
      showPreview(d, snap.name, cellRect({ id: d.id, ...d.cell, ...span }, snap.m), false);
      return;
    }
    const resized = snap.blocks.map((b, i) => i === d.fromIndex ? { ...b, ...span } : b);
    const next = placeOf(resized, snap.mode, snap.m.cols);
    slide(d, moveDeltas({ base: snap.base, next, m: snap.m, skipId: d.id }), snap.name);
    const me = next.find((b) => b.id === d.id);
    if (me) showPreview(d, snap.name, cellRect(me, snap.m), false);
  }
  function onMove(ev) {
    if (!drag || ev.pointerId !== drag.pid) return;
    if (!drag.moved && (Math.abs(ev.clientX - drag.startX) > 2 || Math.abs(ev.clientY - drag.startY) > 2)) drag.moved = true;
    drag.lastX = ev.clientX;
    drag.lastY = ev.clientY;
  }
  function detach() {
    restoreTextSelection();
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    window.removeEventListener("keydown", onKey);
  }
  function cleanup() {
    if (!drag) return;
    const d = drag;
    if (d.raf) cancelAnimationFrame(d.raf);
    detach();
    resetStyles(d);
    drag = null;
    setActive(null);
    setOver(null);
  }
  function onKey(ev) {
    if (ev.key === "Escape") cleanup();
  }
  function onUp(ev) {
    if (!drag || ev.pointerId !== drag.pid) return;
    const d = drag;
    const zone = zones.get(d.fromZone);
    const snap = d.zones.get(d.fromZone);
    if (d.kind === "resize") {
      const before = snap?.blocks[d.fromIndex];
      cleanup();
      if (d.ready && before && (d.span.w !== before.w || d.span.h !== before.h)) {
        zone?.opts.onResize?.(d.id, d.span.w, d.span.h);
      }
      return;
    }
    const ready = d.ready;
    const target = d.target;
    const blocked = d.blocked;
    const index = d.index;
    const cell = d.cell;
    const home = snap?.base.find((b) => b.id === d.id);
    cleanup();
    if (!ready) return;
    if (target !== d.fromZone) {
      if (blocked) return;
      opts.onTransfer?.(
        { grid: d.fromZone, id: d.id, index: d.fromIndex },
        { grid: target, index, x: cell.col, y: cell.row }
      );
      return;
    }
    if (snap?.mode === "free") {
      if (blocked || !home || cell.col === home.col && cell.row === home.row) return;
      zone?.opts.onMove?.(d.id, cell.col, cell.row);
      return;
    }
    if (index !== d.fromIndex) zone?.opts.onReorder?.(d.fromIndex, index);
  }
  function begin(kind, name, id, handle, pid, x, y) {
    const zone = zones.get(name);
    const el = zone?.els.get(id);
    if (!zone || !el || !zone.el) return;
    if (kind === "move" && handle === el && focusInside(el)) return;
    const blocks = zone.opts.blocks();
    const fromIndex = blocks.findIndex((b) => b.id === id);
    if (fromIndex < 0 || blocks[fromIndex].locked) return;
    const m = metricsOf(zone);
    if (!m.colW) return;
    drag = {
      kind,
      id,
      fromZone: name,
      fromIndex,
      pid,
      el,
      startX: x,
      startY: y,
      lastX: x,
      lastY: y,
      zones: /* @__PURE__ */ new Map(),
      target: name,
      index: fromIndex,
      cell: { col: 0, row: 0 },
      blocked: false,
      span: { w: blocks[fromIndex].w, h: blocks[fromIndex].h },
      ghost: null,
      preview: null,
      previewZone: null,
      touched: /* @__PURE__ */ new Set(),
      raf: 0,
      ready: false,
      moved: false
    };
    setActive({ grid: name, id, kind });
    setOver(name);
    suppressTextSelection();
    el.style.willChange = "transform";
    if (kind === "move") {
      injectGhostReset();
      el.style.opacity = "0.4";
      el.style.cursor = "grabbing";
    } else {
      el.style.zIndex = "3";
    }
    snapshot((rects) => {
      if (!drag || drag.id !== id || drag.pid !== pid) return;
      drag.zones = buildSnaps(rects);
      const snap = drag.zones.get(name);
      const home = snap?.base.find((b) => b.id === id);
      if (snap && home) {
        drag.cell = { col: home.col, row: home.row };
        if (kind === "move") {
          const r = cellRect(home, snap.m);
          const b = boxOf(snap);
          drag.ghost = makeGhost(el, {
            left: b.left + snap.padLeft + r.x,
            top: b.top + snap.padTop + r.y,
            width: r.width,
            height: r.height
          });
        } else {
          showPreview(drag, name, cellRect(home, snap.m), false);
        }
      }
      drag.ready = true;
    });
    try {
      handle.setPointerCapture(pid);
    } catch {
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey);
    drag.raf = requestAnimationFrame(frame);
  }
  const gate = createPressGate(opts);
  const canStart = (zone) => !zone.opts.disabled?.() && !drag && !gate.pending();
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
      return {
        attachContainer(el) {
          zone.el = el;
          if (typeof ResizeObserver === "function") {
            zone.ro = new ResizeObserver((entries) => {
              const r = entries[entries.length - 1]?.contentRect;
              if (!r) return;
              zone.contentW = r.width;
              zone.padLeft = r.left;
              zone.padTop = r.top;
            });
            zone.ro.observe(el);
          }
          return () => {
            zone.ro?.disconnect();
            zone.ro = null;
            if (zone.el === el) zone.el = null;
          };
        },
        attach(el, id) {
          zone.els.set(id, el);
          el.dataset.gridBlock = id;
          const down = (ev) => {
            if (ev.button !== 0 || !canStart(zone)) return;
            if (!(ev.target instanceof Element)) return;
            if (ev.target.closest("[data-grid-resize]")) return;
            if (ev.target.closest("[data-flip-id]")) return;
            const nested = ev.target.closest("[data-grid-block]");
            if (nested && nested !== el) return;
            const handle2 = el.querySelector("[data-drag-handle]");
            if (handle2) {
              if (!(ev.target instanceof Node && handle2.contains(ev.target))) return;
            } else if (targetIsInteractive(ev)) {
              return;
            }
            gate.arm(ev, (px, py) => begin("move", name, id, handle2 || el, ev.pointerId, px, py));
          };
          el.addEventListener("pointerdown", down);
          const handle = el.querySelector("[data-drag-handle]");
          if (handle) handle.style.touchAction = "none";
          return () => {
            el.removeEventListener("pointerdown", down);
            delete el.dataset.gridBlock;
            if (zone.els.get(id) === el) zone.els.delete(id);
          };
        },
        attachResize(el, id) {
          el.dataset.gridResize = "";
          el.style.touchAction = "none";
          const down = (ev) => {
            if (ev.button !== 0 || !canStart(zone) || zone.opts.resizable?.() === false) return;
            ev.stopPropagation();
            ev.preventDefault();
            begin("resize", name, id, el, ev.pointerId, ev.clientX, ev.clientY);
          };
          el.addEventListener("pointerdown", down);
          return () => el.removeEventListener("pointerdown", down);
        }
      };
    },
    active: () => activeState,
    over: () => overName,
    destroy() {
      gate.cancel();
      cleanup();
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

// src/solid.ts
function createDumbGrid(opts) {
  const [active, setActive] = createSignal(null);
  const engine = createGridEngine({
    ...opts,
    onActive: (state) => {
      setActive(state);
      opts.onActive?.(state);
    }
  });
  onCleanup(engine.destroy);
  return {
    container: (el) => onCleanup(engine.attachContainer(el)),
    bind: (id) => (el) => onCleanup(engine.attach(el, id)),
    resize: (id) => (el) => onCleanup(engine.attachResize(el, id)),
    active
  };
}
function createDumbGridGroup(opts) {
  const [active, setActive] = createSignal(null);
  const [over, setOver] = createSignal(null);
  const engine = createGridGroupEngine({
    ...opts,
    onActive: (state) => {
      setActive(state);
      opts.onActive?.(state);
    },
    onOver: (name) => {
      setOver(name);
      opts.onOver?.(name);
    }
  });
  onCleanup(engine.destroy);
  return {
    grid(name, zoneOpts) {
      const zone = engine.grid(name, zoneOpts);
      return {
        container: (el) => onCleanup(zone.attachContainer(el)),
        bind: (id) => (el) => onCleanup(zone.attach(el, id)),
        resize: (id) => (el) => onCleanup(zone.attachResize(el, id)),
        // «активен ли этот блок» — общий сигнал группы, суженный до своей сетки
        active: () => {
          const a = active();
          return a && a.grid === name ? { id: a.id, kind: a.kind } : null;
        }
      };
    },
    active,
    over
  };
}

// src/DumbGrid.tsx
var _tmpl$ = /* @__PURE__ */ template(`<div data-grid-lines aria-hidden=true style="position:absolute;inset:0;padding:inherit;box-sizing:border-box;pointer-events:none;z-index:0;background-origin:content-box;background-clip:content-box;background-repeat:no-repeat, repeat;transition:opacity .15s ease">`);
var _tmpl$2 = /* @__PURE__ */ template(`<div style=display:grid;position:relative;scrollbar-gutter:stable>`);
var _tmpl$3 = /* @__PURE__ */ template(`<div>`);
var _tmpl$4 = /* @__PURE__ */ template(`<button type=button data-grid-remove data-no-drag style=position:absolute;top:0;right:0;width:22px;height:22px;display:grid;place-items:center;padding:0;border:none;background:transparent;color:currentColor;font:inherit;line-height:1;cursor:pointer;opacity:0.45;z-index:2>\u2715`);
var _tmpl$5 = /* @__PURE__ */ template(`<div style="position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;background:linear-gradient(135deg, transparent 0 45%, currentColor 45% 55%, transparent 55% 70%, currentColor 70% 80%, transparent 80%);border-bottom-right-radius:8px">`);
var _tmpl$6 = /* @__PURE__ */ template(`<div style=touch-action:manipulation>`);
var DEFAULT_COLS = 12;
var DEFAULT_ROW_H = 80;
var DEFAULT_GAP = 12;
var LayoutSchema = v.array(v.object({
  id: v.string(),
  w: v.number(),
  h: v.number(),
  x: v.optional(v.number()),
  y: v.optional(v.number())
}));
function blockBox(span, pos) {
  return {
    // ЯВНАЯ позиция: раскладку считаем мы, браузер не домысливает
    "grid-column": `${(pos?.col ?? 0) + 1} / span ${span.w}`,
    "grid-row": `${(pos?.row ?? 0) + 1} / span ${span.h}`,
    position: "relative",
    "z-index": "1",
    // над подложкой-сеткой
    "min-width": "0",
    "min-height": "0",
    "box-sizing": "border-box"
  };
}
function clampInt(n, lo, hi) {
  const i = Math.round(n);
  if (!Number.isFinite(i)) return lo;
  return Math.max(lo, Math.min(hi, i));
}
function spanOf(item, src, cols) {
  const minW = item.minW === void 0 ? 1 : resolveSpan(item.minW, cols);
  const maxW = item.maxW === void 0 ? cols : resolveSpan(item.maxW, cols);
  const w = clampInt(src.w, Math.max(1, minW), Math.min(cols, maxW));
  const out = {
    id: item.id,
    w,
    h: clampInt(src.h, Math.max(1, item.minH ?? 1), item.maxH ?? Number.MAX_SAFE_INTEGER)
  };
  if (Number.isFinite(src.x)) out.x = clampInt(src.x, 0, Math.max(0, cols - w));
  if (Number.isFinite(src.y)) out.y = Math.max(0, Math.round(src.y));
  return out;
}
function mergeLayout(saved, items, cols, mode = "flow") {
  const byId = new Map(items.map((it) => [it.id, it]));
  const out = [];
  for (const s of saved ?? []) {
    const it = byId.get(s.id);
    if (!it) continue;
    out.push(spanOf(it, s, cols));
    byId.delete(s.id);
  }
  for (const it of items) {
    if (!byId.has(it.id)) continue;
    const w = resolveSpan(it.w, cols);
    const h = Math.max(1, Math.round(it.h ?? 1) || 1);
    const spot = mode === "free" && it.x === void 0 && it.y === void 0 && out.length ? firstFreeCell({
      placed: placeFree(out, cols),
      cols,
      w,
      h
    }) : {
      x: it.x,
      y: it.y
    };
    out.push(spanOf(it, {
      w,
      h,
      x: spot.x,
      y: spot.y
    }, cols));
  }
  return out;
}
var GRID_LINE = "rgba(100,116,139,.28)";
function gridLinesBackground(args) {
  const {
    cols,
    gapX,
    rowH,
    gapY
  } = args;
  const col = `calc((100% - ${(cols - 1) * gapX}px) / ${cols})`;
  const stepX = `calc(${col} + ${gapX}px)`;
  const lineW = Math.max(1, gapX);
  const lineH = Math.max(1, gapY);
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
function DumbGrid(props) {
  const mode = () => props.mode ?? "flow";
  const cols = () => Math.max(1, Math.floor(props.cols ?? DEFAULT_COLS));
  const rowH = () => props.rowHeight ?? DEFAULT_ROW_H;
  const gapX = () => props.gapX ?? props.gap ?? DEFAULT_GAP;
  const gapY = () => props.gapY ?? props.gap ?? DEFAULT_GAP;
  const persisted = props.storageKey ? makePersisted(createSignal(null), {
    name: props.storageKey,
    serialize: (l) => JSON.stringify(l ?? []),
    deserialize: (raw) => {
      try {
        const parsed = v.safeParse(LayoutSchema, JSON.parse(raw));
        return parsed.success ? parsed.output : null;
      } catch {
        return null;
      }
    }
  }) : null;
  const [memory, setMemory] = createSignal(null);
  const saved = () => props.layout ?? (persisted ? persisted[0]() : memory());
  const layout = createMemo(() => mergeLayout(saved(), props.items, cols(), mode()));
  const commit = (next) => {
    if (!props.layout) (persisted ? persisted[1] : setMemory)(next);
    props.onLayout?.(next);
  };
  const placed = createMemo(() => {
    const m = mode();
    return m === "free" ? placeFree(layout(), cols()) : packFlow(layout(), cols(), m);
  });
  const rows = createMemo(() => rowCount(placed()));
  const itemById = createMemo(() => new Map(props.items.map((it) => [it.id, it])));
  const spanById = createMemo(() => new Map(layout().map((s) => [s.id, s])));
  const posById = createMemo(() => new Map(placed().map((p) => [p.id, p])));
  const materialize = (next) => {
    if (mode() !== "free") return next;
    const pos = new Map(placeFree(next, cols()).map((p) => [p.id, p]));
    return next.map((s) => {
      const p = pos.get(s.id);
      return p ? {
        ...s,
        x: p.col,
        y: p.row
      } : s;
    });
  };
  const engineOptions = {
    blocks: () => {
      const map = itemById();
      const c = cols();
      return layout().map((s) => {
        const it = map.get(s.id);
        return {
          ...s,
          minW: it?.minW === void 0 ? void 0 : resolveSpan(it.minW, c),
          maxW: it?.maxW === void 0 ? void 0 : resolveSpan(it.maxW, c),
          minH: it?.minH,
          maxH: it?.maxH,
          locked: it?.locked
        };
      });
    },
    mode,
    cols,
    rowHeight: rowH,
    gapX,
    gapY,
    disabled: () => props.disabled === true || !editable(),
    resizable: () => props.resizable !== false,
    animate: props.animate,
    pressDelay: props.pressDelay,
    mouseThreshold: props.mouseThreshold,
    onReorder: (from, to) => commit(materialize(reorder(layout(), from, to))),
    onMove: (id, x, y) => commit(materialize(layout().map((s) => s.id === id ? {
      ...s,
      x,
      y
    } : s))),
    onResize: (id, w, h) => {
      const it = itemById().get(id);
      if (!it) return;
      commit(materialize(layout().map((s) => s.id === id ? spanOf(it, {
        ...s,
        w,
        h
      }, cols()) : s)));
    }
  };
  const g = props.group ? props.group.grid(props.name ?? "grid", engineOptions) : createDumbGrid(engineOptions);
  const spare = () => (
    // в режиме просмотра пустой хвост не нужен: уводить туда нечего
    editable() ? Math.max(0, props.spareRows ?? (mode() === "free" ? 2 : 0)) : 0
  );
  const totalRows = () => rows() + spare();
  const heightOf = (n) => n * rowH() + Math.max(0, n - 1) * gapY();
  const editable = () => props.editable !== false;
  const showGrid = () => props.showGrid ?? "drag";
  const gridVisible = () => showGrid() === true || showGrid() === "drag" && !!g.active();
  const gridBackground = () => gridLinesBackground({
    cols: cols(),
    gapX: gapX(),
    rowH: rowH(),
    gapY: gapY()
  });
  return (() => {
    var _el$ = _tmpl$2();
    var _ref$ = g.container;
    typeof _ref$ === "function" ? use(_ref$, _el$) : g.container = _el$;
    insert(_el$, createComponent(Show, {
      get when() {
        return memo(() => !!editable())() && showGrid() !== false;
      },
      get children() {
        var _el$2 = _tmpl$();
        effect((_p$) => {
          var _v$ = gridBackground().image, _v$2 = gridBackground().size, _v$3 = gridVisible() ? "1" : "0";
          _v$ !== _p$.e && setStyleProperty(_el$2, "background-image", _p$.e = _v$);
          _v$2 !== _p$.t && setStyleProperty(_el$2, "background-size", _p$.t = _v$2);
          _v$3 !== _p$.a && setStyleProperty(_el$2, "opacity", _p$.a = _v$3);
          return _p$;
        }, {
          e: void 0,
          t: void 0,
          a: void 0
        });
        return _el$2;
      }
    }), null);
    insert(_el$, createComponent(Show, {
      get when() {
        return editable();
      },
      get fallback() {
        return createComponent(For, {
          get each() {
            return props.items;
          },
          children: (it) => {
            const span = () => spanById().get(it.id);
            return createComponent(Show, {
              get when() {
                return span();
              },
              children: (s) => (() => {
                var _el$3 = _tmpl$3();
                insert(_el$3, () => it.content());
                effect((_p$) => {
                  var _v$6 = props.blockClass, _v$7 = {
                    ...blockBox(s(), posById().get(it.id)),
                    ...props.blockStyle
                  };
                  _v$6 !== _p$.e && className(_el$3, _p$.e = _v$6);
                  _p$.t = style(_el$3, _v$7, _p$.t);
                  return _p$;
                }, {
                  e: void 0,
                  t: void 0
                });
                return _el$3;
              })()
            });
          }
        });
      },
      get children() {
        return createComponent(For, {
          get each() {
            return props.items;
          },
          children: (it) => {
            const span = () => spanById().get(it.id);
            const dragging = () => g.active()?.id === it.id;
            return createComponent(Show, {
              get when() {
                return span();
              },
              children: (s) => (() => {
                var _el$4 = _tmpl$6();
                var _ref$2 = g.bind(it.id);
                typeof _ref$2 === "function" && use(_ref$2, _el$4);
                insert(_el$4, () => it.content(), null);
                insert(_el$4, createComponent(Show, {
                  get when() {
                    return memo(() => !!(props.onRemove && !props.disabled))() && it.removable !== false;
                  },
                  get children() {
                    var _el$5 = _tmpl$4();
                    _el$5.$$click = () => props.onRemove?.(it.id);
                    effect((_p$) => {
                      var _v$8 = props.labels?.remove ?? "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0431\u043B\u043E\u043A", _v$9 = props.labels?.remove ?? "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0431\u043B\u043E\u043A";
                      _v$8 !== _p$.e && setAttribute(_el$5, "title", _p$.e = _v$8);
                      _v$9 !== _p$.t && setAttribute(_el$5, "aria-label", _p$.t = _v$9);
                      return _p$;
                    }, {
                      e: void 0,
                      t: void 0
                    });
                    return _el$5;
                  }
                }), null);
                insert(_el$4, createComponent(Show, {
                  get when() {
                    return memo(() => !!(props.resizable !== false && !it.locked))() && !props.disabled;
                  },
                  get children() {
                    var _el$6 = _tmpl$5();
                    var _ref$3 = g.resize(it.id);
                    typeof _ref$3 === "function" && use(_ref$3, _el$6);
                    effect((_p$) => {
                      var _v$0 = props.labels?.resize ?? "\u041F\u043E\u0442\u044F\u043D\u0438, \u0447\u0442\u043E\u0431\u044B \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0440\u0430\u0437\u043C\u0435\u0440", _v$1 = dragging() ? "0.9" : "0.35";
                      _v$0 !== _p$.e && setAttribute(_el$6, "title", _p$.e = _v$0);
                      _v$1 !== _p$.t && setStyleProperty(_el$6, "opacity", _p$.t = _v$1);
                      return _p$;
                    }, {
                      e: void 0,
                      t: void 0
                    });
                    return _el$6;
                  }
                }), null);
                effect((_p$) => {
                  var _v$10 = props.blockClass, _v$11 = {
                    ...blockBox(s(), posById().get(it.id)),
                    cursor: it.locked || props.disabled ? "default" : "grab",
                    ...props.blockStyle
                  };
                  _v$10 !== _p$.e && className(_el$4, _p$.e = _v$10);
                  _p$.t = style(_el$4, _v$11, _p$.t);
                  return _p$;
                }, {
                  e: void 0,
                  t: void 0
                });
                return _el$4;
              })()
            });
          }
        });
      }
    }), null);
    effect((_p$) => {
      var _v$4 = props.class, _v$5 = {
        "grid-template-columns": `repeat(${cols()}, minmax(0, 1fr))`,
        "grid-auto-rows": `${rowH()}px`,
        "column-gap": `${gapX()}px`,
        "row-gap": `${gapY()}px`,
        // высота под все строки плюс запас, чтобы блок было куда увести вниз
        "min-height": `${heightOf(totalRows())}px`,
        ...props.style
      };
      _v$4 !== _p$.e && className(_el$, _p$.e = _v$4);
      _p$.t = style(_el$, _v$5, _p$.t);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$;
  })();
}
delegateEvents(["click"]);

export { DumbGrid, cellRect, colWidth, createDumbGrid, createDumbGridGroup, createGridEngine, createGridGroupEngine, firstFreeCell, fitSpan, insertIndex, mergeLayout, moveDeltas, overlaps, packFlow, placeFree, pointToCell, reorder, resolveSpan, rowCount, snapSpan, spanSize };
