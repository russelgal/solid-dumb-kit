// src/DumbToaster.tsx
import { For, Show as Show2, createSignal, onCleanup } from "solid-js";

// ../shared/dist/index.js
import * as solid from "solid-js";
import { createEffect, untrack } from "solid-js";
function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function shouldAnimate(explicit) {
  if (explicit !== void 0) return explicit;
  return !prefersReducedMotion();
}
var configured = "auto";
var apple = null;
function isApplePlatform() {
  if (apple !== null) return apple;
  const nav = typeof navigator === "undefined" ? null : navigator;
  if (!nav) return apple = false;
  const uaData = nav.userAgentData;
  const src = uaData?.platform || nav.platform || nav.userAgent || "";
  apple = /mac|iphone|ipad|ipod/i.test(src);
  return apple;
}
function resolveCloseSide(explicit) {
  const pick = explicit && explicit !== "auto" ? explicit : configured;
  if (pick !== "auto") return pick;
  const nav = typeof navigator === "undefined" ? null : navigator;
  if (!nav) return "left";
  return isApplePlatform() ? "left" : "right";
}
var SOLID_2 = !("batch" in solid);
function effect(fn) {
  if (SOLID_2) createEffect(fn, () => {
  });
  else createEffect(fn);
}
function onMounted(fn) {
  createEffect(() => untrack(fn));
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

// src/toast.ts
function createToastBus(defaults = {}) {
  const DEFAULT_TTL = defaults.ttl ?? 5e3;
  const HISTORY_LIMIT = defaults.historyLimit ?? 50;
  const LEAVE_MS = defaults.leaveMs ?? 260;
  let items = [];
  let gone = [];
  let past = [];
  let fresh = 0;
  let open = false;
  let seq = 0;
  let paused = false;
  const timers = /* @__PURE__ */ new Map();
  const rest = /* @__PURE__ */ new Map();
  const started = /* @__PURE__ */ new Map();
  const subs = /* @__PURE__ */ new Set();
  const emit = () => subs.forEach((f) => f());
  function arm(t) {
    if (!t.ttl || paused) return;
    started.set(t.id, Date.now());
    timers.set(
      t.id,
      setTimeout(() => bus.dismiss(t.id), rest.get(t.id) ?? t.ttl)
    );
  }
  function disarm(id) {
    const timer = timers.get(id);
    if (timer) clearTimeout(timer);
    timers.delete(id);
  }
  function push(kind, text, opts) {
    const actions = opts?.actions ?? (opts?.action ? [opts.action] : void 0);
    const t = {
      id: ++seq,
      kind,
      text,
      title: opts?.title,
      icon: opts?.icon,
      time: Date.now(),
      actions,
      // с кнопкой держим дольше: успеть прочитать и нажать
      at: opts?.at,
      ttl: opts?.ttl ?? (actions ? DEFAULT_TTL * 2 : DEFAULT_TTL),
      closable: opts?.closable ?? true,
      archive: opts?.archive ?? true,
      onDismiss: opts?.onDismiss
    };
    if (t.at) for (const old of items.filter((x) => x.at)) bus.dismiss(old.id);
    items = [...items, t];
    arm(t);
    emit();
    return t.id;
  }
  function retire(t) {
    if (t.archive) {
      past = [t, ...past].slice(0, HISTORY_LIMIT);
      if (!open) fresh++;
    }
    if (!LEAVE_MS) return;
    gone = [...gone, t];
    setTimeout(() => {
      gone = gone.filter((x) => x.id !== t.id);
      emit();
    }, LEAVE_MS);
  }
  const bus = {
    list: () => items,
    leaving: () => gone,
    history: () => past,
    unread: () => fresh,
    info: (text, o) => push("info", text, o),
    success: (text, o) => push("success", text, o),
    // ошибку сама не прячем: её читают и на неё реагируют
    error: (text, o) => push("error", text, { ttl: 0, ...o }),
    ask: (text, actions, opts) => (
      // ttl 0 и без крестика: вопрос ждёт ответа столько, сколько нужно.
      // В историю не идёт: ответ уже дан, читать его там нечего
      push("info", text, { ...opts, actions, ttl: 0, closable: false, archive: false })
    ),
    confirm(text, opts) {
      return new Promise((done2) => {
        bus.ask(
          text,
          [
            {
              label: opts?.yes ?? "\u0414\u0430",
              kind: opts?.danger ? "danger" : "primary",
              run: () => done2(true)
            },
            { label: opts?.no ?? "\u041E\u0442\u043C\u0435\u043D\u0430", run: () => done2(false) }
          ],
          // закрыли, не ответив (клик мимо, Esc, чужой вопрос вытеснил) — это
          // отказ. Без этого обещание не разрешилось бы никогда, и `await`
          // висел бы до перезагрузки страницы
          { at: opts?.at, onDismiss: () => done2(false) }
        );
      });
    },
    dismiss(id) {
      disarm(id);
      rest.delete(id);
      started.delete(id);
      const t = items.find((x) => x.id === id);
      items = items.filter((x) => x.id !== id);
      if (t) {
        t.onDismiss?.();
        retire(t);
      }
      emit();
    },
    clear() {
      for (const id of timers.keys()) disarm(id);
      const outgoing = items;
      items = [];
      rest.clear();
      started.clear();
      for (const t of outgoing) {
        t.onDismiss?.();
        retire(t);
      }
      emit();
    },
    forget(id) {
      past = past.filter((t) => t.id !== id);
      emit();
    },
    clearHistory() {
      past = [];
      fresh = 0;
      emit();
    },
    historyOpen: () => open,
    showHistory() {
      if (open) return;
      open = true;
      fresh = 0;
      emit();
    },
    hideHistory() {
      if (!open) return;
      open = false;
      emit();
    },
    toggleHistory() {
      if (open) bus.hideHistory();
      else bus.showHistory();
    },
    pause() {
      if (paused) return;
      paused = true;
      const now = Date.now();
      for (const t of items) {
        if (!t.ttl) continue;
        const left = (rest.get(t.id) ?? t.ttl) - (now - (started.get(t.id) ?? now));
        rest.set(t.id, Math.max(300, left));
        disarm(t.id);
      }
    },
    resume() {
      if (!paused) return;
      paused = false;
      for (const t of items) arm(t);
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    }
  };
  return bus;
}
var toast = createToastBus();

// src/toastLook.tsx
import { Show } from "solid-js";
var kindTone = (kind) => kind === "error" ? "bg-error text-error-content" : kind === "success" ? "bg-success text-success-content" : "bg-info text-info-content";
var kindGlyph = (kind) => kind === "error" ? "!" : kind === "success" ? "\u2713" : "i";
function ToastIcon(props) {
  const box = () => props.size === "sm" ? "size-7 rounded-lg text-sm" : "size-9 rounded-xl text-base";
  return <span
    class={`dumb-toast-icon grid shrink-0 place-items-center font-bold ${box()} ${kindTone(props.t.kind)}`}
    aria-hidden="true"
  >
      <Show when={props.t.icon} fallback={kindGlyph(props.t.kind)}>
        <span class={`${props.t.icon} size-[1.2em]`} />
      </Show>
    </span>;
}
function ToastBody(props) {
  return <span class="dumb-toast-body flex min-w-0 flex-1 flex-col">
      <Show when={props.t.title}>
        <span class="dumb-toast-title text-sm font-semibold">{props.t.title}</span>
      </Show>
      <span class="dumb-toast-text text-sm">{props.t.text}</span>
    </span>;
}

// src/DumbToaster.tsx
var GAP = 20;
var STYLES = `
  /* \u0417\u0434\u0435\u0441\u044C \u0422\u041E\u041B\u042C\u041A\u041E \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430: popover \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u0441\u0436\u0438\u043C\u0430\u0435\u0442\u0441\u044F \u0432 \u0442\u043E\u0447\u043A\u0443 \u0438 \u0441\u0442\u043E\u0438\u0442 \u043F\u043E
     \u0446\u0435\u043D\u0442\u0440\u0443 \u2014 \u0440\u0430\u0441\u0442\u044F\u0433\u0438\u0432\u0430\u0435\u043C \u043D\u0430 \u0432\u0441\u0451 \u043E\u043A\u043D\u043E \u0438 \u0434\u0435\u043B\u0430\u0435\u043C \u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u044B\u043C \u0434\u043B\u044F \u043A\u043B\u0438\u043A\u043E\u0432, \u043A\u0440\u043E\u043C\u0435
     \u0441\u0430\u043C\u0438\u0445 \u043F\u043B\u0430\u0448\u0435\u043A. \u0412\u0438\u0434 \u043F\u043B\u0430\u0448\u043A\u0438 \u2014 daisyUI (alert), \u0441\u043C. \u0440\u0430\u0437\u043C\u0435\u0442\u043A\u0443 \u043D\u0438\u0436\u0435. */
  .dumb-toaster { position: fixed; inset: 0; width: 100%; height: 100%;
                  margin: 0; padding: 16px; border: 0; background: none; overflow: visible;
                  display: flex; flex-direction: column; gap: ${GAP}px;
                  pointer-events: none }
  .dumb-toaster::backdrop { background: none }
  .dumb-toaster[data-at$="right"] { align-items: flex-end }
  .dumb-toaster[data-at$="left"] { align-items: flex-start }
  .dumb-toaster[data-at$="center"] { align-items: center }
  .dumb-toaster[data-at^="top"] { justify-content: flex-start }
  /* column-reverse \u043F\u0435\u0440\u0435\u0432\u043E\u0440\u0430\u0447\u0438\u0432\u0430\u0435\u0442 \u0433\u043B\u0430\u0432\u043D\u0443\u044E \u043E\u0441\u044C, \u043F\u043E\u044D\u0442\u043E\u043C\u0443 \u043A \u041D\u0418\u0416\u041D\u0415\u041C\u0423 \u043A\u0440\u0430\u044E \u043F\u0440\u0438\u0436\u0438\u043C\u0430\u0435\u0442
     flex-start, \u0430 \u043D\u0435 flex-end: \u0441 flex-end \u0441\u0442\u043E\u043F\u043A\u0430 \xAB\u0441\u043D\u0438\u0437\u0443 \u0441\u043F\u0440\u0430\u0432\u0430\xBB \u0432\u0438\u0441\u0435\u043B\u0430 \u0432\u0432\u0435\u0440\u0445\u0443 */
  .dumb-toaster[data-at^="bottom"] { justify-content: flex-start; flex-direction: column-reverse }

  /* \u041F\u043B\u0430\u0448\u043A\u0430 \u043B\u043E\u0432\u0438\u0442 \u043A\u043B\u0438\u043A\u0438, \u0445\u043E\u0442\u044F \u043A\u043E\u043D\u0442\u0435\u0439\u043D\u0435\u0440 \u0438\u0445 \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u0442 \u043D\u0430\u0441\u043A\u0432\u043E\u0437\u044C. position \u0438
     \u0437\u0430\u043F\u0430\u0441 \u0441\u0432\u0435\u0440\u0445\u0443 \u2014 \u043F\u043E\u0434 \u043A\u0440\u0435\u0441\u0442\u0438\u043A: \u043E\u043D \u0432\u0438\u0441\u0438\u0442 \u043A\u0440\u0443\u0436\u043A\u043E\u043C \u041D\u0410 \u0423\u0413\u041B\u0423 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438, \u043D\u0430\u043F\u043E\u043B\u043E\u0432\u0438\u043D\u0443
     \u0441\u043D\u0430\u0440\u0443\u0436\u0438, \u043A\u0430\u043A \u0432 \u0441\u0438\u0441\u0442\u0435\u043C\u043D\u044B\u0445 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F\u0445, \u0438 \u0431\u0435\u0437 \u0437\u0430\u043F\u0430\u0441\u0430 \u0435\u0433\u043E \u0441\u0440\u0435\u0437\u0430\u043B \u0431\u044B \u043A\u0440\u0430\u0439
     \u043A\u043E\u043D\u0442\u0435\u0439\u043D\u0435\u0440\u0430. \u0412\u0438\u0434 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u2014 daisyUI \u0432 \u0440\u0430\u0437\u043C\u0435\u0442\u043A\u0435, \u0441\u043C. toastLook.tsx. */
  .dumb-toast { pointer-events: auto; position: relative;
                /* \u0448\u0438\u0440\u0438\u043D\u0430 \u041E\u0414\u041D\u0410 \u043D\u0430 \u0432\u0441\u0435 \u043F\u043B\u0430\u0448\u043A\u0438: \u0440\u0430\u0437\u043D\u043E\u043A\u0430\u043B\u0438\u0431\u0435\u0440\u043D\u0430\u044F \u0441\u0442\u043E\u043F\u043A\u0430 \u0432\u044B\u0433\u043B\u044F\u0434\u0438\u0442
                   \u043C\u0443\u0441\u043E\u0440\u043E\u043C, \u0430 \u0441\u0438\u0441\u0442\u0435\u043C\u043D\u044B\u0435 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F \u043A\u0430\u043A \u0440\u0430\u0437 \u043E\u0434\u0438\u043D\u0430\u043A\u043E\u0432\u044B. \u041F\u043B\u0430\u0448\u043A\u0430 \u0443
                   \u043A\u0443\u0440\u0441\u043E\u0440\u0430 \u043D\u0438\u0436\u0435 \u043F\u0435\u0440\u0435\u043E\u043F\u0440\u0435\u0434\u0435\u043B\u044F\u0435\u0442 \u2014 \u0435\u0439 \u0432\u0430\u0436\u043D\u0435\u0435 \u043D\u0435 \u0437\u0430\u043A\u0440\u044B\u0442\u044C \u0441\u043E\u0431\u043E\u0439 \u0442\u043E,
                   \u043F\u0440\u043E \u0447\u0442\u043E \u0441\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u044E\u0442 */
                width: min(92vw, 380px);
                /* \u0441\u0432\u0430\u0439\u043F \u0432\u0435\u0434\u0451\u043C \u0441\u0430\u043C\u0438, \u0430 \u0432\u0435\u0440\u0442\u0438\u043A\u0430\u043B\u044C\u043D\u0443\u044E \u043F\u0440\u043E\u043A\u0440\u0443\u0442\u043A\u0443 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B \u043F\u043E\u0434
                   \u043F\u0430\u043B\u044C\u0446\u0435\u043C \u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u043C \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0443 */
                touch-action: pan-y;
                /* \u0412\u043E\u0437\u0432\u0440\u0430\u0442 \u043D\u0435\u0434\u043E\u0442\u044F\u043D\u0443\u0442\u043E\u0439 \u043F\u043B\u0430\u0448\u043A\u0438 \u043D\u0430 \u043C\u0435\u0441\u0442\u043E. \u041F\u0435\u0440\u0435\u0445\u043E\u0434 \u0432\u0438\u0441\u0438\u0442 \u041F\u041E\u0421\u0422\u041E\u042F\u041D\u041D\u041E
                   \u0438 \u0432\u044B\u043A\u043B\u044E\u0447\u0430\u0435\u0442\u0441\u044F \u043D\u0430 \u0432\u0440\u0435\u043C\u044F \u0436\u0435\u0441\u0442\u0430: \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044B\u0439 \u0432 \u043E\u0434\u043D\u043E\u043C \u043A\u0430\u0434\u0440\u0435 \u0441
                   \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435\u043C transform \u043E\u043D \u0431\u044B \u043F\u0440\u043E\u0441\u0442\u043E \u043D\u0435 \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u043B\u0441\u044F, \u0438 \u043F\u043B\u0430\u0448\u043A\u0430
                   \u043F\u0440\u044B\u0433\u043D\u0443\u043B\u0430 \u0431\u044B \u043E\u0431\u0440\u0430\u0442\u043D\u043E. */
                transition: transform .18s cubic-bezier(.2, .8, .2, 1), opacity .18s ease-out;
                animation: dumb-toast-in .16s ease-out }
  .dumb-toast[data-swipe="1"] { transition: none }
  /* \u041A\u0440\u0435\u0441\u0442\u0438\u043A \u2014 \u043D\u0430 \u0443\u0433\u043B\u0443 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438, \u0447\u0443\u0442\u044C \u0441\u043D\u0430\u0440\u0443\u0436\u0438, \u0438 \u043F\u043E\u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043F\u0440\u0438 \u043D\u0430\u0432\u0435\u0434\u0435\u043D\u0438\u0438, \u043A\u0430\u043A \u0432
     macOS: \u0432\u0438\u0441\u044F\u0449\u0438\u0439 \u043A\u0440\u0443\u0436\u043E\u043A \u043D\u0430 \u043A\u0430\u0436\u0434\u043E\u0439 \u043F\u043B\u0430\u0448\u043A\u0435 \u0432 \u0441\u0442\u043E\u043F\u043A\u0435 \u0438\u0437 \u0448\u0435\u0441\u0442\u0438 \u2014 \u044D\u0442\u043E \u0448\u0435\u0441\u0442\u044C \u043B\u0438\u0448\u043D\u0438\u0445
     \u043F\u044F\u0442\u0435\u043D.

     \u041F\u0440\u0430\u0432\u0438\u043B\u0443 \u0440\u0435\u043F\u044B \u043F\u0440\u043E \u043D\u0435\u0432\u0438\u0434\u0438\u043C\u044B\u0435 \u0440\u0443\u0447\u043A\u0438 \u044D\u0442\u043E \u043D\u0435 \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u0440\u0435\u0447\u0438\u0442, \u043F\u043E\u0442\u043E\u043C\u0443 \u0447\u0442\u043E \u0437\u0430\u043A\u0440\u044B\u0442\u044C
     \u043F\u043B\u0430\u0448\u043A\u0443 \u0435\u0441\u0442\u044C \u0447\u0435\u043C \u0438 \u0431\u0435\u0437 \u043D\u0435\u0433\u043E: \u043C\u044B\u0448\u044C\u044E \u2014 \u043D\u0430\u0432\u0435\u0434\u0435\u043D\u0438\u0435, \u043F\u0430\u043B\u044C\u0446\u0435\u043C \u2014 \u0421\u0412\u0410\u0419\u041F \u0432\u0431\u043E\u043A (\u0441\u043C.
     grab/drag/drop), \u043A\u043B\u0430\u0432\u0438\u0430\u0442\u0443\u0440\u043E\u0439 \u2014 Tab, \u0438 \u0442\u043E\u0433\u0434\u0430 \u043A\u0440\u0435\u0441\u0442\u0438\u043A \u043F\u0440\u043E\u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043F\u043E
     :focus-visible. \u0422\u0430\u043C, \u0433\u0434\u0435 \u043D\u0430\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043D\u0435 \u0431\u044B\u0432\u0430\u0435\u0442 \u0432\u043E\u0432\u0441\u0435, \u043E\u043D \u0432\u0438\u0434\u0435\u043D \u0432\u0441\u0435\u0433\u0434\u0430. */
  .dumb-toast-close { position: absolute; top: -10px; z-index: 1; opacity: 0;
                      transition: opacity .12s ease-out }
  .dumb-toast-close[data-side="left"] { left: -10px }
  .dumb-toast-close[data-side="right"] { right: -10px }
  .dumb-toast:hover .dumb-toast-close,
  .dumb-toast:focus-within .dumb-toast-close,
  .dumb-toast-close:focus-visible { opacity: 1 }
  @media (hover: none) { .dumb-toast-close { opacity: 1 } }
  @media (prefers-reduced-motion: reduce) { .dumb-toast-close { transition: none } }

  /* \u0423\u041B\u0401\u0422 \u0412 \u0418\u0421\u0422\u041E\u0420\u0418\u042E. \u041F\u043E\u0433\u0430\u0441\u0448\u0430\u044F \u043F\u043B\u0430\u0448\u043A\u0430 \u043D\u0435 \u0438\u0441\u0447\u0435\u0437\u0430\u0435\u0442 \u043D\u0430 \u043C\u0435\u0441\u0442\u0435, \u0430 \u0443\u0435\u0437\u0436\u0430\u0435\u0442 \u043A \u043A\u0440\u0430\u044E, \u0433\u0434\u0435
     \u0436\u0438\u0432\u0451\u0442 \u0446\u0435\u043D\u0442\u0440 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0439, \u2014 \u0432\u0438\u0434\u043D\u043E, \u041A\u0423\u0414\u0410 \u043E\u043D\u0430 \u0434\u0435\u043B\u0430\u0441\u044C \u0438 \u0433\u0434\u0435 \u0435\u0451 \u043F\u043E\u0442\u043E\u043C \u0438\u0441\u043A\u0430\u0442\u044C.
     \u0414\u0432\u0438\u0433\u0430\u0435\u043C \u0442\u043E\u043B\u044C\u043A\u043E transform \u0438 opacity: \u043E\u0431\u0435 \u043D\u0430 compositor, layout \u043D\u0435 \u0442\u0440\u043E\u0433\u0430\u0435\u043C.
     \u041A\u043B\u0438\u043A\u043E\u0432 \u0443\u043B\u0435\u0442\u0430\u044E\u0449\u0430\u044F \u043F\u043B\u0430\u0448\u043A\u0430 \u0443\u0436\u0435 \u043D\u0435 \u043B\u043E\u0432\u0438\u0442 \u2014 \u043F\u043E \u043D\u0435\u0439 \u0446\u0435\u043B\u044F\u0442\u0441\u044F \u043C\u0438\u043C\u043E. */
  .dumb-toast-leave { pointer-events: none;
                      animation: dumb-toast-out .26s cubic-bezier(.4, 0, 1, 1) forwards }
  .dumb-toaster[data-fly="left"] .dumb-toast-leave { animation-name: dumb-toast-out-left }
  @keyframes dumb-toast-out { to { opacity: 0; transform: translateX(115%) scale(.86) } }
  @keyframes dumb-toast-out-left { to { opacity: 0; transform: translateX(-115%) scale(.86) } }

  /* \u043F\u043B\u0430\u0448\u043A\u0430 \u0423 \u041A\u0423\u0420\u0421\u041E\u0420\u0410: \u0442\u043E\u0442 \u0436\u0435 \u043F\u0440\u0438\u0451\u043C, \u0447\u0442\u043E \u0443 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u043D\u043E\u0433\u043E \u043C\u0435\u043D\u044E \u2014 \u043D\u0435\u0432\u0438\u0434\u0438\u043C\u044B\u0439 \u044F\u043A\u043E\u0440\u044C
     \u0432 \u0442\u043E\u0447\u043A\u0435 \u0438 \u043F\u0440\u0438\u0432\u044F\u0437\u043A\u0430 \u043A \u043D\u0435\u043C\u0443, \u0441\u0442\u043E\u0440\u043E\u043D\u0443 \u0432\u044B\u0431\u0438\u0440\u0430\u0435\u0442 \u0431\u0440\u0430\u0443\u0437\u0435\u0440 */
  .dumb-toast-anchor { position: fixed; width: 1px; height: 1px; pointer-events: none;
                       anchor-name: --dumb-toast-at }
  .dumb-toast-at { position: fixed; margin: 0; overflow: visible;
                   width: max-content; max-width: min(92vw, 380px);
                   /* UA \u0434\u0430\u0451\u0442 [popover] inset: 0; \u0431\u0435\u0437 \u0441\u0431\u0440\u043E\u0441\u0430 flip-inline \u0443 \u043A\u0440\u0430\u044F
                      \u043C\u0435\u043D\u044F\u0435\u0442 \u043D\u0430\u0448 anchor() \u043C\u0435\u0441\u0442\u0430\u043C\u0438 \u0441 \u044D\u0442\u0438\u043C \u043D\u0443\u043B\u0451\u043C, \u0438 \u043F\u043B\u0430\u0448\u043A\u0430
                      \u043F\u0440\u044B\u0433\u0430\u0435\u0442 \u043A \u043B\u0435\u0432\u043E\u043C\u0443 \u043A\u0440\u0430\u044E \u043E\u043A\u043D\u0430 */
                   right: auto; bottom: auto;
                   position-anchor: --dumb-toast-at;
                   top: anchor(--dumb-toast-at bottom);
                   left: anchor(--dumb-toast-at right);
                   position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline }
  .dumb-toast-at::backdrop { background: none }

  @keyframes dumb-toast-in { from { opacity: 0; transform: translateY(6px) } }
  /* \u0441\u0438\u0441\u0442\u0435\u043C\u043D\u0430\u044F \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u0441\u0438\u043B\u044C\u043D\u0435\u0435 \u0432\u043A\u0443\u0441\u0430: \u0438 \u0432\u044A\u0435\u0437\u0434, \u0438 \u0443\u043B\u0451\u0442 \u0433\u0430\u0441\u0438\u043C */
  @media (prefers-reduced-motion: reduce) {
    .dumb-toast { animation: none; transition: none }
    .dumb-toast-leave { display: none }
  }
`;
var cardClass = "card flex-row items-start gap-3 rounded-2xl border border-base-300 bg-base-100/80 p-3 shadow-lg backdrop-blur-xl";
var actionClass = (kind) => kind === "primary" ? "btn btn-sm" : kind === "danger" ? "btn btn-sm btn-error" : "btn btn-sm btn-ghost";
function DumbToaster(props) {
  injectStyle("toast", STYLES);
  const bus = () => props.bus ?? toast;
  const [tick, bump] = createSignal(0, { equals: false });
  let box;
  onMounted(() => {
    const off = bus().subscribe(() => bump(0));
    onCleanup(() => {
      off();
      if (box?.matches(":popover-open")) box.hidePopover();
    });
  });
  let was = 0;
  effect(() => {
    const n = shown().length + flying().length;
    if (!n) {
      if (box?.matches(":popover-open")) box.hidePopover();
    } else if (n !== was) {
      if (box?.matches(":popover-open")) box.hidePopover();
      box?.showPopover?.();
    }
    was = n;
  });
  const shown = () => {
    tick();
    const all = bus().list();
    const max = props.max ?? 6;
    return all.length > max ? all.slice(-max) : all;
  };
  const flying = () => {
    tick();
    return bus().leaving().filter((t) => !t.at);
  };
  const rows = () => [...stacked(), ...flying()].sort((a, b) => a.id - b.id);
  const isLeaving = (t) => flying().some((x) => x.id === t.id);
  const stacked = () => shown().filter((t) => !t.at);
  const anchored = () => shown().filter((t) => t.at);
  const fly = () => (props.position ?? "bottom-right").endsWith("left") ? "left" : "right";
  const flip = createFlip(shouldAnimate(props.animate));
  const els = /* @__PURE__ */ new Map();
  const heights = /* @__PURE__ */ new Map();
  const sizer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
    for (const e of entries) {
      const id = Number(e.target.dataset.toastId);
      const h = e.boundingClientRect.height;
      if (id && h) heights.set(id, h);
    }
  });
  onCleanup(() => sizer?.disconnect());
  const hold = (id, el) => {
    els.set(id, el);
    sizer?.observe(el);
    onCleanup(() => {
      els.delete(id);
      sizer?.unobserve(el);
    });
  };
  let prevRows = [];
  effect(() => {
    const now = rows();
    const alive = new Set(now.map((t) => t.id));
    let freed = 0;
    const moved = [];
    for (const t of prevRows) {
      if (!alive.has(t.id)) {
        freed += (heights.get(t.id) ?? 0) + GAP;
        heights.delete(t.id);
      } else if (freed) {
        moved.push([t.id, freed]);
      }
    }
    prevRows = now;
    if (!moved.length) return;
    const dir = (props.position ?? "bottom-right").startsWith("bottom") ? -1 : 1;
    for (const [id, dy] of moved) {
      const el = els.get(id);
      if (el) flip.nudge(el, 0, dir * dy);
    }
  });
  const SWIPE_START = 6;
  const SWIPE_DROP = 72;
  const SWIPE_FADE = 240;
  const [swipe, setSwipe] = createSignal(null);
  const shift = (t) => {
    const s = swipe();
    if (!s || s.id !== t.id || Math.abs(s.dx) < SWIPE_START) return 0;
    return s.dx;
  };
  const dragging = (t) => {
    const s = swipe();
    return !!s && s.id === t.id;
  };
  const grab = (t, ev) => {
    if (ev.button !== 0) return;
    if (ev.target.closest("button")) return;
    ev.currentTarget.setPointerCapture?.(ev.pointerId);
    bus().pause();
    setSwipe({ id: t.id, from: ev.clientX, dx: 0 });
  };
  const drag = (t, ev) => {
    const s = swipe();
    if (!s || s.id !== t.id) return;
    setSwipe({ ...s, dx: ev.clientX - s.from });
  };
  const drop = (t) => {
    const s = swipe();
    if (!s || s.id !== t.id) return;
    bus().resume();
    if (Math.abs(s.dx) > SWIPE_DROP) {
      bus().dismiss(t.id);
      return;
    }
    setSwipe(null);
  };
  const side = () => resolveCloseSide(props.closeSide);
  const closeButton = (t) => <button
    type="button"
    class="dumb-toast-close btn btn-xs btn-circle btn-neutral shadow"
    data-side={side()}
    title="закрыть"
    onClick={() => bus().dismiss(t.id)}
  >
      ✕
    </button>;
  const [pointer, setPointer] = createSignal({ x: 0, y: 0 });
  onMounted(() => {
    const track = (ev) => setPointer({ x: ev.clientX, y: ev.clientY });
    window.addEventListener("pointermove", track, { passive: true });
    window.addEventListener("pointerdown", track, { passive: true });
    onCleanup(() => {
      window.removeEventListener("pointermove", track);
      window.removeEventListener("pointerdown", track);
    });
  });
  const spotOf = (t) => t.at === "pointer" ? pointer() : t.at;
  return <div
    ref={box}
    popover="manual"
    class={`dumb-toaster ${props.class ?? ""}`}
    data-at={props.position ?? "bottom-right"}
    data-fly={fly()}
    onMouseEnter={() => bus().pause()}
    onMouseLeave={() => bus().resume()}
  >
      <For each={rows()}>
        {(t) => props.children?.(t, () => bus().dismiss(t.id)) ?? <div
    ref={(el) => hold(t.id, el)}
    class={`dumb-toast ${cardClass} ${isLeaving(t) ? "dumb-toast-leave" : ""}`}
    data-toast-id={t.id}
    data-kind={t.kind}
    aria-hidden={isLeaving(t) ? "true" : void 0}
    role={t.kind === "error" ? "alert" : "status"}
    onPointerDown={(ev) => !isLeaving(t) && grab(t, ev)}
    onPointerMove={(ev) => drag(t, ev)}
    onPointerUp={() => drop(t)}
    onPointerCancel={() => drop(t)}
    style={{
      transform: shift(t) ? `translateX(${shift(t)}px)` : void 0,
      opacity: shift(t) ? String(Math.max(0.15, 1 - Math.abs(shift(t)) / SWIPE_FADE)) : void 0
    }}
    data-swipe={dragging(t) ? "1" : void 0}
  >
              {
    /* у вопроса крестика нет: закрыть, не ответив, — это неявный
       ответ, и какой именно, никто не знает. У улетающей его тоже
       нет: она уже закрыта */
  }
              <Show2 when={t.closable && !isLeaving(t)}>{closeButton(t)}</Show2>
              <ToastIcon t={t} />
              <ToastBody t={t} />
              <For each={t.actions ?? []}>
                {(a) => <button
    type="button"
    class={actionClass(a.kind)}
    data-kind={a.kind}
    onClick={() => {
      a.run?.();
      if (!a.keepOpen) bus().dismiss(t.id);
    }}
  >
                    {a.label}
                  </button>}
              </For>
            </div>}
      </For>
      <For each={anchored()}>{(t) => <AtToast t={t} />}</For>
    </div>;
  function AtToast(p) {
    let el;
    onMounted(() => {
      queueMicrotask(() => el?.showPopover?.());
      const away = (ev) => {
        if (!el?.contains(ev.target)) bus().dismiss(p.t.id);
      };
      const onKey = (ev) => {
        if (ev.key !== "Escape") return;
        ev.preventDefault();
        bus().dismiss(p.t.id);
      };
      window.addEventListener("pointerdown", away, true);
      window.addEventListener("keydown", onKey);
      onCleanup(() => {
        window.removeEventListener("pointerdown", away, true);
        window.removeEventListener("keydown", onKey);
        if (el?.matches(":popover-open")) el.hidePopover();
      });
    });
    const spot = spotOf(p.t);
    return <>
        <div class="dumb-toast-anchor" style={{ left: `${spot.x}px`, top: `${spot.y}px` }} />
        <div
      ref={el}
      popover="manual"
      class={`dumb-toast dumb-toast-at ${cardClass}`}
      data-kind={p.t.kind}
      role={p.t.kind === "error" ? "alert" : "status"}
    >
          <Show2 when={p.t.closable}>{closeButton(p.t)}</Show2>
          <ToastIcon t={p.t} />
          <ToastBody t={p.t} />
          <For each={p.t.actions ?? []}>
            {(a) => <button
      type="button"
      class={actionClass(a.kind)}
      data-kind={a.kind}
      onClick={() => {
        a.run?.();
        if (!a.keepOpen) bus().dismiss(p.t.id);
      }}
    >
                {a.label}
              </button>}
          </For>
        </div>
      </>;
  }
}

