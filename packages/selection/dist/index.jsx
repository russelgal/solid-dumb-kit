// ../shared/dist/index.js
import * as solid from "solid-js";
import { createEffect, untrack } from "solid-js";
function onMounted(fn) {
  createEffect(() => untrack(fn));
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

// src/solid.ts
import { onCleanup } from "solid-js";

// src/selectionMath.ts
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

// src/selectionCore.ts
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

// src/solid.ts
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

// src/SelectionArea.tsx
function SelectionArea(props) {
  let containerRef;
  onMounted(() => {
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
export {
  SelectionArea,
  areaFrom,
  clampPoint,
  createSelectionArea,
  createSelectionEngine,
  diffSelection,
  hits,
  pickHits,
  resolveSelection,
  tapSelection
};
