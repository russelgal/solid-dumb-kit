import { delegateEvents, use, insert, effect, className, createComponent, setStyleProperty, setAttribute, memo, template } from 'solid-js/web';
import { onMount, onCleanup, createSignal, For, Show, createMemo } from 'solid-js';
import VanillaSelectionArea from '@viselect/vanilla';
import { makePersisted } from '@solid-primitives/storage';
import * as v from 'valibot';

// src/SelectionArea.tsx
var _tmpl$ = /* @__PURE__ */ template(`<div style=position:relative>`);
function SelectionArea(props) {
  let containerRef;
  onMount(() => {
    const selection = new VanillaSelectionArea({
      selectables: [props.selectables],
      boundaries: props.boundaries ?? [containerRef],
      container: containerRef,
      selectionAreaClass: props.selectionAreaClass ?? "viselect-area",
      behaviour: {
        overlap: "invert",
        intersect: props.intersect ?? "touch",
        startThreshold: 10,
        ...props.behaviour
      },
      features: {
        touch: true,
        range: true,
        singleTap: {
          allow: true,
          intersect: "native"
        },
        deselectOnBlur: false,
        ...props.features
      }
    });
    selection.on("beforestart", (e) => {
      const target = e.event?.target;
      if (target?.closest("button, a, input, [data-no-select]")) return false;
      if (props.windowScroll) containerRef.classList.add("viselect-window-scroll");
      return props.onBeforeStart?.(e) ?? true;
    }).on("start", ({
      store,
      event
    }) => {
      const e = event;
      const isAdditive = e instanceof MouseEvent ? e.shiftKey || e.metaKey || e.ctrlKey : false;
      if (!isAdditive) {
        selection.clearSelection();
        store.stored.forEach((el) => el.classList.remove("viselect-selected"));
      }
    }).on("move", (e) => {
      const {
        added,
        removed
      } = e.store.changed;
      added.forEach((el) => el.classList.add("viselect-selected"));
      removed.forEach((el) => el.classList.remove("viselect-selected"));
      props.onSelect?.(e);
    }).on("stop", (e) => {
      if (props.windowScroll) {
        containerRef.classList.remove("viselect-window-scroll");
        setTimeout(() => window.getSelection()?.removeAllRanges(), 50);
      }
      props.onStop?.(e);
    });
    onCleanup(() => selection.destroy());
  });
  return (() => {
    var _el$ = _tmpl$();
    var _ref$ = containerRef;
    typeof _ref$ === "function" ? use(_ref$, _el$) : containerRef = _el$;
    insert(_el$, () => props.children);
    effect(() => className(_el$, props.class));
    return _el$;
  })();
}
var _tmpl$2 = /* @__PURE__ */ template(`<div class=resizable-grid-handle-row>`);
var _tmpl$22 = /* @__PURE__ */ template(`<div style=display:grid;min-height:0>`);
var _tmpl$3 = /* @__PURE__ */ template(`<div style=display:grid;height:100%;width:100%;overflow:hidden><div style=display:grid;min-height:0>`);
var _tmpl$4 = /* @__PURE__ */ template(`<div class=resizable-grid-handle-col>`);
var _tmpl$5 = /* @__PURE__ */ template(`<div style=min-width:0;min-height:0;overflow:auto>`);
var HANDLE_SIZE = 6;
var DEFAULT_MIN = 100;
var SizesSchema = v.object({
  cols: v.array(v.number()),
  rows: v.optional(v.array(v.number())),
  rowSplit: v.optional(v.array(v.number()))
});
function validateSizes(raw, defaults) {
  const result = v.safeParse(SizesSchema, raw);
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
      document.body.style.userSelect = "";
    }
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
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
      document.body.style.userSelect = "";
    }
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
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
      document.body.style.userSelect = "";
    }
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
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
  const style = document.createElement("style");
  style.textContent = `
.resizable-grid-handle-col {
  cursor: col-resize;
  background: transparent;
  transition: background 0.15s;
  z-index: 1;
}
.resizable-grid-handle-col:hover,
.resizable-grid-handle-col:active {
  background: oklch(from currentColor l c h / 0.15);
}
.resizable-grid-handle-row {
  cursor: row-resize;
  background: transparent;
  transition: background 0.15s;
  z-index: 1;
}
.resizable-grid-handle-row:hover,
.resizable-grid-handle-row:active {
  background: oklch(from currentColor l c h / 0.15);
}`;
  document.head.appendChild(style);
}
delegateEvents(["mousedown"]);
var SLIDE = "transform .18s cubic-bezier(.2,.8,.2,1)";
var EDGE = 48;
var MAX_SPEED = 18;
var ACCEL = 3.5;
var LONGPRESS = 350;
var MOVE_TOL = 10;
var LIFT_SHADOW = "0 10px 24px -6px rgba(0,0,0,.28)";
function scrollParent(el) {
  let n = el.parentElement;
  while (n) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll" || oy === "overlay") && n.scrollHeight > n.clientHeight) return n;
    n = n.parentElement;
  }
  return null;
}
function view(scroller) {
  if (scroller) {
    const r = scroller.getBoundingClientRect();
    return { top: r.top, left: r.left, sy: scroller.scrollTop, sx: scroller.scrollLeft, clientH: scroller.clientHeight, clientW: scroller.clientWidth, max: scroller.scrollHeight - scroller.clientHeight };
  }
  const se = document.scrollingElement || document.documentElement;
  return { top: 0, left: 0, sy: window.scrollY, sx: window.scrollX, clientH: window.innerHeight, clientW: window.innerWidth, max: se.scrollHeight - window.innerHeight };
}
function doScroll(scroller, dy) {
  if (scroller) scroller.scrollTop += dy;
  else window.scrollBy(0, dy);
}
function createDumbSortable(opts) {
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
  function hitIndex(d, pX, pY) {
    let k = 0;
    for (const o of d.others) {
      if (grid) {
        if (pY > o.bottom) k++;
        else if (pY >= o.top && pX > o.cx) k++;
      } else {
        if (pY > o.cy) k++;
      }
    }
    return k;
  }
  function frame() {
    if (!drag) return;
    const d = drag;
    const v2 = view(d.scroller);
    let speed = 0;
    if (d.moved) {
      const distTop = d.lastY - v2.top;
      const distBot = v2.top + v2.clientH - d.lastY;
      if (distTop < EDGE && v2.sy > 0) {
        const over = (EDGE - distTop) / EDGE;
        speed = -Math.min(MAX_SPEED * ACCEL, MAX_SPEED * over);
      } else if (distBot < EDGE && v2.sy < d.scrollMax0) {
        const over = (EDGE - distBot) / EDGE;
        speed = Math.min(MAX_SPEED * ACCEL, MAX_SPEED * over);
      }
    }
    if (speed) doScroll(d.scroller, speed);
    const vv = speed ? view(d.scroller) : v2;
    let tx = grid ? d.lastX - d.startX + (vv.sx - d.scrollX0) : 0;
    let ty = d.lastY - d.startY + (vv.sy - d.scrollY0);
    const cell = d.cells.length ? d.cells[d.fromIndex] : d.selfCell;
    if (cell) {
      const top = Math.max(vv.sy, Math.min(vv.sy + vv.clientH - cell.height, cell.top + ty));
      ty = top - cell.top;
      if (grid) {
        const left = Math.max(vv.sx, Math.min(vv.sx + vv.clientW - cell.width, cell.left + tx));
        tx = left - cell.left;
      }
    }
    d.dragEl.style.transform = `translate(${tx}px,${ty}px)`;
    if (d.ready) {
      const pX = d.lastX - vv.left + vv.sx;
      const pY = d.lastY - vv.top + vv.sy;
      const k = hitIndex(d, pX, pY);
      d.toIndex = k;
      if (grid) {
        d.ids.forEach((id, i) => {
          if (id === d.id) return;
          const el = rowEls.get(id);
          if (!el) return;
          const ri = i < d.fromIndex ? i : i - 1;
          const newVis = ri < k ? ri : ri + 1;
          const cell2 = d.cells[newVis], me = d.cells[i];
          const dx = cell2.left - me.left, dy = cell2.top - me.top;
          el.style.transform = dx || dy ? `translate(${dx}px,${dy}px)` : "";
        });
      } else {
        const dragH = d.cells[d.fromIndex].height;
        const colTop = d.cells[0].top;
        const gap = d.cells.length > 1 ? Math.max(0, d.cells[1].top - d.cells[0].top - d.cells[0].height) : 0;
        let cursor = colTop, oi = 0;
        for (let v3 = 0; v3 < d.ids.length; v3++) {
          if (v3 === k) {
            cursor += dragH + gap;
            continue;
          }
          while (d.ids[oi] === d.id) oi++;
          const oc = d.cells[oi];
          const el = rowEls.get(d.ids[oi]);
          oi++;
          if (el) {
            const dy = cursor - oc.top;
            el.style.transform = dy ? `translateY(${dy}px)` : "";
          }
          cursor += oc.height + gap;
        }
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
  function cleanup() {
    if (!drag) return;
    const d = drag;
    if (d.raf) cancelAnimationFrame(d.raf);
    for (const id of d.ids) {
      const el = rowEls.get(id);
      if (!el) continue;
      el.style.transition = "";
      el.style.transform = "";
      el.style.zIndex = "";
      el.style.position = "";
      el.style.willChange = "";
      el.style.boxShadow = "";
      el.style.opacity = "";
      el.style.cursor = "";
    }
    document.body.style.userSelect = "";
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    drag = null;
  }
  function onUp(ev) {
    if (!drag || ev.pointerId !== drag.pid) return;
    const { fromIndex, toIndex, ready } = drag;
    cleanup();
    if (ready && toIndex !== fromIndex) opts.onEnd(fromIndex, toIndex);
  }
  function begin(id, handle, pid, x, y) {
    const dragEl = rowEls.get(id);
    if (!dragEl) return;
    const ids = opts.order();
    const fromIndex = ids.indexOf(id);
    if (fromIndex < 0) return;
    const scroller = scrollParent(dragEl);
    const v0 = view(scroller);
    const r0 = dragEl.getBoundingClientRect();
    const selfCell = { left: r0.left - v0.left + v0.sx, top: r0.top - v0.top + v0.sy, width: r0.width, height: r0.height };
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
      selfCell,
      others: [],
      toIndex: fromIndex,
      scroller,
      scrollX0: v0.sx,
      scrollY0: v0.sy,
      scrollMax0: v0.max,
      raf: 0,
      ready: false,
      moved: false
    };
    dragEl.style.position = "relative";
    dragEl.style.zIndex = "2";
    dragEl.style.willChange = "transform";
    dragEl.style.boxShadow = LIFT_SHADOW;
    dragEl.style.opacity = "0.97";
    dragEl.style.cursor = "grabbing";
    dragEl.style.transition = "box-shadow .15s ease, opacity .15s ease";
    document.body.style.userSelect = "none";
    for (const oid of ids) {
      if (oid === id) continue;
      const el = rowEls.get(oid);
      if (el) {
        el.style.transition = SLIDE;
        el.style.willChange = "transform";
      }
    }
    snapshot(ids, (rects) => {
      if (!drag || drag.id !== id) return;
      const w = view(scroller);
      const ox = (r) => r.left - w.left + w.sx;
      const oy = (r) => r.top - w.top + w.sy;
      drag.cells = ids.map((i) => {
        const r = rects.get(i);
        return r ? { left: ox(r), top: oy(r), width: r.width, height: r.height } : { left: 0, top: 0, width: 0, height: 0 };
      });
      drag.others = ids.filter((oid) => oid !== id).map((oid) => {
        const r = rects.get(oid);
        const l = ox(r), t = oy(r);
        return { id: oid, cx: l + r.width / 2, cy: t + r.height / 2, top: t, bottom: t + r.height };
      });
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
  onCleanup(() => {
    clearPending();
    cleanup();
  });
  return {
    // самодостаточный ref: регистрирует элемент И навешивает старт драга.
    // ручка = дочка с [data-drag-handle] (делегирование); нет её → тянем за весь элемент.
    bind: (id) => (el) => {
      el.dataset.flipId = id;
      rowEls.set(id, el);
      const h = el.querySelector("[data-drag-handle]");
      if (h) h.style.touchAction = "none";
      const down = (ev) => {
        const handle = el.querySelector("[data-drag-handle]");
        if (handle && !(ev.target instanceof Node && handle.contains(ev.target))) return;
        onDown(id, handle || el, ev);
      };
      el.addEventListener("pointerdown", down);
      onCleanup(() => {
        el.removeEventListener("pointerdown", down);
        if (rowEls.get(id) === el) rowEls.delete(id);
      });
    },
    // низкоуровневые рефы (для ручной разводки; используются текущими DataTable/ColorsEditor)
    row: (id) => (el) => {
      el.dataset.flipId = id;
      rowEls.set(id, el);
      onCleanup(() => {
        if (rowEls.get(id) === el) rowEls.delete(id);
      });
    },
    handle: (id) => (el) => {
      const down = (ev) => onDown(id, el, ev);
      el.addEventListener("pointerdown", down);
      onCleanup(() => el.removeEventListener("pointerdown", down));
    }
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
    onEnd: (from, to) => {
      const next = props.items.slice();
      next.splice(to, 0, next.splice(from, 1)[0]);
      props.setItems(next);
    }
  });
  return createComponent(For, {
    get each() {
      return props.items;
    },
    children: (item, i) => {
      const el = props.children(item, i);
      if (el instanceof HTMLElement) s.bind(props.id(item))(el);
      return el;
    }
  });
}
var _tmpl$6 = /* @__PURE__ */ template(`<span class="ml-auto shrink-0 flex items-center gap-1">`);
var _tmpl$23 = /* @__PURE__ */ template(`<a><span></span><span>`);
var _tmpl$32 = /* @__PURE__ */ template(`<button class="btn btn-ghost btn-xs btn-square"><span>`);
var _tmpl$42 = /* @__PURE__ */ template(`<ul class="pl-3 border-l border-base-200 ml-3">`);
var _tmpl$52 = /* @__PURE__ */ template(`<li><div class="flex items-center">`);
var _tmpl$62 = /* @__PURE__ */ template(`<span class="w-5 shrink-0">`);
var _tmpl$7 = /* @__PURE__ */ template(`<div class="text-xs opacity-50 mb-2 px-1">`);
var _tmpl$8 = /* @__PURE__ */ template(`<label class="input input-sm input-bordered flex items-center gap-2 mb-2 w-full"><span></span><input class=grow>`);
var _tmpl$9 = /* @__PURE__ */ template(`<div class="join mb-2 w-full"><button><span></span></button><button><span>`);
var _tmpl$0 = /* @__PURE__ */ template(`<ul class="bg-base-100 rounded-box shadow w-full text-sm p-2 max-h-[80vh] overflow-auto">`);
var _tmpl$1 = /* @__PURE__ */ template(`<aside>`);
var _tmpl$10 = /* @__PURE__ */ template(`<span class="loading loading-spinner">`);
var _tmpl$11 = /* @__PURE__ */ template(`<button data-drag-handle type=button class="cursor-grab text-base-content/30 hover:text-base-content shrink-0"title=\u041F\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u044C><span>`);
var _tmpl$12 = /* @__PURE__ */ template(`<li class="flex items-center">`);
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
var DEFAULT_ICONS = {
  folder: "icon-[solar--folder-linear] text-secondary",
  folderOpen: "icon-[solar--folder-open-linear] text-primary",
  leaf: "icon-[solar--tag-linear] text-secondary",
  expanded: "icon-[solar--alt-arrow-down-linear]",
  collapsed: "icon-[solar--alt-arrow-right-linear]",
  search: "icon-[solar--magnifer-linear]",
  sortIndex: "icon-[solar--sort-vertical-linear]",
  sortName: "icon-[solar--sort-by-alphabet-linear]",
  dragHandle: "icon-[solar--hamburger-menu-linear]"
};
var DEFAULT_LABELS = {
  search: "\u041F\u043E\u0438\u0441\u043A",
  sortIndex: "\u0418\u043D\u0434\u0435\u043A\u0441",
  sortName: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435"
};
function DumbTree(props) {
  const nodes = () => props.nodes;
  const icons = () => ({
    ...DEFAULT_ICONS,
    ...props.icons
  });
  const labels = () => ({
    ...DEFAULT_LABELS,
    ...props.labels
  });
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
    onEnd: (from, to) => props.sortable?.(from, to)
  });
  const toggle = (id) => setExpanded((s) => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const defaultTitle = (n) => `${n.title}${n.meta ? " \xB7 " + n.meta : ""} \xB7 id ${n.id}`;
  const RowLink = (p) => (() => {
    var _el$ = _tmpl$23(), _el$2 = _el$.firstChild, _el$3 = _el$2.nextSibling;
    _el$.$$click = () => props.onSelect?.(p.node.id, p.node);
    insert(_el$3, () => p.node.title);
    insert(_el$, createComponent(Show, {
      get when() {
        return props.rowExtra;
      },
      get children() {
        var _el$4 = _tmpl$6();
        insert(_el$4, () => props.rowExtra(p.node));
        return _el$4;
      }
    }), null);
    effect((_p$) => {
      var _v$ = `flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer rounded px-1.5 py-0.5 ${activeId() === p.node.id ? "bg-primary/10 text-primary" : "hover:bg-base-200"} ${props.rowClass?.(p.node) ?? ""}`, _v$2 = props.rowTitle ? props.rowTitle(p.node) : defaultTitle(p.node), _v$3 = `size-4 shrink-0 ${p.icon}`, _v$4 = `truncate ${props.titleClass?.(p.node) ?? ""}`;
      _v$ !== _p$.e && className(_el$, _p$.e = _v$);
      _v$2 !== _p$.t && setAttribute(_el$, "title", _p$.t = _v$2);
      _v$3 !== _p$.a && className(_el$2, _p$.a = _v$3);
      _v$4 !== _p$.o && className(_el$3, _p$.o = _v$4);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0,
      o: void 0
    });
    return _el$;
  })();
  function Node2(p) {
    const node = () => byId().get(p.id);
    const kids = () => childrenOf().get(p.id) ?? [];
    const isExpanded = () => visible() ? true : expanded().has(p.id);
    return createComponent(Show, {
      get when() {
        return memo(() => !!node())() && (!visible() || visible().has(p.id));
      },
      get children() {
        var _el$5 = _tmpl$52(), _el$6 = _el$5.firstChild;
        insert(_el$6, createComponent(Show, {
          get when() {
            return kids().length;
          },
          get fallback() {
            return _tmpl$62();
          },
          get children() {
            var _el$7 = _tmpl$32(), _el$8 = _el$7.firstChild;
            _el$7.$$click = () => toggle(p.id);
            effect(() => className(_el$8, `size-4 ${isExpanded() ? icons().expanded : icons().collapsed}`));
            return _el$7;
          }
        }), null);
        insert(_el$6, createComponent(RowLink, {
          get node() {
            return node();
          },
          get icon() {
            return memo(() => !!(isExpanded() && kids().length))() ? icons().folderOpen : icons().folder;
          }
        }), null);
        insert(_el$5, createComponent(Show, {
          get when() {
            return memo(() => !!isExpanded())() && kids().length;
          },
          get children() {
            var _el$9 = _tmpl$42();
            insert(_el$9, createComponent(For, {
              get each() {
                return kids();
              },
              children: (k) => createComponent(Node2, {
                get id() {
                  return k.id;
                }
              })
            }));
            return _el$9;
          }
        }), null);
        return _el$5;
      }
    });
  }
  return (() => {
    var _el$1 = _tmpl$1();
    insert(_el$1, createComponent(Show, {
      get when() {
        return props.title;
      },
      get children() {
        var _el$10 = _tmpl$7();
        insert(_el$10, () => props.title);
        return _el$10;
      }
    }), null);
    insert(_el$1, createComponent(Show, {
      get when() {
        return !props.hideSearch;
      },
      get children() {
        var _el$11 = _tmpl$8(), _el$12 = _el$11.firstChild, _el$13 = _el$12.nextSibling;
        _el$13.$$input = (e) => setQ(e.currentTarget.value);
        effect((_p$) => {
          var _v$5 = `size-4 opacity-50 ${icons().search}`, _v$6 = props.placeholder ?? labels().search;
          _v$5 !== _p$.e && className(_el$12, _p$.e = _v$5);
          _v$6 !== _p$.t && setAttribute(_el$13, "placeholder", _p$.t = _v$6);
          return _p$;
        }, {
          e: void 0,
          t: void 0
        });
        effect(() => _el$13.value = q());
        return _el$11;
      }
    }), null);
    insert(_el$1, createComponent(Show, {
      get when() {
        return !props.hideSort;
      },
      get children() {
        var _el$14 = _tmpl$9(), _el$15 = _el$14.firstChild, _el$16 = _el$15.firstChild, _el$17 = _el$15.nextSibling, _el$18 = _el$17.firstChild;
        _el$15.$$click = () => setSort("index");
        insert(_el$15, () => labels().sortIndex, null);
        _el$17.$$click = () => setSort("name");
        insert(_el$17, () => labels().sortName, null);
        effect((_p$) => {
          var _v$7 = `btn btn-xs join-item grow gap-1 ${sort() === "index" ? "btn-active btn-primary" : "btn-ghost"}`, _v$8 = labels().sortIndex, _v$9 = `size-3.5 ${icons().sortIndex}`, _v$0 = `btn btn-xs join-item grow gap-1 ${sort() === "name" ? "btn-active btn-primary" : "btn-ghost"}`, _v$1 = labels().sortName, _v$10 = `size-3.5 ${icons().sortName}`;
          _v$7 !== _p$.e && className(_el$15, _p$.e = _v$7);
          _v$8 !== _p$.t && setAttribute(_el$15, "title", _p$.t = _v$8);
          _v$9 !== _p$.a && className(_el$16, _p$.a = _v$9);
          _v$0 !== _p$.o && className(_el$17, _p$.o = _v$0);
          _v$1 !== _p$.i && setAttribute(_el$17, "title", _p$.i = _v$1);
          _v$10 !== _p$.n && className(_el$18, _p$.n = _v$10);
          return _p$;
        }, {
          e: void 0,
          t: void 0,
          a: void 0,
          o: void 0,
          i: void 0,
          n: void 0
        });
        return _el$14;
      }
    }), null);
    insert(_el$1, createComponent(Show, {
      get when() {
        return nodes();
      },
      get fallback() {
        return _tmpl$10();
      },
      get children() {
        var _el$19 = _tmpl$0();
        insert(_el$19, createComponent(Show, {
          get when() {
            return props.flat;
          },
          get fallback() {
            return createComponent(For, {
              get each() {
                return childrenOf().get(rootId()) ?? [];
              },
              children: (n) => createComponent(Node2, {
                get id() {
                  return n.id;
                }
              })
            });
          },
          get children() {
            return createComponent(For, {
              get each() {
                return flatList();
              },
              children: (n) => (() => {
                var _el$21 = _tmpl$12();
                var _ref$ = props.sortable ? fs.bind(String(n.id)) : void 0;
                typeof _ref$ === "function" && use(_ref$, _el$21);
                insert(_el$21, createComponent(Show, {
                  get when() {
                    return props.sortable;
                  },
                  get children() {
                    var _el$22 = _tmpl$11(), _el$23 = _el$22.firstChild;
                    effect(() => className(_el$23, `size-4 ${icons().dragHandle}`));
                    return _el$22;
                  }
                }), null);
                insert(_el$21, createComponent(RowLink, {
                  node: n,
                  get icon() {
                    return icons().leaf;
                  }
                }), null);
                return _el$21;
              })()
            });
          }
        }));
        return _el$19;
      }
    }), null);
    effect(() => className(_el$1, `w-64 shrink-0 sticky top-0 self-start max-h-screen overflow-y-auto ${props.class ?? ""}`));
    return _el$1;
  })();
}
delegateEvents(["click", "input"]);

export { DumbSortable, DumbTree, ResizableGrid, SelectionArea, createDumbSortable };
