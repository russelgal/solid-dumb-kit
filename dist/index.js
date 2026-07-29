import { delegateEvents, use, insert, effect, className, style, createComponent, setStyleProperty, setAttribute, memo, addEventListener, template } from 'solid-js/web';
import { onCleanup, onMount, createSignal, For, Show, createMemo } from 'solid-js';
import { makePersisted } from '@solid-primitives/storage';
import * as v from 'valibot';
import { createSolidTable, getSortedRowModel, getCoreRowModel, flexRender } from '@tanstack/solid-table';
import slug from 'slug';

// src/SelectionArea/SelectionArea.tsx

// src/shared/viewport.ts
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

// src/SelectionArea/selectionMath.ts
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

// src/SelectionArea/selectionCore.ts
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
    document.body.style.userSelect = "none";
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
    document.body.style.userSelect = "";
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

// src/SelectionArea/solid.ts
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

// src/SelectionArea/SelectionArea.tsx
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

// src/Sortable/geometry.ts
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

// src/shared/motion.ts
function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function shouldAnimate(explicit) {
  if (explicit !== void 0) return explicit;
  return !prefersReducedMotion();
}

// src/Sortable/sortableCore.ts
var NO_DRAG = 'input, textarea, select, option, button, a, label, [contenteditable=""], [contenteditable="true"], [data-no-drag]';
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
    document.body.style.userSelect = "";
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
    document.body.style.userSelect = "none";
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
        } else if (ev.target instanceof Element && ev.target.closest(NO_DRAG)) {
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

// src/Sortable/sortableGroup.ts
var NO_DRAG2 = 'input, textarea, select, option, button, a, label, [contenteditable=""], [contenteditable="true"], [data-no-drag]';
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
    document.body.style.userSelect = "";
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
    document.body.style.userSelect = "none";
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
          const h = el.querySelector("[data-drag-handle]");
          if (h) h.style.touchAction = "none";
          const down = (ev) => {
            const handle = el.querySelector("[data-drag-handle]");
            if (handle) {
              if (!(ev.target instanceof Node && handle.contains(ev.target))) return;
            } else if (ev.target instanceof Element && ev.target.closest(NO_DRAG2)) {
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

// src/Sortable/solid.ts
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

// src/Sortable/DumbSortable.tsx
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
var DEFAULT_LABELS = {
  search: "\u041F\u043E\u0438\u0441\u043A",
  sortIndex: "\u0418\u043D\u0434\u0435\u043A\u0441",
  sortName: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435"
};
function DumbTree(props) {
  const nodes = () => props.nodes;
  const icons = () => props.icons;
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
var _tmpl$13 = /* @__PURE__ */ template(`<span aria-hidden=true style=margin-left:4px>`);
var _tmpl$24 = /* @__PURE__ */ template(`<tfoot>`);
var _tmpl$33 = /* @__PURE__ */ template(`<table style=width:100%;border-collapse:collapse><thead></thead><tbody>`);
var _tmpl$43 = /* @__PURE__ */ template(`<div style="transition:opacity .15s">`);
var _tmpl$53 = /* @__PURE__ */ template(`<th style=width:1%>`);
var _tmpl$63 = /* @__PURE__ */ template(`<tr>`);
var _tmpl$72 = /* @__PURE__ */ template(`<th style="padding:6px 8px;white-space:nowrap">`);
var _tmpl$82 = /* @__PURE__ */ template(`<td style="padding:6px 4px;width:1%"><span data-drag-handle style=display:inline-block;touch-action:none>`);
var _tmpl$92 = /* @__PURE__ */ template(`<td style="padding:6px 8px">`);
var withViewTransition = (on, fn) => {
  const doc = document;
  if (on && shouldAnimate() && typeof doc.startViewTransition === "function") doc.startViewTransition(fn);
  else fn();
};
function SortMark(props) {
  return (() => {
    var _el$ = _tmpl$13();
    insert(_el$, (() => {
      var _c$ = memo(() => props.dir === "asc");
      return () => _c$() ? "\u25B2" : props.dir === "desc" ? "\u25BC" : "\u21C5";
    })());
    effect((_$p) => setStyleProperty(_el$, "opacity", props.dir ? "1" : ".3"));
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
  const visibleRows = () => table.getRowModel().rows;
  const dragDisabled = () => !props.onReorder || sorting().length > 0;
  const withHandle = () => props.handle !== false;
  const sortable = createDumbSortable({
    order: () => visibleRows().map((r) => r.id),
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
    var _el$2 = _tmpl$43();
    insert(_el$2, createComponent(Show, {
      get when() {
        return visibleRows().length;
      },
      get fallback() {
        return props.empty;
      },
      get children() {
        var _el$3 = _tmpl$33(), _el$4 = _el$3.firstChild, _el$5 = _el$4.nextSibling;
        insert(_el$4, createComponent(For, {
          get each() {
            return table.getHeaderGroups();
          },
          children: (hg) => (() => {
            var _el$7 = _tmpl$63();
            insert(_el$7, createComponent(Show, {
              get when() {
                return memo(() => !!props.onReorder)() && withHandle();
              },
              get children() {
                return _tmpl$53();
              }
            }), null);
            insert(_el$7, createComponent(For, {
              get each() {
                return hg.headers;
              },
              children: (header) => {
                const c = () => colOf(header.column.columnDef);
                const canSort = () => header.column.getCanSort();
                return (() => {
                  var _el$9 = _tmpl$72();
                  addEventListener(_el$9, "click", header.column.getToggleSortingHandler(), true);
                  insert(_el$9, () => flexRender(header.column.columnDef.header, header.getContext()), null);
                  insert(_el$9, createComponent(Show, {
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
                    var _v$5 = `${c().class ?? ""} ${c().headClass ?? ""}`.trim() || void 0, _v$6 = {
                      ...cellStyle(c()),
                      cursor: canSort() ? "pointer" : void 0,
                      "user-select": canSort() ? "none" : void 0
                    };
                    _v$5 !== _p$.e && className(_el$9, _p$.e = _v$5);
                    _p$.t = style(_el$9, _v$6, _p$.t);
                    return _p$;
                  }, {
                    e: void 0,
                    t: void 0
                  });
                  return _el$9;
                })();
              }
            }), null);
            return _el$7;
          })()
        }));
        insert(_el$5, createComponent(For, {
          get each() {
            return visibleRows();
          },
          children: (row) => (() => {
            var _el$0 = _tmpl$63();
            _el$0.$$click = () => props.onRowClick?.(row.original, row.index);
            var _ref$ = props.onReorder ? sortable.bind(row.id) : void 0;
            typeof _ref$ === "function" && use(_ref$, _el$0);
            insert(_el$0, createComponent(Show, {
              get when() {
                return memo(() => !!props.onReorder)() && withHandle();
              },
              get children() {
                var _el$1 = _tmpl$82(), _el$10 = _el$1.firstChild;
                _el$1.$$click = (e) => e.stopPropagation();
                insert(_el$10, () => props.handle ?? "\u283F");
                effect((_p$) => {
                  var _v$7 = dragDisabled() ? "not-allowed" : "grab", _v$8 = dragDisabled() ? ".3" : "1", _v$9 = dragDisabled() ? "reset sorting to reorder" : "drag";
                  _v$7 !== _p$.e && setStyleProperty(_el$10, "cursor", _p$.e = _v$7);
                  _v$8 !== _p$.t && setStyleProperty(_el$10, "opacity", _p$.t = _v$8);
                  _v$9 !== _p$.a && setAttribute(_el$10, "title", _p$.a = _v$9);
                  return _p$;
                }, {
                  e: void 0,
                  t: void 0,
                  a: void 0
                });
                return _el$1;
              }
            }), null);
            insert(_el$0, createComponent(For, {
              get each() {
                return row.getVisibleCells();
              },
              children: (cell) => {
                const c = () => colOf(cell.column.columnDef);
                return (() => {
                  var _el$11 = _tmpl$92();
                  addEventListener(_el$11, "click", c().stopClick ? (e) => e.stopPropagation() : void 0, true);
                  insert(_el$11, () => flexRender(cell.column.columnDef.cell, cell.getContext()));
                  effect((_p$) => {
                    var _v$11 = c().class, _v$12 = {
                      ...cellStyle(c())
                    };
                    _v$11 !== _p$.e && className(_el$11, _p$.e = _v$11);
                    _p$.t = style(_el$11, _v$12, _p$.t);
                    return _p$;
                  }, {
                    e: void 0,
                    t: void 0
                  });
                  return _el$11;
                })();
              }
            }), null);
            effect((_p$) => {
              var _v$0 = row.id, _v$1 = props.rowClass?.(row.original, row.index), _v$10 = {
                cursor: props.onReorder && !withHandle() && !dragDisabled() ? "grab" : props.onRowClick ? "pointer" : void 0,
                ...props.rowStyle?.(row.original, row.index)
              };
              _v$0 !== _p$.e && setAttribute(_el$0, "data-key", _p$.e = _v$0);
              _v$1 !== _p$.t && className(_el$0, _p$.t = _v$1);
              _p$.a = style(_el$0, _v$10, _p$.a);
              return _p$;
            }, {
              e: void 0,
              t: void 0,
              a: void 0
            });
            return _el$0;
          })()
        }));
        insert(_el$3, createComponent(Show, {
          get when() {
            return props.footer;
          },
          get children() {
            var _el$6 = _tmpl$24();
            insert(_el$6, () => props.footer);
            return _el$6;
          }
        }), null);
        effect((_p$) => {
          var _v$ = props.tableClass, _v$2 = props.headClass;
          _v$ !== _p$.e && className(_el$3, _p$.e = _v$);
          _v$2 !== _p$.t && className(_el$4, _p$.t = _v$2);
          return _p$;
        }, {
          e: void 0,
          t: void 0
        });
        return _el$3;
      }
    }));
    effect((_p$) => {
      var _v$3 = props.class, _v$4 = props.loading ? ".5" : "1";
      _v$3 !== _p$.e && className(_el$2, _p$.e = _v$3);
      _v$4 !== _p$.t && setStyleProperty(_el$2, "opacity", _p$.t = _v$4);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$2;
  })();
}
delegateEvents(["click"]);
var _tmpl$14 = /* @__PURE__ */ template(`<div style=display:flex;gap:4px>`);
var _tmpl$25 = /* @__PURE__ */ template(`<div style=display:flex;gap:4px;flex-wrap:wrap><button>\xAB</button><button>\xBB`);
var _tmpl$34 = /* @__PURE__ */ template(`<div style=display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap><div style=display:flex;align-items:center;gap:8px><span style=opacity:.7;font-size:13px>`);
var _tmpl$44 = /* @__PURE__ */ template(`<button>`);
var _tmpl$54 = /* @__PURE__ */ template(`<span style="padding:3px 4px;opacity:.4">\u2026`);
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
  return (() => {
    var _el$ = _tmpl$34(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild;
    insert(_el$3, summary);
    insert(_el$2, createComponent(Show, {
      get when() {
        return memo(() => !!props.pageSizes?.length)() && props.onPageSizeChange;
      },
      get children() {
        var _el$4 = _tmpl$14();
        insert(_el$4, createComponent(For, {
          get each() {
            return props.pageSizes;
          },
          children: (size) => (() => {
            var _el$8 = _tmpl$44();
            _el$8.$$click = () => props.onPageSizeChange(size);
            insert(_el$8, size);
            effect((_p$) => {
              var _v$7 = `${props.buttonClass ?? ""} ${props.pageSize === size ? props.activeClass ?? "" : ""}`.trim() || void 0, _v$8 = btn(props.pageSize === size, false);
              _v$7 !== _p$.e && className(_el$8, _p$.e = _v$7);
              _p$.t = style(_el$8, _v$8, _p$.t);
              return _p$;
            }, {
              e: void 0,
              t: void 0
            });
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
        var _el$5 = _tmpl$25(), _el$6 = _el$5.firstChild, _el$7 = _el$6.nextSibling;
        _el$6.$$click = () => props.onPageChange(props.page - 1);
        insert(_el$5, createComponent(For, {
          get each() {
            return buildPageNumbers(props.page, pages());
          },
          children: (p) => createComponent(Show, {
            when: p !== "\u2026",
            get fallback() {
              return _tmpl$54();
            },
            get children() {
              var _el$9 = _tmpl$44();
              _el$9.$$click = () => props.onPageChange(p);
              insert(_el$9, p);
              effect((_p$) => {
                var _v$9 = `${props.buttonClass ?? ""} ${props.page === p ? props.activeClass ?? "" : ""}`.trim() || void 0, _v$0 = btn(props.page === p, false);
                _v$9 !== _p$.e && className(_el$9, _p$.e = _v$9);
                _p$.t = style(_el$9, _v$0, _p$.t);
                return _p$;
              }, {
                e: void 0,
                t: void 0
              });
              return _el$9;
            }
          })
        }), _el$7);
        _el$7.$$click = () => props.onPageChange(props.page + 1);
        effect((_p$) => {
          var _v$ = props.buttonClass, _v$2 = btn(false, props.page <= 1), _v$3 = props.page <= 1, _v$4 = props.buttonClass, _v$5 = btn(false, props.page >= pages()), _v$6 = props.page >= pages();
          _v$ !== _p$.e && className(_el$6, _p$.e = _v$);
          _p$.t = style(_el$6, _v$2, _p$.t);
          _v$3 !== _p$.a && (_el$6.disabled = _p$.a = _v$3);
          _v$4 !== _p$.o && className(_el$7, _p$.o = _v$4);
          _p$.i = style(_el$7, _v$5, _p$.i);
          _v$6 !== _p$.n && (_el$7.disabled = _p$.n = _v$6);
          return _p$;
        }, {
          e: void 0,
          t: void 0,
          a: void 0,
          o: void 0,
          i: void 0,
          n: void 0
        });
        return _el$5;
      }
    }), null);
    effect(() => className(_el$, props.class));
    return _el$;
  })();
}
delegateEvents(["click"]);

// src/utils/fmt.ts
var RubIntl2 = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2
});
var RubIntl0 = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0
});
var RubIntl4 = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 4
});
function toNum(v2) {
  if (v2 == null || v2 === "") return null;
  const n = typeof v2 === "string" ? parseFloat(v2) : Number(v2);
  return Number.isFinite(n) ? n : null;
}
function RubR2(v2) {
  const n = toNum(v2);
  return n != null ? RubIntl2.format(n) + " \u20BD" : "";
}
function Rub2(v2) {
  const n = toNum(v2);
  return n != null ? RubIntl2.format(n) : "";
}
function Rub0(v2) {
  const n = toNum(v2);
  return n != null ? RubIntl0.format(n) : "";
}
function Rub0R(v2) {
  const n = toNum(v2);
  return n != null ? RubIntl0.format(n) + " \u20BD" : "";
}
function Rub4(v2) {
  const n = toNum(v2);
  return n != null ? RubIntl4.format(n) : "";
}
function fmtNum(v2) {
  const n = toNum(v2);
  return n != null ? RubIntl0.format(n) : "\u2014";
}
function fmtPrice(v2) {
  const n = toNum(v2);
  return n != null ? RubIntl2.format(n) + " \u20BD" : "\u2014";
}
var DateTimeFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});
var DateTimeShortFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});
var DateFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});
var TimeFmt = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});
var DateMonthFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric"
});
function toDate(v2) {
  if (v2 == null || v2 === "") return null;
  const d = v2 instanceof Date ? v2 : new Date(v2);
  return isNaN(d.getTime()) ? null : d;
}
function fmtDateTime(v2) {
  const d = toDate(v2);
  return d ? DateTimeFmt.format(d) : "";
}
function fmtDateTimeShort(v2) {
  const d = toDate(v2);
  return d ? DateTimeShortFmt.format(d) : "";
}
function fmtDate(v2) {
  const d = toDate(v2);
  return d ? DateFmt.format(d) : "";
}
function fmtTime(v2) {
  const d = toDate(v2);
  return d ? TimeFmt.format(d) : "";
}
function fmtDateMonth(v2) {
  const d = toDate(v2);
  return d ? DateMonthFmt.format(d) : "";
}
function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} \u0411`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} \u041A\u0411`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} \u041C\u0411`;
}
function timeAgo(v2) {
  const d = toDate(v2);
  if (!d) return "\u2014";
  const diff = Date.now() - d.getTime();
  if (diff < 0) return "\u0442\u043E\u043B\u044C\u043A\u043E \u0447\u0442\u043E";
  const minutes = Math.floor(diff / 6e4);
  if (minutes < 1) return "\u0442\u043E\u043B\u044C\u043A\u043E \u0447\u0442\u043E";
  if (minutes < 60) return `${minutes} \u043C\u0438\u043D. \u043D\u0430\u0437\u0430\u0434`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} \u0447. \u043D\u0430\u0437\u0430\u0434`;
  const days = Math.floor(hours / 24);
  return `${days} \u0434\u043D. \u043D\u0430\u0437\u0430\u0434`;
}
var genSlug = (name) => slug(name);

