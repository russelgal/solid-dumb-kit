import * as solid from 'solid-js';
import { createEffect, untrack } from 'solid-js';

// src/motion.ts
function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function shouldAnimate(explicit) {
  if (explicit !== void 0) return explicit;
  return !prefersReducedMotion();
}
var batch2 = solid.batch ?? ((fn) => fn());
function onMounted(fn) {
  createEffect(() => untrack(fn));
}
function watch(dep, fn, opts) {
  let first = true;
  let prev;
  createEffect(() => {
    const value = dep();
    const skip = first && (opts?.defer ?? false);
    first = false;
    const before = prev;
    prev = value;
    if (!skip) untrack(() => fn(value, before));
  });
}

// src/injectStyle.ts
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

// src/stableOrder.ts
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

// src/flip.ts
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

// src/viewport.ts
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

// src/autoScroll.ts
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

// src/textSelection.ts
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

// src/gesture.ts
var NO_DRAG = 'input, textarea, select, option, button, a, label, [contenteditable=""], [contenteditable="true"], [data-no-drag]';
function targetIsInteractive(ev) {
  return ev.target instanceof Element && !!ev.target.closest(NO_DRAG);
}
function focusInside(el) {
  const active = document.activeElement;
  return !!active && active !== document.body && active !== el && el.contains(active);
}
var LONGPRESS = 350;
var MOVE_TOL = 10;
function createPressGate(opts = {}) {
  const pressDelay = opts.pressDelay ?? LONGPRESS;
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
        wait = { pid: ev.pointerId, x: ev.clientX, y: ev.clientY, timer: 0, mode: "press", thresh: MOVE_TOL, start };
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
        if (running.get(id) === ctrl) events.onProgress?.(id, clamp(f));
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
var clamp = (f) => f < 0 ? 0 : f > 1 ? 1 : f;
function message(err) {
  if (err instanceof Error) return err.message;
  return String(err);
}

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

// src/virtual.ts
function createVirtualizer(opts) {
  const overscan = opts.overscan ?? 3;
  let viewH = 0;
  let raf = 0;
  let last = null;
  let dead = false;
  const el = () => opts.scroller();
  function compute() {
    const size = Math.max(1, opts.itemSize());
    const cols = Math.max(1, opts.columns?.() ?? 1);
    const count = Math.max(0, opts.count());
    const rows = Math.ceil(count / cols);
    const node2 = el();
    const scrolled = node2 ? node2.scrollTop : 0;
    const firstRow = Math.max(0, Math.floor(scrolled / size) - overscan);
    const visibleRows = Math.ceil(viewH / size) + overscan * 2;
    const lastRow = Math.min(rows, firstRow + visibleRows);
    return {
      start: firstRow * cols,
      end: Math.min(count, lastRow * cols),
      offset: firstRow * size,
      total: rows * size
    };
  }
  function emit() {
    if (dead) return;
    const next = compute();
    if (last && last.start === next.start && last.end === next.end && last.total === next.total) {
      return;
    }
    last = next;
    opts.onChange(next);
  }
  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      emit();
    });
  }
  const ro = new ResizeObserver((entries) => {
    for (const e of entries) viewH = e.contentRect.height;
    emit();
  });
  const node = el();
  if (node) {
    viewH = node.clientHeight;
    node.addEventListener("scroll", onScroll, { passive: true });
    ro.observe(node);
  }
  emit();
  return {
    refresh: () => {
      last = null;
      emit();
    },
    destroy: () => {
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      el()?.removeEventListener("scroll", onScroll);
    }
  };
}
function scrollOffsetFor(args) {
  const cols = Math.max(1, args.columns ?? 1);
  const row = Math.floor(args.index / cols);
  const top = row * args.itemSize;
  const bottom = top + args.itemSize;
  if (args.force) return Math.max(0, top);
  if (top >= args.scrollTop && bottom <= args.scrollTop + args.viewHeight) return null;
  if (top < args.scrollTop) return top;
  return bottom - args.viewHeight;
}

