// src/DumbLightbox.tsx
import { Show, createEffect as createEffect2, createMemo, createSignal, onCleanup } from "solid-js";

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

// src/DumbLightbox.tsx
var STYLES = `
  /* \u0422\u043E\u043B\u044C\u043A\u043E \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430 \u0438 \u043C\u0435\u0445\u0430\u043D\u0438\u043A\u0430 \u0437\u0443\u043C\u0430. \u041A\u043D\u043E\u043F\u043A\u0438 \u2014 daisyUI (btn) \u0432 \u0440\u0430\u0437\u043C\u0435\u0442\u043A\u0435; \u043D\u0430\u0434
     \u0442\u0451\u043C\u043D\u043E\u0439 \u043A\u0430\u0440\u0442\u0438\u043D\u043A\u043E\u0439 \u043E\u043D\u0438 \u0438\u0434\u0443\u0442 \u0432 btn-neutral, \u0447\u0442\u043E\u0431\u044B \u0447\u0438\u0442\u0430\u0442\u044C\u0441\u044F \u043D\u0430 \u043B\u044E\u0431\u043E\u043C \u0444\u043E\u043D\u0435. */
  .dumb-lightbox { border: 0; padding: 0; max-width: 100vw; max-height: 100vh;
                   width: 100vw; height: 100vh; background: transparent; overflow: hidden }
  .dumb-lightbox::backdrop { background: rgb(0 0 0 / .82) }
  .dumb-lightbox-stage { position: absolute; inset: 0; display: grid; place-items: center;
                         overflow: hidden; touch-action: none; cursor: grab }
  .dumb-lightbox-stage[data-drag="1"] { cursor: grabbing }
  .dumb-lightbox-img { max-width: 92vw; max-height: 84vh; display: block;
                       will-change: transform; user-select: none; -webkit-user-drag: none }
  .dumb-lightbox[data-animate="1"] .dumb-lightbox-img { transition: transform .12s ease-out }
  .dumb-lightbox-stage[data-drag="1"] .dumb-lightbox-img { transition: none }

  /* \u043F\u0430\u043D\u0435\u043B\u0438 \u043F\u043E\u0432\u0435\u0440\u0445 \u043A\u0430\u0440\u0442\u0438\u043D\u043A\u0438: \u043F\u043E\u0434\u043B\u043E\u0436\u043A\u0430-\u0433\u0440\u0430\u0434\u0438\u0435\u043D\u0442, \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u0434\u043F\u0438\u0441\u0438 \u0447\u0438\u0442\u0430\u043B\u0438\u0441\u044C */
  .dumb-lightbox-bar { position: absolute; left: 0; right: 0 }
  .dumb-lightbox-bar[data-at="top"] { top: 0;
    background: linear-gradient(rgb(0 0 0 / .55), transparent) }
  .dumb-lightbox-bar[data-at="bottom"] { bottom: 0;
    background: linear-gradient(transparent, rgb(0 0 0 / .55)) }
  .dumb-lightbox-nav { position: absolute; top: 50%; transform: translateY(-50%) }
  .dumb-lightbox-nav[data-side="prev"] { left: 12px }
  .dumb-lightbox-nav[data-side="next"] { right: 12px }
`;
function DumbLightbox(props) {
  injectStyle("lightbox", STYLES);
  let dialog;
  const [zoom, setZoom] = createSignal(1);
  const [pan, setPan] = createSignal({ x: 0, y: 0 });
  const [dragging, setDragging] = createSignal(false);
  const at = () => props.index();
  const item = createMemo(() => {
    const i = at();
    return i === null ? null : props.items[i] ?? null;
  });
  const go = (delta) => {
    const i = at();
    if (i === null || !props.items.length) return;
    const next = (i + delta + props.items.length) % props.items.length;
    reset();
    props.onIndexChange(next);
  };
  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const close = () => {
    reset();
    props.onIndexChange(null);
  };
  createEffect2(() => {
    const open = at() !== null;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });
  createEffect2(() => {
    const i = at();
    if (i === null) return;
    for (const d of [1, -1]) {
      const near = props.items[(i + d + props.items.length) % props.items.length];
      if (near?.url) new Image().src = near.url;
    }
  });
  function onKey(ev) {
    if (at() === null) return;
    if (ev.key === "ArrowRight") return void (ev.preventDefault(), go(1));
    if (ev.key === "ArrowLeft") return void (ev.preventDefault(), go(-1));
    if (ev.key === "0") return reset();
    if (ev.key === "+" || ev.key === "=") return setZoom((z) => Math.min(8, z * 1.25));
    if (ev.key === "-") return setZoom((z) => Math.max(1, z / 1.25));
  }
  createEffect2(() => {
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });
  function onWheel(ev) {
    ev.preventDefault();
    const k = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
    setZoom((z) => {
      const next = Math.min(8, Math.max(1, z * k));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }
  let from = null;
  function onDown(ev) {
    if (zoom() === 1) return;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    from = { x: ev.clientX, y: ev.clientY, ...{ px: pan().x, py: pan().y } };
    setDragging(true);
  }
  function onMove(ev) {
    if (!from) return;
    setPan({ x: from.px + (ev.clientX - from.x), y: from.py + (ev.clientY - from.y) });
  }
  function onUp() {
    from = null;
    setDragging(false);
  }
  return <dialog
    ref={dialog}
    class={`dumb-lightbox ${props.class ?? ""}`}
    data-animate={shouldAnimate(props.animate) ? "1" : void 0}
    onClose={() => at() !== null && close()}
    onCancel={(ev) => {
      ev.preventDefault();
      close();
    }}
  >
      <Show when={item()}>
        {(cur) => <>
            <div
    class="dumb-lightbox-stage"
    data-drag={dragging() ? "1" : void 0}
    onWheel={onWheel}
    onPointerDown={onDown}
    onPointerMove={onMove}
    onPointerUp={onUp}
    onPointerCancel={onUp}
    onClick={(ev) => ev.target === ev.currentTarget && close()}
  >
              <img
    class="dumb-lightbox-img"
    src={cur().url}
    alt={cur().title ?? ""}
    draggable={false}
    style={{
      transform: `translate(${pan().x}px, ${pan().y}px) scale(${zoom()})`
    }}
    onDblClick={() => zoom() === 1 ? setZoom(2.5) : reset()}
  />
            </div>

            <div
    class="dumb-lightbox-bar flex items-center gap-3 p-3 text-sm text-white"
    data-at="top"
  >
              <span class="dumb-lightbox-title min-w-0 flex-1 truncate">{cur().title}</span>
              <Show when={props.items.length > 1}>
                <span class="dumb-lightbox-count tabular-nums">
                  {(at() ?? 0) + 1} / {props.items.length}
                </span>
              </Show>
              <Show when={zoom() !== 1}>
                <button type="button" class="btn btn-sm btn-neutral" onClick={reset}>
                  1:1
                </button>
              </Show>
              <button
    type="button"
    class="btn btn-sm btn-circle btn-neutral"
    title="закрыть (Esc)"
    onClick={close}
  >
                ✕
              </button>
            </div>

            <Show when={props.items.length > 1}>
              <button
    type="button"
    class="dumb-lightbox-nav btn btn-circle btn-neutral text-xl"
    data-side="prev"
    title="предыдущая (←)"
    onClick={() => go(-1)}
  >
                ‹
              </button>
              <button
    type="button"
    class="dumb-lightbox-nav btn btn-circle btn-neutral text-xl"
    data-side="next"
    title="следующая (→)"
    onClick={() => go(1)}
  >
                ›
              </button>
            </Show>

            <Show when={props.actions}>
              <div
    class="dumb-lightbox-bar flex items-center justify-center gap-3 p-3 text-sm text-white"
    data-at="bottom"
  >
                {props.actions(cur(), at() ?? 0)}
              </div>
            </Show>
          </>}
      </Show>
    </dialog>;
}
export {
  DumbLightbox
};
