// src/ResizableGrid.tsx
import { For, Show } from "solid-js";
import * as v from "valibot";

// ../shared/dist/index.js
import { getOwner, runWithOwner, createSignal, createEffect } from "solid-js";
function createPersisted(key, initial, opts = {}) {
  const store = opts.storage ?? safeStorage();
  const stringify = opts.stringify ?? ((v2) => JSON.stringify(v2));
  const parse = opts.parse ?? ((raw2) => JSON.parse(raw2));
  let start = initial;
  const raw = store?.getItem(key);
  if (raw != null) {
    try {
      const parsed = parse(raw);
      if (parsed !== void 0) start = parsed;
    } catch {
    }
  }
  const [value, setValue] = createSignal(start);
  createEffect(value, (v2) => {
    try {
      store?.setItem(key, stringify(v2));
    } catch {
    }
  }, { defer: true });
  return [value, setValue];
}
function safeStorage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}
var done = /* @__PURE__ */ new Set();
function injectStyle(id, css) {
  if (typeof document === "undefined") return;
  if (done.has(id)) return;
  done.add(id);
  const was = document.querySelector(`style[data-dumb-kit="${id}"]`);
  if (was) {
    if (was.textContent !== css) was.textContent = css;
    return;
  }
  const el = document.createElement("style");
  el.setAttribute("data-dumb-kit", id);
  el.textContent = css;
  document.head.appendChild(el);
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

// src/ResizableGrid.tsx
var HANDLE_SIZE = 6;
var COLLAPSED_SIZE = 32;
var DEFAULT_MIN = 100;
var SizesSchema = v.object({
  cols: v.array(v.number()),
  rows: v.optional(v.array(v.number())),
  rowSplit: v.optional(v.array(v.number())),
  collapsed: v.optional(v.array(v.string()))
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
  injectStyle("resizable-grid", STYLES);
  const meta = {
    colIds: props.cols.map((c) => c.id),
    colCollapseAt: props.cols.map((c) => c.collapseAt),
    colMins: props.cols.map((c) => c.min ?? DEFAULT_MIN),
    colMaxes: props.cols.map((c) => c.max ?? Infinity),
    colInitials: props.cols.map((c) => c.initial ?? 1),
    rowMins: props.rows?.map((r) => r.min ?? DEFAULT_MIN) ?? [],
    rowInitials: props.rows?.map((r) => r.initial ?? 1) ?? []
  };
  const defaults = {
    cols: [...meta.colInitials],
    rows: meta.rowInitials.length ? [...meta.rowInitials] : void 0,
    rowSplit: props.rows ? [props.rowInitial ?? 1, props.row2Initial ?? 1] : void 0
  };
  const [sizes, setSizes] = createPersisted(props.storageKey, defaults, {
    parse: (raw) => validateSizes(JSON.parse(raw), defaults)
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
  const isCollapsed = (index) => sizes()?.collapsed?.includes(meta.colIds[index]) ?? false;
  function setCollapsed(index, on) {
    const id = meta.colIds[index];
    setSizes((prev) => {
      const rest = (prev?.collapsed ?? []).filter((x) => x !== id);
      return { ...prev, cols: prev?.cols ?? [...meta.colInitials], collapsed: on ? [...rest, id] : rest };
    });
  }
  const hasHandle = (index) => index > 0 && !isCollapsed(index - 1) && !isCollapsed(index);
  let containerRef;
  function startColResize(index, e) {
    e.preventDefault();
    const rect = containerRef.getBoundingClientRect();
    const open = meta.colIds.map((_, k) => !isCollapsed(k));
    const handles = meta.colIds.filter((_, k) => hasHandle(k)).length;
    const totalWidth = rect.width - HANDLE_SIZE * handles - COLLAPSED_SIZE * open.filter((o) => !o).length;
    const currentSizes = [...colSizes()];
    const totalFr = currentSizes.reduce((a, b, k) => open[k] ? a + b : a, 0);
    const startX = e.clientX;
    const leftFr = currentSizes[index];
    const rightFr = currentSizes[index + 1];
    const toFr = (px) => px / totalWidth * totalFr;
    const toPx = (fr) => fr / totalFr * totalWidth;
    const lo = Math.max(toFr(meta.colMins[index]) - leftFr, rightFr - toFr(meta.colMaxes[index + 1]));
    const hi = Math.min(toFr(meta.colMaxes[index]) - leftFr, rightFr - toFr(meta.colMins[index + 1]));
    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dFr = dx / totalWidth * totalFr;
      for (const [side, raw] of [[index, leftFr + dFr], [index + 1, rightFr - dFr]]) {
        const at = meta.colCollapseAt[side];
        if (at === void 0) continue;
        if (toPx(raw) < at) {
          if (!isCollapsed(side)) {
            currentSizes[index] = leftFr;
            currentSizes[index + 1] = rightFr;
            setSizes((prev) => ({ ...prev, cols: [...currentSizes] }));
            setCollapsed(side, true);
          }
          return;
        }
        if (isCollapsed(side)) setCollapsed(side, false);
      }
      const d = Math.min(hi, Math.max(lo, dFr));
      currentSizes[index] = leftFr + d;
      currentSizes[index + 1] = rightFr - d;
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
  const colTemplate = () => colSizes().map((v2, k) => `${hasHandle(k) ? `${HANDLE_SIZE}px ` : ""}${isCollapsed(k) ? `${COLLAPSED_SIZE}px` : `${v2}fr`}`).join(" ");
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
              <Show when={hasHandle(i())}>
                <div
    class="resizable-grid-handle-col"
    onMouseDown={(e) => startColResize(i() - 1, e)}
  />
              </Show>
              <Show
    when={isCollapsed(i())}
    fallback={<div style={{ "min-width": "0", "min-height": "0", overflow: "auto" }}>{col.content()}</div>}
  >
                {
    /* Полоса свёрнутой панели — кнопка во всю высоту: её видно
       сразу и попадают в неё не целясь. */
  }
                <button
    type="button"
    class="resizable-grid-rail btn btn-ghost btn-sm h-full w-full rounded-none p-0"
    title="Развернуть"
    aria-label="Развернуть панель"
    onClick={() => setCollapsed(i(), false)}
  >
                  {col.collapsedContent?.() ?? "\u203A"}
                </button>
              </Show>
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
var STYLES = `
.resizable-grid-handle-col {
  cursor: col-resize;
  background: linear-gradient(to right,
    transparent calc(50% - 0.5px),
    var(--dumb-grid-handle, #64748b) calc(50% - 0.5px),
    var(--dumb-grid-handle, #64748b) calc(50% + 0.5px),
    transparent calc(50% + 0.5px));
  transition: background-color 0.15s;
  z-index: 1;
}
.resizable-grid-handle-col:hover,
.resizable-grid-handle-col:active {
  background: oklch(from currentColor l c h / 0.2);
}
.resizable-grid-handle-row {
  cursor: row-resize;
  background: linear-gradient(to bottom,
    transparent calc(50% - 0.5px),
    var(--dumb-grid-handle, #64748b) calc(50% - 0.5px),
    var(--dumb-grid-handle, #64748b) calc(50% + 0.5px),
    transparent calc(50% + 0.5px));
  transition: background-color 0.15s;
  z-index: 1;
}
.resizable-grid-handle-row:hover,
.resizable-grid-handle-row:active {
  background: oklch(from currentColor l c h / 0.2);
}`;
export {
  ResizableGrid
};