// src/utils/zip.ts
var IMAGE_EXTS = /* @__PURE__ */ new Set(["jpg", "jpeg", "png", "gif", "webp", "svg"]);
var MIME_MAP = {
  svg: "image/svg+xml",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg"
};
async function extractImagesFromZip(zipFile) {
  const { unzipSync } = await import('fflate');
  const buf = new Uint8Array(await zipFile.arrayBuffer());
  const entries = unzipSync(buf);
  const dt = new DataTransfer();
  for (const [name, data] of Object.entries(entries)) {
    if (name.startsWith("__MACOSX/") || name.startsWith(".")) continue;
    const ext = name.split(".").pop()?.toLowerCase() || "";
    if (!IMAGE_EXTS.has(ext)) continue;
    const mime = MIME_MAP[ext] || "image/jpeg";
    const fileName = name.split("/").pop() || name;
    dt.items.add(new File([data], fileName, { type: mime }));
  }
  return dt.files;
}

// src/utils/imgproxy.ts
var config = {};
function configureImgproxy(c) {
  config = { ...config, ...c };
}
function env(key) {
  const proc = globalThis.process;
  const fromProc = proc?.env?.[key];
  if (fromProc) return fromProc;
  const meta = import.meta;
  return meta.env?.[key];
}
function base64url(input) {
  const Buf = globalThis.Buffer;
  if (Buf) {
    return Buf.from(input, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  const bytes = new TextEncoder().encode(input);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function resolveSource(src) {
  const bucket = config.bucket ?? env("VITE_S3_BUCKET");
  if (!bucket) return src;
  if (src.startsWith("/media/")) return `s3://${bucket}/${src.slice(7)}`;
  const s3Web = (config.webEndpoint ?? env("VITE_S3_WEB_ENDPOINT"))?.replace(/\/$/, "");
  if (s3Web && src.startsWith(s3Web + "/")) return `s3://${bucket}/${src.slice(s3Web.length + 1)}`;
  return src;
}
function buildProcessing(ops) {
  const parts = [];
  if (ops.w || ops.h || ops.fit) {
    const t = ops.fit ?? "fit";
    parts.push(`rs:${t}:${ops.w ?? 0}:${ops.h ?? 0}:${ops.enlarge ? 1 : 0}:${ops.extend ? 1 : 0}`);
  }
  if (ops.dpr && ops.dpr !== 1) parts.push(`dpr:${ops.dpr}`);
  if (ops.gravity) parts.push(`g:${ops.gravity}`);
  if (ops.q) parts.push(`q:${ops.q}`);
  if (ops.bg) parts.push(`bg:${ops.bg.replace(/^#/, "")}`);
  if (ops.blur) parts.push(`bl:${ops.blur}`);
  if (ops.sharpen) parts.push(`sh:${ops.sharpen}`);
  if (ops.padding != null) {
    parts.push(Array.isArray(ops.padding) ? `pd:${ops.padding.join(":")}` : `pd:${ops.padding}`);
  }
  if (ops.preset) {
    parts.push(`pr:${Array.isArray(ops.preset) ? ops.preset.join(":") : ops.preset}`);
  }
  return parts.join("/");
}
function imgproxyUrl(src, opts = {}) {
  const base = (config.baseUrl ?? env("VITE_IMGPROXY_URL"))?.replace(/\/$/, "");
  if (!base || !src) return src;
  const processing = buildProcessing({ fit: "fill", ...opts });
  const ext = opts.format ? `.${opts.format}` : "";
  return `${base}/insecure/${processing}/${base64url(resolveSource(src))}${ext}`;
}

export { DumbPagination, DumbSortable, DumbTable, DumbTree, ResizableGrid, Rub0, Rub0R, Rub2, Rub4, RubR2, SelectionArea, buildPageNumbers, configureImgproxy, createDumbSortable, createSelectionArea, createSortableGroup, extractImagesFromZip, fmtDate, fmtDateMonth, fmtDateTime, fmtDateTimeShort, fmtNum, fmtPrice, fmtSize, fmtTime, genSlug, imgproxyUrl, timeAgo };
