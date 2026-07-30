// src/SelectionArea/SelectionArea.tsx
import { onMount } from "solid-js";

// src/SelectionArea/solid.ts
import { onCleanup } from "solid-js";

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

// src/shared/textSelection.ts
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
    suppressTextSelection();
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
    restoreTextSelection();
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
    if (!drag) restoreTextSelection();
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
    suppressTextSelection();
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
  return <div ref={containerRef} class={props.class} style={{ position: "relative", ...props.style }}>
      {props.children}
    </div>;
}

// src/ResizableGrid/ResizableGrid.tsx
import { createSignal, For, Show } from "solid-js";
import { makePersisted } from "@solid-primitives/storage";
import * as v from "valibot";
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
  const [sizes, setSizes] = makePersisted(
    createSignal(defaults),
    {
      name: props.storageKey,
      deserialize: (raw) => validateSizes(JSON.parse(raw), defaults)
    }
  );
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
      setSizes((prev) => ({ ...prev, cols: [...currentSizes] }));
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      restoreTextSelection();
    }
    document.body.style.cursor = "col-resize";
    suppressTextSelection();
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
      setSizes((prev) => ({ ...prev, rows: [...currentSizes] }));
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      restoreTextSelection();
    }
    document.body.style.cursor = "col-resize";
    suppressTextSelection();
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
      setSizes((prev) => ({ ...prev, rowSplit: [newTop, newBottom] }));
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      restoreTextSelection();
    }
    document.body.style.cursor = "row-resize";
    suppressTextSelection();
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
  return <div
    ref={containerRef}
    class={props.class}
    style={{
      display: "grid",
      height: "100%",
      width: "100%",
      "grid-template-rows": rowTemplate(),
      overflow: "hidden"
    }}
  >
      {
    /* ─── Первый ряд ─── */
  }
      <div
    style={{ display: "grid", "min-height": "0", "grid-template-columns": colTemplate() }}
  >
        <For each={props.cols}>
          {(col, i) => <>
              <Show when={i() > 0}>
                <div
    class="resizable-grid-handle-col"
    onMouseDown={(e) => startColResize(i() - 1, e)}
  />
              </Show>
              <div style={{ "min-width": "0", "min-height": "0", overflow: "auto" }}>{col.content()}</div>
            </>}
        </For>
      </div>

      {
    /* ─── Горизонтальный разделитель рядов ─── */
  }
      <Show when={hasRows()}>
        <div
    class="resizable-grid-handle-row"
    onMouseDown={startRowResize}
  />
      </Show>

      {
    /* ─── Второй ряд ─── */
  }
      <Show when={hasRows()}>
        <div
    style={{ display: "grid", "min-height": "0", "grid-template-columns": row2Template() }}
  >
          <For each={props.rows}>
            {(panel, i) => <>
                <Show when={i() > 0}>
                  <div
    class="resizable-grid-handle-col"
    onMouseDown={(e) => startRow2ColResize(i() - 1, e)}
  />
                </Show>
                <div style={{ "min-width": "0", "min-height": "0", overflow: "auto" }}>{panel.content()}</div>
              </>}
          </For>
        </div>
      </Show>
    </div>;
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

// src/Sortable/DumbSortable.tsx
import { For as For2 } from "solid-js";

// src/Sortable/solid.ts
import { onCleanup as onCleanup2 } from "solid-js";

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

// src/Sortable/sortableGroup.ts
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

