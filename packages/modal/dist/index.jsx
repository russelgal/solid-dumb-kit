// src/DumbModal.tsx
import { Show, createEffect, onCleanup } from "solid-js";

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

// src/DumbModal.tsx
var STYLES = `
  .dumb-modal { border: 0; padding: 0; max-width: 100vw; max-height: 100vh;
                width: var(--dumb-modal-w, min(560px, 92vw));
                border-radius: 14px; overflow: visible;
                color: var(--dumb-modal-fg, #0f172a);
                background: var(--dumb-modal-bg, #fff);
                box-shadow: 0 24px 60px rgb(0 0 0 / .28) }
  .dumb-modal::backdrop { background: rgb(15 23 42 / .55) }
  .dumb-modal[data-animate="1"] { animation: dumb-modal-in .14s ease-out }
  .dumb-modal[data-animate="1"]::backdrop { animation: dumb-modal-fade .14s ease-out }
  @keyframes dumb-modal-in { from { opacity: 0; transform: translateY(8px) scale(.985) } }
  @keyframes dumb-modal-fade { from { opacity: 0 } }
  @media (prefers-reduced-motion: reduce) {
    .dumb-modal[data-animate="1"], .dumb-modal[data-animate="1"]::backdrop { animation: none }
  }

  .dumb-modal-head { display: flex; align-items: center; gap: 10px;
                     padding: 14px 16px 10px; font-size: 15px; font-weight: 600 }
  .dumb-modal-title { flex: 1; min-width: 0 }
  .dumb-modal-x { flex: none; width: 28px; height: 28px; padding: 0; border: 0;
                  border-radius: 8px; cursor: pointer; font: inherit; font-size: 15px;
                  background: none; color: var(--dumb-modal-dim, #475569) }
  .dumb-modal-x:hover { background: var(--dumb-modal-hover, rgb(0 0 0 / .07)) }
  .dumb-modal-body { padding: 4px 16px 16px; max-height: 70vh; overflow: auto;
                     overscroll-behavior: contain }
  .dumb-modal-foot { display: flex; justify-content: flex-end; align-items: center; gap: 8px;
                     padding: 12px 16px; border-top: 1px solid var(--dumb-modal-line, rgb(0 0 0 / .1)) }
`;
function DumbModal(props) {
  injectStyle("modal", STYLES);
  let dialog;
  let returnTo = null;
  async function tryClose() {
    if (props.onBeforeClose) {
      const ok = await props.onBeforeClose();
      if (!ok) return;
    }
    props.onClose();
  }
  createEffect(() => {
    const want = props.open();
    if (want && !dialog.open) {
      returnTo = document.activeElement ?? null;
      dialog.showModal();
    }
    if (!want && dialog.open) {
      dialog.close();
      returnTo?.focus?.();
      returnTo = null;
    }
  });
  onCleanup(() => {
    if (dialog?.open) dialog.close();
  });
  return <dialog
    ref={dialog}
    class={`dumb-modal ${props.class ?? ""}`}
    data-animate={shouldAnimate(props.animate) ? "1" : void 0}
    style={{ ...props.width ? { "--dumb-modal-w": props.width } : {}, ...props.style }}
    onCancel={(ev) => {
      ev.preventDefault();
      if (!props.keepOnEsc) void tryClose();
    }}
    onClick={(ev) => {
      if (props.keepOnBackdrop) return;
      if (ev.target === ev.currentTarget) void tryClose();
    }}
  >
      <Show when={props.title}>
        <div class="dumb-modal-head">
          <div class="dumb-modal-title">{props.title}</div>
          <button type="button" class="dumb-modal-x" title="закрыть" onClick={() => void tryClose()}>
            ✕
          </button>
        </div>
      </Show>

      <div class="dumb-modal-body">{props.children}</div>

      <Show when={props.footer}>
        <div class="dumb-modal-foot">{props.footer}</div>
      </Show>
    </dialog>;
}
export {
  DumbModal
};
