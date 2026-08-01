// src/DumbSortableDnd.tsx
import { For } from "solid-js";

// src/solid.ts
import { createSignal, onCleanup } from "solid-js";

// ../shared/dist/index.js
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
  let drag = null;
  let pressed = null;
  let lastX = -1;
  let lastY = -1;
  const remember = (ev) => {
    pressed = ev.target;
  };
  if (typeof document !== "undefined") {
    document.addEventListener("pointerdown", remember, { capture: true, passive: true });
  }
  const scroller = createAutoScroller();
  let flip = null;
  function measure(d) {
    const targets = [];
    for (const id of d.ids) {
      const el = els.get(id);
      if (el) targets.push(el);
    }
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
      if (drag !== d) return;
      const list = d.ids.map((id) => rects.get(id));
      d.slots = list.map((r) => r ? { left: r.left, top: r.top } : { left: 0, top: 0 });
      let gap = 0;
      for (let i = 1; i < list.length; i++) {
        const a = list[i - 1];
        const b = list[i];
        if (!a || !b || b.top <= a.top) continue;
        gap = Math.max(0, b.top - (a.top + a.height));
        break;
      }
      d.steps = list.map((r) => r ? r.height + gap : 0);
      d.ready = true;
      if (d.k !== d.from) place(d);
    });
    for (const t of targets) io.observe(t);
  }
  const idAt = (d, i) => d.ids[i < d.from ? i : i + 1];
  const slotAt = (i, k) => i < k ? i : i + 1;
  function shiftOf(d, i) {
    const was = slotAt(i, d.from);
    const now = slotAt(i, d.k);
    if (was === now) return { dx: 0, dy: 0 };
    if (d.grid) {
      const a = d.slots[was];
      const b = d.slots[now];
      return a && b ? { dx: b.left - a.left, dy: b.top - a.top } : { dx: 0, dy: 0 };
    }
    return { dx: 0, dy: (now - was) * (d.steps[d.from] ?? 0) };
  }
  function shiftOfDrag(d) {
    if (d.grid) {
      const a = d.slots[d.from];
      const b = d.slots[d.k];
      return a && b ? { dx: b.left - a.left, dy: b.top - a.top } : { dx: 0, dy: 0 };
    }
    let dy = 0;
    if (d.k > d.from) for (let i = d.from; i < d.k; i++) dy += d.steps[i + 1] ?? 0;
    else for (let i = d.k; i < d.from; i++) dy -= d.steps[i] ?? 0;
    return { dx: 0, dy };
  }
  function place(d) {
    if (!d.ready) return;
    const lo = Math.min(d.from, d.k);
    const hi = Math.max(d.from, d.k);
    const next = /* @__PURE__ */ new Set();
    const self = shiftOfDrag(d);
    flip?.to(d.el, self.dx, self.dy);
    for (let i = lo; i < hi; i++) {
      const id = idAt(d, i);
      const el = els.get(id);
      if (!el) continue;
      const { dx, dy } = shiftOf(d, i);
      if (!dx && !dy) continue;
      flip?.to(el, dx, dy);
      next.add(id);
    }
    for (const id of d.moved) {
      if (next.has(id)) continue;
      const el = els.get(id);
      if (el) flip?.to(el, 0, 0);
    }
    d.moved = next;
  }
  function hover(id) {
    const d = drag;
    if (!d || !id) return;
    {
      if (id === d.id) return;
      const idx = d.ids.indexOf(id);
      if (idx < 0) return;
      if (els.get(id)?.getAnimations().length) return;
      const rest = idx < d.from ? idx : idx - 1;
      const to = rest >= d.k ? rest + 1 : rest;
      if (to === d.k) return;
      d.k = to;
      place(d);
      return;
    }
  }
  function endDrag(commit) {
    if (!drag) return;
    const el = drag.el;
    drag = null;
    scroller.stop();
    opts.onActive?.(null);
    if (!commit) {
      flip?.clear();
      flip = null;
      el.style.opacity = "";
      return;
    }
    commit();
    requestAnimationFrame(() => {
      flip?.clear();
      flip = null;
      el.style.opacity = "";
    });
  }
  const idOf = (ev) => {
    const el = ev.target?.closest?.("[data-sort-dnd-id]");
    return el?.dataset.sortDndId ?? null;
  };
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
    const ids = opts.order();
    const from = ids.indexOf(id);
    if (from < 0) {
      ev.preventDefault();
      return;
    }
    ev.dataTransfer?.setData("text/plain", id);
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = "move";
    drag = {
      id,
      el,
      ids,
      from,
      k: from,
      steps: [],
      slots: [],
      moved: /* @__PURE__ */ new Set(),
      grid: opts.axis?.() === "grid",
      ready: false
    };
    lastX = ev.clientX;
    lastY = ev.clientY;
    opts.onActive?.(id);
    el.style.opacity = "0.35";
    flip = createFlip(shouldAnimate(opts.animate));
    scroller.start(container ?? el);
    measure(drag);
  };
  const onDragOver = (ev) => {
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
    if (!drag) return;
    scroller.move(ev.clientX, ev.clientY);
    if (ev.clientX === lastX && ev.clientY === lastY) return;
    lastX = ev.clientX;
    lastY = ev.clientY;
    hover(idOf(ev));
  };
  const onFinish = (ev) => {
    const d = drag;
    if (!d) return;
    if (ev.type === "drop") ev.preventDefault();
    const inside = ev.type === "drop";
    const { from, k } = d;
    endDrag(inside && k !== from ? () => opts.onEnd?.(from, k) : void 0);
  };
  return {
    attachContainer(el) {
      el.addEventListener("dragstart", onDragStart);
      el.addEventListener("dragover", onDragOver);
      el.addEventListener("drop", onFinish);
      el.addEventListener("dragend", onFinish);
      container = el;
      return () => {
        el.removeEventListener("dragstart", onDragStart);
        el.removeEventListener("dragover", onDragOver);
        el.removeEventListener("drop", onFinish);
        el.removeEventListener("dragend", onFinish);
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
    active: () => drag?.id ?? null,
    destroy() {
      endDrag();
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
function DumbSortableDnd(props) {
  const s = createDumbSortableDnd({
    order: () => props.items.map(props.id),
    axis: () => props.axis ?? "y",
    disabled: () => props.disabled === true,
    animate: props.animate,
    onEnd: (from, to) => {
      const next = props.items.slice();
      next.splice(to, 0, next.splice(from, 1)[0]);
      props.setItems(next);
    }
  });
  return <div ref={s.container} class={props.class} style={props.style}>
      <For each={props.items}>
        {(item, i) => {
    const el = props.children(item, i);
    if (el instanceof HTMLElement) s.bind(props.id(item))(el);
    return el;
  }}
      </For>
    </div>;
}
export {
  DumbSortableDnd,
  createDumbSortableDnd,
  createSortDndEngine
};
