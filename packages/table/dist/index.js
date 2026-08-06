import { delegateEvents, insert, createComponent, memo, addEventListener, effect, className, classList, style, setStyleProperty, use, setAttribute, template } from 'solid-js/web';
import { createSignal, createMemo, Show, For, onCleanup } from 'solid-js';
import { createSolidTable, getSortedRowModel, getCoreRowModel, flexRender } from '@tanstack/solid-table';

// src/DumbTable.tsx
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
function clampDragged(args) {
  const { cell, scrollX, scrollY, clientW, clientH, grid } = args;
  const top = Math.max(scrollY, Math.min(scrollY + clientH - cell.height, cell.top + args.ty));
  const ty = top - cell.top;
  if (!grid) return { tx: args.tx, ty };
  const left = Math.max(scrollX, Math.min(scrollX + clientW - cell.width, cell.left + args.tx));
  return { tx: left - cell.left, ty };
}
function hitIndex(others, pX, pY, grid) {
  let k = 0;
  for (const o of others) {
    {
      if (pY > o.bottom) k++;
      else if (pY >= o.top && pX > o.cx) k++;
    }
  }
  return k;
}
function gridLayout(args) {
  const { ids, dragId, fromIndex, k, cells } = args;
  const out = [];
  ids.forEach((id, i) => {
    if (id === dragId) return;
    const ri = i < fromIndex ? i : i - 1;
    const newVis = ri < k ? ri : ri + 1;
    const cell = cells[newVis], me = cells[i];
    if (!cell || !me) return;
    out.push({ id, dx: cell.left - me.left, dy: cell.top - me.top });
  });
  return out;
}
function nextInsertIndex(args) {
  const { cells, gap, top, holeH, pointerY } = args;
  const n = cells.length;
  if (!n) return 0;
  const pos = [];
  let cursor = top;
  for (let i = 0; i < n; i++) {
    pos.push(cursor);
    cursor += cells[i].height + gap;
  }
  const shift = holeH + gap;
  let k = Math.max(0, Math.min(n, args.k));
  const center = (i, at) => pos[i] + (i >= at ? shift : 0) + cells[i].height / 2;
  for (let guard = 0; guard <= n; guard++) {
    if (k < n && pointerY > center(k, k)) {
      k++;
      continue;
    }
    if (k > 0 && pointerY < center(k - 1, k)) {
      k--;
      continue;
    }
    break;
  }
  return k;
}
function gapOf(cells) {
  return cells.length > 1 ? Math.max(0, cells[1].top - cells[0].top - cells[0].height) : 0;
}
function shiftLayout(args) {
  const { count, from, to, amount } = args;
  const out = new Array(count).fill(0);
  if (to === null) return out;
  if (from === null) {
    for (let i = to; i < count; i++) out[i] = amount;
    return out;
  }
  if (to > from) {
    for (let i = from; i < to; i++) out[i] = -amount;
  } else if (to < from) {
    for (let i = to; i < from; i++) out[i] = amount;
  }
  return out;
}
function holeTop(args) {
  const { cells, gap, top, k } = args;
  let cursor = top;
  for (let i = 0; i < Math.min(k, cells.length); i++) cursor += cells[i].height + gap;
  return cursor;
}
function listLayout(args) {
  const { ids, dragId, fromIndex, k, cells } = args;
  if (!cells.length) return [];
  const rest = ids.filter((id) => id !== dragId);
  const amount = cells[fromIndex].height + gapOf(cells);
  const dy = shiftLayout({ count: rest.length, from: fromIndex, to: k, amount });
  return rest.map((id, i) => ({ id, dy: dy[i] }));
}
var NO_DRAG = 'input, textarea, select, option, button, a, label, [contenteditable=""], [contenteditable="true"], [data-no-drag]';
function targetIsInteractive(ev) {
  return ev.target instanceof Element && !!ev.target.closest(NO_DRAG);
}
function focusInside(el) {
  const active = document.activeElement;
  return !!active && active !== document.body && active !== el && el.contains(active);
}
var SLIDE = "transform .18s cubic-bezier(.2,.8,.2,1)";
var LONGPRESS = 350;
var MOVE_TOL = 10;
var LIFT_SHADOW = "0 10px 24px -6px rgba(0,0,0,.28)";
function originOf(d) {
  return d.scroller ? viewOrigin(d.geom, window.scrollX, window.scrollY) : { top: 0, left: 0 };
}
function createSortableEngine(opts) {
  const grid = opts.axis === "grid";
  const pressDelay = opts.pressDelay ?? LONGPRESS;
  const mousePress = opts.mousePressDelay ?? 0;
  const mouseThresh = opts.mouseThreshold ?? 0;
  const rowEls = /* @__PURE__ */ new Map();
  let drag = null;
  function snapshot(ids, cb) {
    const out = /* @__PURE__ */ new Map();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const el = e.target;
        if (el.dataset.flipId) out.set(el.dataset.flipId, e.boundingClientRect);
      }
      io.disconnect();
      cb(out);
    });
    let n = 0;
    for (const id of ids) {
      const el = rowEls.get(id);
      if (el) {
        io.observe(el);
        n++;
      }
    }
    if (n === 0) cb(out);
  }
  function frame() {
    if (!drag) return;
    const d = drag;
    let origin = originOf(d);
    let { sx, sy } = scrollOf(d.scroller);
    const speed = d.moved ? autoScrollSpeed({
      pointerY: d.lastY,
      viewTop: origin.top,
      clientH: d.geom.clientH,
      scrollY: sy,
      scrollMax: d.geom.max
    }) : 0;
    if (speed) {
      doScroll(d.scroller, 0, speed);
      ({ sx, sy } = scrollOf(d.scroller));
      origin = originOf(d);
    }
    let tx = grid ? d.lastX - d.startX + (sx - d.scrollX0) : 0;
    let ty = d.lastY - d.startY + (sy - d.scrollY0);
    if (d.ready && d.cells.length) {
      ({ tx, ty } = clampDragged({
        cell: d.cells[d.fromIndex],
        tx,
        ty,
        scrollX: sx,
        scrollY: sy,
        clientW: d.geom.clientW,
        clientH: d.geom.clientH,
        grid
      }));
    }
    d.dragEl.style.transform = `translate(${tx}px,${ty}px)`;
    if (d.ready) {
      const pX = d.lastX - origin.left + sx;
      const pY = d.lastY - origin.top + sy;
      const k = grid ? hitIndex(d.others, pX, pY) : nextInsertIndex({
        cells: d.restCells,
        gap: d.gap,
        top: d.top,
        holeH: d.cells[d.fromIndex].height,
        k: d.toIndex,
        pointerY: pY
      });
      d.toIndex = k;
      const moves = grid ? gridLayout({ ids: d.ids, dragId: d.id, fromIndex: d.fromIndex, k, cells: d.cells }) : listLayout({ ids: d.ids, dragId: d.id, fromIndex: d.fromIndex, k, cells: d.cells });
      for (const m of moves) {
        const el = rowEls.get(m.id);
        if (!el) continue;
        const dx = "dx" in m ? m.dx : 0;
        if (!dx && !m.dy) {
          if (d.touched.has(el)) el.style.transform = "";
          continue;
        }
        if (!d.touched.has(el)) {
          d.touched.add(el);
          el.style.willChange = "transform";
          if (!shouldAnimate(opts.animate)) {
            el.style.transform = `translate(${dx}px,${m.dy}px)`;
            continue;
          }
          el.style.transition = SLIDE;
          continue;
        }
        el.style.transform = `translate(${dx}px,${m.dy}px)`;
      }
    }
    d.raf = requestAnimationFrame(frame);
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
  }
  function resetStyles(d) {
    const reset = (el) => {
      el.style.transition = "";
      el.style.transform = "";
      el.style.zIndex = "";
      el.style.position = "";
      el.style.willChange = "";
      el.style.boxShadow = "";
      el.style.opacity = "";
      el.style.cursor = "";
    };
    reset(d.dragEl);
    for (const el of d.touched) reset(el);
  }
  function cleanup() {
    if (!drag) return;
    const d = drag;
    if (d.raf) cancelAnimationFrame(d.raf);
    detach();
    resetStyles(d);
    drag = null;
  }
  function land(d, done) {
    if (!shouldAnimate(opts.animate)) {
      done();
      return;
    }
    const from = d.cells[d.fromIndex];
    let tx = 0, ty = 0;
    if (grid) {
      const target = d.cells[d.toIndex];
      if (!target) {
        done();
        return;
      }
      tx = target.left - from.left;
      ty = target.top - from.top;
    } else {
      ty = holeTop({ cells: d.restCells, gap: d.gap, top: d.top, k: d.toIndex }) - from.top;
    }
    const el = d.dragEl;
    el.style.transition = SLIDE;
    el.style.transform = `translate(${tx}px,${ty}px)`;
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
    if (!drag || ev.pointerId !== drag.pid) return;
    const d = drag;
    const { fromIndex, toIndex, ready } = d;
    if (!ready || toIndex === fromIndex) {
      cleanup();
      return;
    }
    detach();
    if (d.raf) cancelAnimationFrame(d.raf);
    drag = null;
    land(d, () => {
      resetStyles(d);
      opts.onEnd(fromIndex, toIndex);
    });
  }
  function begin(id, handle, pid, x, y) {
    const dragEl = rowEls.get(id);
    if (!dragEl) return;
    if (handle === dragEl && focusInside(dragEl)) return;
    const ids = opts.order();
    const fromIndex = ids.indexOf(id);
    if (fromIndex < 0) return;
    const scroller = scrollParent(dragEl);
    const geom = measure(scroller);
    const s0 = scrollOf(scroller);
    drag = {
      id,
      pid,
      startX: x,
      startY: y,
      lastX: x,
      lastY: y,
      dragEl,
      ids,
      fromIndex,
      cells: [],
      others: [],
      restCells: [],
      top: 0,
      gap: 0,
      toIndex: fromIndex,
      scroller,
      geom,
      scrollX0: s0.sx,
      scrollY0: s0.sy,
      raf: 0,
      ready: false,
      moved: false,
      touched: /* @__PURE__ */ new Set()
    };
    dragEl.style.position = "relative";
    dragEl.style.zIndex = "2";
    dragEl.style.willChange = "transform";
    dragEl.style.boxShadow = LIFT_SHADOW;
    dragEl.style.opacity = "0.97";
    dragEl.style.cursor = "grabbing";
    dragEl.style.transition = "box-shadow .15s ease, opacity .15s ease";
    suppressTextSelection();
    snapshot(ids, (rects) => {
      if (!drag || drag.id !== id) return;
      const origin = originOf(drag);
      const s = scrollOf(scroller);
      const ox = (r) => r.left - origin.left + s.sx;
      const oy = (r) => r.top - origin.top + s.sy;
      drag.cells = ids.map((i) => {
        const r = rects.get(i);
        return r ? { left: ox(r), top: oy(r), width: r.width, height: r.height } : { left: 0, top: 0, width: 0, height: 0 };
      });
      drag.others = ids.filter((oid) => oid !== id).map((oid) => {
        const r = rects.get(oid);
        const l = ox(r), t = oy(r);
        return { id: oid, cx: l + r.width / 2, cy: t + r.height / 2, top: t, bottom: t + r.height };
      });
      drag.restCells = drag.cells.filter((_, i) => ids[i] !== id);
      drag.top = drag.cells.length ? drag.cells[0].top : 0;
      drag.gap = gapOf(drag.cells);
      drag.ready = true;
    });
    try {
      handle.setPointerCapture(pid);
    } catch {
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    drag.raf = requestAnimationFrame(frame);
  }
  let pending = null;
  function addPend() {
    window.addEventListener("pointermove", pendMove);
    window.addEventListener("pointerup", pendCancel);
    window.addEventListener("pointercancel", pendCancel);
  }
  function clearPending() {
    if (!pending) return;
    clearTimeout(pending.timer);
    window.removeEventListener("pointermove", pendMove);
    window.removeEventListener("pointerup", pendCancel);
    window.removeEventListener("pointercancel", pendCancel);
    pending = null;
  }
  function pendMove(ev) {
    if (!pending || ev.pointerId !== pending.pid) return;
    const moved = Math.abs(ev.clientX - pending.x) > pending.thresh || Math.abs(ev.clientY - pending.y) > pending.thresh;
    if (!moved) return;
    if (pending.mode === "press") clearPending();
    else {
      const p = pending;
      clearPending();
      begin(p.id, p.handle, p.pid, ev.clientX, ev.clientY);
    }
  }
  function pendCancel(ev) {
    if (pending && ev.pointerId === pending.pid) clearPending();
  }
  function onDown(id, handle, ev) {
    if (ev.button !== 0 || opts.disabled?.() || drag || pending) return;
    if (!rowEls.get(id)) return;
    const touch = ev.pointerType === "touch";
    const delay = touch ? pressDelay : mousePress;
    if (delay > 0) {
      pending = { id, handle, pid: ev.pointerId, x: ev.clientX, y: ev.clientY, timer: 0, mode: "press", thresh: MOVE_TOL };
      pending.timer = setTimeout(() => {
        const p = pending;
        clearPending();
        if (p) {
          if (touch) navigator.vibrate?.(8);
          begin(p.id, p.handle, p.pid, p.x, p.y);
        }
      }, delay);
      addPend();
      return;
    }
    if (!touch && mouseThresh > 0) {
      pending = { id, handle, pid: ev.pointerId, x: ev.clientX, y: ev.clientY, timer: 0, mode: "dist", thresh: mouseThresh };
      addPend();
      return;
    }
    ev.preventDefault();
    begin(id, handle, ev.pointerId, ev.clientX, ev.clientY);
  }
  return {
    // самодостаточно: регистрирует элемент И навешивает старт драга.
    // ручка = дочка с [data-drag-handle] (делегирование); нет её → тянем за весь элемент.
    attach(el, id) {
      el.dataset.flipId = id;
      rowEls.set(id, el);
      const h = el.querySelector("[data-drag-handle]");
      if (h) h.style.touchAction = "none";
      const down = (ev) => {
        const handle = el.querySelector("[data-drag-handle]");
        if (handle) {
          if (!(ev.target instanceof Node && handle.contains(ev.target))) return;
        } else if (targetIsInteractive(ev)) {
          return;
        }
        onDown(id, handle || el, ev);
      };
      el.addEventListener("pointerdown", down);
      return () => {
        el.removeEventListener("pointerdown", down);
        if (rowEls.get(id) === el) rowEls.delete(id);
      };
    },
    // низкоуровневое: ячейка и ручка порознь (когда ручка не потомок ячейки)
    attachRow(el, id) {
      el.dataset.flipId = id;
      rowEls.set(id, el);
      return () => {
        if (rowEls.get(id) === el) rowEls.delete(id);
      };
    },
    attachHandle(el, id) {
      const down = (ev) => onDown(id, el, ev);
      el.addEventListener("pointerdown", down);
      return () => el.removeEventListener("pointerdown", down);
    },
    destroy() {
      clearPending();
      cleanup();
    }
  };
}
function createDumbSortable(opts) {
  const engine = createSortableEngine(opts);
  onCleanup(engine.destroy);
  return {
    bind: (id) => (el) => onCleanup(engine.attach(el, id)),
    row: (id) => (el) => onCleanup(engine.attachRow(el, id)),
    handle: (id) => (el) => onCleanup(engine.attachHandle(el, id))
  };
}
function prefersReducedMotion2() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function shouldAnimate2(explicit) {
  return !prefersReducedMotion2();
}

