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
var MAX_SCROLL_HEIGHT = 15e6;
function createVirtualizer(opts) {
  const overscan = opts.overscan ?? 3;
  const horizontal = opts.axis === "x";
  let viewH = 0;
  let raf = 0;
  let last = null;
  let dead = false;
  const el = () => opts.scroller();
  let sumsFor = null;
  let sums = null;
  function prefixOf(sizes) {
    if (sumsFor === sizes && sums && sums.length === sizes.length + 1) return sums;
    const next = new Float64Array(sizes.length + 1);
    for (let i = 0; i < sizes.length; i++) next[i + 1] = next[i] + Math.max(0, sizes[i]);
    sumsFor = sizes;
    sums = next;
    return next;
  }
  function compute() {
    const sizes = opts.itemSizes?.();
    const size = Math.max(1, opts.itemSize());
    const cols = sizes ? 1 : Math.max(1, opts.columns?.() ?? 1);
    const count = Math.max(0, opts.count());
    const rows = sizes ? Math.min(count, sizes.length) : Math.ceil(count / cols);
    const prefix = sizes ? prefixOf(sizes) : null;
    const node2 = el();
    const lead = opts.lead?.() ?? 0;
    const raw = node2 ? horizontal ? node2.scrollLeft : node2.scrollTop : 0;
    const scrolled = Math.max(0, raw - lead);
    const posOf = (row) => prefix ? prefix[Math.min(Math.max(0, row), rows)] : row * size;
    const rowAt = (pos) => {
      if (!prefix) return Math.floor(pos / size);
      let lo = 0;
      let hi = rows;
      while (lo < hi) {
        const mid = lo + hi + 1 >> 1;
        if (prefix[mid] <= pos) lo = mid;
        else hi = mid - 1;
      }
      return lo;
    };
    const real = posOf(rows);
    const total = Math.min(real, Math.max(viewH, opts.maxHeight ?? MAX_SCROLL_HEIGHT));
    const runwayReal = Math.max(0, real - viewH);
    const runwayFake = Math.max(0, total - viewH);
    const virtual = runwayFake > 0 ? scrolled * runwayReal / runwayFake : 0;
    const anchorRow = Math.min(Math.max(0, rows - 1), Math.max(0, rowAt(virtual)));
    const inRow = virtual - posOf(anchorRow);
    const firstRow = Math.max(0, anchorRow - overscan);
    const lastRow = Math.min(rows, rowAt(virtual + viewH) + 1 + overscan);
    return {
      start: firstRow * cols,
      end: Math.min(count, Math.max(firstRow, lastRow) * cols),
      // верх окна (`scrolled`) минус выехавшая часть якорного ряда минус
      // запасные ряды сверху; при незажатой распорке это ровно `posOf(firstRow)`
      offset: scrolled - inRow - (posOf(anchorRow) - posOf(firstRow)),
      total
    };
  }
  function emit() {
    if (dead) return;
    const next = compute();
    if (last && last.start === next.start && last.end === next.end && last.offset === next.offset && last.total === next.total) {
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
    for (const e of entries) viewH = horizontal ? e.contentRect.width : e.contentRect.height;
    emit();
  });
  const node = el();
  if (node) {
    viewH = horizontal ? node.clientWidth : node.clientHeight;
    node.addEventListener("scroll", onScroll, { passive: true });
    ro.observe(node);
  }
  emit();
  return {
    refresh: () => {
      last = null;
      sumsFor = null;
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
  const rows = args.count == null ? 0 : Math.ceil(Math.max(0, args.count) / cols);
  const real = rows * args.itemSize;
  const total = Math.min(real, Math.max(args.viewHeight, args.maxHeight ?? MAX_SCROLL_HEIGHT));
  const runwayReal = Math.max(0, real - args.viewHeight);
  const runwayFake = Math.max(0, total - args.viewHeight);
  const squeezed = runwayReal > runwayFake;
  const toScroll = (y) => squeezed ? Math.max(0, y) * runwayFake / runwayReal : Math.max(0, y);
  const view = squeezed ? args.scrollTop * runwayReal / runwayFake : args.scrollTop;
  if (args.force) return toScroll(top);
  if (top >= view && bottom <= view + args.viewHeight) return null;
  if (top < view) return toScroll(top);
  return toScroll(bottom - args.viewHeight);
}

// src/rowIndex.ts
function rowIndexKernel(port) {
  var count = 0;
  var cols = {};
  var live = null;
  var shOrder = null;
  var shCtrl = null;
  var chan = typeof MessageChannel === "function" ? new MessageChannel() : null;
  var queued = null;
  if (chan) {
    chan.port1.onmessage = function() {
      var fn = queued;
      queued = null;
      if (fn) fn();
    };
  }
  function soon(fn) {
    if (chan) {
      queued = fn;
      chan.port2.postMessage(0);
      return;
    }
    setTimeout(fn, 0);
  }
  function now() {
    return typeof performance === "object" && performance ? performance.now() : Date.now();
  }
  function valuesOf(name) {
    var c = name ? cols[name] : null;
    return c ? c.values : null;
  }
  function comparer(sort) {
    var vals = valuesOf(sort.column);
    if (!vals) return null;
    var sign = sort.dir === "desc" ? -1 : 1;
    return function(a, b) {
      var x = vals[a];
      var y = vals[b];
      if (x < y) return -sign;
      if (x > y) return sign;
      return a - b;
    };
  }
  function matcher(filter) {
    var col = filter.column ? cols[filter.column] : null;
    if (!col) return null;
    var vals = col.values;
    var text = col.kind === "text";
    var needle = filter.contains == null ? "" : String(filter.contains).toLowerCase();
    var min = filter.min;
    var max = filter.max;
    if (!needle && min == null && max == null) return null;
    return function(i) {
      var v = vals[i];
      if (min != null && !(v >= min)) return false;
      if (max != null && !(v <= max)) return false;
      if (!needle) return true;
      var s = text ? v : "" + v;
      return s.toLowerCase().indexOf(needle) !== -1;
    };
  }
  function merge(src, dst, lo, mid, hi, cmp) {
    var a = lo;
    var b = mid;
    var k = lo;
    while (a < mid && b < hi) {
      var x = src[a];
      var y = src[b];
      if (cmp(x, y) <= 0) {
        dst[k++] = x;
        a++;
      } else {
        dst[k++] = y;
        b++;
      }
    }
    while (a < mid) dst[k++] = src[a++];
    while (b < hi) dst[k++] = src[b++];
  }
  function run(msg) {
    var job = { dead: false };
    live = job;
    var id = msg.id;
    var budget = msg.chunk > 0 ? msg.chunk : 1e5;
    var started = now();
    var reported = started;
    function publish(len, phase) {
      if (!shCtrl) return;
      Atomics.store(shCtrl, 1, len);
      Atomics.store(shCtrl, 2, phase);
      Atomics.store(shCtrl, 3, id);
      Atomics.add(shCtrl, 0, 1);
    }
    function tell(phase, done2, len) {
      var t = now();
      if (t - reported < 60) return;
      reported = t;
      publish(len, phase === "filter" ? 0 : 1);
      port.post({ type: "progress", id, phase, done: done2, matched: len });
    }
    var keep = msg.filter ? matcher(msg.filter) : null;
    var cmp = msg.sort ? comparer(msg.sort) : null;
    var picked = shOrder ? shOrder : new Uint32Array(count);
    var m = 0;
    var i = 0;
    function filterStep() {
      if (job.dead) return;
      var edge = i + budget;
      if (edge > count) edge = count;
      if (keep) {
        for (; i < edge; i++) if (keep(i)) picked[m++] = i;
      } else {
        for (; i < edge; i++) picked[m++] = i;
      }
      if (i < count) {
        tell("filter", i / count, m);
        soon(filterStep);
        return;
      }
      if (!cmp || m < 2) {
        finish(shOrder ? null : picked.slice(0, m), m);
        return;
      }
      sortStart(picked.slice(0, m));
    }
    function sortStart(order) {
      var n = order.length;
      var buf = new Uint32Array(n);
      var src = order;
      var dst = buf;
      var width = 1;
      var at = 0;
      var passes = Math.ceil(Math.log(n) / Math.LN2);
      var pass = 0;
      function sortStep() {
        if (job.dead) return;
        var work = 0;
        while (width < n) {
          while (at < n) {
            var mid = at + width;
            if (mid > n) mid = n;
            var hi = at + width * 2;
            if (hi > n) hi = n;
            merge(src, dst, at, mid, hi, cmp);
            work += hi - at;
            at = hi;
            if (work >= budget) {
              tell("sort", (pass + at / n) / passes, n);
              soon(sortStep);
              return;
            }
          }
          var t = src;
          src = dst;
          dst = t;
          at = 0;
          width = width * 2;
          pass++;
        }
        if (shOrder) {
          shOrder.set(src.subarray(0, n), 0);
          finish(null, n);
          return;
        }
        finish(src, n);
      }
      sortStep();
    }
    function finish(order, matched) {
      if (job.dead) return;
      live = null;
      publish(matched, 2);
      var msg2 = {
        type: "result",
        id,
        order,
        matched,
        total: count,
        ms: now() - started
      };
      port.post(msg2, order ? [order.buffer] : []);
    }
    filterStep();
  }
  port.receive(function(msg) {
    if (!msg) return;
    if (msg.type === "data") {
      count = msg.count;
      cols = msg.columns;
      shOrder = msg.order ? new Uint32Array(msg.order) : null;
      shCtrl = msg.ctrl ? new Int32Array(msg.ctrl) : null;
      return;
    }
    if (msg.type === "query") {
      if (live) live.dead = true;
      run(msg);
      return;
    }
    if (msg.type === "stop") {
      if (live) live.dead = true;
      live = null;
    }
  });
}
function spawnWorker() {
  if (typeof Worker !== "function" || typeof Blob !== "function" || typeof URL === "undefined") {
    return null;
  }
  try {
    const src = "var kernel = " + rowIndexKernel.toString() + ";\nkernel({ post: function (m, t) { self.postMessage(m, t || []) }, receive: function (cb) { self.onmessage = function (e) { cb(e.data) } } });";
    const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
    const worker = new Worker(url);
    return {
      worker: true,
      send: (msg, transfer) => worker.postMessage(msg, transfer ?? []),
      onMessage: (cb) => {
        worker.onmessage = (e) => cb(e.data);
      },
      close: () => {
        worker.terminate();
        URL.revokeObjectURL(url);
      }
    };
  } catch {
    return null;
  }
}
function spawnInline() {
  let toHost = () => {
  };
  let toKernel = () => {
  };
  rowIndexKernel({
    post: (msg) => toHost(msg),
    receive: (cb) => {
      toKernel = cb;
    }
  });
  return {
    worker: false,
    send: (msg) => toKernel(msg),
    onMessage: (cb) => {
      toHost = cb;
    },
    close: () => {
      toKernel({ type: "stop" });
    }
  };
}
function sharedMemoryAvailable() {
  return typeof SharedArrayBuffer === "function" && globalThis.crossOriginIsolated === true;
}
function toShared(column) {
  if (column.kind !== "number") return column;
  const values = column.values;
  if (values instanceof Float64Array && values.buffer instanceof SharedArrayBuffer) return column;
  const copy = new Float64Array(new SharedArrayBuffer(values.length * 8));
  copy.set(values);
  return { kind: "number", values: copy };
}
function createRowIndex(opts) {
  const channel = (opts.inline ? null : spawnWorker()) ?? spawnInline();
  const shared = channel.worker && (opts.shared ?? sharedMemoryAvailable());
  let seq = 0;
  let awaiting = 0;
  let pending = {};
  let dead = false;
  let total = 0;
  let view = null;
  let ctrl = null;
  let seen = -1;
  function readShared(partial, ms) {
    if (!view || !ctrl) return;
    const version = Atomics.load(ctrl, 0);
    if (partial && version === seen) return;
    seen = version;
    if (Atomics.load(ctrl, 3) !== awaiting) return;
    const matched = Atomics.load(ctrl, 1);
    opts.onResult({
      // `subarray` — окно в ту же память, без копии
      order: view.subarray(0, matched),
      matched,
      total,
      ms,
      query: pending,
      partial
    });
  }
  channel.onMessage((msg) => {
    if (dead || !msg || msg.id !== awaiting) return;
    if (msg.type === "progress") {
      opts.onProgress?.({ phase: msg.phase, done: msg.done, matched: msg.matched });
      if (shared && msg.phase === "filter") readShared(true, 0);
      return;
    }
    if (msg.type === "result") {
      if (shared) {
        readShared(false, msg.ms);
        return;
      }
      opts.onResult({
        order: msg.order,
        matched: msg.matched,
        total: msg.total,
        ms: msg.ms,
        query: pending,
        partial: false
      });
    }
  });
  return {
    threaded: channel.worker,
    shared,
    setData: (data) => {
      if (dead) return;
      total = data.count;
      seen = -1;
      const columns = {};
      for (const name in data.columns) {
        columns[name] = shared ? toShared(data.columns[name]) : data.columns[name];
      }
      if (shared) {
        view = new Uint32Array(new SharedArrayBuffer(Math.max(1, data.count) * 4));
        ctrl = new Int32Array(new SharedArrayBuffer(4 * 4));
      } else {
        view = null;
        ctrl = null;
      }
      channel.send({
        type: "data",
        count: data.count,
        columns,
        order: view ? view.buffer : null,
        ctrl: ctrl ? ctrl.buffer : null
      });
    },
    query: (q) => {
      if (dead) return;
      pending = q;
      awaiting = ++seq;
      seen = -1;
      channel.send({
        type: "query",
        id: awaiting,
        sort: q.sort,
        filter: q.filter,
        chunk: opts.chunk
      });
    },
    cancel: () => {
      if (dead) return;
      awaiting = ++seq;
      seen = -1;
      channel.send({ type: "stop" });
    },
    destroy: () => {
      dead = true;
      channel.close();
    }
  };
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

export { ACCEL, EDGE, LONGPRESS, MAX_SCROLL_HEIGHT, MAX_SPEED, MOVE_TOL, NO_DRAG, autoScrollSpeed, batch2 as batch, createAutoScroller, createFlip, createInlineEdit, createPresignedUploader, createPressGate, createRowIndex, createStableOrder, createUndoStack, createUploadQueue, createVirtualizer, doScroll, focusInside, hasDirectories, injectStyle, isMoveKey, measure, moveIndex, moveSelection, onMounted, prefersReducedMotion, putWithProgress, readDropEntries, restoreTextSelection, scrollOf, scrollOffsetFor, scrollParent, shouldAnimate, shouldSplit, suppressTextSelection, targetIsInteractive, uploadMultipart, viewOrigin, watch };