// src/Sortable/solid.ts
function createDumbSortable(opts) {
  const engine = createSortableEngine(opts);
  onCleanup2(engine.destroy);
  return {
    bind: (id) => (el) => onCleanup2(engine.attach(el, id)),
    row: (id) => (el) => onCleanup2(engine.attachRow(el, id)),
    handle: (id) => (el) => onCleanup2(engine.attachHandle(el, id))
  };
}
function createSortableGroup(opts) {
  const engine = createSortableGroupEngine(opts);
  onCleanup2(engine.destroy);
  return {
    list(name, listOpts) {
      const zone = engine.list(name, listOpts);
      return {
        container: (el) => onCleanup2(zone.attachContainer(el)),
        bind: (id) => (el) => onCleanup2(zone.attach(el, id))
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
  return <For2 each={props.items}>
      {(item, i) => {
    const el = props.children(item, i);
    if (el instanceof HTMLElement) s.bind(props.id(item))(el);
    return el;
  }}
    </For2>;
}

// src/DumbTree/DumbTree.tsx
import { createMemo, createSignal as createSignal2, For as For3, Show as Show2 } from "solid-js";
import { makePersisted as makePersisted2 } from "@solid-primitives/storage";
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
  const [q, setQ] = createSignal2("");
  const key = props.storageKey ?? "dumb-tree";
  const [expanded, setExpanded] = makePersisted2(createSignal2(/* @__PURE__ */ new Set()), {
    name: `${key}:expanded`,
    serialize: (s) => JSON.stringify([...s]),
    deserialize: (str) => new Set(JSON.parse(str))
  });
  const [sort, setSort] = makePersisted2(createSignal2("index"), {
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
      <Show2 when={props.rowExtra}>
        <span class="ml-auto shrink-0 flex items-center gap-1">{props.rowExtra(p.node)}</span>
      </Show2>
    </a>;
  function Node2(p) {
    const node = () => byId().get(p.id);
    const kids = () => childrenOf().get(p.id) ?? [];
    const isExpanded = () => visible() ? true : expanded().has(p.id);
    return <Show2 when={node() && (!visible() || visible().has(p.id))}>
        <li>
          <div class="flex items-center">
            <Show2 when={kids().length} fallback={<span class="w-5 shrink-0" />}>
              <button class="btn btn-ghost btn-xs btn-square" onClick={() => toggle(p.id)}>
                <span class={`size-4 ${isExpanded() ? icons().expanded : icons().collapsed}`} />
              </button>
            </Show2>
            <RowLink
      node={node()}
      icon={isExpanded() && kids().length ? icons().folderOpen : icons().folder}
    />
          </div>
          <Show2 when={isExpanded() && kids().length}>
            <ul class="pl-3 border-l border-base-200 ml-3">
              <For3 each={kids()}>{(k) => <Node2 id={k.id} />}</For3>
            </ul>
          </Show2>
        </li>
      </Show2>;
  }
  return <aside class={`w-64 shrink-0 sticky top-0 self-start max-h-screen overflow-y-auto ${props.class ?? ""}`}>
      <Show2 when={props.title}>
        <div class="text-xs opacity-50 mb-2 px-1">{props.title}</div>
      </Show2>
      <Show2 when={!props.hideSearch}>
        <label class="input input-sm input-bordered flex items-center gap-2 mb-2 w-full">
          <span class={`size-4 opacity-50 ${icons().search}`} />
          <input value={q()} onInput={(e) => setQ(e.currentTarget.value)} placeholder={props.placeholder ?? labels().search} class="grow" />
        </label>
      </Show2>
      <Show2 when={!props.hideSort}>
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
      </Show2>
      <Show2 when={nodes()} fallback={<span class="loading loading-spinner" />}>
        <ul class="bg-base-100 rounded-box shadow w-full text-sm p-2 max-h-[80vh] overflow-auto">
          <Show2
    when={props.flat}
    fallback={<For3 each={childrenOf().get(rootId()) ?? []}>{(n) => <Node2 id={n.id} />}</For3>}
  >
            <For3 each={flatList()}>
              {(n) => <li ref={props.sortable ? fs.bind(String(n.id)) : void 0} class="flex items-center">
                  <Show2 when={props.sortable}>
                    <button data-drag-handle type="button" class="cursor-grab text-base-content/30 hover:text-base-content shrink-0" title="Перетащить">
                      <span class={`size-4 ${icons().dragHandle}`} />
                    </button>
                  </Show2>
                  <RowLink node={n} icon={icons().leaf} />
                </li>}
            </For3>
          </Show2>
        </ul>
      </Show2>
    </aside>;
}

// src/DumbTable/DumbTable.tsx
import { For as For4, Show as Show3, createSignal as createSignal3, createMemo as createMemo2 } from "solid-js";
import {
  createSolidTable,
  flexRender,
  getCoreRowModel,
  getSortedRowModel
} from "@tanstack/solid-table";
var withViewTransition = (on, fn) => {
  const doc = document;
  if (on && shouldAnimate() && typeof doc.startViewTransition === "function") doc.startViewTransition(fn);
  else fn();
};
function SortMark(props) {
  return <span aria-hidden="true" style={{ "margin-left": "4px", opacity: props.dir ? "1" : ".3" }}>
      {props.dir === "asc" ? "\u25B2" : props.dir === "desc" ? "\u25BC" : "\u21C5"}
    </span>;
}
function DumbTable(props) {
  const [localSort, setLocalSort] = createSignal3([]);
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
  const visibleRows = createMemo2(() => table.getRowModel().rows.map((r) => r.original));
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
      <Show3 when={visibleRows().length} fallback={props.empty}>
        <table
    class={props.tableClass}
    style={{ width: "100%", "border-collapse": "collapse" }}
  >
          <thead class={props.headClass}>
            <For4 each={table.getHeaderGroups()}>
              {(hg) => <tr>
                  <Show3 when={props.onReorder && withHandle()}>
                    <th style={{ width: "1%" }} />
                  </Show3>
                  <For4 each={hg.headers}>
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
                          <Show3 when={canSort()}>
                            <SortMark dir={header.column.getIsSorted()} />
                          </Show3>
                        </th>;
  }}
                  </For4>
                </tr>}
            </For4>
          </thead>

          <tbody>
            <Show3 when={props.spacerTop}>
              <tr aria-hidden="true" style={{ height: `${props.spacerTop}px` }} />
            </Show3>
            <For4 each={visibleRows()}>
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
                  <Show3 when={props.onReorder && withHandle()}>
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
                  </Show3>
                  <For4 each={row().getVisibleCells()}>
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
                  </For4>
                </tr>;
  }}
            </For4>
            <Show3 when={props.spacerBottom}>
              <tr aria-hidden="true" style={{ height: `${props.spacerBottom}px` }} />
            </Show3>
          </tbody>

          <Show3 when={props.footer}>
            <tfoot>{props.footer}</tfoot>
          </Show3>
        </table>
      </Show3>
    </div>;
}