// src/dropEntries.ts
function readDropEntries(dt) {
  if (!dt) return Promise.resolve([]);
  const entries = [];
  const plain = [];
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind !== "file") continue;
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
    else {
      const f = item.getAsFile();
      if (f) plain.push(f);
    }
  }
  if (!entries.length) {
    const files = plain.length ? plain : Array.from(dt.files ?? []);
    return Promise.resolve(files.map((file) => ({ file, path: file.name })));
  }
  return Promise.all(entries.map((e) => walk(e, ""))).then((lists) => lists.flat());
}
async function walk(entry, prefix) {
  if (entry.isFile) {
    const file = await new Promise(
      (ok) => entry.file ? entry.file(ok, () => ok(null)) : ok(null)
    );
    return file ? [{ file, path: `${prefix}${file.name}` }] : [];
  }
  if (!entry.isDirectory || !entry.createReader) return [];
  const reader = entry.createReader();
  const kids = [];
  for (; ; ) {
    const part = await new Promise(
      (ok) => reader.readEntries(ok, () => ok([]))
    );
    if (!part.length) break;
    kids.push(...part);
  }
  const inner = `${prefix}${entry.name}/`;
  const lists = await Promise.all(kids.map((k) => walk(k, inner)));
  return lists.flat();
}
function hasDirectories(dt) {
  if (!dt) return false;
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind !== "file") continue;
    if (item.webkitGetAsEntry?.()?.isDirectory) return true;
  }
  return false;
}

// src/undo.ts
function createUndoStack(opts = {}) {
  const limit = opts.limit ?? 50;
  let done2 = [];
  let undone = [];
  let busy = false;
  const changed = () => opts.onChange?.();
  return {
    push(step) {
      done2.push(step);
      if (done2.length > limit) done2 = done2.slice(-limit);
      undone = [];
      changed();
    },
    async undo() {
      if (busy) return;
      const step = done2[done2.length - 1];
      if (!step?.undo) return;
      busy = true;
      try {
        await step.undo();
        done2.pop();
        undone.push(step);
      } catch (err) {
        opts.onError?.(err, step);
      } finally {
        busy = false;
        changed();
      }
    },
    async redo() {
      if (busy) return;
      const step = undone[undone.length - 1];
      if (!step?.redo) return;
      busy = true;
      try {
        await step.redo();
        undone.pop();
        done2.push(step);
      } catch (err) {
        opts.onError?.(err, step);
      } finally {
        busy = false;
        changed();
      }
    },
    peekUndo: () => {
      const step = done2[done2.length - 1];
      return step?.undo ? step : null;
    },
    peekRedo: () => {
      const step = undone[undone.length - 1];
      return step?.redo ? step : null;
    },
    canUndo: () => !!done2[done2.length - 1]?.undo && !busy,
    canRedo: () => !!undone[undone.length - 1]?.redo && !busy,
    clear: () => {
      done2 = [];
      undone = [];
      changed();
    }
  };
}

