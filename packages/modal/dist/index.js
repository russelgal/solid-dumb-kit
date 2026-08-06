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

// src/DumbModal.tsx
var _tmpl$ = /* @__PURE__ */ template(`<div class="dumb-modal-head mb-3 flex items-center gap-3"><div class="dumb-modal-title flex-1 text-lg font-semibold"></div><button type=button class="dumb-modal-x btn btn-sm btn-circle btn-ghost"title=\u0437\u0430\u043A\u0440\u044B\u0442\u044C>\u2715`);
var _tmpl$2 = /* @__PURE__ */ template(`<div class="dumb-modal-foot modal-action">`);
var _tmpl$3 = /* @__PURE__ */ template(`<dialog><div class="dumb-modal-box modal-box w-full max-w-none"><div class=dumb-modal-body>`);
var STYLES = `
  /* \u0422\u043E\u043B\u044C\u043A\u043E \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430 \u0438 \u043C\u0435\u0445\u0430\u043D\u0438\u043A\u0430. \u0412\u0438\u0434 \u043E\u043A\u043D\u0430 \u2014 daisyUI (modal-box), \u043F\u043E\u044D\u0442\u043E\u043C\u0443 \u0437\u0434\u0435\u0441\u044C
     \u043D\u0438 \u0446\u0432\u0435\u0442\u043E\u0432, \u043D\u0438 \u0441\u043A\u0440\u0443\u0433\u043B\u0435\u043D\u0438\u0439, \u043D\u0438 \u0442\u0435\u043D\u0435\u0439: \u0438\u0445 \u0437\u0430\u0434\u0430\u0451\u0442 \u0442\u0435\u043C\u0430 \u043F\u043E\u0442\u0440\u0435\u0431\u0438\u0442\u0435\u043B\u044F. */
  .dumb-modal { border: 0; padding: 0; max-width: 100vw; max-height: 100vh;
                width: var(--dumb-modal-w, min(560px, 92vw));
                background: none; overflow: visible }
  .dumb-modal[data-animate="1"] { animation: dumb-modal-in .14s ease-out }
  .dumb-modal[data-animate="1"]::backdrop { animation: dumb-modal-fade .14s ease-out }
  @keyframes dumb-modal-in { from { opacity: 0; transform: translateY(8px) scale(.985) } }
  @keyframes dumb-modal-fade { from { opacity: 0 } }
  @media (prefers-reduced-motion: reduce) {
    .dumb-modal[data-animate="1"], .dumb-modal[data-animate="1"]::backdrop { animation: none }
  }

  /* \u043F\u0440\u043E\u043A\u0440\u0443\u0447\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u0422\u0415\u041B\u041E, \u0430 \u043D\u0435 \u043E\u043A\u043D\u043E \u0446\u0435\u043B\u0438\u043A\u043E\u043C: \u0448\u0430\u043F\u043A\u0430 \u0438 \u043A\u043D\u043E\u043F\u043A\u0438 \u0434\u043E\u043B\u0436\u043D\u044B \u043E\u0441\u0442\u0430\u0442\u044C\u0441\u044F \u043D\u0430
     \u0432\u0438\u0434\u0443, \u043A\u043E\u0433\u0434\u0430 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u0433\u043E \u043C\u043D\u043E\u0433\u043E */
  .dumb-modal-body { max-height: 70vh; overflow: auto; overscroll-behavior: contain }
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
    var _el$ = _tmpl$3(), _el$2 = _el$.firstChild, _el$6 = _el$2.firstChild;
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
    insert(_el$2, createComponent(Show, {
      get when() {
        return props.title;
      },
      get children() {
        var _el$3 = _tmpl$(), _el$4 = _el$3.firstChild, _el$5 = _el$4.nextSibling;
        insert(_el$4, () => props.title);
        _el$5.$$click = () => void tryClose();
        return _el$3;
      }
    }), _el$6);
    insert(_el$6, () => props.children);
    insert(_el$2, createComponent(Show, {
      get when() {
        return props.footer;
      },
      get children() {
        var _el$7 = _tmpl$2();
        insert(_el$7, () => props.footer);
        return _el$7;
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
