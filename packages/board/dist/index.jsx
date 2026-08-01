// src/DumbBoard.tsx
import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";

// ../shared/dist/index.js
function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function shouldAnimate(explicit) {
  if (explicit !== void 0) return explicit;
  return !prefersReducedMotion();
}
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
function createStableOrder(id) {
  const seen = /* @__PURE__ */ new Map();
  let next = 0;
  return {
    sort(items) {
      const live = /* @__PURE__ */ new Set();
      for (const it of items) {
        const key = id(it);
        live.add(key);
        if (!seen.has(key)) seen.set(key, next++);
      }
      if (seen.size > live.size) {
        for (const key of seen.keys()) if (!live.has(key)) seen.delete(key);
      }
      return items.slice().sort((a, b) => seen.get(id(a)) - seen.get(id(b)));
    },
    rank(item) {
      return seen.get(id(item)) ?? Number.MAX_SAFE_INTEGER;
    }
  };
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
        const style = getComputedStyle(node);
        if (SCROLLABLE.test(style.overflowY) || SCROLLABLE.test(style.overflowX)) {
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

// src/boardMath.ts
function slotAt(g, k) {
  if (!g) return null;
  return {
    left: g.left + k % g.cols * g.stepX,
    top: g.top + Math.floor(k / g.cols) * g.stepY
  };
}
var rowsFor = (count, cols) => Math.max(1, Math.ceil(count / Math.max(1, cols)));
function panelFlow(order, opts) {
  const { cols, colW, gap, origin } = opts;
  const step = colW + gap;
  const out = {};
  let used = 0;
  let top = 0;
  let rowH = 0;
  for (const p of order) {
    const w = Math.max(1, Math.min(cols, p.span));
    if (used + w > cols && used > 0) {
      top += rowH + gap;
      used = 0;
      rowH = 0;
    }
    out[p.id] = { left: origin.left + used * step, top: origin.top + top };
    used += w;
    rowH = Math.max(rowH, p.height);
  }
  return out;
}
function moveAt(list, from, to) {
  if (from === to || from < 0) return list;
  const next = list.slice();
  next.splice(Math.max(0, Math.min(next.length, to)), 0, next.splice(from, 1)[0]);
  return next;
}

// src/DumbBoard.tsx
var CSS = `
          .dumb-board { display: grid; align-items: start; gap: var(--dumb-board-gap);
                        grid-template-columns: repeat(var(--dumb-board-cols), 1fr) }
          .dumb-board-panel { position: relative; min-width: 0 }
          .dumb-board-panel.held { opacity: .35 }
          .dumb-board-head { display: flex; align-items: center; gap: 6px; margin: 0 0 8px;
                             font: inherit; font-size: 13px; cursor: grab; user-select: none }
          .dumb-board-head:active { cursor: grabbing }
          .dumb-board-grip { color: #cbd5e1 }
          .dumb-board-title { display: flex; align-items: baseline; gap: 6px; min-width: 0 }
          .dumb-board-sub { font-size: 11.5px; font-weight: 400; opacity: .65 }
          .dumb-board-count { padding: 1px 7px; border-radius: 999px; font-size: 11px;
                              background: rgb(0 0 0 / .06) }
          .dumb-board-actions { margin-left: auto; display: flex; gap: 4px }
          /* \u0441\u0435\u0442\u043A\u0430 \u0431\u043B\u043E\u043A\u043E\u0432: \u0441\u044E\u0434\u0430 \u0438 \u0441\u043C\u043E\u0442\u0440\u0438\u0442 order */
          .dumb-board-zone { display: grid; gap: 8px; align-content: start; min-height: 88px;
                             overflow-y: auto; scrollbar-gutter: stable;
                             grid-template-columns: repeat(var(--dumb-board-inner), 1fr) }
          /* \u0431\u043B\u043E\u043A \u041D\u0415 \u0440\u0430\u0441\u0442\u044F\u0433\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u043D\u0430 \u0432\u044B\u0441\u043E\u0442\u0443 \u0441\u0442\u0440\u043E\u043A\u0438: \u0438\u043D\u0430\u0447\u0435 \u0443 \u0432\u0441\u0435\u0445 \u0432 \u0441\u0442\u0440\u043E\u043A\u0435
             \u0437\u0430\u043C\u0435\u0440\u044F\u0435\u0442\u0441\u044F \u043E\u0434\u043D\u0430 \u0438 \u0442\u0430 \u0436\u0435 \u0432\u044B\u0441\u043E\u0442\u0430, \u0438 \u043F\u0435\u0440\u0435\u0435\u0445\u0430\u0432\u0448\u0438\u0439 \u0432 \u0434\u0440\u0443\u0433\u0443\u044E \u0441\u0442\u0440\u043E\u043A\u0443
             \u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044F \u043D\u0435 \u043F\u043E \u0441\u0432\u043E\u0435\u0439 */
          .dumb-board-block { align-self: start; min-width: 0 }
          .dumb-board-block.held { opacity: .35 }
          .dumb-board-grip-x { position: absolute; top: 26px; right: -9px; bottom: 12px; width: 12px;
                               cursor: col-resize; touch-action: none }
          .dumb-board-grip-y { position: absolute; left: 12px; right: 12px; bottom: -9px; height: 12px;
                               cursor: row-resize; touch-action: none }
          .dumb-board-grip-xy { position: absolute; right: -9px; bottom: -9px; width: 16px; height: 16px;
                                cursor: nwse-resize; touch-action: none }
        `;
function DumbBoard(props) {
  injectStyle("board", CSS);
  const cols = () => props.cols ?? 12;
  const gap = () => props.gap ?? 14;
  const rowH = () => props.rowHeight ?? 76;
  const minSpan = () => props.minSpan ?? 3;
  const editable = () => props.editable !== false;
  const resizable = () => props.resizable !== false;
  const spanOf = (s) => Math.max(1, Math.min(cols(), s.span ?? Math.floor(cols() / 2)));
  const colsIn = (s) => Math.max(1, s.cols ?? 3);
  const sectionById = (id) => props.sections.find((s) => s.id === id);
  const itemsOf = (id) => sectionById(id)?.items ?? [];
  const sectionOf = (blockId) => props.sections.find((s) => s.items.some((it) => props.id(it) === blockId));
  const spanOfBlock = (item, s) => {
    const want = Math.max(1, Math.round(props.blockSpan?.(item) ?? 1));
    const sec = s ?? sectionOf(props.id(item));
    return Math.min(want, sec ? colsIn(sec) : want);
  };
  const stableSections = createStableOrder((s) => s.id);
  const stableItems = createStableOrder(props.id);
  const renderOrder = () => stableSections.sort(props.sections).map((s) => s.id);
  const showOrder = (id) => props.sections.findIndex((s) => s.id === id);
  const ranked = createMemo(() => stableItems.sort(props.sections.flatMap((s) => s.items)));
  const renderItemsOf = (id) => {
    const own = new Set(itemsOf(id).map(props.id));
    return ranked().filter((it) => own.has(props.id(it)));
  };
  const places = createMemo(() => {
    const out = /* @__PURE__ */ new Map();
    for (const s of props.sections) s.items.forEach((it, k) => out.set(props.id(it), k));
    return out;
  });
  const placeOf = (item) => places().get(props.id(item)) ?? 0;
  const [held, setHeld] = createSignal(null);
  const [heldSection, setHeldSection] = createSignal(null);
  const [sizing, setSizing] = createSignal(null);
  const blockEls = /* @__PURE__ */ new Map();
  const zoneEls = /* @__PURE__ */ new Map();
  const panelEls = /* @__PURE__ */ new Map();
  let wrapEl;
  let geom = {};
  let blockH = {};
  let panelH = {};
  let wrapAt = { left: 0, top: 0 };
  let colW = 0;
  let flip = createFlip(true);
  createEffect(() => {
    flip = createFlip(shouldAnimate(props.animate));
  });
  const scroller = createAutoScroller();
  onCleanup(() => scroller.stop());
  function measure() {
    const targets = [...blockEls.values(), ...zoneEls.values(), ...panelEls.values(), wrapEl].filter(Boolean);
    if (!targets.length || typeof IntersectionObserver !== "function") return;
    const rects = /* @__PURE__ */ new Map();
    let batches = 0;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) rects.set(e.target, e.boundingClientRect);
      batches++;
      if (rects.size < targets.length && batches < 4) return;
      io.disconnect();
      const next = {};
      const nextH = {};
      for (const s of props.sections) {
        const n = colsIn(s);
        const own = itemsOf(s.id).map((it, k) => ({ k, id: props.id(it), span: spanOfBlock(it), r: rects.get(blockEls.get(props.id(it))) })).filter((x) => Boolean(x.r));
        const zoneRect = rects.get(zoneEls.get(s.id));
        for (const o of own) nextH[o.id] = o.r.height;
        if (!own.length) {
          if (zoneRect) next[s.id] = { left: zoneRect.left + 10, top: zoneRect.top + 10, colW: 96, gap: 8, cols: n };
          continue;
        }
        const a = own[0];
        let gap2 = 8;
        for (const o of own) {
          if (o.r.top === a.r.top && o.r.left > a.r.left) {
            gap2 = o.r.left - (a.r.left + a.r.width);
            break;
          }
        }
        const colW2 = (a.r.width - (a.span - 1) * gap2) / a.span;
        next[s.id] = { left: a.r.left, top: a.r.top, colW: colW2, gap: gap2, cols: n };
      }
      geom = next;
      blockH = nextH;
      for (const s of props.sections) {
        const r = rects.get(panelEls.get(s.id));
        if (r) panelH[s.id] = r.height;
      }
      const wr = rects.get(wrapEl);
      if (wr) wrapAt = { left: wr.left, top: wr.top };
    });
    for (const t of targets) io.observe(t);
  }
  function measureWhenStill() {
    const anims = [...blockEls.values(), ...panelEls.values()].filter(Boolean).flatMap((el) => el.getAnimations());
    if (!anims.length) {
      measure();
      return;
    }
    Promise.allSettled(anims.map((a) => a.finished)).then(() => measure());
  }
  onMount(() => {
    measure();
    if (typeof ResizeObserver !== "function") return;
    let firstCall = true;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        if (e.target !== wrapEl) continue;
        colW = (e.contentRect.width - gap() * (cols() - 1)) / cols();
      }
      if (firstCall) {
        firstCall = false;
        return;
      }
      measure();
    });
    ro.observe(wrapEl);
    onCleanup(() => ro.disconnect());
  });
  const blockPlaces = (sectionId) => {
    const g = geom[sectionId];
    if (!g) return {};
    const boxes = itemsOf(sectionId).map((it) => ({
      id: props.id(it),
      span: spanOfBlock(it),
      height: blockH[props.id(it)] ?? 0
    }));
    return panelFlow(boxes, { cols: g.cols, colW: g.colW, gap: g.gap, origin: { left: g.left, top: g.top } });
  };
  const snapshotPlaces = () => {
    const out = /* @__PURE__ */ new Map();
    for (const s of props.sections) {
      const pos = blockPlaces(s.id);
      for (const id of Object.keys(pos)) out.set(id, pos[id]);
    }
    return out;
  };
  const playBlocks = (was) => {
    for (const s of props.sections) {
      const now = blockPlaces(s.id);
      for (const id of Object.keys(now)) {
        const from = was.get(id);
        const to = now[id];
        if (!from || from.left === to.left && from.top === to.top) continue;
        const el = blockEls.get(id);
        if (el) flip.nudge(el, from.left - to.left, from.top - to.top);
      }
    }
  };
  function moveBlock(item, toSection, toIndex) {
    const bid = props.id(item);
    const was = snapshotPlaces();
    const next = props.sections.map((s) => {
      const has = s.items.some((it) => props.id(it) === bid);
      if (!has && s.id !== toSection) return s;
      const rest = s.items.filter((it) => props.id(it) !== bid);
      if (s.id !== toSection) return { ...s, items: rest };
      const k = Math.max(0, Math.min(rest.length, toIndex));
      return { ...s, items: [...rest.slice(0, k), item, ...rest.slice(k)] };
    });
    props.setSections(next);
    props.onMove?.(item, toSection, toIndex);
    playBlocks(was);
  }
  const panelBoxes = (order) => order.map((s) => ({ id: s.id, span: spanOf(s), height: panelH[s.id] ?? 0 }));
  const flowOpts = () => ({ cols: cols(), colW, gap: gap(), origin: wrapAt });
  const playSections = (order, apply) => {
    const was = panelFlow(panelBoxes(props.sections), flowOpts());
    apply();
    const now = panelFlow(panelBoxes(order), flowOpts());
    for (const s of order) {
      const a = was[s.id];
      const b = now[s.id];
      const el = panelEls.get(s.id);
      if (!a || !b || !el || a.left === b.left && a.top === b.top) continue;
      flip.nudge(el, a.left - b.left, a.top - b.top);
    }
  };
  function moveSection(id, toIndex) {
    const from = props.sections.findIndex((s) => s.id === id);
    if (from < 0 || from === toIndex) return;
    const order = moveAt(props.sections, from, toIndex);
    playSections(order, () => {
      props.setSections(order);
      props.onSectionMove?.(from, toIndex);
    });
  }
  const wasSpan = {};
  function toggleWide(s) {
    const full = spanOf(s) >= cols();
    if (!full) wasSpan[s.id] = spanOf(s);
    const span = full ? wasSpan[s.id] ?? Math.floor(cols() / 2) : cols();
    const order = props.sections.map((x) => x.id === s.id ? { ...x, span } : x);
    playSections(order, () => {
      props.setSections(order);
      props.onSectionResize?.(s.id, { span, rows: s.rows ?? 0 });
    });
    measureWhenStill();
  }
  let sizingFrom = null;
  const onGripDown = (ev) => {
    const grip = ev.target?.closest?.("[data-board-resize]");
    if (!grip || !editable() || !resizable()) return;
    const s = sectionById(grip.dataset.boardResize);
    if (!s) return;
    ev.preventDefault();
    grip.setPointerCapture(ev.pointerId);
    sizingFrom = {
      id: s.id,
      axis: grip.dataset.axis ?? "x",
      x: ev.clientX,
      y: ev.clientY,
      span: spanOf(s),
      // высота «по содержимому» — берём фактическую, чтобы тянуть с того же места
      rows: s.rows || rowsFor(itemsOf(s.id).length, colsIn(s))
    };
    setSizing(s.id);
  };
  const onGripMove = (ev) => {
    const d = sizingFrom;
    if (!d || !colW) return;
    const s = sectionById(d.id);
    if (!s) return;
    let span = spanOf(s);
    let rows = s.rows ?? d.rows;
    if (d.axis !== "y") span = Math.max(minSpan(), Math.min(cols(), d.span + Math.round((ev.clientX - d.x) / colW)));
    if (d.axis !== "x") rows = Math.max(1, d.rows + Math.round((ev.clientY - d.y) / rowH()));
    if (span === spanOf(s) && rows === (s.rows ?? d.rows)) return;
    props.setSections(props.sections.map((x) => x.id === d.id ? { ...x, span, rows } : x));
    props.onSectionResize?.(d.id, { span, rows });
  };
  const onGripUp = () => {
    if (!sizingFrom) return;
    sizingFrom = null;
    setSizing(null);
    measureWhenStill();
  };
  const closestOf = (ev, sel) => ev.target?.closest?.(sel);
  let pressed = null;
  let gesture = null;
  let lastX = -1;
  let lastY = -1;
  const onDragStart = (ev) => {
    if (!editable()) {
      ev.preventDefault();
      return;
    }
    setHeld(null);
    setHeldSection(null);
    const panel = closestOf(ev, "[data-board-section]");
    const block = closestOf(ev, "[data-board-block]");
    if (panel && !block && pressed?.closest?.("[data-board-handle]")) {
      const id2 = panel.dataset.boardSection;
      ev.dataTransfer?.setData("text/plain", id2);
      if (ev.dataTransfer) ev.dataTransfer.effectAllowed = "move";
      lastX = ev.clientX;
      lastY = ev.clientY;
      gesture = id2;
      scroller.start(panel);
      setTimeout(() => {
        if (gesture === id2) setHeldSection(id2);
      });
      return;
    }
    const id = block?.dataset.boardBlock;
    if (!id) {
      ev.preventDefault();
      return;
    }
    ev.dataTransfer?.setData("text/plain", id);
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = "move";
    lastX = ev.clientX;
    lastY = ev.clientY;
    gesture = id;
    scroller.start(block);
    setTimeout(() => {
      if (gesture === id) setHeld(id);
    });
  };
  const onDragOver = (ev) => {
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
    scroller.move(ev.clientX, ev.clientY);
    if (ev.clientX === lastX && ev.clientY === lastY) return;
    lastX = ev.clientX;
    lastY = ev.clientY;
    const movingSection = heldSection();
    if (movingSection) {
      const overId = closestOf(ev, "[data-board-section]")?.dataset.boardSection;
      if (!overId || overId === movingSection) return;
      if (panelEls.get(overId)?.getAnimations().length) return;
      moveSection(movingSection, props.sections.findIndex((s) => s.id === overId));
      return;
    }
    const id = held();
    if (!id) return;
    const home = sectionOf(id);
    const item = home?.items.find((x) => props.id(x) === id);
    if (!item || !home) return;
    const zoneId = closestOf(ev, "[data-board-zone]")?.dataset.boardZone;
    const zone = zoneId ? sectionById(zoneId) : null;
    if (!zone) return;
    const from = home.id;
    if (zone.accepts && from !== zone.id && !zone.accepts(from)) return;
    const over = closestOf(ev, "[data-board-block]")?.dataset.boardBlock;
    if (over) {
      if (over === id) return;
      if (blockEls.get(over)?.getAnimations().length) return;
      const target = zone.items.find((x) => props.id(x) === over);
      if (!target) return;
      const k = placeOf(target);
      if (from === zone.id && placeOf(item) === k) return;
      moveBlock(item, zone.id, k);
      return;
    }
    if (from === zone.id) return;
    moveBlock(item, zone.id, itemsOf(zone.id).length);
  };
  const finish = () => {
    gesture = null;
    if (!held() && !heldSection()) return;
    setHeld(null);
    setHeldSection(null);
    scroller.stop();
    measureWhenStill();
  };
  return <div
    class={props.class}
    style={props.style}
    onPointerDown={(ev) => {
      pressed = ev.target;
      onGripDown(ev);
    }}
    onPointerMove={onGripMove}
    onPointerUp={onGripUp}
    onPointerCancel={onGripUp}
    onDragStart={onDragStart}
    onDragOver={onDragOver}
    onDragEnd={finish}
    onDrop={(ev) => {
      ev.preventDefault();
      finish();
    }}
  >
      <div
    class="dumb-board"
    ref={(el) => {
      wrapEl = el;
    }}
    style={{ "--dumb-board-cols": String(cols()), "--dumb-board-gap": `${gap()}px` }}
  >
        <For each={renderOrder()}>
          {(sid) => {
    const s = () => sectionById(sid);
    return <section
      class="dumb-board-panel"
      classList={{ held: heldSection() === sid, sizing: sizing() === sid }}
      data-board-section={sid}
      draggable={editable()}
      ref={(el) => panelEls.set(sid, el)}
      style={{ "grid-column": `span ${spanOf(s())}`, order: String(showOrder(sid)) }}
    >
              <Show when={s().title}>
                <h4
      class="dumb-board-head"
      data-board-handle
      onDblClick={() => editable() && toggleWide(s())}
    >
                  <Show when={editable()}><span class="dumb-board-grip">⠿</span></Show>
                  <span class="dumb-board-title">
                    {s().title}
                    <Show when={s().subtitle}><span class="dumb-board-sub">{s().subtitle}</span></Show>
                  </span>
                  <span class="dumb-board-count">{itemsOf(sid).length}</span>
                  <Show when={props.sectionActions}>
                    <span class="dumb-board-actions">{props.sectionActions(s())}</span>
                  </Show>
                </h4>
              </Show>

              <div
      class="dumb-board-zone"
      data-board-zone={sid}
      ref={(el) => zoneEls.set(sid, el)}
      style={{
        "--dumb-board-inner": String(colsIn(s())),
        ...s().rows ? { height: `${s().rows * rowH() + 12}px` } : {}
      }}
    >
                {
      /* Итерируем сами элементы, а не их id: иначе содержимое пришлось
         бы искать в массиве прямо в разметке, и оно зависело бы от
         всего массива — любая правка пересоздавала бы ВСЕ блоки. */
    }
                <For each={renderItemsOf(sid)}>
                  {(item) => <div
      class="dumb-board-block"
      classList={{ held: held() === props.id(item) }}
      data-board-block={props.id(item)}
      draggable={editable()}
      ref={(el) => blockEls.set(props.id(item), el)}
      style={{
        order: String(placeOf(item)),
        ...spanOfBlock(item, s()) > 1 ? { "grid-column": `span ${spanOfBlock(item, s())}` } : {}
      }}
    >
                      {props.children(item, s())}
                    </div>}
                </For>
              </div>

              <Show when={editable() && resizable()}>
                <div class="dumb-board-grip-x" data-board-resize={sid} data-axis="x" />
                <div class="dumb-board-grip-y" data-board-resize={sid} data-axis="y" />
                <div class="dumb-board-grip-xy" data-board-resize={sid} data-axis="xy" />
              </Show>
            </section>;
  }}
        </For>
      </div>

    </div>;
}
export {
  DumbBoard,
  moveAt,
  panelFlow,
  rowsFor,
  slotAt
};
