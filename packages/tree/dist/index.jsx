// src/DumbTree.tsx
import { createMemo, createSignal, For as For2, Show } from "solid-js";
import { makePersisted } from "@solid-primitives/storage";

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

// src/DumbTree.tsx
function fuzzy(q, text) {
  if (!q) return true;
  q = q.toLowerCase();
  text = (text || "").toLowerCase();
  if (text.includes(q)) return true;
  let i = 0;
  for (const ch of text) {
    if (ch === q[i]) i++;
    if (i === q.length) return true;
  }
  return false;
}
var DEFAULT_LABELS = {
  search: "\u041F\u043E\u0438\u0441\u043A",
  sortIndex: "\u0418\u043D\u0434\u0435\u043A\u0441",
  sortName: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435"
};
function DumbTree(props) {
  const nodes = () => props.nodes;
  const icons = () => props.icons;
  const labels = () => ({ ...DEFAULT_LABELS, ...props.labels });
  const activeId = () => props.activeId?.();
  const [q, setQ] = createSignal("");
  const key = props.storageKey ?? "dumb-tree";
  const [expanded, setExpanded] = makePersisted(createSignal(/* @__PURE__ */ new Set()), {
    name: `${key}:expanded`,
    serialize: (s) => JSON.stringify([...s]),
    deserialize: (str) => new Set(JSON.parse(str))
  });
  const [sort, setSort] = makePersisted(createSignal("index"), {
    name: `${key}:sort`,
    serialize: (vv) => vv,
    deserialize: (s) => s === "name" ? "name" : "index"
  });
  const sortMode = () => props.hideSort ? "index" : sort();
  const cmp = (a, b) => sortMode() === "name" ? a.title.localeCompare(b.title, props.locale) || (a.index ?? 0) - (b.index ?? 0) : (a.index ?? 0) - (b.index ?? 0) || a.title.localeCompare(b.title, props.locale);
  const byId = createMemo(() => new Map((nodes() ?? []).map((n) => [n.id, n])));
  const childrenOf = createMemo(() => {
    const m = /* @__PURE__ */ new Map();
    for (const n of nodes() ?? []) {
      let a = m.get(n.parent);
      if (!a) {
        a = [];
        m.set(n.parent, a);
      }
      a.push(n);
    }
    for (const a of m.values()) a.sort(cmp);
    return m;
  });
  const rootId = createMemo(() => {
    const ns = nodes() ?? [];
    if (!ns.length) return 0;
    const ids = new Set(ns.map((n) => n.id));
    return (ns.find((n) => !ids.has(n.parent)) ?? ns[0]).id;
  });
  const matches = (n, query) => props.match ? props.match(n, query) : fuzzy(query, n.title) || !!n.meta && fuzzy(query, n.meta) || String(n.id).includes(query);
  const visible = createMemo(() => {
    const query = q().trim().toLowerCase();
    if (!query) return null;
    const ids = byId();
    const show = /* @__PURE__ */ new Set();
    for (const n of nodes() ?? []) {
      if (matches(n, query)) {
        let cur = n;
        while (cur) {
          show.add(cur.id);
          cur = ids.get(cur.parent);
        }
      }
    }
    return show;
  });
  const flatList = createMemo(() => {
    const query = q().trim().toLowerCase();
    return (nodes() ?? []).filter((n) => !query || matches(n, query)).sort(cmp);
  });
  const fs = createDumbSortable({
    order: () => flatList().map((n) => String(n.id)),
    disabled: () => !!q().trim(),
    get animate() {
      return props.animate;
    },
    onEnd: (from, to) => props.sortable?.(from, to)
  });
  const toggle = (id) => setExpanded((s) => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const defaultTitle = (n) => `${n.title}${n.meta ? " \xB7 " + n.meta : ""} \xB7 id ${n.id}`;
  const RowLink = (p) => <a
    class={`flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer rounded px-1.5 py-0.5 ${activeId() === p.node.id ? "bg-primary/10 text-primary" : "hover:bg-base-200"} ${props.rowClass?.(p.node) ?? ""}`}
    onClick={() => props.onSelect?.(p.node.id, p.node)}
    title={props.rowTitle ? props.rowTitle(p.node) : defaultTitle(p.node)}
  >
      <span class={`size-4 shrink-0 ${p.icon}`} />
      <span class={`truncate ${props.titleClass?.(p.node) ?? ""}`}>{p.node.title}</span>
      <Show when={props.rowExtra}>
        <span class="ml-auto shrink-0 flex items-center gap-1">{props.rowExtra(p.node)}</span>
      </Show>
    </a>;
  function Node2(p) {
    const node = () => byId().get(p.id);
    const kids = () => childrenOf().get(p.id) ?? [];
    const isExpanded = () => visible() ? true : expanded().has(p.id);
    return <Show when={node() && (!visible() || visible().has(p.id))}>
        <li>
          <div class="flex items-center">
            <Show when={kids().length} fallback={<span class="w-5 shrink-0" />}>
              <button class="btn btn-ghost btn-xs btn-square" onClick={() => toggle(p.id)}>
                <span class={`size-4 ${isExpanded() ? icons().expanded : icons().collapsed}`} />
              </button>
            </Show>
            <RowLink
      node={node()}
      icon={isExpanded() && kids().length ? icons().folderOpen : icons().folder}
    />
          </div>
          <Show when={isExpanded() && kids().length}>
            <ul class="pl-3 border-l border-base-200 ml-3">
              <For2 each={kids()}>{(k) => <Node2 id={k.id} />}</For2>
            </ul>
          </Show>
        </li>
      </Show>;
  }
  return <aside class={`w-64 shrink-0 sticky top-0 self-start max-h-screen overflow-y-auto ${props.class ?? ""}`}>
      <Show when={props.title}>
        <div class="text-xs opacity-50 mb-2 px-1">{props.title}</div>
      </Show>
      <Show when={!props.hideSearch}>
        <label class="input input-sm input-bordered flex items-center gap-2 mb-2 w-full">
          <span class={`size-4 opacity-50 ${icons().search}`} />
          <input value={q()} onInput={(e) => setQ(e.currentTarget.value)} placeholder={props.placeholder ?? labels().search} class="grow" />
        </label>
      </Show>
      <Show when={!props.hideSort}>
        <div class="join mb-2 w-full">
          <button
    class={`btn btn-xs join-item grow gap-1 ${sort() === "index" ? "btn-active btn-primary" : "btn-ghost"}`}
    onClick={() => setSort("index")}
    title={labels().sortIndex}
  >
            <span class={`size-3.5 ${icons().sortIndex}`} />
            {labels().sortIndex}
          </button>
          <button
    class={`btn btn-xs join-item grow gap-1 ${sort() === "name" ? "btn-active btn-primary" : "btn-ghost"}`}
    onClick={() => setSort("name")}
    title={labels().sortName}
  >
            <span class={`size-3.5 ${icons().sortName}`} />
            {labels().sortName}
          </button>
        </div>
      </Show>
      <Show when={nodes()} fallback={<span class="loading loading-spinner" />}>
        <ul class="bg-base-100 rounded-box shadow w-full text-sm p-2 max-h-[80vh] overflow-auto">
          <Show
    when={props.flat}
    fallback={<For2 each={childrenOf().get(rootId()) ?? []}>{(n) => <Node2 id={n.id} />}</For2>}
  >
            <For2 each={flatList()}>
              {(n) => <li ref={props.sortable ? fs.bind(String(n.id)) : void 0} class="flex items-center">
                  <Show when={props.sortable}>
                    <button data-drag-handle type="button" class="cursor-grab text-base-content/30 hover:text-base-content shrink-0" title="Перетащить">
                      <span class={`size-4 ${icons().dragHandle}`} />
                    </button>
                  </Show>
                  <RowLink node={n} icon={icons().leaf} />
                </li>}
            </For2>
          </Show>
        </ul>
      </Show>
    </aside>;
}
export {
  DumbTree
};