// src/DumbTable/DumbPagination.tsx
import { For as For5, Show as Show4 } from "solid-js";
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
        <Show4 when={props.pageSizes?.length && props.onPageSizeChange}>
          <div style={{ display: "flex", gap: "4px" }}>
            <For5 each={props.pageSizes}>
              {(size) => <button
    class={`${props.buttonClass ?? ""} ${props.pageSize === size ? props.activeClass ?? "" : ""}`.trim() || void 0}
    style={btn(props.pageSize === size, false)}
    onClick={() => props.onPageSizeChange(size)}
  >
                  {size}
                </button>}
            </For5>
          </div>
        </Show4>
      </div>

      <Show4 when={pages() > 1}>
        <div style={{ display: "flex", gap: "4px", "flex-wrap": "wrap" }}>
          <button
    class={props.buttonClass}
    style={btn(false, props.page <= 1)}
    disabled={props.page <= 1}
    onClick={() => props.onPageChange(props.page - 1)}
  >
            «
          </button>
          <For5 each={buildPageNumbers(props.page, pages())}>
            {(p) => <Show4 when={p !== "\u2026"} fallback={<span style={{ padding: "3px 4px", opacity: ".4" }}>…</span>}>
                <button
    class={`${props.buttonClass ?? ""} ${props.page === p ? props.activeClass ?? "" : ""}`.trim() || void 0}
    style={btn(props.page === p, false)}
    onClick={() => props.onPageChange(p)}
  >
                  {p}
                </button>
              </Show4>}
          </For5>
          <button
    class={props.buttonClass}
    style={btn(false, props.page >= pages())}
    disabled={props.page >= pages()}
    onClick={() => props.onPageChange(props.page + 1)}
  >
            »
          </button>
        </div>
      </Show4>
    </div>;
}

