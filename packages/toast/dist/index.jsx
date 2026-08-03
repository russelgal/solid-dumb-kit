// src/DumbToaster.tsx
import { For, Show, createEffect as createEffect2, createSignal, onCleanup } from "solid-js";

// ../shared/dist/index.js
import * as solid from "solid-js";
import { createEffect, untrack } from "solid-js";
function onMounted(fn) {
  createEffect(() => untrack(fn));
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

// src/toast.ts
function createToastBus(defaults = {}) {
  const DEFAULT_TTL = defaults.ttl ?? 5e3;
  let items = [];
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
    const same = items.find((t2) => t2.kind === kind && t2.text === text && !t2.actions);
    if (same && !actions) {
      const next = { ...same, count: same.count + 1 };
      items = items.map((t2) => t2.id === same.id ? next : t2);
      disarm(next.id);
      rest.delete(next.id);
      arm(next);
      emit();
      return next.id;
    }
    const t = {
      id: ++seq,
      kind,
      text,
      count: 1,
      actions,
      // с кнопкой держим дольше: успеть прочитать и нажать
      at: opts?.at,
      ttl: opts?.ttl ?? (actions ? DEFAULT_TTL * 2 : DEFAULT_TTL),
      closable: opts?.closable ?? true
    };
    items = [...items, t];
    arm(t);
    emit();
    return t.id;
  }
  const bus = {
    list: () => items,
    info: (text, o) => push("info", text, o),
    success: (text, o) => push("success", text, o),
    // ошибку сама не прячем: её читают и на неё реагируют
    error: (text, o) => push("error", text, { ttl: 0, ...o }),
    ask: (text, actions, opts) => (
      // ttl 0 и без крестика: вопрос ждёт ответа столько, сколько нужно
      push("info", text, { ...opts, actions, ttl: 0, closable: false })
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
          { at: opts?.at }
        );
      });
    },
    dismiss(id) {
      disarm(id);
      rest.delete(id);
      started.delete(id);
      items = items.filter((t) => t.id !== id);
      emit();
    },
    clear() {
      for (const id of timers.keys()) disarm(id);
      items = [];
      rest.clear();
      started.clear();
      emit();
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

// src/DumbToaster.tsx
var STYLES = `
  /* popover \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u0441\u0436\u0438\u043C\u0430\u0435\u0442\u0441\u044F \u0432 \u0442\u043E\u0447\u043A\u0443 \u0438 \u0441\u0442\u043E\u0438\u0442 \u043F\u043E \u0446\u0435\u043D\u0442\u0440\u0443 \u2014 \u0440\u0430\u0441\u0442\u044F\u0433\u0438\u0432\u0430\u0435\u043C \u043D\u0430
     \u0432\u0441\u0451 \u043E\u043A\u043D\u043E \u0438 \u0434\u0435\u043B\u0430\u0435\u043C \u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u044B\u043C \u0434\u043B\u044F \u043A\u043B\u0438\u043A\u043E\u0432, \u043A\u0440\u043E\u043C\u0435 \u0441\u0430\u043C\u0438\u0445 \u043F\u043B\u0430\u0448\u0435\u043A */
  .dumb-toaster { position: fixed; inset: 0; width: 100%; height: 100%;
                  margin: 0; padding: 16px; border: 0; background: none; overflow: visible;
                  display: flex; flex-direction: column; gap: 8px;
                  pointer-events: none }
  .dumb-toaster::backdrop { background: none }
  .dumb-toaster[data-at$="right"] { align-items: flex-end }
  .dumb-toaster[data-at$="left"] { align-items: flex-start }
  .dumb-toaster[data-at$="center"] { align-items: center }
  .dumb-toaster[data-at^="top"] { justify-content: flex-start }
  .dumb-toaster[data-at^="bottom"] { justify-content: flex-end; flex-direction: column-reverse }
  .dumb-toast { max-width: min(92vw, 420px) }

  .dumb-toast { pointer-events: auto; display: flex; align-items: center; gap: 10px;
                padding: 9px 12px; border-radius: 10px; font-size: 13px; line-height: 1.35;
                color: var(--dumb-toast-fg, #f8fafc);
                background: var(--dumb-toast-bg, #1e293b);
                box-shadow: 0 6px 20px rgb(0 0 0 / .18);
                animation: dumb-toast-in .16s ease-out }
  .dumb-toast[data-kind="success"] { background: var(--dumb-toast-ok, #15803d) }
  .dumb-toast[data-kind="error"] { background: var(--dumb-toast-bad, #b91c1c) }
  .dumb-toast-text { flex: 1; min-width: 0; overflow-wrap: anywhere }
  /* \u0441\u0447\u0451\u0442\u0447\u0438\u043A \u043F\u043E\u0432\u0442\u043E\u0440\u043E\u0432: \u0434\u0432\u0430\u0434\u0446\u0430\u0442\u044C \u043E\u0434\u0438\u043D\u0430\u043A\u043E\u0432\u044B\u0445 \u043E\u0448\u0438\u0431\u043E\u043A \u2014 \u043E\u0434\u043D\u0430 \u043F\u043B\u0430\u0448\u043A\u0430 \u0441 \u0447\u0438\u0441\u043B\u043E\u043C */
  .dumb-toast-count { flex: none; font-size: 11px; font-variant-numeric: tabular-nums;
                      padding: 1px 6px; border-radius: 999px; background: rgb(255 255 255 / .22) }
  .dumb-toast button { flex: none; font: inherit; color: inherit; cursor: pointer;
                       background: rgb(255 255 255 / .16); border: 0; border-radius: 6px;
                       padding: 3px 9px }
  .dumb-toast button:hover { background: rgb(255 255 255 / .28) }
  /* \u0433\u043B\u0430\u0432\u043D\u043E\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u0438\u0434\u043D\u043E \u0441\u0440\u0430\u0437\u0443, \u043E\u043F\u0430\u0441\u043D\u043E\u0435 \u2014 \u043A\u0440\u0430\u0441\u043D\u044B\u043C: \u043F\u043E \u043D\u0438\u043C \u043F\u043E\u043F\u0430\u0434\u0430\u044E\u0442 \u043D\u0430\u0441\u043F\u0435\u0445 */
  .dumb-toast button[data-kind="primary"] { background: rgb(255 255 255 / .92);
                                            color: var(--dumb-toast-bg, #1e293b);
                                            font-weight: 600 }
  .dumb-toast button[data-kind="danger"] { background: var(--dumb-toast-bad, #b91c1c);
                                           color: #fff; font-weight: 600 }
  .dumb-toast button[data-kind="danger"]:hover { filter: brightness(1.12) }
  .dumb-toast-close { padding: 0 4px !important; background: none !important; opacity: .8 }

  /* \u043F\u043B\u0430\u0448\u043A\u0430 \u0423 \u041A\u0423\u0420\u0421\u041E\u0420\u0410: \u0442\u043E\u0442 \u0436\u0435 \u043F\u0440\u0438\u0451\u043C, \u0447\u0442\u043E \u0443 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u043D\u043E\u0433\u043E \u043C\u0435\u043D\u044E \u2014 \u043D\u0435\u0432\u0438\u0434\u0438\u043C\u044B\u0439 \u044F\u043A\u043E\u0440\u044C
     \u0432 \u0442\u043E\u0447\u043A\u0435 \u0438 \u043F\u0440\u0438\u0432\u044F\u0437\u043A\u0430 \u043A \u043D\u0435\u043C\u0443, \u0441\u0442\u043E\u0440\u043E\u043D\u0443 \u0432\u044B\u0431\u0438\u0440\u0430\u0435\u0442 \u0431\u0440\u0430\u0443\u0437\u0435\u0440 */
  .dumb-toast-anchor { position: fixed; width: 1px; height: 1px; pointer-events: none;
                       anchor-name: --dumb-toast-at }
  .dumb-toast-at { position: fixed; margin: 0; border: 0; padding: 9px 12px; overflow: visible;
                   max-width: min(92vw, 380px);
                   position-anchor: --dumb-toast-at;
                   top: anchor(--dumb-toast-at bottom);
                   left: anchor(--dumb-toast-at right);
                   position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline }
  .dumb-toast-at::backdrop { background: none }

  @keyframes dumb-toast-in { from { opacity: 0; transform: translateY(6px) } }
  /* \u0441\u0438\u0441\u0442\u0435\u043C\u043D\u0430\u044F \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u0441\u0438\u043B\u044C\u043D\u0435\u0435 \u0432\u043A\u0443\u0441\u0430: \u0432\u044A\u0435\u0437\u0434 \u0433\u0430\u0441\u0438\u043C */
  @media (prefers-reduced-motion: reduce) { .dumb-toast { animation: none } }
`;
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
  createEffect2(() => {
    const n = shown().length;
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
    const max = props.max ?? 4;
    return all.length > max ? all.slice(-max) : all;
  };
  const stacked = () => shown().filter((t) => !t.at);
  const anchored = () => shown().filter((t) => t.at);
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
    onMouseEnter={() => bus().pause()}
    onMouseLeave={() => bus().resume()}
  >
      <For each={stacked()}>
        {(t) => props.children?.(t, () => bus().dismiss(t.id)) ?? <div class="dumb-toast" data-kind={t.kind} role={t.kind === "error" ? "alert" : "status"}>
              <span class="dumb-toast-text">{t.text}</span>
              <Show when={t.count > 1}>
                <span class="dumb-toast-count">{t.count}</span>
              </Show>
              <For each={t.actions ?? []}>
                {(a) => <button
    type="button"
    data-kind={a.kind}
    onClick={() => {
      a.run?.();
      if (!a.keepOpen) bus().dismiss(t.id);
    }}
  >
                    {a.label}
                  </button>}
              </For>
              {
    /* у вопроса крестика нет: закрыть, не ответив, — это неявный
       ответ, и какой именно, никто не знает */
  }
              <Show when={t.closable}>
                <button
    type="button"
    class="dumb-toast-close"
    title="закрыть"
    onClick={() => bus().dismiss(t.id)}
  >
                  ✕
                </button>
              </Show>
            </div>}
      </For>
      <For each={anchored()}>{(t) => <AtToast t={t} />}</For>
    </div>;
  function AtToast(p) {
    let el;
    onMounted(() => {
      queueMicrotask(() => el?.showPopover?.());
      onCleanup(() => {
        if (el?.matches(":popover-open")) el.hidePopover();
      });
    });
    const spot = spotOf(p.t);
    return <>
        <div class="dumb-toast-anchor" style={{ left: `${spot.x}px`, top: `${spot.y}px` }} />
        <div
      ref={el}
      popover="manual"
      class="dumb-toast dumb-toast-at"
      data-kind={p.t.kind}
      role={p.t.kind === "error" ? "alert" : "status"}
    >
          <span class="dumb-toast-text">{p.t.text}</span>
          <For each={p.t.actions ?? []}>
            {(a) => <button
      type="button"
      data-kind={a.kind}
      onClick={() => {
        a.run?.();
        if (!a.keepOpen) bus().dismiss(p.t.id);
      }}
    >
                {a.label}
              </button>}
          </For>
          <Show when={p.t.closable}>
            <button type="button" class="dumb-toast-close" onClick={() => bus().dismiss(p.t.id)}>
              ✕
            </button>
          </Show>
        </div>
      </>;
  }
}
export {
  DumbToaster,
  createToastBus,
  toast
};
