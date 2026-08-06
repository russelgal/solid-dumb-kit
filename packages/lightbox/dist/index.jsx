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
  if (document.querySelector(`style[data-dumb-kit="${id}"]`)) return;
  const el = document.createElement("style");
  el.setAttribute("data-dumb-kit", id);
  el.textContent = css;
  document.head.appendChild(el);
}

// src/DumbLightbox.tsx
var CSS = `
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

  .dumb-lightbox-bar { position: absolute; left: 0; right: 0; display: flex; align-items: center;
                       gap: 10px; padding: 12px 16px; color: #f8fafc; font-size: 13px }
  .dumb-lightbox-bar[data-at="top"] { top: 0;
    background: linear-gradient(rgb(0 0 0 / .55), transparent) }
  .dumb-lightbox-bar[data-at="bottom"] { bottom: 0; justify-content: center;
    background: linear-gradient(transparent, rgb(0 0 0 / .55)) }
  .dumb-lightbox-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis;
                         white-space: nowrap }
  .dumb-lightbox-count { font-variant-numeric: tabular-nums; opacity: .85 }
  .dumb-lightbox button { font: inherit; color: inherit; cursor: pointer; border: 0;
                          border-radius: 8px; padding: 5px 10px;
                          background: rgb(255 255 255 / .16) }
  .dumb-lightbox button:hover { background: rgb(255 255 255 / .3) }
  .dumb-lightbox-nav { position: absolute; top: 50%; transform: translateY(-50%);
                       font-size: 22px; padding: 10px 14px !important }
  .dumb-lightbox-nav[data-side="prev"] { left: 12px }
  .dumb-lightbox-nav[data-side="next"] { right: 12px }
`;
function DumbLightbox(props) {
  injectStyle("lightbox", CSS);
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

            <div class="dumb-lightbox-bar" data-at="top">
              <span class="dumb-lightbox-title">{cur().title}</span>
              <Show when={props.items.length > 1}>
                <span class="dumb-lightbox-count">
                  {(at() ?? 0) + 1} / {props.items.length}
                </span>
              </Show>
              <Show when={zoom() !== 1}>
                <button type="button" onClick={reset}>
                  1:1
                </button>
              </Show>
              <button type="button" title="закрыть (Esc)" onClick={close}>
                ✕
              </button>
            </div>

            <Show when={props.items.length > 1}>
              <button
    type="button"
    class="dumb-lightbox-nav"
    data-side="prev"
    title="предыдущая (←)"
    onClick={() => go(-1)}
  >
                ‹
              </button>
              <button
    type="button"
    class="dumb-lightbox-nav"
    data-side="next"
    title="следующая (→)"
    onClick={() => go(1)}
  >
                ›
              </button>
            </Show>

            <Show when={props.actions}>
              <div class="dumb-lightbox-bar" data-at="bottom">
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
