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
    return s.map((v3) => `${v3}fr`).join(` ${HANDLE_SIZE}px `);
  };
  const row2Template = () => {
    const s = rowSizes();
    if (!s) return "";
    return s.map((v3) => `${v3}fr`).join(` ${HANDLE_SIZE}px `);
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

// src/DumbGrid/DumbGrid.tsx
import { createMemo, createSignal as createSignal3, For as For3, Show as Show2 } from "solid-js";
import { makePersisted as makePersisted2 } from "@solid-primitives/storage";
import * as v2 from "valibot";

// src/DumbGrid/solid.ts
import { createSignal as createSignal2, onCleanup as onCleanup3 } from "solid-js";

// src/DumbGrid/gridMath.ts
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

// src/shared/gesture.ts
var NO_DRAG3 = 'input, textarea, select, option, button, a, label, [contenteditable=""], [contenteditable="true"], [data-no-drag]';
function targetIsInteractive3(ev) {
  return ev.target instanceof Element && !!ev.target.closest(NO_DRAG3);
}
function focusInside3(el) {
  const active = document.activeElement;
  return !!active && active !== document.body && active !== el && el.contains(active);
}
var LONGPRESS3 = 350;
var MOVE_TOL3 = 10;
function createPressGate(opts = {}) {
  const pressDelay = opts.pressDelay ?? LONGPRESS3;
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
        wait = { pid: ev.pointerId, x: ev.clientX, y: ev.clientY, timer: 0, mode: "press", thresh: MOVE_TOL3, start };
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

// src/DumbGrid/gridCore.ts
var SLIDE3 = "transform .18s cubic-bezier(.2,.8,.2,1)";
var LIFT_SHADOW3 = "0 12px 28px -8px rgba(0,0,0,.32)";
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
        el.style.transition = SLIDE3;
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
    el.style.transition = SLIDE3;
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
    if (kind === "move" && handle === el && focusInside3(el)) return;
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
      el.style.boxShadow = LIFT_SHADOW3;
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
        } else if (targetIsInteractive3(ev)) {
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

// src/DumbGrid/gridGroup.ts
var SLIDE4 = "transform .18s cubic-bezier(.2,.8,.2,1)";
var LIFT_SHADOW4 = "0 12px 28px -8px rgba(0,0,0,.35)";
var PREVIEW_BG2 = "rgba(59,130,246,.10)";
var PREVIEW_LINE2 = "2px dashed rgba(59,130,246,.85)";
var BLOCKED_BG2 = "rgba(239,68,68,.10)";
var BLOCKED_LINE2 = "2px dashed rgba(239,68,68,.85)";
var PREVIEW_Z2 = 5;
var GHOST_STYLE_ID = "dumb-grid-ghost";
var canPopover2 = () => typeof HTMLElement !== "undefined" && typeof HTMLElement.prototype.showPopover === "function";
function injectGhostReset2() {
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
function makeGhost2(src, r) {
  const ghost = src.cloneNode(true);
  ghost.setAttribute("data-dumb-grid-ghost", "");
  ghost.removeAttribute("id");
  src.insertAdjacentElement("afterend", ghost);
  if (canPopover2()) {
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
  ghost.style.boxShadow = LIFT_SHADOW4;
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
  function boxOf2(z) {
    const s = scrollOf(z.scroller);
    const dx = window.scrollX - z.boxWinX + (z.scroller ? s.sx - z.sx0 : 0);
    const dy = window.scrollY - z.boxWinY + (z.scroller ? s.sy - z.sy0 : 0);
    return { left: z.boxLeft - dx, top: z.boxTop - dy, right: z.boxLeft - dx + z.boxW, bottom: z.boxTop - dy + z.boxH };
  }
  function zoneAt(d, x, y) {
    for (const z of d.zones.values()) {
      if (!z.boxW || !z.boxH) continue;
      const b = boxOf2(z);
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
    const b = boxOf2(z);
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
        el.style.transition = SLIDE4;
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
    if (kind === "move" && handle === el && focusInside3(el)) return;
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
      injectGhostReset2();
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
          const b = boxOf2(snap);
          drag.ghost = makeGhost2(el, {
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
            } else if (targetIsInteractive3(ev)) {
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

// src/DumbGrid/solid.ts
function createDumbGrid(opts) {
  const [active, setActive] = createSignal2(null);
  const engine = createGridEngine({
    ...opts,
    onActive: (state) => {
      setActive(state);
      opts.onActive?.(state);
    }
  });
  onCleanup3(engine.destroy);
  return {
    container: (el) => onCleanup3(engine.attachContainer(el)),
    bind: (id) => (el) => onCleanup3(engine.attach(el, id)),
    resize: (id) => (el) => onCleanup3(engine.attachResize(el, id)),
    active
  };
}
function createDumbGridGroup(opts) {
  const [active, setActive] = createSignal2(null);
  const [over, setOver] = createSignal2(null);
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
  onCleanup3(engine.destroy);
  return {
    grid(name, zoneOpts) {
      const zone = engine.grid(name, zoneOpts);
      return {
        container: (el) => onCleanup3(zone.attachContainer(el)),
        bind: (id) => (el) => onCleanup3(zone.attach(el, id)),
        resize: (id) => (el) => onCleanup3(zone.attachResize(el, id)),
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

// src/DumbGrid/DumbGrid.tsx
var DEFAULT_COLS = 12;
var DEFAULT_ROW_H = 80;
var DEFAULT_GAP = 12;
var HANDLE = 16;
var REMOVE = 22;
var LayoutSchema = v2.array(
  v2.object({
    id: v2.string(),
    w: v2.number(),
    h: v2.number(),
    x: v2.optional(v2.number()),
    y: v2.optional(v2.number())
  })
);
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
    const spot = mode === "free" && it.x === void 0 && it.y === void 0 && out.length ? firstFreeCell({ placed: placeFree(out, cols), cols, w, h }) : { x: it.x, y: it.y };
    out.push(spanOf(it, { w, h, x: spot.x, y: spot.y }, cols));
  }
  return out;
}
var GRID_LINE = "rgba(100,116,139,.28)";
function gridLinesBackground(args) {
  const { cols, gapX, rowH, gapY } = args;
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
    image: [
      `linear-gradient(to right, ${stops.join(", ")})`,
      `linear-gradient(to bottom, transparent 0, transparent ${stepY - lineH}px, ${GRID_LINE} ${stepY - lineH}px, ${GRID_LINE} ${stepY}px)`
    ].join(", "),
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
  const persisted = props.storageKey ? makePersisted2(createSignal3(null), {
    name: props.storageKey,
    serialize: (l) => JSON.stringify(l ?? []),
    deserialize: (raw) => {
      try {
        const parsed = v2.safeParse(LayoutSchema, JSON.parse(raw));
        return parsed.success ? parsed.output : null;
      } catch {
        return null;
      }
    }
  }) : null;
  const [memory, setMemory] = createSignal3(null);
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
      return p ? { ...s, x: p.col, y: p.row } : s;
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
    onMove: (id, x, y) => commit(materialize(layout().map((s) => s.id === id ? { ...s, x, y } : s))),
    onResize: (id, w, h) => {
      const it = itemById().get(id);
      if (!it) return;
      commit(materialize(layout().map((s) => s.id === id ? spanOf(it, { ...s, w, h }, cols()) : s)));
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
  const gridBackground = () => gridLinesBackground({ cols: cols(), gapX: gapX(), rowH: rowH(), gapY: gapY() });
  return <div
    ref={g.container}
    class={props.class}
    style={{
      display: "grid",
      "grid-template-columns": `repeat(${cols()}, minmax(0, 1fr))`,
      "grid-auto-rows": `${rowH()}px`,
      "column-gap": `${gapX()}px`,
      "row-gap": `${gapY()}px`,
      position: "relative",
      // высота под все строки плюс запас, чтобы блок было куда увести вниз
      "min-height": `${heightOf(totalRows())}px`,
      // если сетку положили в свой скроллер — место под полосу держим всегда,
      // иначе её появление меняет ширину контента и сбивает шаг колонок
      "scrollbar-gutter": "stable",
      ...props.style
    }}
  >
      <Show2 when={editable() && showGrid() !== false}>
        <div
    data-grid-lines
    aria-hidden="true"
    style={{
      position: "absolute",
      inset: "0",
      padding: "inherit",
      "box-sizing": "border-box",
      "pointer-events": "none",
      "z-index": "0",
      "background-image": gridBackground().image,
      "background-size": gridBackground().size,
      "background-origin": "content-box",
      "background-clip": "content-box",
      "background-repeat": "no-repeat, repeat",
      opacity: gridVisible() ? "1" : "0",
      transition: "opacity .15s ease"
    }}
  />
      </Show2>

      {
    /*
      Две ветки, а не одна с флагами: ref'ы навешиваются в момент создания
      элемента, поэтому «выключить редактирование» — это пересоздать блоки без
      привязки к движку. Иначе слушатели остались бы висеть, просто ничего не
      делая. Show переключает ветку целиком, и в режиме просмотра на блоках
      нет ни одного обработчика, ни ручек, ни кнопок.
    */
  }
      <Show2 when={editable()} fallback={<For3 each={props.items}>
          {(it) => {
    const span = () => spanById().get(it.id);
    return <Show2 when={span()}>
                {(s) => <div class={props.blockClass} style={{ ...blockBox(s(), posById().get(it.id)), ...props.blockStyle }}>
                    {it.content()}
                  </div>}
              </Show2>;
  }}
        </For3>}>
      <For3 each={props.items}>
        {(it) => {
    const span = () => spanById().get(it.id);
    const dragging = () => g.active()?.id === it.id;
    return <Show2 when={span()}>
              {(s) => <div
      ref={g.bind(it.id)}
      class={props.blockClass}
      style={{
        ...blockBox(s(), posById().get(it.id)),
        cursor: it.locked || props.disabled ? "default" : "grab",
        "touch-action": "manipulation",
        ...props.blockStyle
      }}
    >
                  {it.content()}

                  <Show2 when={props.onRemove && !props.disabled && it.removable !== false}>
                    <button
      type="button"
      data-grid-remove
      data-no-drag
      title={props.labels?.remove ?? "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0431\u043B\u043E\u043A"}
      aria-label={props.labels?.remove ?? "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0431\u043B\u043E\u043A"}
      onClick={() => props.onRemove?.(it.id)}
      style={{
        position: "absolute",
        top: "0",
        right: "0",
        width: `${REMOVE}px`,
        height: `${REMOVE}px`,
        display: "grid",
        "place-items": "center",
        padding: "0",
        border: "none",
        background: "transparent",
        color: "currentColor",
        font: "inherit",
        "line-height": "1",
        cursor: "pointer",
        opacity: "0.45",
        // на кнопке жест не начинается: она <button> и с [data-no-drag],
        // а это ровно то, что движок пропускает мимо драга
        "z-index": "2"
      }}
    >
                      ✕
                    </button>
                  </Show2>

                  <Show2 when={props.resizable !== false && !it.locked && !props.disabled}>
                    <div
      ref={g.resize(it.id)}
      title={props.labels?.resize ?? "\u041F\u043E\u0442\u044F\u043D\u0438, \u0447\u0442\u043E\u0431\u044B \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0440\u0430\u0437\u043C\u0435\u0440"}
      style={{
        position: "absolute",
        right: "0",
        bottom: "0",
        width: `${HANDLE}px`,
        height: `${HANDLE}px`,
        cursor: "nwse-resize",
        // уголок из двух штрихов — рисуем градиентом, без иконок
        background: "linear-gradient(135deg, transparent 0 45%, currentColor 45% 55%, transparent 55% 70%, currentColor 70% 80%, transparent 80%)",
        opacity: dragging() ? "0.9" : "0.35",
        "border-bottom-right-radius": "8px"
      }}
    />
                  </Show2>
                </div>}
            </Show2>;
  }}
      </For3>
      </Show2>
    </div>;
}

// src/DumbGridDnd/DumbGridDnd.tsx
import { createMemo as createMemo2, For as For4, Show as Show3 } from "solid-js";

// src/DumbGridDnd/solid.ts
import { createSignal as createSignal4, onCleanup as onCleanup4 } from "solid-js";

// src/DumbGridDnd/dndCore.ts
var DND_MIME = "application/x-dumb-grid";
var dndSupported = () => typeof DataTransfer === "function" && typeof DragEvent === "function";
function createGridDndEngine(opts = {}) {
  const zones = /* @__PURE__ */ new Map();
  let drag = null;
  let over = null;
  const setOver = (name) => {
    if (over === name) return;
    over = name;
    opts.onOver?.(name);
  };
  function markDrop(zoneName, index) {
    if (!drag) return;
    if (drag.toZone === zoneName && drag.toIndex === index) return;
    drag.toZone = zoneName;
    drag.toIndex = index;
    opts.onDropTarget?.({ grid: zoneName, index });
  }
  function clearDrag() {
    if (!drag) return;
    drag.el.style.opacity = "";
    drag = null;
    setOver(null);
    opts.onDropTarget?.(null);
    opts.onActive?.(null);
  }
  function accepted(zone) {
    if (!drag) return false;
    if (zone.name === drag.fromZone) return true;
    return !zone.opts.accepts || zone.opts.accepts(drag.fromZone);
  }
  function onDragStart(zone, id, el, ev) {
    if (!ev.dataTransfer || zone.opts.disabled?.()) {
      ev.preventDefault();
      return;
    }
    if (ev.target instanceof Element) {
      if (ev.target.closest("[data-grid-resize]")) {
        ev.preventDefault();
        return;
      }
      if (ev.target.closest("[data-flip-id]")) {
        ev.preventDefault();
        return;
      }
      const nested = ev.target.closest("[data-dnd-block]");
      if (nested && nested !== el) {
        ev.preventDefault();
        return;
      }
      const handle = el.querySelector("[data-drag-handle]");
      if (handle && !handle.contains(ev.target)) {
        ev.preventDefault();
        return;
      }
    }
    const index = zone.opts.order().indexOf(id);
    if (index < 0) {
      ev.preventDefault();
      return;
    }
    ev.dataTransfer.effectAllowed = "move";
    try {
      ev.dataTransfer.setData(DND_MIME, JSON.stringify({ grid: zone.name, id }));
    } catch {
    }
    try {
      ev.dataTransfer.setData("text/plain", id);
    } catch {
    }
    const span = zone.opts.spanOf?.(id) ?? { w: 1, h: 1 };
    drag = { fromZone: zone.name, id, fromIndex: index, el, span, toZone: zone.name, toIndex: -1 };
    setOver(zone.name);
    opts.onActive?.({ grid: zone.name, id, ...span });
    requestAnimationFrame(() => {
      if (drag) el.style.opacity = "0.4";
    });
  }
  function onBlockOver(zone, id, el, ev, rect) {
    if (!drag || !accepted(zone) || !rect) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
    const order = zone.opts.order().filter((x) => !(zone.name === drag.fromZone && x === drag.id));
    const at = order.indexOf(id);
    if (at < 0) return;
    const after = ev.clientX > rect.left + rect.width / 2;
    markDrop(zone.name, after ? at + 1 : at);
    setOver(zone.name);
  }
  function onZoneOver(zone, ev) {
    if (!drag || !accepted(zone)) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
    setOver(zone.name);
    const order = zone.opts.order().filter((id) => !(zone.name === drag.fromZone && id === drag.id));
    markDrop(zone.name, order.length);
  }
  function onZoneDrop(zone, ev) {
    if (!drag || !accepted(zone)) return;
    ev.preventDefault();
    ev.stopPropagation();
    const d = drag;
    const to = { zone: d.toZone, index: d.toIndex };
    clearDrag();
    if (to.index < 0) return;
    if (to.zone !== d.fromZone) {
      opts.onTransfer?.({ grid: d.fromZone, id: d.id, index: d.fromIndex }, { grid: to.zone, index: to.index });
      return;
    }
    if (to.index !== d.fromIndex) zones.get(d.fromZone)?.opts.onReorder?.(d.fromIndex, to.index);
  }
  return {
    grid(name, zoneOpts) {
      const zone = zones.get(name) ?? { name, el: null, els: /* @__PURE__ */ new Map(), opts: zoneOpts };
      zone.opts = zoneOpts;
      zones.set(name, zone);
      return {
        attachContainer(el) {
          zone.el = el;
          const onEnter = (ev) => {
            if (drag && accepted(zone)) {
              ev.preventDefault();
              ev.stopPropagation();
            }
          };
          const onOver = (ev) => onZoneOver(zone, ev);
          const onLeave = (ev) => {
            if (!drag || ev.relatedTarget instanceof Node && el.contains(ev.relatedTarget)) return;
            if (over === zone.name) setOver(null);
          };
          const onDrop = (ev) => onZoneDrop(zone, ev);
          el.addEventListener("dragenter", onEnter);
          el.addEventListener("dragover", onOver);
          el.addEventListener("dragleave", onLeave);
          el.addEventListener("drop", onDrop);
          return () => {
            el.removeEventListener("dragenter", onEnter);
            el.removeEventListener("dragover", onOver);
            el.removeEventListener("dragleave", onLeave);
            el.removeEventListener("drop", onDrop);
            if (zone.el === el) zone.el = null;
          };
        },
        attach(el, id) {
          zone.els.set(id, el);
          el.dataset.dndBlock = id;
          el.setAttribute("draggable", "true");
          let rect = null;
          const onStart = (ev) => onDragStart(zone, id, el, ev);
          const onEnd = () => clearDrag();
          const onEnter = () => {
            rect = el.getBoundingClientRect();
          };
          const onOver = (ev) => {
            if (!rect) rect = el.getBoundingClientRect();
            onBlockOver(zone, id, el, ev, rect);
          };
          const onLeave = () => {
            rect = null;
          };
          const onDrop = (ev) => onZoneDrop(zone, ev);
          el.addEventListener("dragstart", onStart);
          el.addEventListener("dragend", onEnd);
          el.addEventListener("dragenter", onEnter);
          el.addEventListener("dragover", onOver);
          el.addEventListener("dragleave", onLeave);
          el.addEventListener("drop", onDrop);
          return () => {
            el.removeEventListener("dragstart", onStart);
            el.removeEventListener("dragend", onEnd);
            el.removeEventListener("dragenter", onEnter);
            el.removeEventListener("dragover", onOver);
            el.removeEventListener("dragleave", onLeave);
            el.removeEventListener("drop", onDrop);
            el.removeAttribute("draggable");
            delete el.dataset.dndBlock;
            if (zone.els.get(id) === el) zone.els.delete(id);
          };
        }
      };
    },
    active: () => drag ? { grid: drag.fromZone, id: drag.id, ...drag.span } : null,
    over: () => over,
    drop: () => drag && drag.toIndex >= 0 ? { grid: drag.toZone, index: drag.toIndex } : null,
    destroy() {
      clearDrag();
      zones.clear();
    }
  };
}

// src/DumbGridDnd/solid.ts
function createDumbGridDndGroup(opts = {}) {
  const [active, setActive] = createSignal4(null);
  const [over, setOver] = createSignal4(null);
  const [drop, setDrop] = createSignal4(null);
  const engine = createGridDndEngine({
    ...opts,
    onActive: (state) => {
      setActive(state);
      opts.onActive?.(state);
    },
    onOver: (name) => {
      setOver(name);
      opts.onOver?.(name);
    },
    onDropTarget: (target) => {
      setDrop(target);
      opts.onDropTarget?.(target);
    }
  });
  onCleanup4(engine.destroy);
  return {
    grid(name, zoneOpts) {
      const zone = engine.grid(name, zoneOpts);
      return {
        container: (el) => onCleanup4(zone.attachContainer(el)),
        bind: (id) => (el) => onCleanup4(zone.attach(el, id)),
        active: () => {
          const a = active();
          return a && a.grid === name ? a.id : null;
        }
      };
    },
    active,
    over,
    drop
  };
}

// src/DumbGridDnd/DumbGridDnd.tsx
var DEFAULT_COLS2 = 12;
var DEFAULT_ROW_H2 = 80;
var DEFAULT_GAP2 = 12;
function DumbGridDnd(props) {
  const cols = () => Math.max(1, Math.floor(props.cols ?? DEFAULT_COLS2));
  const rowH = () => props.rowHeight ?? DEFAULT_ROW_H2;
  const gap = () => props.gap ?? DEFAULT_GAP2;
  const spans = createMemo2(
    () => props.items.map((it) => ({
      id: it.id,
      w: resolveSpan(it.w, cols()),
      h: Math.max(1, Math.round(it.h ?? 1) || 1)
    }))
  );
  const group = props.group ?? createDumbGridDndGroup();
  const name = () => props.name ?? "grid";
  const g = group.grid(name(), {
    order: () => props.items.map((it) => it.id),
    spanOf: (id) => spans().find((s) => s.id === id) ?? { w: 1, h: 1 },
    disabled: () => props.disabled === true,
    onReorder: (from, to) => props.onReorder?.(from, to)
  });
  const GHOST = "\0dnd-ghost";
  const viewSpans = createMemo2(() => {
    const base = spans();
    const drop = group.drop();
    const dragging = group.active();
    if (!drop || !dragging || drop.grid !== name()) return base;
    if (dragging.grid === name()) {
      const from = base.findIndex((s) => s.id === dragging.id);
      if (from < 0) return base;
      const rest = base.filter((_, i) => i !== from);
      const at2 = Math.max(0, Math.min(rest.length, drop.index));
      return [...rest.slice(0, at2), base[from], ...rest.slice(at2)];
    }
    const at = Math.max(0, Math.min(base.length, drop.index));
    const ghost = { id: GHOST, w: Math.min(dragging.w, cols()), h: dragging.h };
    return [...base.slice(0, at), ghost, ...base.slice(at)];
  });
  const placed = createMemo2(() => packFlow(viewSpans(), cols()));
  const posById = createMemo2(() => new Map(placed().map((p) => [p.id, p])));
  const rows = createMemo2(() => rowCount(placed()));
  const ghostPos = () => posById().get(GHOST);
  return <div
    ref={g.container}
    class={props.class}
    style={{
      display: "grid",
      "grid-template-columns": `repeat(${cols()}, minmax(0, 1fr))`,
      "grid-auto-rows": `${rowH()}px`,
      gap: `${gap()}px`,
      "min-height": `${rows() * rowH() + Math.max(0, rows() - 1) * gap()}px`,
      ...props.style
    }}
  >
      {
    /* место будущего гостя: контур ровно того размера, каким блок сюда сядет */
  }
      <Show3 when={ghostPos()}>
        {(p) => <div
    data-dnd-ghost
    aria-hidden="true"
    style={{
      "grid-column": `${p().col + 1} / span ${p().w}`,
      "grid-row": `${p().row + 1} / span ${p().h}`,
      "pointer-events": "none",
      "box-sizing": "border-box",
      "border-radius": "10px",
      background: "rgba(59,130,246,.10)",
      outline: "2px dashed rgba(59,130,246,.85)",
      "outline-offset": "-2px"
    }}
  />}
      </Show3>

      <For4 each={props.items}>
        {(it) => {
    const pos = () => posById().get(it.id);
    const dragging = () => g.active() === it.id;
    return <Show3 when={pos()}>
              {(p) => <div
      ref={props.disabled ? void 0 : g.bind(it.id)}
      class={props.blockClass}
      style={{
        // позицию считаем мы, браузер её не домысливает
        "grid-column": `${p().col + 1} / span ${p().w}`,
        "grid-row": `${p().row + 1} / span ${p().h}`,
        position: "relative",
        "min-width": "0",
        "min-height": "0",
        "box-sizing": "border-box",
        cursor: props.disabled ? "default" : "grab",
        opacity: dragging() ? "0.4" : void 0,
        ...props.blockStyle
      }}
    >
                  {it.content()}
                </div>}
            </Show3>;
  }}
      </For4>
    </div>;
}

// src/DumbTree/DumbTree.tsx
import { createMemo as createMemo3, createSignal as createSignal5, For as For5, Show as Show4 } from "solid-js";
import { makePersisted as makePersisted3 } from "@solid-primitives/storage";
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
  const [q, setQ] = createSignal5("");
  const key = props.storageKey ?? "dumb-tree";
  const [expanded, setExpanded] = makePersisted3(createSignal5(/* @__PURE__ */ new Set()), {
    name: `${key}:expanded`,
    serialize: (s) => JSON.stringify([...s]),
    deserialize: (str) => new Set(JSON.parse(str))
  });
  const [sort, setSort] = makePersisted3(createSignal5("index"), {
    name: `${key}:sort`,
    serialize: (vv) => vv,
    deserialize: (s) => s === "name" ? "name" : "index"
  });
  const sortMode = () => props.hideSort ? "index" : sort();
  const cmp = (a, b) => sortMode() === "name" ? a.title.localeCompare(b.title, props.locale) || (a.index ?? 0) - (b.index ?? 0) : (a.index ?? 0) - (b.index ?? 0) || a.title.localeCompare(b.title, props.locale);
  const byId = createMemo3(() => new Map((nodes() ?? []).map((n) => [n.id, n])));
  const childrenOf = createMemo3(() => {
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
  const rootId = createMemo3(() => {
    const ns = nodes() ?? [];
    if (!ns.length) return 0;
    const ids = new Set(ns.map((n) => n.id));
    return (ns.find((n) => !ids.has(n.parent)) ?? ns[0]).id;
  });
  const matches = (n, query) => props.match ? props.match(n, query) : fuzzy(query, n.title) || !!n.meta && fuzzy(query, n.meta) || String(n.id).includes(query);
  const visible = createMemo3(() => {
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
  const flatList = createMemo3(() => {
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
      <Show4 when={props.rowExtra}>
        <span class="ml-auto shrink-0 flex items-center gap-1">{props.rowExtra(p.node)}</span>
      </Show4>
    </a>;
  function Node2(p) {
    const node = () => byId().get(p.id);
    const kids = () => childrenOf().get(p.id) ?? [];
    const isExpanded = () => visible() ? true : expanded().has(p.id);
    return <Show4 when={node() && (!visible() || visible().has(p.id))}>
        <li>
          <div class="flex items-center">
            <Show4 when={kids().length} fallback={<span class="w-5 shrink-0" />}>
              <button class="btn btn-ghost btn-xs btn-square" onClick={() => toggle(p.id)}>
                <span class={`size-4 ${isExpanded() ? icons().expanded : icons().collapsed}`} />
              </button>
            </Show4>
            <RowLink
      node={node()}
      icon={isExpanded() && kids().length ? icons().folderOpen : icons().folder}
    />
          </div>
          <Show4 when={isExpanded() && kids().length}>
            <ul class="pl-3 border-l border-base-200 ml-3">
              <For5 each={kids()}>{(k) => <Node2 id={k.id} />}</For5>
            </ul>
          </Show4>
        </li>
      </Show4>;
  }
  return <aside class={`w-64 shrink-0 sticky top-0 self-start max-h-screen overflow-y-auto ${props.class ?? ""}`}>
      <Show4 when={props.title}>
        <div class="text-xs opacity-50 mb-2 px-1">{props.title}</div>
      </Show4>
      <Show4 when={!props.hideSearch}>
        <label class="input input-sm input-bordered flex items-center gap-2 mb-2 w-full">
          <span class={`size-4 opacity-50 ${icons().search}`} />
          <input value={q()} onInput={(e) => setQ(e.currentTarget.value)} placeholder={props.placeholder ?? labels().search} class="grow" />
        </label>
      </Show4>
      <Show4 when={!props.hideSort}>
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
      </Show4>
      <Show4 when={nodes()} fallback={<span class="loading loading-spinner" />}>
        <ul class="bg-base-100 rounded-box shadow w-full text-sm p-2 max-h-[80vh] overflow-auto">
          <Show4
    when={props.flat}
    fallback={<For5 each={childrenOf().get(rootId()) ?? []}>{(n) => <Node2 id={n.id} />}</For5>}
  >
            <For5 each={flatList()}>
              {(n) => <li ref={props.sortable ? fs.bind(String(n.id)) : void 0} class="flex items-center">
                  <Show4 when={props.sortable}>
                    <button data-drag-handle type="button" class="cursor-grab text-base-content/30 hover:text-base-content shrink-0" title="Перетащить">
                      <span class={`size-4 ${icons().dragHandle}`} />
                    </button>
                  </Show4>
                  <RowLink node={n} icon={icons().leaf} />
                </li>}
            </For5>
          </Show4>
        </ul>
      </Show4>
    </aside>;
}

// src/DumbTable/DumbTable.tsx
import { For as For6, Show as Show5, createSignal as createSignal6, createMemo as createMemo4 } from "solid-js";
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
  const [localSort, setLocalSort] = createSignal6([]);
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
  const visibleRows = createMemo4(() => table.getRowModel().rows.map((r) => r.original));
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
      <Show5 when={visibleRows().length} fallback={props.empty}>
        <table
    class={props.tableClass}
    style={{ width: "100%", "border-collapse": "collapse" }}
  >
          <thead class={props.headClass}>
            <For6 each={table.getHeaderGroups()}>
              {(hg) => <tr>
                  <Show5 when={props.onReorder && withHandle()}>
                    <th style={{ width: "1%" }} />
                  </Show5>
                  <For6 each={hg.headers}>
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
                          <Show5 when={canSort()}>
                            <SortMark dir={header.column.getIsSorted()} />
                          </Show5>
                        </th>;
  }}
                  </For6>
                </tr>}
            </For6>
          </thead>

          <tbody>
            <Show5 when={props.spacerTop}>
              <tr aria-hidden="true" style={{ height: `${props.spacerTop}px` }} />
            </Show5>
            <For6 each={visibleRows()}>
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
                  <Show5 when={props.onReorder && withHandle()}>
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
                  </Show5>
                  <For6 each={row().getVisibleCells()}>
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
                  </For6>
                </tr>;
  }}
            </For6>
            <Show5 when={props.spacerBottom}>
              <tr aria-hidden="true" style={{ height: `${props.spacerBottom}px` }} />
            </Show5>
          </tbody>

          <Show5 when={props.footer}>
            <tfoot>{props.footer}</tfoot>
          </Show5>
        </table>
      </Show5>
    </div>;
}

// src/DumbTable/DumbPagination.tsx
import { For as For7, Show as Show6 } from "solid-js";
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
        <Show6 when={props.pageSizes?.length && props.onPageSizeChange}>
          <div style={{ display: "flex", gap: "4px" }}>
            <For7 each={props.pageSizes}>
              {(size) => <button
    class={`${props.buttonClass ?? ""} ${props.pageSize === size ? props.activeClass ?? "" : ""}`.trim() || void 0}
    style={btn(props.pageSize === size, false)}
    onClick={() => props.onPageSizeChange(size)}
  >
                  {size}
                </button>}
            </For7>
          </div>
        </Show6>
      </div>

      <Show6 when={pages() > 1}>
        <div style={{ display: "flex", gap: "4px", "flex-wrap": "wrap" }}>
          <button
    class={props.buttonClass}
    style={btn(false, props.page <= 1)}
    disabled={props.page <= 1}
    onClick={() => props.onPageChange(props.page - 1)}
  >
            «
          </button>
          <For7 each={buildPageNumbers(props.page, pages())}>
            {(p) => <Show6 when={p !== "\u2026"} fallback={<span style={{ padding: "3px 4px", opacity: ".4" }}>…</span>}>
                <button
    class={`${props.buttonClass ?? ""} ${props.page === p ? props.activeClass ?? "" : ""}`.trim() || void 0}
    style={btn(props.page === p, false)}
    onClick={() => props.onPageChange(p)}
  >
                  {p}
                </button>
              </Show6>}
          </For7>
          <button
    class={props.buttonClass}
    style={btn(false, props.page >= pages())}
    disabled={props.page >= pages()}
    onClick={() => props.onPageChange(props.page + 1)}
  >
            »
          </button>
        </div>
      </Show6>
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
      ...Object.fromEntries(Object.entries(params).map(([k, v3]) => [k, String(v3)])),
      $format: JSON_NOMETA
    };
    const qs = Object.entries(all).map(([k, v3]) => `${encodeURIComponent(k)}=${encodeURIComponent(v3)}`).join("&");
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
function toNum(v3) {
  if (v3 == null || v3 === "") return null;
  const n = typeof v3 === "string" ? parseFloat(v3) : Number(v3);
  return Number.isFinite(n) ? n : null;
}
function RubR2(v3) {
  const n = toNum(v3);
  return n != null ? RubIntl2.format(n) + " \u20BD" : "";
}
function Rub2(v3) {
  const n = toNum(v3);
  return n != null ? RubIntl2.format(n) : "";
}
function Rub0(v3) {
  const n = toNum(v3);
  return n != null ? RubIntl0.format(n) : "";
}
function Rub0R(v3) {
  const n = toNum(v3);
  return n != null ? RubIntl0.format(n) + " \u20BD" : "";
}
function Rub4(v3) {
  const n = toNum(v3);
  return n != null ? RubIntl4.format(n) : "";
}
function fmtNum(v3) {
  const n = toNum(v3);
  return n != null ? RubIntl0.format(n) : "\u2014";
}
function fmtPrice(v3) {
  const n = toNum(v3);
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
function toDate(v3) {
  if (v3 == null || v3 === "") return null;
  const d = v3 instanceof Date ? v3 : new Date(v3);
  return isNaN(d.getTime()) ? null : d;
}
function fmtDateTime(v3) {
  const d = toDate(v3);
  return d ? DateTimeFmt.format(d) : "";
}
function fmtDateTimeShort(v3) {
  const d = toDate(v3);
  return d ? DateTimeShortFmt.format(d) : "";
}
function fmtDate(v3) {
  const d = toDate(v3);
  return d ? DateFmt.format(d) : "";
}
function fmtTime(v3) {
  const d = toDate(v3);
  return d ? TimeFmt.format(d) : "";
}
function fmtDateMonth(v3) {
  const d = toDate(v3);
  return d ? DateMonthFmt.format(d) : "";
}
function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} \u0411`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} \u041A\u0411`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} \u041C\u0411`;
}
function timeAgo(v3) {
  const d = toDate(v3);
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
  DND_MIME,
  DumbGrid,
  DumbGridDnd,
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
  cellRect,
  colWidth,
  configureImgproxy,
  createDumbGrid,
  createDumbGridDndGroup,
  createDumbGridGroup,
  createDumbSortable,
  createGridDndEngine,
  createGridEngine,
  createGridGroupEngine,
  createOdataClient,
  createSelectionArea,
  createSortableGroup,
  dndSupported,
  extractImagesFromZip,
  firstFreeCell,
  fitSpan,
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
  insertIndex,
  mergeLayout,
  moveDeltas,
  odataString,
  overlaps,
  packFlow,
  placeFree,
  pointToCell,
  resolveSpan,
  rowCount,
  snapSpan,
  spanSize,
  timeAgo,
  toBase64
};