// src/DumbToastCenter.tsx
import { For as For2, Show as Show3, createSignal as createSignal2, onCleanup as onCleanup2 } from "solid-js";
var STYLES2 = `
  /* \u041F\u0430\u043D\u0435\u043B\u044C. \u0417\u0434\u0435\u0441\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430 \u0438 \u043C\u0435\u0445\u0430\u043D\u0438\u043A\u0430: \u0432\u0438\u0434 \u2014 daisyUI \u0432 \u0440\u0430\u0437\u043C\u0435\u0442\u043A\u0435.
     popover \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u0446\u0435\u043D\u0442\u0440\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u0438 \u0441\u0436\u0438\u043C\u0430\u0435\u0442\u0441\u044F \u043F\u043E \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u043C\u0443 \u2014 \u0440\u0430\u0441\u0442\u044F\u0433\u0438\u0432\u0430\u0435\u043C
     \u043D\u0430 \u0432\u0441\u044E \u0432\u044B\u0441\u043E\u0442\u0443 \u0438 \u043F\u0440\u0438\u0436\u0438\u043C\u0430\u0435\u043C \u043A \u043A\u0440\u0430\u044E. */
  .dumb-center { position: fixed; top: 0; bottom: 0; margin: 0; border: 0; padding: 0;
                 /* height, \u0430 \u043D\u0435 \u043F\u0430\u0440\u0430 top/bottom: \u0443 popover \u043E\u0442 UA height: fit-content,
                    \u0438 \u043F\u0440\u0438 \u0437\u0430\u0434\u0430\u043D\u043D\u044B\u0445 top+bottom \u0441\u043F\u043E\u0440 \u0440\u0435\u0448\u0430\u0435\u0442\u0441\u044F \u0432 \u043F\u043E\u043B\u044C\u0437\u0443 height \u2014
                    \u043F\u0430\u043D\u0435\u043B\u044C \u0441\u044A\u0451\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u043F\u043E \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u043C\u0443 \u0432\u043C\u0435\u0441\u0442\u043E \u043F\u043E\u043B\u043D\u043E\u0439 \u0432\u044B\u0441\u043E\u0442\u044B */
                 width: min(92vw, 380px); height: 100%; overflow: visible;
                 display: flex; flex-direction: column }
  /* \u0421\u043A\u0440\u044B\u0442\u044B\u0439 popover \u0431\u0440\u0430\u0443\u0437\u0435\u0440 \u043F\u0440\u044F\u0447\u0435\u0442 \u0441\u0430\u043C (display: none), \u043D\u043E \u044D\u0442\u043E UA-\u0441\u0442\u0438\u043B\u044C, \u0430 \u043D\u0430\u0448
     display: flex \u2014 \u0430\u0432\u0442\u043E\u0440\u0441\u043A\u0438\u0439: \u043E\u043D \u043F\u0435\u0440\u0435\u0431\u0438\u0432\u0430\u0435\u0442 \u043F\u043E \u043A\u0430\u0441\u043A\u0430\u0434\u0443, \u0438 \u043F\u0430\u043D\u0435\u043B\u044C \u0432\u0438\u0441\u0435\u043B\u0430 \u0431\u044B \u043D\u0430
     \u044D\u043A\u0440\u0430\u043D\u0435 \u0441 \u0441\u0430\u043C\u043E\u0439 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438. \u0413\u0430\u0441\u0438\u043C \u044F\u0432\u043D\u043E. */
  .dumb-center:not(:popover-open) { display: none }
  .dumb-center[data-side="right"] { right: 0; left: auto }
  .dumb-center[data-side="left"] { left: 0; right: auto }
  .dumb-center::backdrop { background: none }
  /* \u0432\u044B\u0435\u0437\u0434: \u0442\u043E\u043B\u044C\u043A\u043E transform, layout \u043D\u0435 \u0442\u0440\u043E\u0433\u0430\u0435\u043C */
  .dumb-center[data-animate="1"] { animation: dumb-center-in .18s ease-out }
  .dumb-center[data-side="left"][data-animate="1"] { animation-name: dumb-center-in-left }
  @keyframes dumb-center-in { from { transform: translateX(100%) } }
  @keyframes dumb-center-in-left { from { transform: translateX(-100%) } }

  /* \u0421\u043F\u0438\u0441\u043E\u043A \u043F\u0440\u043E\u043A\u0440\u0443\u0447\u0438\u0432\u0430\u0435\u0442\u0441\u044F, \u0448\u0430\u043F\u043A\u0430 \u0441\u0442\u043E\u0438\u0442 \u043D\u0430 \u043C\u0435\u0441\u0442\u0435. \u041E\u0442\u0441\u0442\u0443\u043F\u044B \u043F\u043E \u0431\u043E\u043A\u0430\u043C \u2014 \u043F\u043E\u0434
     \u043A\u0440\u0435\u0441\u0442\u0438\u043A: \u043E\u043D \u0432\u0438\u0441\u0438\u0442 \u041D\u0410 \u0423\u0413\u041B\u0423 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438, \u043D\u0430\u043F\u043E\u043B\u043E\u0432\u0438\u043D\u0443 \u0441\u043D\u0430\u0440\u0443\u0436\u0438, \u0438 \u0431\u0435\u0437 \u0437\u0430\u043F\u0430\u0441\u0430 \u0435\u0433\u043E
     \u0441\u0440\u0435\u0437\u0430\u043B\u0430 \u0431\u044B \u043F\u0440\u043E\u043A\u0440\u0443\u0447\u0438\u0432\u0430\u0435\u043C\u0430\u044F \u043E\u0431\u043B\u0430\u0441\u0442\u044C. */
  .dumb-center-list { overflow-y: auto; overscroll-behavior: contain; flex: 1 }
  /* \u041A\u0440\u0435\u0441\u0442\u0438\u043A \u043F\u043E\u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043F\u043E \u043D\u0430\u0432\u0435\u0434\u0435\u043D\u0438\u044E \u2014 \u043A\u0430\u043A \u0432\u043E \u0432\u0441\u043F\u043B\u044B\u0432\u0430\u044E\u0449\u0435\u0439 \u043F\u043B\u0430\u0448\u043A\u0435 \u0438 \u043A\u0430\u043A \u0432 macOS:
     \u043F\u043E\u043B\u0441\u043E\u0442\u043D\u0438 \u043A\u0440\u0443\u0436\u043A\u043E\u0432 \u0432 \u0441\u043F\u0438\u0441\u043A\u0435 \u0438\u0441\u0442\u043E\u0440\u0438\u0438 \u0431\u044B\u043B\u0438 \u0431\u044B \u0448\u0443\u043C\u043E\u043C. \u0413\u0434\u0435 \u043D\u0430\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043D\u0435 \u0431\u044B\u0432\u0430\u0435\u0442
     (\u0442\u0430\u0447), \u043E\u043D \u0432\u0438\u0434\u0435\u043D \u0432\u0441\u0435\u0433\u0434\u0430; \u0441 \u043A\u043B\u0430\u0432\u0438\u0430\u0442\u0443\u0440\u044B \u043F\u0440\u043E\u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043F\u043E :focus-visible. */
  .dumb-center-forget { position: absolute; top: -8px; z-index: 1; opacity: 0;
                        transition: opacity .12s ease-out }
  .dumb-center-forget[data-side="left"] { left: -8px }
  .dumb-center-forget[data-side="right"] { right: -8px }
  .dumb-center-item:hover .dumb-center-forget,
  .dumb-center-item:focus-within .dumb-center-forget,
  .dumb-center-forget:focus-visible { opacity: 1 }
  @media (hover: none) { .dumb-center-forget { opacity: 1 } }
  @media (prefers-reduced-motion: reduce) { .dumb-center-forget { transition: none } }

  /* \u041A\u043E\u043B\u043E\u043A\u043E\u043B\u044C\u0447\u0438\u043A \u2014 \u041E\u0411\u042B\u0427\u041D\u042B\u0419 fixed-\u044D\u043B\u0435\u043C\u0435\u043D\u0442, \u0430 \u041D\u0415 popover.

     \u0421\u043E\u0431\u043B\u0430\u0437\u043D \u0431\u044B\u043B: \u0432 top layer \u043E\u043D \u0432\u0441\u0435\u0433\u0434\u0430 \u043F\u043E\u0432\u0435\u0440\u0445 \u0432\u0441\u0435\u0433\u043E. \u041D\u043E top layer \u2014 \u044D\u0442\u043E \u043C\u0435\u0441\u0442\u043E
     \u0434\u043B\u044F \u0442\u043E\u0433\u043E, \u0447\u0442\u043E \u043E\u0442\u043A\u0440\u044B\u043B\u0438 \u0438 \u0437\u0430\u043A\u0440\u043E\u044E\u0442, \u0430 \u043A\u043E\u043B\u043E\u043A\u043E\u043B\u044C\u0447\u0438\u043A \u0432\u0438\u0441\u0438\u0442 \u0432\u0441\u0451 \u0432\u0440\u0435\u043C\u044F \u0440\u0430\u0431\u043E\u0442\u044B
     \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F, \u0438 \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u0439 \u0436\u0438\u043B\u0435\u0446 \u0442\u0430\u043C \u043C\u0435\u0448\u0430\u0435\u0442 \u0432\u0441\u0435\u043C: \u043B\u044E\u0431\u043E\u0435 \u043E\u043A\u043D\u043E, \u043E\u0442\u043A\u0440\u044B\u0442\u043E\u0435
     \u043F\u043E\u0437\u0436\u0435, \u0432\u0441\u0451 \u0440\u0430\u0432\u043D\u043E \u043B\u044F\u0436\u0435\u0442 \u0432\u044B\u0448\u0435, \u0437\u0430\u0442\u043E \u0441\u0430\u043C \u043E\u043D \u0432 \u043E\u0442\u043B\u0430\u0434\u0447\u0438\u043A\u0435 \u0432\u0435\u0447\u043D\u043E \u0442\u043E\u0440\u0447\u0438\u0442 \u0432
     #top-layer, \u0438 \u043F\u043E\u043D\u044F\u0442\u044C, \u043A\u0442\u043E \u0442\u0430\u043C \u043B\u0438\u0448\u043D\u0438\u0439, \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u0441\u044F \u043D\u0435\u0447\u0435\u043C.

     \u041F\u0435\u0440\u0435\u043A\u0440\u044B\u0432\u0430\u0442\u044C \u043C\u043E\u0434\u0430\u043B\u043A\u0443 \u0435\u043C\u0443 \u0438 \u043D\u0435 \u043D\u0443\u0436\u043D\u043E: \u043F\u043E\u043A\u0430 \u043E\u0442\u043A\u0440\u044B\u0442\u043E \u043E\u043A\u043D\u043E, \u043A\u043D\u043E\u043F\u043A\u0430 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0439
     \u2014 \u043D\u0435 \u0442\u043E, \u043A\u0443\u0434\u0430 \u0434\u043E\u043B\u0436\u0435\u043D \u0443\u0445\u043E\u0434\u0438\u0442\u044C \u043A\u043B\u0438\u043A. z-index \u0431\u0435\u0440\u0451\u0442\u0441\u044F \u043F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u043E\u0439: \u0443 \u0447\u0443\u0436\u043E\u0439
     \u0448\u0430\u043F\u043A\u0438 \u043E\u043D \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u0432\u044B\u0448\u0435, \u0438 \u044D\u0442\u043E \u0434\u0435\u043B\u043E \u043F\u043E\u0442\u0440\u0435\u0431\u0438\u0442\u0435\u043B\u044F. */
  .dumb-center-bell { position: fixed; top: 12px; z-index: var(--dumb-center-bell-z, 40) }
  .dumb-center-bell[data-side="right"] { right: 12px; left: auto }
  .dumb-center-bell[data-side="left"] { left: 12px; right: auto }
`;
function ago(time, now) {
  const sec = Math.max(0, Math.round((now - time) / 1e3));
  if (sec < 45) return "\u0442\u043E\u043B\u044C\u043A\u043E \u0447\u0442\u043E";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} \u043C\u0438\u043D`;
  const hour = Math.round(min / 60);
  if (hour < 24) return `${hour} \u0447`;
  const day = Math.round(hour / 24);
  return day === 1 ? "\u0432\u0447\u0435\u0440\u0430" : `${day} \u0434\u043D`;
}
function DumbToastCenter(props) {
  injectStyle("toast-center", STYLES2);
  const bus = () => props.bus ?? toast;
  const [tick, bump] = createSignal2(0, { equals: false });
  const [now, setNow] = createSignal2(Date.now());
  let panel;
  let bell;
  const side = () => props.side ?? "right";
  const closeAt = () => resolveCloseSide(props.closeSide);
  const open = () => (tick(), bus().historyOpen());
  const items = () => (tick(), bus().history());
  const unread = () => (tick(), bus().unread());
  onMounted(() => {
    const off = bus().subscribe(() => bump(0));
    const onKey = (ev) => {
      if (ev.key === "Escape" && bus().historyOpen()) {
        ev.preventDefault();
        bus().hideHistory();
      }
    };
    const away = (ev) => {
      if (!bus().historyOpen()) return;
      const t = ev.target;
      if (panel?.contains(t) || bell?.contains(t)) return;
      bus().hideHistory();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", away, true);
    onCleanup2(() => {
      off();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", away, true);
      if (panel?.matches(":popover-open")) panel.hidePopover();
    });
  });
  effect(() => {
    if (!open()) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 3e4);
    onCleanup2(() => clearInterval(id));
  });
  effect(() => {
    const show = open();
    queueMicrotask(() => {
      if (!panel) return;
      if (show && !panel.matches(":popover-open")) panel.showPopover?.();
      if (!show && panel.matches(":popover-open")) panel.hidePopover();
    });
  });
  const closeButton = () => <button
    type="button"
    class="btn btn-sm btn-ghost btn-circle"
    aria-label="закрыть"
    onClick={() => bus().hideHistory()}
  >
      ✕
    </button>;
  const forgetButton = (t) => <button
    type="button"
    class="dumb-center-forget btn btn-xs btn-circle btn-neutral shadow"
    data-side={closeAt()}
    aria-label="убрать"
    onClick={() => bus().forget(t.id)}
  >
      ✕
    </button>;
  return <>
      {
    /* при открытой панели колокольчик убираем: она стоит ровно на его месте,
       а закрыть её есть чем — крестиком, Esc и кликом мимо */
  }
      <Show3 when={props.bell !== false && !open()}>
        <div ref={bell} class="dumb-center-bell" data-side={side()}>
          <button
    type="button"
    class="btn btn-circle btn-neutral shadow-lg"
    aria-label={`\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F${unread() ? `: \u043D\u0435\u043F\u0440\u043E\u0447\u0438\u0442\u0430\u043D\u043D\u044B\u0445 ${unread()}` : ""}`}
    aria-expanded={open()}
    onClick={() => bus().toggleHistory()}
  >
            {
    /* Своих иконок кит не несёт — рисуем колокол текстом. Нужна
       иконка набора — потребитель кладёт свою кнопку и зовёт
       toast.toggleHistory(), а колокольчик выключает пропом. */
  }
            <span class="text-lg leading-none" aria-hidden="true">
              🔔
            </span>
            <Show3 when={unread() > 0}>
              <span class="badge badge-sm badge-error absolute -right-1 -top-1 tabular-nums">
                {unread()}
              </span>
            </Show3>
          </button>
        </div>
      </Show3>

      <div
    ref={panel}
    popover="manual"
    class={`dumb-center bg-base-100 border-base-300 shadow-2xl ${side() === "right" ? "border-l" : "border-r"} ${props.class ?? ""}`}
    data-side={side()}
    data-animate={shouldAnimate(props.animate) ? "1" : "0"}
    role="region"
    aria-label={props.title ?? "\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F"}
  >
        <div class="flex items-center gap-2 border-b border-base-300 p-3">
          <Show3 when={closeAt() === "left"}>{closeButton()}</Show3>
          <h2 class="flex-1 font-semibold">{props.title ?? "\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F"}</h2>
          <Show3 when={items().length > 0}>
            {
    /* очистили — читать больше нечего, поэтому панель сразу уходит:
       смотреть на пустой список никто не просил */
  }
            <button
    type="button"
    class="btn btn-sm btn-ghost"
    onClick={() => {
      bus().clearHistory();
      bus().hideHistory();
    }}
  >
              Очистить
            </button>
          </Show3>
          <Show3 when={closeAt() === "right"}>{closeButton()}</Show3>
        </div>

        {
    /* px-4 и gap-3, а не p-3: крестик висит на углу карточки, наполовину
       снаружи, и в тесном списке его срезала бы прокручиваемая область, а
       соседняя карточка — накрыла бы */
  }
        <ul class="dumb-center-list flex flex-col gap-3 px-4 py-3">
          <Show3
    when={items().length > 0}
    fallback={<li class="py-8 text-center text-sm text-base-content opacity-90">
                Пока ничего не приходило
              </li>}
  >
            <For2 each={items()}>
              {(t) => props.children?.(t, () => bus().forget(t.id)) ?? <li
    class="dumb-center-item card relative flex-row items-start gap-3 rounded-2xl border border-base-300 bg-base-100/80 p-3 shadow backdrop-blur-xl"
    data-kind={t.kind}
  >
                    {forgetButton(t)}
                    <ToastIcon t={t} size="sm" />
                    <ToastBody t={t} />
                    {
    /* время читаемое, а не серое по серому: правило контраста
       кита запрещает text-base-content/60 и подобное */
  }
                    <span class="shrink-0 text-xs opacity-90 tabular-nums">{ago(t.time, now())}</span>
                  </li>}
            </For2>
          </Show3>
        </ul>
      </div>
    </>;
}
export {
  DumbToastCenter,
  DumbToaster,
  ago,
  createToastBus,
  toast
};
