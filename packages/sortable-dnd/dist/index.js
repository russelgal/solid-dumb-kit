import { use, insert, createComponent, effect, className, style, template } from 'solid-js/web';
import { createSignal, onCleanup, createMemo, createEffect, For } from 'solid-js';

// src/DumbSortableDnd.tsx

// ../shared/dist/index.js
function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function shouldAnimate(explicit) {
  if (explicit !== void 0) return explicit;
  return !prefersReducedMotion();
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

// src/sortDndCore.ts
function createSortDndEngine(opts) {
  const els = /* @__PURE__ */ new Map();
  let container = null;
  let flip = null;
  const scroller = createAutoScroller();
  const SETTLE_MS = 24;
  let dragId = null;
  let stopRo = null;
  let startIndex = -1;
  let escaped = false;
  let sizes = /* @__PURE__ */ new Map();
  let origin = { left: 0, top: 0 };
  let grid = null;
  const isGrid = () => opts.axis?.() === "grid";
  const indexOf = (id) => opts.order().indexOf(id);
  function slotAt(order, k) {
    if (grid) {
      return {
        left: origin.left + k % grid.cols * grid.stepX,
        top: origin.top + Math.floor(k / grid.cols) * grid.stepY
      };
    }
    let top = origin.top;
    for (let i = 0; i < k && i < order.length; i++) top += sizes.get(order[i]) ?? 0;
    return { left: origin.left, top };
  }
  let measured = false;
  function measure() {
    const ids = opts.order();
    const targets = ids.map((id) => els.get(id)).filter(Boolean);
    if (!targets.length || typeof IntersectionObserver !== "function") return;
    const rects = /* @__PURE__ */ new Map();
    let batches = 0;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const id = e.target.dataset.sortDndId;
        if (id) rects.set(id, e.boundingClientRect);
      }
      batches++;
      if (rects.size < targets.length && batches < 4) return;
      io.disconnect();
      const list = ids.map((id) => rects.get(id));
      const first = list.find(Boolean);
      if (!first) return;
      origin = { left: first.left, top: first.top };
      let gap = 0;
      for (let i = 1; i < list.length; i++) {
        const a = list[i - 1];
        const b = list[i];
        if (!a || !b || b.top <= a.top) continue;
        gap = Math.max(0, b.top - (a.top + a.height));
        break;
      }
      if (isGrid()) {
        let stepX = first.width + gap;
        let stepY = first.height + gap;
        let cols = 1;
        for (let i = 1; i < list.length; i++) {
          const r = list[i];
          if (!r) continue;
          if (r.top > first.top + 1) {
            stepY = r.top - first.top;
            cols = i;
            break;
          }
          stepX = (r.left - first.left) / i;
        }
        grid = { stepX, stepY, cols: Math.max(1, cols) };
      } else {
        grid = null;
        sizes = new Map(ids.map((id, i) => [id, (list[i]?.height ?? 0) + gap]));
      }
      measured = true;
    });
    for (const t of targets) io.observe(t);
  }
  function commit(from, to) {
    const was = opts.order();
    const next = was.slice();
    next.splice(to, 0, next.splice(from, 1)[0]);
    const back = [];
    for (let i = 0; i < was.length; i++) {
      const id = was[i];
      const a = slotAt(was, i);
      const b = slotAt(next, next.indexOf(id));
      if (a.left === b.left && a.top === b.top) continue;
      back.push({ id, dx: a.left - b.left, dy: a.top - b.top });
    }
    opts.onMove?.(from, to);
    for (const m of back) {
      const el = els.get(m.id);
      if (el) flip?.nudge(el, m.dx, m.dy);
    }
  }
  const idOf = (ev) => {
    const el = ev.target?.closest?.("[data-sort-dnd-id]");
    return el?.dataset.sortDndId ?? null;
  };
  let pressed = null;
  const remember = (ev) => {
    pressed = ev.target;
  };
  if (typeof document !== "undefined") {
    document.addEventListener("pointerdown", remember, { capture: true, passive: true });
  }
  const onKey = (ev) => {
    if (ev.key === "Escape") escaped = true;
  };
  let lastX = -1;
  let lastY = -1;
  const onDragStart = (ev) => {
    if (opts.disabled?.()) {
      ev.preventDefault();
      return;
    }
    const el = ev.target?.closest?.("[data-sort-dnd-id]");
    const id = el?.dataset.sortDndId;
    if (!id) return;
    const handle = el.querySelector("[data-drag-handle]");
    if (handle && !(pressed && handle.contains(pressed))) {
      ev.preventDefault();
      return;
    }
    const from = indexOf(id);
    if (from < 0) {
      ev.preventDefault();
      return;
    }
    ev.dataTransfer?.setData("text/plain", id);
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = "move";
    dragId = id;
    startIndex = from;
    escaped = false;
    lastX = ev.clientX;
    lastY = ev.clientY;
    flip = createFlip(shouldAnimate(opts.animate));
    opts.onActive?.(id);
    el.style.opacity = "0.35";
    scroller.start(container ?? el);
    if (!measured) measure();
  };
  const onDragOver = (ev) => {
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
    const id = dragId;
    if (!id) return;
    scroller.move(ev.clientX, ev.clientY);
    if (ev.clientX === lastX && ev.clientY === lastY) return;
    lastX = ev.clientX;
    lastY = ev.clientY;
    const over = idOf(ev);
    if (!over || over === id) return;
    if (els.get(over)?.getAnimations().length) return;
    const order = opts.order();
    const cur = order.indexOf(id);
    const t = order.indexOf(over);
    if (cur < 0 || t < 0 || cur === t) return;
    commit(cur, t);
  };
  const finish = () => {
    const id = dragId;
    if (!id) return;
    dragId = null;
    scroller.stop();
    opts.onActive?.(null);
    const el = els.get(id);
    setTimeout(() => {
      const cur = indexOf(id);
      if (escaped && cur >= 0 && cur !== startIndex) commit(cur, startIndex);
      else if (cur >= 0 && cur !== startIndex) opts.onEnd?.(startIndex, cur);
      requestAnimationFrame(() => {
        flip?.clear();
        flip = null;
        if (el) el.style.opacity = "";
      });
    }, SETTLE_MS);
  };
  const onDrop = (ev) => {
    ev.preventDefault();
    finish();
  };
  return {
    attachContainer(el) {
      if (typeof ResizeObserver === "function") {
        const ro = new ResizeObserver(() => {
          measured = false;
          measure();
        });
        ro.observe(el);
        stopRo = () => ro.disconnect();
      }
      el.addEventListener("dragstart", onDragStart);
      el.addEventListener("dragover", onDragOver);
      el.addEventListener("drop", onDrop);
      el.addEventListener("dragend", finish);
      document.addEventListener("keyup", onKey);
      container = el;
      return () => {
        el.removeEventListener("dragstart", onDragStart);
        el.removeEventListener("dragover", onDragOver);
        el.removeEventListener("drop", onDrop);
        el.removeEventListener("dragend", finish);
        document.removeEventListener("keyup", onKey);
        stopRo?.();
        stopRo = null;
        if (container === el) container = null;
      };
    },
    attach(el, id) {
      els.set(id, el);
      el.dataset.sortDndId = id;
      el.setAttribute("draggable", "true");
      return () => {
        el.removeAttribute("draggable");
        delete el.dataset.sortDndId;
        if (els.get(id) === el) els.delete(id);
      };
    },
    active: () => dragId,
    destroy() {
      finish();
      if (typeof document !== "undefined") {
        document.removeEventListener("pointerdown", remember, true);
      }
      els.clear();
    }
  };
}

