import { delegateEvents, createComponent, setAttribute, insert, effect, setStyleProperty, use, memo, className, style, template } from 'solid-js/web';
import { createSignal, onCleanup, createMemo, Show, For } from 'solid-js';
import { createFileUploader, createDropzone } from '@solid-primitives/upload';

// src/DumbGallery.tsx
function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function shouldAnimate(explicit) {
  if (explicit !== void 0) return explicit;
  return !prefersReducedMotion();
}
var DUR = 380;
var EASE = "cubic-bezier(.2,.8,.2,1)";
var C = { x1: 0.2, y1: 0.8, x2: 0.2, y2: 1 };
var curve = (a, b, t) => {
  const u = 1 - t;
  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
};
function progress(p) {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  let t = p;
  for (let i = 0; i < 4; i++) {
    const x = curve(C.x1, C.x2, t) - p;
    const u = 1 - t;
    const d = 3 * u * u * C.x1 + 6 * u * t * (C.x2 - C.x1) + 3 * t * t * (1 - C.x2);
    if (Math.abs(d) < 1e-6) break;
    t -= x / d;
  }
  return curve(C.y1, C.y2, Math.max(0, Math.min(1, t)));
}
function createFlip(animate) {
  const live = /* @__PURE__ */ new Map();
  function at(cur) {
    if (!cur) return { x: 0, y: 0 };
    if (!cur.anim) return { x: cur.toX, y: cur.toY };
    const e = progress(Number(cur.anim.currentTime ?? 0) / DUR);
    return {
      x: cur.fromX + (cur.toX - cur.fromX) * e,
      y: cur.fromY + (cur.toY - cur.fromY) * e
    };
  }
  function release(el, anim) {
    anim.finished.then(() => {
      if (live.get(el)?.anim !== anim) return;
      anim.cancel();
      live.delete(el);
    }).catch(() => {
    });
  }
  return {
    nudge(el, dx, dy) {
      const cur = live.get(el);
      const now = at(cur);
      cur?.anim?.cancel();
      const fromX = now.x + dx;
      const fromY = now.y + dy;
      if (!animate || !fromX && !fromY) {
        el.style.transform = "";
        live.delete(el);
        return;
      }
      const anim = el.animate(
        [
          { transform: `translate(${fromX}px,${fromY}px)` },
          { transform: "translate(0px,0px)" }
        ],
        { duration: DUR, easing: EASE, fill: "forwards" }
      );
      live.set(el, { anim, fromX, fromY, toX: 0, toY: 0 });
      release(el, anim);
    },
    to(el, dx, dy) {
      const cur = live.get(el);
      const atX = cur ? cur.toX : 0;
      const atY = cur ? cur.toY : 0;
      if (atX === dx && atY === dy) return;
      if (!animate) {
        el.style.transform = dx || dy ? `translate(${dx}px,${dy}px)` : "";
        if (dx || dy)
          live.set(el, {
            anim: null,
            fromX: dx,
            fromY: dy,
            toX: dx,
            toY: dy
          });
        else live.delete(el);
        return;
      }
      const now = at(cur);
      const fromX = now.x;
      const fromY = now.y;
      cur?.anim?.cancel();
      const anim = el.animate(
        [
          { transform: `translate(${fromX}px,${fromY}px)` },
          { transform: `translate(${dx}px,${dy}px)` }
        ],
        { duration: DUR, easing: EASE, fill: "forwards" }
      );
      live.set(el, { anim, fromX, fromY, toX: dx, toY: dy });
      if (!dx && !dy) release(el, anim);
    },
    clear() {
      for (const [el, st] of live) {
        st.anim?.cancel();
        el.style.transform = "";
      }
      live.clear();
    }
  };
}
var EDGE = 48;
var MAX_SPEED = 18;
var ACCEL = 3.5;
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
var SCROLLABLE = /(auto|scroll|overlay)/;
var MAX_STEP = 18;
function createAutoScroller() {
  let levels = [];
  let x = 0;
  let y = 0;
  let raf = 0;
  let live = false;
  let echo = 0;
  const onNativeDrag = (ev) => {
    if (!ev.clientX && !ev.clientY) return;
    x = ev.clientX;
    y = ev.clientY;
    wake();
  };
  const onScroll = (ev) => {
    if (echo > 0) {
      echo = 0;
      return;
    }
    const t = ev.target;
    for (const level of levels) {
      if (level.el ? t === level.el : t === document || t === document.documentElement) {
        level.pos = level.el ? level.el.scrollTop : window.scrollY;
        return;
      }
    }
  };
  function step() {
    for (const level of levels) {
      if (x < level.left - EDGE || x > level.right + EDGE) continue;
      const speed = autoScrollSpeed({
        pointerY: y,
        viewTop: level.top,
        clientH: level.bottom - level.top,
        scrollY: level.pos,
        scrollMax: level.max
      });
      if (!speed) continue;
      const capped = Math.max(-MAX_STEP, Math.min(MAX_STEP, speed));
      const next = Math.max(0, Math.min(level.max, level.pos + capped));
      if (next === level.pos) continue;
      level.pos = next;
      echo++;
      if (level.el) level.el.scrollTop = next;
      else window.scrollTo(window.scrollX, next);
      return true;
    }
    return false;
  }
  function frame() {
    if (!live) return;
    if (!step()) {
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  function wake() {
    if (live && !raf) raf = requestAnimationFrame(frame);
  }
  return {
    start(el) {
      levels = [];
      let node = el;
      while (node && node !== document.body && node !== document.documentElement) {
        const style2 = getComputedStyle(node);
        if (SCROLLABLE.test(style2.overflowY) || SCROLLABLE.test(style2.overflowX)) {
          const r = node.getBoundingClientRect();
          levels.push({
            el: node,
            top: r.top,
            bottom: r.bottom,
            left: r.left,
            right: r.right,
            max: node.scrollHeight - node.clientHeight,
            pos: node.scrollTop
          });
        }
        node = node.parentElement;
      }
      levels.push({
        el: null,
        top: 0,
        bottom: window.innerHeight,
        left: 0,
        right: window.innerWidth,
        max: (document.scrollingElement?.scrollHeight ?? 0) - window.innerHeight,
        pos: window.scrollY
      });
      live = true;
      document.addEventListener("drag", onNativeDrag, true);
      document.addEventListener("scroll", onScroll, { capture: true, passive: true });
      wake();
    },
    move(nextX, nextY) {
      x = nextX;
      y = nextY;
      wake();
    },
    stop() {
      live = false;
      echo = 0;
      document.removeEventListener("drag", onNativeDrag, true);
      document.removeEventListener("scroll", onScroll, true);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      levels = [];
    }
  };
}
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
    const want = clamp(Math.round(it.w) || 1, 1, c);
    const h = Math.max(1, Math.round(it.h) || 1);
    const fromCol = mode === "dense" ? 0 : curCol;
    const fromRow = mode === "dense" ? 0 : curRow;
    const min = clamp(Math.round(it.minW ?? want) || 1, 1, want);
    let best = null;
    for (let w2 = want; w2 >= min; w2--) {
      const spot = grid.findFrom(fromCol, fromRow, w2, h, c);
      if (!best || spot.row < best.row || spot.row === best.row && spot.col < best.col) {
        best = { col: spot.col, row: spot.row, w: w2 };
      }
      if (best.row === fromRow && best.col === fromCol) break;
    }
    const { col, row, w } = best;
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
delegateEvents(["click"]);
function insertIndexReading(args) {
  const { base, dragId, m, x, y } = args;
  let k = 0;
  for (const p of base) {
    if (p.id === dragId) continue;
    const r = cellRect(p, m);
    if (p.w >= m.cols) {
      if (y > r.y + r.height / 2) k++;
      continue;
    }
    if (y > r.y + r.height) k++;
    else if (y >= r.y && x > r.x + r.width / 2) k++;
  }
  return k;
}
function planDrop(args) {
  const { spans, m, x, y, drag } = args;
  const home = drag.fromIndex !== null;
  const layout = packFlow(spans, m.cols);
  const base = args.base ?? layout;
  const index = insertIndexReading({ base, dragId: drag.id, m, x, y });
  let next;
  if (home) {
    next = packFlow(reorder(spans, drag.fromIndex, index), m.cols);
  } else {
    const merged = spans.slice();
    merged.splice(index, 0, { id: drag.id, w: Math.min(drag.w, m.cols), h: drag.h });
    next = packFlow(merged, m.cols);
  }
  const me = next.find((b) => b.id === drag.id);
  return {
    index,
    next,
    // сдвиги считаем от НАСТОЯЩЕЙ укладки: transform у блоков абсолютный,
    // а не накопительный — иначе они уезжали бы дважды
    moves: moveDeltas({ base: layout, next, m, skipId: drag.id }),
    rect: me ? cellRect(me, m) : null
  };
}
var SLIDE = "transform .18s cubic-bezier(.2,.8,.2,1)";
var PREVIEW_BG = "rgba(59,130,246,.10)";
var PREVIEW_LINE = "2px dashed rgba(59,130,246,.85)";
function createGridDndEngine(opts = {}) {
  const zones = /* @__PURE__ */ new Map();
  let drag = null;
  let over = null;
  const boxes = /* @__PURE__ */ new Map();
  const scroller = createAutoScroller();
  const setOver = (name) => {
    if (over === name) return;
    over = name;
    opts.onOver?.(name);
  };
  const metricsOf = (z) => {
    const cols = Math.max(1, Math.floor(z.opts.cols()));
    const gapX = z.opts.gapX();
    return { cols, colW: colWidth(z.contentW, cols, gapX), rowH: z.opts.rowHeight(), gapX, gapY: z.opts.gapY() };
  };
  function snapshotZones(cb) {
    const targets = [];
    for (const z of zones.values()) if (z.el) targets.push(z.el);
    if (!targets.length || typeof IntersectionObserver !== "function") {
      cb();
      return;
    }
    let batches = 0;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const name = e.target.dataset.dndZone;
        if (name) boxes.set(name, { left: e.boundingClientRect.left, top: e.boundingClientRect.top });
      }
      batches++;
      if (boxes.size < targets.length && batches < 4) return;
      io.disconnect();
      cb();
    });
    for (const t of targets) io.observe(t);
  }
  function snapOf(zone) {
    const box = zone.el ? boxes.get(zone.name) : null;
    if (!zone.el || !box) return null;
    const m = metricsOf(zone);
    const spans = zone.opts.order().map((id) => ({ id, ...zone.opts.spanOf(id) }));
    return {
      zone,
      m,
      base: packFlow(spans, m.cols),
      left: box.left + zone.padLeft,
      top: box.top + zone.padTop,
      winX: window.scrollX,
      winY: window.scrollY
    };
  }
  function pointIn(s, x, y) {
    return {
      x: x - (s.left - (window.scrollX - s.winX)),
      y: y - (s.top - (window.scrollY - s.winY))
    };
  }
  const snapFor = (d, zone) => {
    let s = d.snaps.get(zone.name);
    if (!s) {
      const fresh = snapOf(zone);
      if (!fresh) return null;
      d.snaps.set(zone.name, s = fresh);
    }
    return s;
  };
  function slide(d, zone, moves) {
    for (const mv of moves) {
      const el = zone.els.get(mv.id);
      if (!el || el === d.el) continue;
      d.touched.add(el);
      d.flip.to(el, mv.dx, mv.dy);
    }
  }
  function calm(d) {
    for (const el of d.touched) d.flip.to(el, 0, 0);
    d.touched.clear();
  }
  function unarm(d) {
    d.flip.clear();
    d.touched.clear();
  }
  function showPreview(d, zone, rect) {
    if (!zone.el) return;
    if (d.preview && d.previewZone !== zone.name) {
      d.preview.remove();
      d.preview = null;
    }
    if (!d.preview) {
      const box = document.createElement("div");
      box.dataset.dndGhost = "";
      box.setAttribute("aria-hidden", "true");
      box.style.cssText = [
        "position:absolute",
        "left:0",
        "top:0",
        "pointer-events:none",
        "box-sizing:border-box",
        "border-radius:10px",
        "z-index:5",
        `background:${PREVIEW_BG}`,
        `outline:${PREVIEW_LINE}`,
        "outline-offset:-2px"
      ].join(";");
      if (shouldAnimate(opts.animate)) box.style.transition = SLIDE;
      zone.el.appendChild(box);
      d.preview = box;
      d.previewZone = zone.name;
    }
    d.preview.style.width = `${rect.width}px`;
    d.preview.style.height = `${rect.height}px`;
    d.preview.style.transform = `translate(${rect.x}px,${rect.y}px)`;
  }
  function update(d, zone, x, y) {
    if (!boxes.size) return;
    const s = snapFor(d, zone);
    if (!s) return;
    const home = zone.name === d.fromZone;
    const p = pointIn(s, x, y);
    const plan = planDrop({
      spans: zone.opts.order().map((id) => ({ id, ...zone.opts.spanOf(id) })),
      base: d.toZone === zone.name ? d.view : void 0,
      m: s.m,
      x: p.x,
      y: p.y,
      drag: { id: d.id, ...d.span, fromIndex: home ? d.fromIndex : null }
    });
    const k = plan.index;
    if (zone.name === d.toZone && k === d.toIndex) return;
    if (zone.name !== d.toZone) calm(d);
    d.toZone = zone.name;
    d.toIndex = k;
    d.view = plan.next;
    slide(d, zone, plan.moves);
    if (plan.rect) showPreview(d, zone, plan.rect);
    opts.onRows?.(zone.name, rowCount(plan.next));
  }
  function endDrag() {
    if (!drag) return;
    scroller.stop();
    const d = drag;
    for (const name of d.snaps.keys()) opts.onRows?.(name, 0);
    unarm(d);
    d.preview?.remove();
    d.el.style.opacity = "";
    drag = null;
    setOver(null);
    opts.onActive?.(null);
  }
  let overZone = null;
  let escaped = false;
  const zoneOf = (ev) => {
    const el = ev.target?.closest?.("[data-dnd-zone]");
    const name = el?.dataset.dndZone;
    return name ? zones.get(name) ?? null : null;
  };
  const accepts = (zone, from) => from === zone.name || !zone.opts.accepts || zone.opts.accepts(from);
  const onDragStart = (ev) => {
    const el = ev.target?.closest?.("[data-dnd-block]");
    const id = el?.dataset.dndBlock;
    const zone = zoneOf(ev);
    if (!id || !zone) return;
    if (zone.opts.disabled?.() || !zone.opts.order().includes(id)) {
      ev.preventDefault();
      return;
    }
    const index = zone.opts.order().indexOf(id);
    if (index < 0) {
      ev.preventDefault();
      return;
    }
    const span = zone.opts.spanOf(id);
    ev.dataTransfer?.setData("text/plain", id);
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = "move";
    overZone = zone.name;
    escaped = false;
    boxes.clear();
    drag = {
      fromZone: zone.name,
      id,
      fromIndex: index,
      el,
      span,
      toZone: zone.name,
      toIndex: index,
      snaps: /* @__PURE__ */ new Map(),
      view: [],
      touched: /* @__PURE__ */ new Set(),
      flip: createFlip(shouldAnimate(opts.animate)),
      preview: null,
      previewZone: null
    };
    setOver(zone.name);
    opts.onActive?.({ grid: zone.name, id, ...span });
    el.style.opacity = "0.4";
    scroller.start(zone.el ?? el);
    snapshotZones(() => {
      if (!drag || drag.id !== id) return;
      const snap = snapOf(zone);
      if (!snap) return;
      drag.snaps.set(zone.name, snap);
      drag.view = snap.base;
    });
  };
  const onDragOver = (ev) => {
    const d = drag;
    if (!d) return;
    const zone = zoneOf(ev);
    if (!zone || !accepts(zone, d.fromZone)) {
      setOver(null);
      return;
    }
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
    scroller.move(ev.clientX, ev.clientY);
    overZone = zone.name;
    setOver(zone.name);
    update(d, zone, ev.clientX, ev.clientY);
  };
  const onZoneLeave = (ev) => {
    const to = ev.relatedTarget;
    if (!to) return;
    const zone = zoneOf(ev);
    if (zone?.el?.contains(to)) return;
    if (overZone === zone?.name) overZone = null;
  };
  const onKey = (ev) => {
    if (ev.key === "Escape") escaped = true;
  };
  const onFinish = (ev) => {
    const d = drag;
    if (!d) return;
    const dropped = !escaped && overZone === d.toZone;
    if (ev.type === "drop") ev.preventDefault();
    const { toZone, toIndex, fromZone, fromIndex, id } = d;
    endDrag();
    if (!dropped || toIndex < 0) return;
    if (toZone !== fromZone) {
      opts.onTransfer?.({ grid: fromZone, id, index: fromIndex }, { grid: toZone, index: toIndex });
      return;
    }
    if (toIndex !== fromIndex) zones.get(fromZone)?.opts.onReorder?.(fromIndex, toIndex);
  };
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
          el.dataset.dndZone = zone.name;
          el.addEventListener("dragstart", onDragStart);
          el.addEventListener("dragover", onDragOver);
          el.addEventListener("dragleave", onZoneLeave);
          el.addEventListener("drop", onFinish);
          el.addEventListener("dragend", onFinish);
          document.addEventListener("keydown", onKey);
          let ro = null;
          if (typeof ResizeObserver === "function") {
            ro = new ResizeObserver((entries) => {
              const r = entries[entries.length - 1]?.contentRect;
              if (!r) return;
              zone.contentW = r.width;
              zone.padLeft = r.left;
              zone.padTop = r.top;
            });
            ro.observe(el);
            zone.ro = ro;
          }
          return () => {
            el.removeEventListener("dragstart", onDragStart);
            el.removeEventListener("dragover", onDragOver);
            el.removeEventListener("dragleave", onZoneLeave);
            el.removeEventListener("drop", onFinish);
            el.removeEventListener("dragend", onFinish);
            document.removeEventListener("keydown", onKey);
            ro?.disconnect();
            delete el.dataset.dndZone;
            if (zone.ro === ro) zone.ro = null;
            if (zone.el === el) zone.el = null;
          };
        },
        attach(el, id) {
          zone.els.set(id, el);
          el.dataset.dndBlock = id;
          el.setAttribute("draggable", "true");
          return () => {
            el.removeAttribute("draggable");
            delete el.dataset.dndBlock;
            if (zone.els.get(id) === el) zone.els.delete(id);
          };
        }
      };
    },
    active: () => drag ? { grid: drag.fromZone, id: drag.id, ...drag.span } : null,
    over: () => over,
    destroy() {
      endDrag();
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
function createDumbGridDndGroup(opts = {}) {
  const [active, setActive] = createSignal(null);
  const [over, setOver] = createSignal(null);
  const [rows, setRows] = createSignal({});
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
    onRows: (grid, n) => {
      setRows((prev) => prev[grid] === n ? prev : { ...prev, [grid]: n });
      opts.onRows?.(grid, n);
    }
  });
  onCleanup(engine.destroy);
  return {
    grid(name, zoneOpts) {
      const zone = engine.grid(name, zoneOpts);
      return {
        container: (el) => onCleanup(zone.attachContainer(el)),
        bind: (id) => (el) => onCleanup(zone.attach(el, id)),
        active: () => {
          const a = active();
          return a && a.grid === name ? a.id : null;
        }
      };
    },
    active,
    over,
    rows: (grid) => rows()[grid] ?? 0
  };
}
var _tmpl$ = /* @__PURE__ */ template(`<div style="display:grid;position:relative;transition:min-height .15s ease">`);
var _tmpl$2 = /* @__PURE__ */ template(`<div style=position:relative;min-width:0;min-height:0;box-sizing:border-box>`);
var DEFAULT_COLS = 12;
var DEFAULT_ROW_H = 80;
var DEFAULT_GAP = 12;
function DumbGridDnd(props) {
  const cols = () => Math.max(1, Math.floor(props.cols ?? DEFAULT_COLS));
  const rowH = () => props.rowHeight ?? DEFAULT_ROW_H;
  const gap = () => props.gap ?? DEFAULT_GAP;
  const spans = createMemo(() => props.items.map((it) => ({
    id: it.id,
    w: resolveSpan(it.w, cols()),
    h: Math.max(1, Math.round(it.h ?? 1) || 1)
  })));
  const group = props.group ?? createDumbGridDndGroup();
  const name = () => props.name ?? "grid";
  const g = group.grid(name(), {
    order: () => props.items.map((it) => it.id),
    spanOf: (id) => spans().find((s) => s.id === id) ?? {
      w: 1,
      h: 1
    },
    // метрики нужны движку, чтобы считать место вставки арифметикой,
    // а не по тому, какой блок сейчас под курсором
    cols,
    rowHeight: rowH,
    gapX: gap,
    gapY: gap,
    disabled: () => props.disabled === true,
    onReorder: (from, to) => props.onReorder?.(from, to)
  });
  const placed = createMemo(() => packFlow(spans(), cols()));
  const posById = createMemo(() => new Map(placed().map((p) => [p.id, p])));
  const rows = createMemo(() => rowCount(placed()));
  const liveRows = () => {
    const base = Math.max(rows(), group.rows(name()));
    const a = group.active();
    const mine = a && (a.grid === name() || group.over() === name());
    return mine ? base + 1 : base;
  };
  return (() => {
    var _el$ = _tmpl$();
    var _ref$ = g.container;
    typeof _ref$ === "function" ? use(_ref$, _el$) : g.container = _el$;
    insert(_el$, createComponent(For, {
      get each() {
        return props.items;
      },
      children: (it) => {
        const pos = () => posById().get(it.id);
        return (() => {
          var _el$2 = _tmpl$2();
          var _ref$2 = props.disabled ? void 0 : g.bind(it.id);
          typeof _ref$2 === "function" && use(_ref$2, _el$2);
          insert(_el$2, () => it.content());
          effect((_p$) => {
            var _v$3 = props.blockClass, _v$4 = {
              // позицию считаем мы, браузер её не домысливает
              "grid-column": `${(pos()?.col ?? 0) + 1} / span ${pos()?.w ?? 1}`,
              "grid-row": `${(pos()?.row ?? 0) + 1} / span ${pos()?.h ?? 1}`,
              cursor: props.disabled ? "default" : "grab",
              ...props.blockStyle
            };
            _v$3 !== _p$.e && className(_el$2, _p$.e = _v$3);
            _p$.t = style(_el$2, _v$4, _p$.t);
            return _p$;
          }, {
            e: void 0,
            t: void 0
          });
          return _el$2;
        })();
      }
    }));
    effect((_p$) => {
      var _v$ = props.class, _v$2 = {
        "grid-template-columns": `repeat(${cols()}, minmax(0, 1fr))`,
        "grid-auto-rows": `${rowH()}px`,
        gap: `${gap()}px`,
        "min-height": `${(() => {
          const n = liveRows();
          return n * rowH() + Math.max(0, n - 1) * gap();
        })()}px`,
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

// ../shared/dist/index.js
var done = /* @__PURE__ */ new Set();
function injectStyle(id, css) {
  if (typeof document === "undefined") return;
  if (done.has(id)) return;
  done.add(id);
  if (document.querySelector(`style[data-dumb-kit="${id}"]`)) return;
  const el = document.createElement("style");
  el.setAttribute("data-dumb-kit", id);
  el.textContent = css;
  document.head.appendChild(el);
}

// src/uploadQueue.ts
function createUploadQueue(upload, events = {}, concurrency = 3) {
  const waiting = [];
  const running = /* @__PURE__ */ new Map();
  let dead = false;
  function pump() {
    while (!dead && running.size < concurrency && waiting.length) {
      const next = waiting.shift();
      start(next.id, next.file);
    }
  }
  function start(id, file) {
    const ctrl = new AbortController();
    running.set(id, ctrl);
    events.onStart?.(id);
    upload(file, {
      signal: ctrl.signal,
      onProgress: (f) => {
        if (running.get(id) === ctrl) events.onProgress?.(id, clamp2(f));
      }
    }).then((res) => {
      if (running.get(id) !== ctrl) return;
      running.delete(id);
      events.onDone?.(id, res);
    }).catch((err) => {
      if (running.get(id) !== ctrl) return;
      running.delete(id);
      events.onError?.(id, message(err));
    }).finally(pump);
  }
  return {
    add(id, file) {
      if (dead) return;
      waiting.push({ id, file });
      pump();
    },
    cancel(id) {
      const i = waiting.findIndex((w) => w.id === id);
      if (i >= 0) {
        waiting.splice(i, 1);
        return;
      }
      const ctrl = running.get(id);
      if (!ctrl) return;
      running.delete(id);
      ctrl.abort();
      pump();
    },
    destroy() {
      dead = true;
      waiting.length = 0;
      for (const ctrl of running.values()) ctrl.abort();
      running.clear();
    },
    pending: () => waiting.length + running.size
  };
}
var clamp2 = (f) => f < 0 ? 0 : f > 1 ? 1 : f;
function message(err) {
  if (err instanceof Error) return err.message;
  return String(err);
}

// src/DumbGallery.tsx
var _tmpl$3 = /* @__PURE__ */ template(`<button type=button data-no-drag title=\u0443\u0431\u0440\u0430\u0442\u044C>\u2715`);
var _tmpl$22 = /* @__PURE__ */ template(`<span class=dumb-gallery-bar><i>`);
var _tmpl$32 = /* @__PURE__ */ template(`<figure class=dumb-gallery-tile><img>`);
var _tmpl$4 = /* @__PURE__ */ template(`<button type=button>\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u0444\u0430\u0439\u043B\u044B`);
var _tmpl$5 = /* @__PURE__ */ template(`<span data-gallery-stats>`);
var _tmpl$6 = /* @__PURE__ */ template(`<div>`);
var CSS = `
          /* \u0441\u0435\u0442\u043A\u0443 \u0440\u0438\u0441\u0443\u0435\u0442 DumbGridDnd; \u043F\u043B\u0438\u0442\u043A\u0430 \u0437\u0430\u043D\u0438\u043C\u0430\u0435\u0442 \u044F\u0447\u0435\u0439\u043A\u0443 \u0446\u0435\u043B\u0438\u043A\u043E\u043C */
          .dumb-gallery-tile { position: relative; overflow: hidden; height: 100%;
                               border-radius: 10px; background: rgb(0 0 0 / .04) }
          .dumb-gallery-tile img { width: 100%; height: 100%; object-fit: cover; display: block }
          /* \u043F\u043E\u043A\u0430 \u0444\u0430\u0439\u043B \u0435\u0434\u0435\u0442 \u2014 \u043F\u0440\u0438\u0433\u043B\u0443\u0448\u0430\u0435\u043C \u0438 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u043C \u043F\u043E\u043B\u043E\u0441\u0443 */
          .dumb-gallery-tile[data-status="uploading"] img,
          .dumb-gallery-tile[data-status="queued"] img { opacity: .5 }
          /* \u0436\u0434\u0443\u0449\u0438\u0439 \u0432 \u043E\u0447\u0435\u0440\u0435\u0434\u0438 \u043E\u0442\u043B\u0438\u0447\u0430\u0435\u0442\u0441\u044F \u043E\u0442 \u0438\u0434\u0443\u0449\u0435\u0433\u043E: \u043F\u043E\u043B\u043E\u0441\u0430 \u0443 \u043D\u0435\u0433\u043E \u043D\u0435 \u0434\u0432\u0438\u0436\u0435\u0442\u0441\u044F */
          .dumb-gallery-tile[data-status="queued"] .dumb-gallery-bar > i { width: 0 !important }
          .dumb-gallery-tile[data-status="error"] { outline: 2px solid currentColor }
          .dumb-gallery-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 3px;
                              background: rgb(0 0 0 / .12) }
          .dumb-gallery-bar > i { display: block; height: 100%; background: currentColor;
                                  transition: width .12s linear }
          .dumb-gallery-drop { position: relative }
          .dumb-gallery-drop[data-over="1"]::after {
            content: ''; position: absolute; inset: -6px; border-radius: 12px;
            outline: 2px dashed currentColor; pointer-events: none }
        `;
function DumbGallery(props) {
  injectStyle("gallery", CSS);
  const editable = () => props.editable !== false;
  const accept = () => props.accept ?? "image/*";
  const [dragOver, setDragOver] = createSignal(false);
  const patch = (id, next) => props.setItems(props.items.map((it) => it.id === id ? {
    ...it,
    ...next
  } : it));
  const queue = createUploadQueue((file, ctx) => {
    const up = props.upload;
    if (!up) return Promise.reject(new Error("\u0442\u0440\u0430\u043D\u0441\u043F\u043E\u0440\u0442 \u043D\u0435 \u0437\u0430\u0434\u0430\u043D"));
    return up(file, ctx);
  }, {
    onStart: (id) => patch(id, {
      status: "uploading"
    }),
    onProgress: (id, p) => patch(id, {
      progress: p
    }),
    onDone: (id, res) => {
      const was = props.items.find((it) => it.id === id);
      if (was?.preview) URL.revokeObjectURL(was.preview);
      patch(id, {
        status: "done",
        progress: 1,
        url: res.url,
        key: res.key,
        preview: void 0
      });
    },
    onError: (id, err) => patch(id, {
      status: "error",
      error: err
    })
  }, props.concurrency ?? 3);
  onCleanup(() => queue.destroy());
  const room = () => props.max === void 0 ? Infinity : props.max - props.items.length;
  function accepted(files) {
    if (!editable()) return;
    const take = files.slice(0, Math.max(0, room()));
    if (!take.length) return;
    const added = take.map((f, i) => ({
      // время + индекс: у двух файлов, выбранных одним кликом, имена совпадают
      id: `g${Date.now().toString(36)}${i}`,
      url: f.source,
      preview: f.source,
      name: f.name,
      size: f.size,
      status: props.upload ? "queued" : "local",
      progress: props.upload ? 0 : void 0
    }));
    props.setItems([...props.items, ...added]);
    if (props.upload) added.forEach((it, i) => queue.add(it.id, take[i].file));
  }
  const picker = createFileUploader({
    accept: accept(),
    multiple: props.multiple !== false
  });
  const dropzone = createDropzone({
    // подсветкой рулим сами (см. `withFiles`): дропзона не отличает файлы от
    // перетаскиваемой плитки
    onDrop: (files) => {
      setDragOver(false);
      accepted(files);
    }
  });
  function remove(item) {
    queue.cancel(item.id);
    if (item.preview) URL.revokeObjectURL(item.preview);
    props.setItems(props.items.filter((it) => it.id !== item.id));
  }
  onCleanup(() => {
    for (const it of props.items) if (it.preview) URL.revokeObjectURL(it.preview);
  });
  const stats = createMemo(() => {
    let up = 0;
    let bad = 0;
    for (const it of props.items) {
      if (it.status === "uploading" || it.status === "queued") up++;
      if (it.status === "error") bad++;
    }
    return {
      up,
      bad
    };
  });
  const byId = createMemo(() => new Map(props.items.map((it) => [it.id, it])));
  const blocks = /* @__PURE__ */ new Map();
  const gridItems = createMemo(() => props.items.map((it) => {
    const key = `${it.id}|${String(it.w ?? 1)}|${it.h ?? 1}`;
    let block = blocks.get(key);
    if (!block) {
      block = {
        id: it.id,
        w: it.w ?? 1,
        h: it.h ?? 1,
        content: () => tile(it.id)
      };
      blocks.set(key, block);
    }
    return block;
  }));
  const tile = (id) => {
    const it = () => byId().get(id);
    return createComponent(Show, {
      get when() {
        return it();
      },
      children: (item) => (() => {
        var _el$ = _tmpl$32(), _el$2 = _el$.firstChild;
        _el$.$$click = () => props.onOpen?.(item(), props.items.findIndex((x) => x.id === id));
        setAttribute(_el$2, "draggable", false);
        insert(_el$, createComponent(Show, {
          get when() {
            return editable();
          },
          get children() {
            var _el$3 = _tmpl$3();
            _el$3.$$click = (ev) => {
              ev.stopPropagation();
              remove(item());
            };
            setAttribute(_el$3, "draggable", false);
            return _el$3;
          }
        }), null);
        insert(_el$, createComponent(Show, {
          get when() {
            return item().status === "uploading" || item().status === "queued";
          },
          get children() {
            var _el$4 = _tmpl$22(), _el$5 = _el$4.firstChild;
            effect((_$p) => setStyleProperty(_el$5, "width", `${Math.round((item().progress ?? 0) * 100)}%`));
            return _el$4;
          }
        }), null);
        effect((_p$) => {
          var _v$ = item().status ?? "local", _v$2 = item().error ?? item().name, _v$3 = item().preview ?? item().url, _v$4 = item().name ?? "";
          _v$ !== _p$.e && setAttribute(_el$, "data-status", _p$.e = _v$);
          _v$2 !== _p$.t && setAttribute(_el$, "title", _p$.t = _v$2);
          _v$3 !== _p$.a && setAttribute(_el$2, "src", _p$.a = _v$3);
          _v$4 !== _p$.o && setAttribute(_el$2, "alt", _p$.o = _v$4);
          return _p$;
        }, {
          e: void 0,
          t: void 0,
          a: void 0,
          o: void 0
        });
        return _el$;
      })()
    });
  };
  function reorder2(from, to) {
    const next = props.items.slice();
    next.splice(to, 0, next.splice(from, 1)[0]);
    props.setItems(next);
  }
  const withFiles = (ev) => !!ev.dataTransfer?.types?.includes("Files");
  return (() => {
    var _el$6 = _tmpl$6();
    _el$6.addEventListener("drop", () => setDragOver(false));
    _el$6.addEventListener("dragleave", (ev) => {
      if (!ev.relatedTarget) setDragOver(false);
    });
    _el$6.addEventListener("dragover", (ev) => {
      if (withFiles(ev)) setDragOver(true);
    });
    var _ref$ = dropzone.setRef;
    typeof _ref$ === "function" ? use(_ref$, _el$6) : dropzone.setRef = _el$6;
    insert(_el$6, createComponent(DumbGridDnd, {
      get items() {
        return gridItems();
      },
      get cols() {
        return props.cols ?? 6;
      },
      get rowHeight() {
        return props.rowHeight ?? 120;
      },
      get gap() {
        return props.gap ?? 10;
      },
      get disabled() {
        return !editable();
      },
      onReorder: reorder2
    }), null);
    insert(_el$6, createComponent(Show, {
      get when() {
        return editable();
      },
      get children() {
        var _el$7 = _tmpl$4();
        _el$7.$$click = () => picker.selectFiles(accepted);
        return _el$7;
      }
    }), null);
    insert(_el$6, createComponent(Show, {
      get when() {
        return stats().up || stats().bad;
      },
      get children() {
        var _el$8 = _tmpl$5();
        insert(_el$8, (() => {
          var _c$ = memo(() => !!stats().up);
          return () => _c$() ? `\u0437\u0430\u043B\u0438\u0432\u0430\u0435\u0442\u0441\u044F: ${stats().up}` : "";
        })(), null);
        insert(_el$8, (() => {
          var _c$2 = memo(() => !!stats().bad);
          return () => _c$2() ? ` \xB7 \u0441 \u043E\u0448\u0438\u0431\u043A\u043E\u0439: ${stats().bad}` : "";
        })(), null);
        return _el$8;
      }
    }), null);
    effect((_p$) => {
      var _v$5 = `dumb-gallery-drop ${props.class ?? ""}`, _v$6 = dragOver() && editable() ? "1" : void 0, _v$7 = props.style;
      _v$5 !== _p$.e && className(_el$6, _p$.e = _v$5);
      _v$6 !== _p$.t && setAttribute(_el$6, "data-over", _p$.t = _v$6);
      _p$.a = style(_el$6, _v$7, _p$.a);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0
    });
    return _el$6;
  })();
}
delegateEvents(["click"]);

// src/presigned.ts
function createPresignedUploader(opts) {
  return (file, ctx) => opts.sign(file).then((p) => putWithProgress(file, p, ctx));
}
function putWithProgress(file, p, ctx) {
  return new Promise((resolve, reject) => {
    if (ctx.signal.aborted) return reject(new Error("\u043E\u0442\u043C\u0435\u043D\u0435\u043D\u043E"));
    const xhr = new XMLHttpRequest();
    xhr.open(p.method ?? "PUT", p.url, true);
    for (const [k, v] of Object.entries(p.headers ?? {})) xhr.setRequestHeader(k, v);
    const onAbort = () => xhr.abort();
    ctx.signal.addEventListener("abort", onAbort, { once: true });
    const done2 = () => ctx.signal.removeEventListener("abort", onAbort);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) ctx.onProgress(ev.loaded / ev.total);
    };
    xhr.onload = () => {
      done2();
      if (xhr.status >= 200 && xhr.status < 300) {
        ctx.onProgress(1);
        resolve({ url: p.publicUrl ?? stripQuery(p.url), key: p.key });
      } else {
        reject(new Error(`\u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435 \u043E\u0442\u0432\u0435\u0442\u0438\u043B\u043E ${xhr.status}${reason(xhr.responseText)}`));
      }
    };
    xhr.onerror = () => {
      done2();
      reject(new Error("\u0441\u0435\u0442\u044C \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430"));
    };
    xhr.onabort = () => {
      done2();
      reject(new Error("\u043E\u0442\u043C\u0435\u043D\u0435\u043D\u043E"));
    };
    xhr.send(file);
  });
}
var stripQuery = (url) => url.split("?")[0];
function reason(body) {
  const m = body && /<Message>([^<]+)<\/Message>/.exec(body);
  return m ? `: ${m[1]}` : "";
}

export { DumbGallery, createPresignedUploader, createUploadQueue };
