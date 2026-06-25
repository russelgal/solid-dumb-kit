// src/SelectionArea.tsx
import { onMount, onCleanup } from "solid-js";
import VanillaSelectionArea from "@viselect/vanilla";
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
        singleTap: { allow: true, intersect: "native" },
        deselectOnBlur: false,
        ...props.features
      }
    });
    selection.on("beforestart", (e) => {
      const target = e.event?.target;
      if (target?.closest("button, a, input, [data-no-select]")) return false;
      if (props.windowScroll) containerRef.classList.add("viselect-window-scroll");
      return props.onBeforeStart?.(e) ?? true;
    }).on("start", ({ store, event }) => {
      const e = event;
      const isAdditive = e instanceof MouseEvent ? e.shiftKey || e.metaKey || e.ctrlKey : false;
      if (!isAdditive) {
        selection.clearSelection();
        store.stored.forEach((el) => el.classList.remove("viselect-selected"));
      }
    }).on("move", (e) => {
      const { added, removed } = e.store.changed;
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
  return <div ref={containerRef} class={props.class} style={{ position: "relative" }}>
      {props.children}
    </div>;
}

// src/ResizableGrid.tsx
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
      setSizes((prev) => ({ ...prev, rows: [...currentSizes] }));
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
      setSizes((prev) => ({ ...prev, rowSplit: [newTop, newBottom] }));
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
  return <div
    ref={containerRef}
    class={`grid h-full w-full ${props.class ?? ""}`}
    style={{
      "grid-template-rows": rowTemplate(),
      overflow: "hidden"
    }}
  >
      {
    /* ─── Первый ряд ─── */
  }
      <div
    class="grid min-h-0"
    style={{ "grid-template-columns": colTemplate() }}
  >
        <For each={props.cols}>
          {(col, i) => <>
              <Show when={i() > 0}>
                <div
    class="resizable-grid-handle-col"
    onMouseDown={(e) => startColResize(i() - 1, e)}
  />
              </Show>
              <div class="min-w-0 min-h-0 overflow-auto">{col.content()}</div>
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
    class="grid min-h-0"
    style={{ "grid-template-columns": row2Template() }}
  >
          <For each={props.rows}>
            {(panel, i) => <>
                <Show when={i() > 0}>
                  <div
    class="resizable-grid-handle-col"
    onMouseDown={(e) => startRow2ColResize(i() - 1, e)}
  />
                </Show>
                <div class="min-w-0 min-h-0 overflow-auto">{panel.content()}</div>
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

// src/DumbSortable.tsx
import { For as For2 } from "solid-js";

// src/sortableCore.ts
import { onCleanup as onCleanup2 } from "solid-js";
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
    const distTop = d.lastY - v2.top;
    const distBot = v2.top + v2.clientH - d.lastY;
    if (distTop < EDGE && v2.sy > 0) {
      const over = (EDGE - distTop) / EDGE;
      speed = -Math.min(MAX_SPEED * ACCEL, MAX_SPEED * over);
    } else if (distBot < EDGE && v2.sy < d.scrollMax0) {
      const over = (EDGE - distBot) / EDGE;
      speed = Math.min(MAX_SPEED * ACCEL, MAX_SPEED * over);
    }
    if (speed) doScroll(d.scroller, speed);
    const vv = speed ? view(d.scroller) : v2;
    let tx = grid ? d.lastX - d.startX + (vv.sx - d.scrollX0) : 0;
    let ty = d.lastY - d.startY + (vv.sy - d.scrollY0);
    if (d.ready && d.cells.length) {
      const cell = d.cells[d.fromIndex];
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
          const cell = d.cells[newVis], me = d.cells[i];
          const dx = cell.left - me.left, dy = cell.top - me.top;
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
      toIndex: fromIndex,
      scroller,
      scrollX0: v0.sx,
      scrollY0: v0.sy,
      scrollMax0: v0.max,
      raf: 0,
      ready: false
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
  onCleanup2(() => {
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
      onCleanup2(() => {
        el.removeEventListener("pointerdown", down);
        if (rowEls.get(id) === el) rowEls.delete(id);
      });
    },
    // низкоуровневые рефы (для ручной разводки; используются текущими DataTable/ColorsEditor)
    row: (id) => (el) => {
      el.dataset.flipId = id;
      rowEls.set(id, el);
      onCleanup2(() => {
        if (rowEls.get(id) === el) rowEls.delete(id);
      });
    },
    handle: (id) => (el) => {
      const down = (ev) => onDown(id, el, ev);
      el.addEventListener("pointerdown", down);
      onCleanup2(() => el.removeEventListener("pointerdown", down));
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
  return <For2 each={props.items}>
      {(item, i) => {
    const el = props.children(item, i);
    if (el instanceof HTMLElement) s.bind(props.id(item))(el);
    return el;
  }}
    </For2>;
}
export {
  DumbSortable,
  ResizableGrid,
  SelectionArea,
  createDumbSortable
};