// src/roving.ts
function moveIndex(key, args) {
  const { from, count } = args;
  if (count <= 0) return null;
  const cols = Math.max(1, args.columns ?? 1);
  const page = Math.max(1, args.page ?? 1) * cols;
  const cur = from < 0 ? key === "ArrowUp" || key === "End" ? count : -1 : from;
  const clamp2 = (i) => Math.max(0, Math.min(count - 1, i));
  switch (key) {
    case "ArrowRight":
      return clamp2(cur + 1);
    case "ArrowLeft":
      return clamp2(cur - 1);
    case "ArrowDown":
      return clamp2(cur + cols);
    case "ArrowUp":
      return clamp2(cur - cols);
    case "PageDown":
      return clamp2(cur + page);
    case "PageUp":
      return clamp2(cur - page);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
function moveSelection(args) {
  const { keys, next, current, shift, ctrl } = args;
  if (ctrl && !shift) return { selected: new Set(current), anchor: next };
  if (shift) {
    const from = args.anchor < 0 ? next : args.anchor;
    const [a, b] = from <= next ? [from, next] : [next, from];
    const selected = /* @__PURE__ */ new Set();
    for (let i = a; i <= b; i++) if (keys[i] !== void 0) selected.add(keys[i]);
    return { selected, anchor: from };
  }
  const one = keys[next];
  return { selected: one === void 0 ? /* @__PURE__ */ new Set() : /* @__PURE__ */ new Set([one]), anchor: next };
}
var isMoveKey = (key) => key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight" || key === "Home" || key === "End" || key === "PageUp" || key === "PageDown";

// src/inlineEdit.ts
function createInlineEdit(opts) {
  const clean = opts.clean ?? ((v) => v.trim());
  let id = null;
  let initial = "";
  let value = "";
  let busy = false;
  let error = null;
  const changed = () => opts.onChange?.();
  return {
    editing: () => id,
    value: () => value,
    busy: () => busy,
    error: () => error,
    start(next, text) {
      if (busy) return;
      id = next;
      initial = text;
      value = text;
      error = null;
      changed();
    },
    input(next) {
      value = next;
      changed();
    },
    async commit() {
      if (!id || busy) return false;
      const next = clean(value);
      if (!next || next === clean(initial)) {
        this.cancel();
        return false;
      }
      busy = true;
      error = null;
      changed();
      try {
        await opts.save(id, next);
        id = null;
        value = "";
        return true;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        return false;
      } finally {
        busy = false;
        changed();
      }
    },
    cancel() {
      if (busy) return;
      id = null;
      value = "";
      error = null;
      changed();
    }
  };
}

// src/multipart.ts
async function uploadMultipart(file, ctx, opts) {
  const partSize = opts.partSize ?? 8 * 1024 * 1024;
  const lanes = Math.max(1, opts.concurrency ?? 3);
  const total = Math.max(1, file.size);
  const count = Math.max(1, Math.ceil(file.size / partSize));
  const handshake = await opts.begin(file, ctx.prefix);
  const sent = new Array(count).fill(0);
  const done2 = [];
  const report = () => {
    let acc = 0;
    for (const n of sent) acc += n;
    ctx.onProgress(Math.min(1, acc / total));
  };
  let next = 0;
  let failed = null;
  async function lane() {
    for (; ; ) {
      if (failed || ctx.signal.aborted) return;
      const i = next++;
      if (i >= count) return;
      const from = i * partSize;
      const chunk = file.slice(from, Math.min(file.size, from + partSize));
      const partNumber = i + 1;
      try {
        const url = await opts.signPart(handshake, partNumber);
        const etag = await putPart(url, chunk, ctx.signal, (bytes) => {
          sent[i] = bytes;
          report();
        });
        sent[i] = chunk.size;
        report();
        done2.push({ partNumber, etag });
      } catch (err) {
        failed = err;
        return;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(lanes, count) }, lane));
  if (failed || ctx.signal.aborted) {
    await opts.abort(handshake).catch(() => {
    });
    throw failed ?? new Error("\u043E\u0442\u043C\u0435\u043D\u0435\u043D\u043E");
  }
  done2.sort((a, b) => a.partNumber - b.partNumber);
  await opts.complete(handshake, done2);
  ctx.onProgress(1);
  return { key: handshake.key };
}
function putPart(url, chunk, signal, onBytes) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error("\u043E\u0442\u043C\u0435\u043D\u0435\u043D\u043E"));
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    const onAbort = () => xhr.abort();
    signal.addEventListener("abort", onAbort, { once: true });
    const off = () => signal.removeEventListener("abort", onAbort);
    xhr.upload.onprogress = (ev) => ev.lengthComputable && onBytes(ev.loaded);
    xhr.onload = () => {
      off();
      if (xhr.status < 200 || xhr.status >= 300) {
        return reject(new Error(`\u043A\u0443\u0441\u043E\u043A \u043D\u0435 \u043F\u0440\u0438\u043D\u044F\u0442: ${xhr.status}`));
      }
      const etag = xhr.getResponseHeader("ETag");
      if (!etag) {
        return reject(
          new Error("\u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435 \u043D\u0435 \u043E\u0442\u0434\u0430\u043B\u043E ETag \u043A\u0443\u0441\u043A\u0430 \u2014 \u043F\u0440\u043E\u0432\u0435\u0440\u044C Access-Control-Expose-Headers")
        );
      }
      resolve(etag.replaceAll('"', ""));
    };
    xhr.onerror = () => {
      off();
      reject(new Error("\u0441\u0435\u0442\u044C \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430"));
    };
    xhr.onabort = () => {
      off();
      reject(new Error("\u043E\u0442\u043C\u0435\u043D\u0435\u043D\u043E"));
    };
    xhr.send(chunk);
  });
}
var shouldSplit = (file, partSize = 8 * 1024 * 1024) => file.size > partSize;

export { ACCEL, EDGE, LONGPRESS, MAX_SPEED, MOVE_TOL, NO_DRAG, autoScrollSpeed, batch2 as batch, createAutoScroller, createFlip, createInlineEdit, createPresignedUploader, createPressGate, createStableOrder, createUndoStack, createUploadQueue, createVirtualizer, doScroll, focusInside, hasDirectories, injectStyle, isMoveKey, measure, moveIndex, moveSelection, onMounted, prefersReducedMotion, putWithProgress, readDropEntries, restoreTextSelection, scrollOf, scrollOffsetFor, scrollParent, shouldAnimate, shouldSplit, suppressTextSelection, targetIsInteractive, uploadMultipart, viewOrigin, watch };