// src/DumbTable.tsx
var _tmpl$ = /* @__PURE__ */ template(`<span aria-hidden=true class="ml-1 inline-block">`);
var _tmpl$2 = /* @__PURE__ */ template(`<progress class="progress progress-primary mb-1 h-1 w-full">`);
var _tmpl$3 = /* @__PURE__ */ template(`<tr aria-hidden=true>`);
var _tmpl$4 = /* @__PURE__ */ template(`<tfoot>`);
var _tmpl$5 = /* @__PURE__ */ template(`<table><thead></thead><tbody>`);
var _tmpl$6 = /* @__PURE__ */ template(`<div>`);
var _tmpl$7 = /* @__PURE__ */ template(`<th class=w-px>`);
var _tmpl$8 = /* @__PURE__ */ template(`<tr>`);
var _tmpl$9 = /* @__PURE__ */ template(`<th style=white-space:nowrap>`);
var _tmpl$0 = /* @__PURE__ */ template(`<td class=w-px><span data-drag-handle class="inline-block touch-none">`);
var _tmpl$1 = /* @__PURE__ */ template(`<td>`);
var withViewTransition = (on, fn) => {
  const doc = document;
  if (on && shouldAnimate2() && typeof doc.startViewTransition === "function") doc.startViewTransition(fn);
  else fn();
};
function SortMark(props) {
  return (() => {
    var _el$ = _tmpl$();
    insert(_el$, (() => {
      var _c$ = memo(() => props.dir === "asc");
      return () => _c$() ? "\u25B2" : props.dir === "desc" ? "\u25BC" : "\u21C5";
    })());
    return _el$;
  })();
}
function DumbTable(props) {
  const [localSort, setLocalSort] = createSignal([]);
  const serverMode = () => !!props.onSort;
  const sorting = () => serverMode() ? props.sort ? [{
    id: props.sort,
    desc: props.order === "desc"
  }] : [] : localSort();
  const defs = () => props.columns.map((c) => ({
    id: c.key,
    // accessorFn обязателен: без него TanStack считает колонку display-колонкой,
    // getCanSort() всегда false и сортировка молча выключается — даже когда
    // сортирует сервер и само значение не используется.
    accessorFn: (row) => c.value ? c.value(row) : row[c.key],
    header: () => c.label ?? c.key,
    enableSorting: !!c.sortable,
    ...props.sortDescFirst === void 0 ? {} : {
      sortDescFirst: props.sortDescFirst
    },
    cell: (ctx) => c.render ? c.render(ctx.row.original, ctx.row.index) : String(ctx.getValue() ?? ""),
    meta: {
      col: c
    }
  }));
  const table = createSolidTable({
    get data() {
      return props.rows;
    },
    get columns() {
      return defs();
    },
    state: {
      get sorting() {
        return sorting();
      }
    },
    get manualSorting() {
      return serverMode();
    },
    // третий клик по заголовку снимает сортировку (asc → desc → без сортировки)
    get enableSortingRemoval() {
      return !props.noSortRemoval;
    },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting()) : updater;
      if (serverMode()) {
        if (next.length) props.onSort(next[0].id, next[0].desc ? "desc" : "asc");
        else props.onSort(null, null);
      } else {
        withViewTransition(props.viewTransition, () => setLocalSort(next));
      }
    },
    getRowId: (row, index) => props.rowId?.(row, index) ?? String(index),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });
  const visibleRows = createMemo(() => table.getRowModel().rows.map((r) => r.original));
  const rowOf = (original) => table.getRowModel().rows.find((r) => r.original === original);
  const dragDisabled = () => !props.onReorder || sorting().length > 0;
  const withHandle = () => props.handle !== false;
  const sortable = createDumbSortable({
    order: () => table.getRowModel().rows.map((r) => r.id),
    disabled: dragDisabled,
    mouseThreshold: props.dragThreshold,
    get animate() {
      return props.animate;
    },
    onEnd: (from, to) => props.onReorder?.(from, to)
  });
  const colOf = (columnDef) => columnDef.meta.col;
  const cellStyle = (c) => ({
    "text-align": c.align ?? "left",
    ...c.width ? {
      width: c.width
    } : {}
  });
  return (() => {
    var _el$2 = _tmpl$6();
    insert(_el$2, createComponent(Show, {
      get when() {
        return props.loading;
      },
      get children() {
        return _tmpl$2();
      }
    }), null);
    insert(_el$2, createComponent(Show, {
      get when() {
        return visibleRows().length;
      },
      get fallback() {
        return props.empty;
      },
      get children() {
        var _el$4 = _tmpl$5(), _el$5 = _el$4.firstChild, _el$6 = _el$5.nextSibling;
        insert(_el$5, createComponent(For, {
          get each() {
            return table.getHeaderGroups();
          },
          children: (hg) => (() => {
            var _el$0 = _tmpl$8();
            insert(_el$0, createComponent(Show, {
              get when() {
                return memo(() => !!props.onReorder)() && withHandle();
              },
              get children() {
                return _tmpl$7();
              }
            }), null);
            insert(_el$0, createComponent(For, {
              get each() {
                return hg.headers;
              },
              children: (header) => {
                const c = () => colOf(header.column.columnDef);
                const canSort = () => header.column.getCanSort();
                return (() => {
                  var _el$10 = _tmpl$9();
                  addEventListener(_el$10, "click", header.column.getToggleSortingHandler(), true);
                  insert(_el$10, () => flexRender(header.column.columnDef.header, header.getContext()), null);
                  insert(_el$10, createComponent(Show, {
                    get when() {
                      return canSort();
                    },
                    get children() {
                      return createComponent(SortMark, {
                        get dir() {
                          return header.column.getIsSorted();
                        }
                      });
                    }
                  }), null);
                  effect((_p$) => {
                    var _v$3 = `${c().class ?? ""} ${c().headClass ?? ""}`.trim() || void 0, _v$4 = {
                      "cursor-pointer select-none": canSort()
                    }, _v$5 = {
                      ...cellStyle(c())
                    };
                    _v$3 !== _p$.e && className(_el$10, _p$.e = _v$3);
                    _p$.t = classList(_el$10, _v$4, _p$.t);
                    _p$.a = style(_el$10, _v$5, _p$.a);
                    return _p$;
                  }, {
                    e: void 0,
                    t: void 0,
                    a: void 0
                  });
                  return _el$10;
                })();
              }
            }), null);
            return _el$0;
          })()
        }));
        insert(_el$6, createComponent(Show, {
          get when() {
            return props.spacerTop;
          },
          get children() {
            var _el$7 = _tmpl$3();
            effect((_$p) => setStyleProperty(_el$7, "height", `${props.spacerTop}px`));
            return _el$7;
          }
        }), null);
        insert(_el$6, createComponent(For, {
          get each() {
            return visibleRows();
          },
          children: (original) => {
            const row = () => rowOf(original);
            return (() => {
              var _el$11 = _tmpl$8();
              _el$11.$$click = () => props.onRowClick?.(original, row().index);
              var _ref$ = props.onReorder ? sortable.bind(row().id) : void 0;
              typeof _ref$ === "function" && use(_ref$, _el$11);
              insert(_el$11, createComponent(Show, {
                get when() {
                  return memo(() => !!props.onReorder)() && withHandle();
                },
                get children() {
                  var _el$12 = _tmpl$0(), _el$13 = _el$12.firstChild;
                  _el$12.$$click = (e) => e.stopPropagation();
                  insert(_el$13, () => props.handle ?? "\u283F");
                  effect((_p$) => {
                    var _v$6 = {
                      "cursor-not-allowed text-base-content": dragDisabled(),
                      "cursor-grab": !dragDisabled()
                    }, _v$7 = dragDisabled() ? "reset sorting to reorder" : "drag";
                    _p$.e = classList(_el$13, _v$6, _p$.e);
                    _v$7 !== _p$.t && setAttribute(_el$13, "title", _p$.t = _v$7);
                    return _p$;
                  }, {
                    e: void 0,
                    t: void 0
                  });
                  return _el$12;
                }
              }), null);
              insert(_el$11, createComponent(For, {
                get each() {
                  return row().getVisibleCells();
                },
                children: (cell) => {
                  const c = () => colOf(cell.column.columnDef);
                  return (() => {
                    var _el$14 = _tmpl$1();
                    addEventListener(_el$14, "click", c().stopClick ? (e) => e.stopPropagation() : void 0, true);
                    insert(_el$14, () => flexRender(cell.column.columnDef.cell, cell.getContext()));
                    effect((_p$) => {
                      var _v$1 = c().class, _v$10 = cellStyle(c());
                      _v$1 !== _p$.e && className(_el$14, _p$.e = _v$1);
                      _p$.t = style(_el$14, _v$10, _p$.t);
                      return _p$;
                    }, {
                      e: void 0,
                      t: void 0
                    });
                    return _el$14;
                  })();
                }
              }), null);
              effect((_p$) => {
                var _v$8 = row().id, _v$9 = props.rowClass?.(original, row().index), _v$0 = {
                  cursor: props.onReorder && !withHandle() && !dragDisabled() ? "grab" : props.onRowClick ? "pointer" : void 0,
                  ...props.rowStyle?.(original, row().index)
                };
                _v$8 !== _p$.e && setAttribute(_el$11, "data-key", _p$.e = _v$8);
                _v$9 !== _p$.t && className(_el$11, _p$.t = _v$9);
                _p$.a = style(_el$11, _v$0, _p$.a);
                return _p$;
              }, {
                e: void 0,
                t: void 0,
                a: void 0
              });
              return _el$11;
            })();
          }
        }), null);
        insert(_el$6, createComponent(Show, {
          get when() {
            return props.spacerBottom;
          },
          get children() {
            var _el$8 = _tmpl$3();
            effect((_$p) => setStyleProperty(_el$8, "height", `${props.spacerBottom}px`));
            return _el$8;
          }
        }), null);
        insert(_el$4, createComponent(Show, {
          get when() {
            return props.footer;
          },
          get children() {
            var _el$9 = _tmpl$4();
            insert(_el$9, () => props.footer);
            return _el$9;
          }
        }), null);
        effect((_p$) => {
          var _v$ = `table ${props.tableClass ?? ""}`, _v$2 = props.headClass;
          _v$ !== _p$.e && className(_el$4, _p$.e = _v$);
          _v$2 !== _p$.t && className(_el$5, _p$.t = _v$2);
          return _p$;
        }, {
          e: void 0,
          t: void 0
        });
        return _el$4;
      }
    }), null);
    effect(() => className(_el$2, props.class));
    return _el$2;
  })();
}
delegateEvents(["click"]);
var _tmpl$10 = /* @__PURE__ */ template(`<div class=join>`);
var _tmpl$22 = /* @__PURE__ */ template(`<div class=join><button>\xAB</button><button>\xBB`);
var _tmpl$32 = /* @__PURE__ */ template(`<div><div class="flex items-center gap-2"><span class=text-sm>`);
var _tmpl$42 = /* @__PURE__ */ template(`<button>`);
var _tmpl$52 = /* @__PURE__ */ template(`<span class="join-item btn btn-sm btn-ghost btn-disabled">\u2026`);
function buildPageNumbers(current, total) {
  if (total <= 10) return Array.from({
    length: total
  }, (_, i) => i + 1);
  const pages = [1];
  let start = Math.max(2, current - 4);
  let end = Math.min(total - 1, current + 4);
  if (end - start < 7) {
    if (start === 2) end = Math.min(total - 1, start + 7);
    else start = Math.max(2, end - 7);
  }
  if (start > 2) pages.push("\u2026");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("\u2026");
  pages.push(total);
  return pages;
}
function DumbPagination(props) {
  const pages = () => Math.max(1, Math.ceil(props.total / props.pageSize));
  const summary = () => props.summary ? props.summary({
    page: props.page,
    pages: pages(),
    total: props.total
  }) : `${props.total} \xB7 ${props.page}/${pages()}`;
  const btn = (active) => `join-item btn btn-sm ${active ? "btn-active" : "btn-ghost"}`;
  return (() => {
    var _el$ = _tmpl$32(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild;
    insert(_el$3, summary);
    insert(_el$2, createComponent(Show, {
      get when() {
        return memo(() => !!props.pageSizes?.length)() && props.onPageSizeChange;
      },
      get children() {
        var _el$4 = _tmpl$10();
        insert(_el$4, createComponent(For, {
          get each() {
            return props.pageSizes;
          },
          children: (size) => (() => {
            var _el$8 = _tmpl$42();
            _el$8.$$click = () => props.onPageSizeChange(size);
            insert(_el$8, size);
            effect(() => className(_el$8, `${btn(props.pageSize === size)} ${props.buttonClass ?? ""} ${props.pageSize === size ? props.activeClass ?? "" : ""}`));
            return _el$8;
          })()
        }));
        return _el$4;
      }
    }), null);
    insert(_el$, createComponent(Show, {
      get when() {
        return pages() > 1;
      },
      get children() {
        var _el$5 = _tmpl$22(), _el$6 = _el$5.firstChild, _el$7 = _el$6.nextSibling;
        _el$6.$$click = () => props.onPageChange(props.page - 1);
        insert(_el$5, createComponent(For, {
          get each() {
            return buildPageNumbers(props.page, pages());
          },
          children: (p) => createComponent(Show, {
            when: p !== "\u2026",
            get fallback() {
              return _tmpl$52();
            },
            get children() {
              var _el$9 = _tmpl$42();
              _el$9.$$click = () => props.onPageChange(p);
              insert(_el$9, p);
              effect(() => className(_el$9, `${btn(props.page === p)} ${props.buttonClass ?? ""} ${props.page === p ? props.activeClass ?? "" : ""}`));
              return _el$9;
            }
          })
        }), _el$7);
        _el$7.$$click = () => props.onPageChange(props.page + 1);
        effect((_p$) => {
          var _v$ = `${btn(false)} ${props.buttonClass ?? ""}`, _v$2 = props.page <= 1, _v$3 = `${btn(false)} ${props.buttonClass ?? ""}`, _v$4 = props.page >= pages();
          _v$ !== _p$.e && className(_el$6, _p$.e = _v$);
          _v$2 !== _p$.t && (_el$6.disabled = _p$.t = _v$2);
          _v$3 !== _p$.a && className(_el$7, _p$.a = _v$3);
          _v$4 !== _p$.o && (_el$7.disabled = _p$.o = _v$4);
          return _p$;
        }, {
          e: void 0,
          t: void 0,
          a: void 0,
          o: void 0
        });
        return _el$5;
      }
    }), null);
    effect(() => className(_el$, `flex flex-wrap items-center justify-between gap-3 ${props.class ?? ""}`));
    return _el$;
  })();
}
delegateEvents(["click"]);

export { DumbPagination, DumbTable, buildPageNumbers };
