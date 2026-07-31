// src/DumbSortable.tsx
import { For } from "solid-js";

// src/solid.ts
import { onCleanup } from "solid-js";

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
    if (dx) scroller.scrollLeft += dx;
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

// src/geometry.ts
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
    if (grid) {
      if (pY > o.bottom) k++;
      else if (pY >= o.top && pX > o.cx) k++;
    } else {
      if (pY > o.cy) k++;
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

// src/sortableCore.ts
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
      const k = grid ? hitIndex(d.others, pX, pY, true) : nextInsertIndex({
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

// src/sortableGroup.ts
var NO_DRAG2 = 'input, textarea, select, option, button, a, label, [contenteditable=""], [contenteditable="true"], [data-no-drag]';
function targetIsInteractive2(ev) {
  return ev.target instanceof Element && !!ev.target.closest(NO_DRAG2);
}
function focusInside2(el) {
  const active = document.activeElement;
  return !!active && active !== document.body && active !== el && el.contains(active);
}
var SLIDE2 = "transform .18s cubic-bezier(.2,.8,.2,1)";
var LONGPRESS2 = 350;
var MOVE_TOL2 = 10;
var LIFT_SHADOW2 = "0 12px 28px -8px rgba(0,0,0,.35)";
var RESET_STYLE_ID = "dumb-sortable-ghost";
var canPopover = () => typeof HTMLElement !== "undefined" && typeof HTMLElement.prototype.showPopover === "function";
function injectGhostReset() {
  if (typeof document === "undefined" || document.getElementById(RESET_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = RESET_STYLE_ID;
  style.textContent = `@layer dumb-sortable {
  [data-dumb-ghost]:popover-open {
    position: fixed; inset: auto; margin: 0; padding: 0; border: 0;
    background: transparent; color: inherit; overflow: visible;
  }
}`;
  document.head.appendChild(style);
}
function makeGhost(src, r) {
  const ghost = src.cloneNode(true);
  ghost.setAttribute("data-dumb-ghost", "");
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
  return ghost;
}
function originOf2(z) {
  return z.scroller ? viewOrigin(z.geom, window.scrollX, window.scrollY) : { top: 0, left: 0 };
}
function boxOf(z) {
  const dx = window.scrollX - z.boxWinX;
  const dy = window.scrollY - z.boxWinY;
  return { top: z.boxTop - dy, left: z.boxLeft - dx, right: z.boxLeft - dx + z.boxW, bottom: z.boxTop - dy + z.boxH };
}
function createSortableGroupEngine(opts) {
  const pressDelay = opts.pressDelay ?? LONGPRESS2;
  const mousePress = opts.mousePressDelay ?? 0;
  const mouseThresh = opts.mouseThreshold ?? 0;
  const zones = /* @__PURE__ */ new Map();
  let drag = null;
  let activeName = null;
  let draggingId = null;
  function snapshot(cb) {
    const out = /* @__PURE__ */ new Map();
    const targets = [];
    for (const z of zones.values()) {
      if (z.el) targets.push(z.el);
      for (const id of z.opts.order()) {
        const el = z.els.get(id);
        if (el) targets.push(el);
      }
    }
    if (!targets.length) {
      cb(out);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) out.set(e.target, e.boundingClientRect);
      io.disconnect();
      cb(out);
    });
    for (const t of targets) io.observe(t);
  }
  function buildZoneSnaps(rects, dragId) {
    const snaps = /* @__PURE__ */ new Map();
    for (const z of zones.values()) {
      if (!z.el) continue;
      const scroller = scrollParent(z.el, true);
      const geom = measure(scroller);
      const s0 = scrollOf(scroller);
      const box = rects.get(z.el);
      const origin = scroller ? viewOrigin(geom, window.scrollX, window.scrollY) : { top: 0, left: 0 };
      const ids = [];
      const cells = [];
      const allCells = [];
      for (const id of z.opts.order()) {
        const el = z.els.get(id);
        const r = el && rects.get(el);
        if (!r) continue;
        const cell = {
          left: r.left - origin.left + s0.sx,
          top: r.top - origin.top + s0.sy,
          width: r.width,
          height: r.height
        };
        allCells.push(cell);
        if (id === dragId) continue;
        ids.push(id);
        cells.push(cell);
      }
      snaps.set(z.name, {
        name: z.name,
        scroller,
        geom,
        boxTop: box ? box.top : geom.top,
        boxLeft: box ? box.left : geom.left,
        boxW: box ? box.width : geom.clientW,
        boxH: box ? box.height : geom.clientH,
        boxWinX: window.scrollX,
        boxWinY: window.scrollY,
        scrollX0: s0.sx,
        scrollY0: s0.sy,
        ids,
        cells,
        top: allCells.length ? allCells[0].top : s0.sy,
        gap: gapOf(allCells)
      });
    }
    return snaps;
  }
  function zoneAt(d, x, y) {
    for (const z of d.zones.values()) {
      const b = boxOf(z);
      if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) {
        const accepts = zones.get(z.name)?.opts.accepts;
        if (accepts && !accepts(d.fromList)) continue;
        return z.name;
      }
    }
    return d.active;
  }
  function applyLayout(d) {
    for (const zz of d.zones.values()) {
      const home = zz.name === d.fromList;
      const to = zz.name === d.active ? d.k : home ? d.fromIndex : null;
      const dy = shiftLayout({
        count: zz.ids.length,
        from: home ? d.fromIndex : null,
        to,
        amount: d.dragH + zz.gap
      });
      zz.ids.forEach((id, i) => {
        const el = zones.get(zz.name)?.els.get(id);
        if (!el) return;
        if (!dy[i]) {
          if (d.touched.has(el)) el.style.transform = "";
          return;
        }
        if (!d.touched.has(el)) {
          d.touched.add(el);
          el.style.willChange = "transform";
          if (!shouldAnimate(opts.animate)) {
            el.style.transform = `translateY(${dy[i]}px)`;
            return;
          }
          el.style.transition = SLIDE2;
          return;
        }
        el.style.transform = `translateY(${dy[i]}px)`;
      });
    }
  }
  function frame() {
    if (!drag) return;
    const d = drag;
    if (d.ghost) {
      d.ghost.style.transform = `translate(${d.lastX - d.startX}px,${d.lastY - d.startY}px)`;
    }
    if (d.ready) {
      const prevActive = d.active;
      const active = zoneAt(d, d.lastX, d.lastY);
      d.active = active;
      activeName = active;
      const z = d.zones.get(active);
      if (z) {
        const origin = originOf2(z);
        let { sx, sy } = scrollOf(z.scroller);
        const speed = d.moved ? autoScrollSpeed({
          pointerY: d.lastY,
          viewTop: origin.top,
          clientH: z.geom.clientH,
          scrollY: sy,
          scrollMax: z.geom.max
        }) : 0;
        if (speed) {
          if (z.scroller) z.scroller.scrollTop += speed;
          else window.scrollBy(0, speed);
          ({ sx, sy } = scrollOf(z.scroller));
        }
        const pY = d.lastY - origin.top + sy;
        const from = active === prevActive ? d.k : 0;
        d.k = nextInsertIndex({
          cells: z.cells,
          gap: z.gap,
          top: z.top,
          holeH: d.dragH,
          k: from,
          pointerY: pY
        });
        applyLayout(d);
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
    window.removeEventListener("keydown", onKey);
  }
  function resetStyles(d) {
    if (d.ghost) {
      try {
        d.ghost.hidePopover();
      } catch {
      }
      d.ghost.remove();
      d.ghost = null;
    }
    d.dragEl.style.cssText = d.prevStyle;
    for (const el of d.touched) {
      el.style.transition = "";
      el.style.transform = "";
      el.style.willChange = "";
    }
  }
  function cleanup() {
    if (!drag) return;
    const d = drag;
    if (d.raf) cancelAnimationFrame(d.raf);
    detach();
    resetStyles(d);
    drag = null;
    activeName = null;
    draggingId = null;
  }
  function onKey(ev) {
    if (ev.key === "Escape" && drag) {
      drag.ready = false;
      cleanup();
    }
  }
  function land(d, done) {
    if (!shouldAnimate(opts.animate)) {
      done();
      return;
    }
    const z = d.zones.get(d.active);
    const ghost = d.ghost;
    if (!z || !ghost) {
      done();
      return;
    }
    const origin = originOf2(z);
    const s = scrollOf(z.scroller);
    const targetY = origin.top + holeTop({ cells: z.cells, gap: z.gap, top: z.top, k: d.k }) - s.sy;
    const targetX = z.cells.length ? origin.left + z.cells[0].left - s.sx : boxOf(z).left;
    ghost.style.transition = SLIDE2;
    ghost.style.transform = `translate(${targetX - d.ghostX0}px,${targetY - d.ghostY0}px)`;
    let fired = false;
    const finish = () => {
      if (fired) return;
      fired = true;
      ghost.removeEventListener("transitionend", finish);
      done();
    };
    ghost.addEventListener("transitionend", finish);
    setTimeout(finish, 240);
  }
  function onUp(ev) {
    if (!drag || ev.pointerId !== drag.pid) return;
    const d = drag;
    const { fromList, fromIndex, active, k, ready } = d;
    if (!ready || fromList === active && k === fromIndex) {
      cleanup();
      return;
    }
    detach();
    if (d.raf) cancelAnimationFrame(d.raf);
    drag = null;
    activeName = null;
    draggingId = null;
    land(d, () => {
      resetStyles(d);
      opts.onEnd({ list: fromList, index: fromIndex }, { list: active, index: k });
    });
  }
  function begin(name, id, handle, pid, x, y) {
    const zone = zones.get(name);
    const dragEl = zone?.els.get(id);
    if (!zone || !dragEl) return;
    if (handle === dragEl && focusInside2(dragEl)) return;
    const fromIndex = zone.opts.order().indexOf(id);
    if (fromIndex < 0) return;
    drag = {
      id,
      fromList: name,
      fromIndex,
      dragEl,
      pid,
      startX: x,
      startY: y,
      lastX: x,
      lastY: y,
      dragH: 0,
      zones: /* @__PURE__ */ new Map(),
      active: name,
      k: fromIndex,
      raf: 0,
      ready: false,
      moved: false,
      prevStyle: dragEl.style.cssText,
      ghost: null,
      ghostX0: 0,
      ghostY0: 0,
      touched: /* @__PURE__ */ new Set()
    };
    draggingId = id;
    activeName = name;
    suppressTextSelection();
    snapshot((rects) => {
      if (!drag || drag.id !== id) return;
      const d = drag;
      const r = rects.get(dragEl);
      d.zones = buildZoneSnaps(rects, id);
      if (r) {
        d.dragH = r.height;
        injectGhostReset();
        d.ghost = makeGhost(dragEl, r);
        d.ghostX0 = r.left;
        d.ghostY0 = r.top;
        dragEl.style.opacity = "0";
      }
      d.ready = true;
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
      begin(p.name, p.id, p.handle, p.pid, ev.clientX, ev.clientY);
    }
  }
  function pendCancel(ev) {
    if (pending && ev.pointerId === pending.pid) clearPending();
  }
  function onDown(name, id, handle, ev) {
    if (ev.button !== 0 || opts.disabled?.() || drag || pending) return;
    const touch = ev.pointerType === "touch";
    const delay = touch ? pressDelay : mousePress;
    if (delay > 0) {
      pending = { name, id, handle, pid: ev.pointerId, x: ev.clientX, y: ev.clientY, timer: 0, mode: "press", thresh: MOVE_TOL2 };
      pending.timer = setTimeout(() => {
        const p = pending;
        clearPending();
        if (p) {
          if (touch) navigator.vibrate?.(8);
          begin(p.name, p.id, p.handle, p.pid, p.x, p.y);
        }
      }, delay);
      addPend();
      return;
    }
    if (!touch && mouseThresh > 0) {
      pending = { name, id, handle, pid: ev.pointerId, x: ev.clientX, y: ev.clientY, timer: 0, mode: "dist", thresh: mouseThresh };
      addPend();
      return;
    }
    ev.preventDefault();
    begin(name, id, handle, ev.pointerId, ev.clientX, ev.clientY);
  }
  return {
    list(name, listOpts) {
      const zone = zones.get(name) ?? { name, opts: listOpts, el: null, els: /* @__PURE__ */ new Map() };
      zone.opts = listOpts;
      zones.set(name, zone);
      return {
        attachContainer(el) {
          zone.el = el;
          return () => {
            if (zone.el === el) zone.el = null;
          };
        },
        attach(el, id) {
          zone.els.set(id, el);
          el.dataset.flipId = id;
          const h = el.querySelector("[data-drag-handle]");
          if (h) h.style.touchAction = "none";
          const down = (ev) => {
            const handle = el.querySelector("[data-drag-handle]");
            if (handle) {
              if (!(ev.target instanceof Node && handle.contains(ev.target))) return;
            } else if (targetIsInteractive2(ev)) {
              return;
            }
            onDown(name, id, handle || el, ev);
          };
          el.addEventListener("pointerdown", down);
          return () => {
            el.removeEventListener("pointerdown", down);
            if (zone.els.get(id) === el) zone.els.delete(id);
          };
        }
      };
    },
    activeList: () => activeName,
    draggingId: () => draggingId,
    destroy() {
      clearPending();
      cleanup();
    }
  };
}

// src/solid.ts
function createDumbSortable(opts) {
  const engine = createSortableEngine(opts);
  onCleanup(engine.destroy);
  return {
    bind: (id) => (el) => onCleanup(engine.attach(el, id)),
    row: (id) => (el) => onCleanup(engine.attachRow(el, id)),
    handle: (id) => (el) => onCleanup(engine.attachHandle(el, id))
  };
}
function createSortableGroup(opts) {
  const engine = createSortableGroupEngine(opts);
  onCleanup(engine.destroy);
  return {
    list(name, listOpts) {
      const zone = engine.list(name, listOpts);
      return {
        container: (el) => onCleanup(zone.attachContainer(el)),
        bind: (id) => (el) => onCleanup(zone.attach(el, id))
      };
    },
    activeList: engine.activeList,
    draggingId: engine.draggingId
  };
}

// src/DumbSortable.tsx
function DumbSortable(props) {
  const s = createDumbSortable({
    order: () => props.items.map(props.id),
    axis: props.axis,
    disabled: props.disabled,
    pressDelay: props.pressDelay,
    mousePressDelay: props.mousePressDelay,
    mouseThreshold: props.mouseThreshold,
    animate: props.animate,
    onEnd: (from, to) => {
      const next = props.items.slice();
      next.splice(to, 0, next.splice(from, 1)[0]);
      props.setItems(next);
    }
  });
  return <For each={props.items}>
      {(item, i) => {
    const el = props.children(item, i);
    if (el instanceof HTMLElement) s.bind(props.id(item))(el);
    return el;
  }}
    </For>;
}
export {
  DumbSortable,
  createDumbSortable,
  createSortableEngine,
  createSortableGroup,
  createSortableGroupEngine
};
