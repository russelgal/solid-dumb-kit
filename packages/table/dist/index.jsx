// src/DumbTable.tsx
import { For as For2, Show, createSignal, createMemo } from "solid-js";
import {
  createSolidTable,
  flexRender,
  getCoreRowModel,
  getSortedRowModel
} from "@tanstack/solid-table";

// ../sortable/dist/index.js
import { createComponent } from "solid-js/web";
import { onCleanup, For } from "solid-js";
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

// ../shared/dist/index.js
import * as solid from "solid-js";
import { createEffect, untrack } from "solid-js";
function prefersReducedMotion2() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function shouldAnimate2(explicit) {
  if (explicit !== void 0) return explicit;
  return !prefersReducedMotion2();
}

// src/DumbTable.tsx
var withViewTransition = (on, fn) => {
  const doc = document;
  if (on && shouldAnimate2() && typeof doc.startViewTransition === "function") doc.startViewTransition(fn);
  else fn();
};
function SortMark(props) {
  return <span aria-hidden="true" style={{ "margin-left": "4px", opacity: props.dir ? "1" : ".3" }}>
      {props.dir === "asc" ? "\u25B2" : props.dir === "desc" ? "\u25BC" : "\u21C5"}
    </span>;
}
function DumbTable(props) {
  const [localSort, setLocalSort] = createSignal([]);
  const serverMode = () => !!props.onSort;
  const sorting = () => serverMode() ? props.sort ? [{ id: props.sort, desc: props.order === "desc" }] : [] : localSort();
  const defs = () => props.columns.map((c) => ({
    id: c.key,
    // accessorFn обязателен: без него TanStack считает колонку display-колонкой,
    // getCanSort() всегда false и сортировка молча выключается — даже когда
    // сортирует сервер и само значение не используется.
    accessorFn: (row) => c.value ? c.value(row) : row[c.key],
    header: () => c.label ?? c.key,
    enableSorting: !!c.sortable,
    ...props.sortDescFirst === void 0 ? {} : { sortDescFirst: props.sortDescFirst },
    cell: (ctx) => c.render ? c.render(ctx.row.original, ctx.row.index) : String(ctx.getValue() ?? ""),
    meta: { col: c }
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
    ...c.width ? { width: c.width } : {}
  });
  return <div
    class={props.class}
    style={{ opacity: props.loading ? ".5" : "1", transition: "opacity .15s" }}
  >
      <Show when={visibleRows().length} fallback={props.empty}>
        <table
    class={props.tableClass}
    style={{ width: "100%", "border-collapse": "collapse" }}
  >
          <thead class={props.headClass}>
            <For2 each={table.getHeaderGroups()}>
              {(hg) => <tr>
                  <Show when={props.onReorder && withHandle()}>
                    <th style={{ width: "1%" }} />
                  </Show>
                  <For2 each={hg.headers}>
                    {(header) => {
    const c = () => colOf(header.column.columnDef);
    const canSort = () => header.column.getCanSort();
    return <th
      class={`${c().class ?? ""} ${c().headClass ?? ""}`.trim() || void 0}
      style={{
        ...cellStyle(c()),
        padding: "6px 8px",
        "white-space": "nowrap",
        cursor: canSort() ? "pointer" : void 0,
        "user-select": canSort() ? "none" : void 0
      }}
      onClick={header.column.getToggleSortingHandler()}
    >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <Show when={canSort()}>
                            <SortMark dir={header.column.getIsSorted()} />
                          </Show>
                        </th>;
  }}
                  </For2>
                </tr>}
            </For2>
          </thead>

          <tbody>
            <Show when={props.spacerTop}>
              <tr aria-hidden="true" style={{ height: `${props.spacerTop}px` }} />
            </Show>
            <For2 each={visibleRows()}>
              {(original) => {
    const row = () => rowOf(original);
    return <tr
      ref={props.onReorder ? sortable.bind(row().id) : void 0}
      data-key={row().id}
      class={props.rowClass?.(original, row().index)}
      style={{
        cursor: props.onReorder && !withHandle() && !dragDisabled() ? "grab" : props.onRowClick ? "pointer" : void 0,
        ...props.rowStyle?.(original, row().index)
      }}
      onClick={() => props.onRowClick?.(original, row().index)}
    >
                  <Show when={props.onReorder && withHandle()}>
                    <td style={{ padding: "6px 4px", width: "1%" }} onClick={(e) => e.stopPropagation()}>
                      <span
      data-drag-handle
      style={{
        display: "inline-block",
        cursor: dragDisabled() ? "not-allowed" : "grab",
        opacity: dragDisabled() ? ".3" : "1",
        "touch-action": "none"
      }}
      title={dragDisabled() ? "reset sorting to reorder" : "drag"}
    >
                        {props.handle ?? "\u283F"}
                      </span>
                    </td>
                  </Show>
                  <For2 each={row().getVisibleCells()}>
                    {(cell) => {
      const c = () => colOf(cell.column.columnDef);
      return <td
        class={c().class}
        style={{ ...cellStyle(c()), padding: "6px 8px" }}
        onClick={c().stopClick ? (e) => e.stopPropagation() : void 0}
      >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>;
    }}
                  </For2>
                </tr>;
  }}
            </For2>
            <Show when={props.spacerBottom}>
              <tr aria-hidden="true" style={{ height: `${props.spacerBottom}px` }} />
            </Show>
          </tbody>

          <Show when={props.footer}>
            <tfoot>{props.footer}</tfoot>
          </Show>
        </table>
      </Show>
    </div>;
}

// src/DumbPagination.tsx
import { For as For3, Show as Show2 } from "solid-js";
function buildPageNumbers(current, total) {
  if (total <= 10) return Array.from({ length: total }, (_, i) => i + 1);
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
  const summary = () => props.summary ? props.summary({ page: props.page, pages: pages(), total: props.total }) : `${props.total} \xB7 ${props.page}/${pages()}`;
  const btn = (active, disabled) => ({
    padding: "3px 9px",
    "min-width": "32px",
    border: "1px solid currentColor",
    "border-radius": "6px",
    background: "transparent",
    color: "inherit",
    font: "inherit",
    opacity: disabled ? ".35" : active ? "1" : ".7",
    cursor: disabled ? "default" : "pointer",
    "font-weight": active ? "700" : "400"
  });
  return <div
    class={props.class}
    style={{
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      gap: "12px",
      "flex-wrap": "wrap"
    }}
  >
      <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
        <span style={{ opacity: ".7", "font-size": "13px" }}>{summary()}</span>
        <Show2 when={props.pageSizes?.length && props.onPageSizeChange}>
          <div style={{ display: "flex", gap: "4px" }}>
            <For3 each={props.pageSizes}>
              {(size) => <button
    class={`${props.buttonClass ?? ""} ${props.pageSize === size ? props.activeClass ?? "" : ""}`.trim() || void 0}
    style={btn(props.pageSize === size, false)}
    onClick={() => props.onPageSizeChange(size)}
  >
                  {size}
                </button>}
            </For3>
          </div>
        </Show2>
      </div>

      <Show2 when={pages() > 1}>
        <div style={{ display: "flex", gap: "4px", "flex-wrap": "wrap" }}>
          <button
    class={props.buttonClass}
    style={btn(false, props.page <= 1)}
    disabled={props.page <= 1}
    onClick={() => props.onPageChange(props.page - 1)}
  >
            «
          </button>
          <For3 each={buildPageNumbers(props.page, pages())}>
            {(p) => <Show2 when={p !== "\u2026"} fallback={<span style={{ padding: "3px 4px", opacity: ".4" }}>…</span>}>
                <button
    class={`${props.buttonClass ?? ""} ${props.page === p ? props.activeClass ?? "" : ""}`.trim() || void 0}
    style={btn(props.page === p, false)}
    onClick={() => props.onPageChange(p)}
  >
                  {p}
                </button>
              </Show2>}
          </For3>
          <button
    class={props.buttonClass}
    style={btn(false, props.page >= pages())}
    disabled={props.page >= pages()}
    onClick={() => props.onPageChange(props.page + 1)}
  >
            »
          </button>
        </div>
      </Show2>
    </div>;
}
export {
  DumbPagination,
  DumbTable,
  buildPageNumbers
};
