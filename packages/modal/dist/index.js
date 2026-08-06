import { delegateEvents, use, insert, createComponent, effect, className, setAttribute, style, template } from 'solid-js/web';
import { createEffect, onCleanup, Show } from 'solid-js';

// src/DumbModal.tsx
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
var _tmpl$ = /* @__PURE__ */ template(`<div class=dumb-modal-head><div class=dumb-modal-title></div><button type=button class=dumb-modal-x title=\u0437\u0430\u043A\u0440\u044B\u0442\u044C>\u2715`);
var _tmpl$2 = /* @__PURE__ */ template(`<div class=dumb-modal-foot>`);
var _tmpl$3 = /* @__PURE__ */ template(`<dialog><div class=dumb-modal-body>`);
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
  return (() => {
    var _el$ = _tmpl$3(), _el$5 = _el$.firstChild;
    _el$.$$click = (ev) => {
      if (props.keepOnBackdrop) return;
      if (ev.target === ev.currentTarget) void tryClose();
    };
    _el$.addEventListener("cancel", (ev) => {
      ev.preventDefault();
      if (!props.keepOnEsc) void tryClose();
    });
    var _ref$ = dialog;
    typeof _ref$ === "function" ? use(_ref$, _el$) : dialog = _el$;
    insert(_el$, createComponent(Show, {
      get when() {
        return props.title;
      },
      get children() {
        var _el$2 = _tmpl$(), _el$3 = _el$2.firstChild, _el$4 = _el$3.nextSibling;
        insert(_el$3, () => props.title);
        _el$4.$$click = () => void tryClose();
        return _el$2;
      }
    }), _el$5);
    insert(_el$5, () => props.children);
    insert(_el$, createComponent(Show, {
      get when() {
        return props.footer;
      },
      get children() {
        var _el$6 = _tmpl$2();
        insert(_el$6, () => props.footer);
        return _el$6;
      }
    }), null);
    effect((_p$) => {
      var _v$ = `dumb-modal ${props.class ?? ""}`, _v$2 = shouldAnimate(props.animate) ? "1" : void 0, _v$3 = {
        ...props.width ? {
          "--dumb-modal-w": props.width
        } : {},
        ...props.style
      };
      _v$ !== _p$.e && className(_el$, _p$.e = _v$);
      _v$2 !== _p$.t && setAttribute(_el$, "data-animate", _p$.t = _v$2);
      _p$.a = style(_el$, _v$3, _p$.a);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0
    });
    return _el$;
  })();
}
delegateEvents(["click"]);

export { DumbModal };