// src/solid.ts
function createDumbSortableDnd(opts) {
  const [active, setActive] = createSignal(null);
  const engine = createSortDndEngine({
    ...opts,
    onActive: (id) => {
      setActive(id);
      opts.onActive?.(id);
    }
  });
  onCleanup(engine.destroy);
  return {
    container: (el) => onCleanup(engine.attachContainer(el)),
    bind: (id) => (el) => onCleanup(engine.attach(el, id)),
    active
  };
}

// src/DumbSortableDnd.tsx
var _tmpl$ = /* @__PURE__ */ template(`<div>`);
function DumbSortableDnd(props) {
  const s = createDumbSortableDnd({
    order: () => props.items.map(props.id),
    axis: () => props.axis ?? "y",
    disabled: () => props.disabled === true,
    animate: props.animate,
    onMove: (from, to) => {
      const next = props.items.slice();
      next.splice(to, 0, next.splice(from, 1)[0]);
      props.setItems(next);
    },
    onEnd: (from, to) => props.onEnd?.(from, to)
  });
  const els = /* @__PURE__ */ new Map();
  const stable = createStableOrder(props.id);
  const rendered = createMemo(() => stable.sort(props.items));
  const places = createMemo(() => new Map(props.items.map((it, i) => [props.id(it), i])));
  createEffect(() => {
    for (const [id, i] of places()) {
      const el = els.get(id);
      if (!el) continue;
      const next = String(i);
      if (el.style.order !== next) el.style.order = next;
    }
  });
  return (() => {
    var _el$ = _tmpl$();
    var _ref$ = s.container;
    typeof _ref$ === "function" ? use(_ref$, _el$) : s.container = _el$;
    insert(_el$, createComponent(For, {
      get each() {
        return rendered();
      },
      children: (item) => {
        const id = props.id(item);
        const el = props.children(item, () => places().get(id) ?? 0);
        if (el instanceof HTMLElement) {
          els.set(id, el);
          el.style.order = String(places().get(id) ?? 0);
          s.bind(id)(el);
        }
        return el;
      }
    }));
    effect((_p$) => {
      var _v$ = props.class, _v$2 = props.style;
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

export { DumbSortableDnd, createDumbSortableDnd, createSortDndEngine };