// src/Odata1C/odataClient.ts
var OdataError = class extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = "OdataError";
  }
  status;
};
var JSON_NOMETA = "application/json;odata=nometadata";
function toBase64(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function odataString(s) {
  return `'${s.replace(/'/g, "''")}'`;
}
function parseODataError(text) {
  try {
    const clean = text.replace(/^﻿/, "");
    const json = JSON.parse(clean);
    return json?.["odata.error"]?.message?.value ?? null;
  } catch {
    return null;
  }
}
var OdataClient = class {
  baseUrl;
  token;
  fetchFn;
  timeoutMs;
  constructor(opts) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.token = opts.token ?? toBase64(`${opts.login ?? ""}:${opts.password ?? ""}`);
    this.fetchFn = opts.fetch ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 3e4;
  }
  /** Сборка URL: параметры кодируются вручную (`%20`, не `+`) */
  url(resource, params = {}) {
    const all = {
      ...Object.fromEntries(Object.entries(params).map(([k, v2]) => [k, String(v2)])),
      $format: JSON_NOMETA
    };
    const qs = Object.entries(all).map(([k, v2]) => `${encodeURIComponent(k)}=${encodeURIComponent(v2)}`).join("&");
    return `${this.baseUrl}/${encodeURI(resource)}?${qs}`;
  }
  async request(resource, params = {}, init = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let res;
    try {
      res = await this.fetchFn(this.url(resource, params), {
        method: init.method ?? "GET",
        headers: {
          Authorization: `Basic ${this.token}`,
          Accept: "application/json",
          ...init.body !== void 0 ? { "Content-Type": "application/json" } : {}
        },
        body: init.body !== void 0 ? JSON.stringify(init.body) : void 0,
        signal: ctrl.signal
      });
    } catch (e) {
      if (ctrl.signal.aborted) throw new OdataError(`1\u0421 OData: \u0442\u0430\u0439\u043C\u0430\u0443\u0442 ${this.timeoutMs}\u043C\u0441`);
      throw e;
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    if (!res.ok) {
      const msg = parseODataError(text);
      if (res.status === 401) throw new OdataError("\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043B\u043E\u0433\u0438\u043D \u0438\u043B\u0438 \u043F\u0430\u0440\u043E\u043B\u044C 1\u0421", 401);
      throw new OdataError(msg ?? `1\u0421 OData HTTP ${res.status}: ${text.slice(0, 200)}`, res.status);
    }
    if (!text.trim()) return void 0;
    const json = JSON.parse(text.replace(/^﻿/, ""));
    const err = json["odata.error"];
    if (err) throw new OdataError(err.message?.value ?? JSON.stringify(err).slice(0, 200));
    return json;
  }
  /** GET сущности/набора */
  get(resource, params) {
    return this.request(resource, params);
  }
  /** GET набора → массив `value` */
  async list(resource, params) {
    const resp = await this.request(resource, params);
    return resp.value ?? [];
  }
  /** Точечное чтение по ключу: `Entity(guid'...')` — работает даже при запрете `$filter` */
  one(entity, refKey, select) {
    return this.request(`${entity}(guid'${refKey}')`, select ? { $select: select } : {});
  }
  /** Точное число записей набора (опционально — с `$filter`) */
  async count(resource, filter) {
    const params = {
      $top: 0,
      $inlinecount: "allpages",
      $select: "Ref_Key"
    };
    if (filter) params.$filter = filter;
    const resp = await this.request(resource, params);
    return Number(resp["odata.count"]) || 0;
  }
  /**
   * Страница «свежие сверху» хронологического набора, когда `$orderby`
   * игнорируется/запрещён: читаем кусок с конца через `$skip` и разворачиваем.
   * `filter` (опционально) применяется и к count, и к странице — поиск
   * с пагинацией поверх того же приёма.
   */
  async tailPage(resource, opts) {
    const total = await this.count(resource, opts.filter);
    const end = Math.max(0, total - (opts.page - 1) * opts.pageSize);
    const skip = Math.max(0, end - opts.pageSize);
    const top = end - skip;
    if (top <= 0) return { rows: [], total };
    const params = { $skip: skip, $top: top };
    if (opts.select) params.$select = opts.select;
    if (opts.filter) params.$filter = opts.filter;
    const rows = await this.list(resource, params);
    return { rows: rows.reverse(), total };
  }
};
function createOdataClient(opts) {
  return new OdataClient(opts);
}

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

// src/utils/slug.ts
import slug from "slug";
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
  const { unzipSync } = await import("fflate");
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
export {
  DumbPagination,
  DumbSortable,
  DumbTable,
  DumbTree,
  OdataClient,
  OdataError,
  ResizableGrid,
  Rub0,
  Rub0R,
  Rub2,
  Rub4,
  RubR2,
  SelectionArea,
  buildPageNumbers,
  configureImgproxy,
  createDumbSortable,
  createOdataClient,
  createSelectionArea,
  createSortableGroup,
  extractImagesFromZip,
  fmtDate,
  fmtDateMonth,
  fmtDateTime,
  fmtDateTimeShort,
  fmtNum,
  fmtPrice,
  fmtSize,
  fmtTime,
  genSlug,
  imgproxyUrl,
  odataString,
  timeAgo,
  toBase64
};
