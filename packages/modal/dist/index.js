import { delegateEvents, use, insert, createComponent, effect as effect$1, className, setAttribute, style, memo, template } from 'solid-js/web';
import * as solid from 'solid-js';
import { onCleanup, Show, createSignal, For, createEffect, untrack } from 'solid-js';

// src/DumbModal.tsx
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

// src/DumbModal.tsx
var _tmpl$ = /* @__PURE__ */ template(`<button type=button class="dumb-modal-x btn btn-sm btn-circle btn-ghost"title=\u0437\u0430\u043A\u0440\u044B\u0442\u044C>\u2715`);
var _tmpl$2 = /* @__PURE__ */ template(`<div class="dumb-modal-head mb-3 flex items-center gap-3"><div class="dumb-modal-title flex-1 text-lg font-semibold">`);
var _tmpl$3 = /* @__PURE__ */ template(`<div class="dumb-modal-foot modal-action">`);
var _tmpl$4 = /* @__PURE__ */ template(`<dialog><div class="dumb-modal-box modal-box"><div class=dumb-modal-body>`);
var STYLES = `
  /* \u0422\u043E\u043B\u044C\u043A\u043E \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430 \u0438 \u043C\u0435\u0445\u0430\u043D\u0438\u043A\u0430. \u0412\u0438\u0434 \u043E\u043A\u043D\u0430 \u2014 daisyUI (\u043A\u043B\u0430\u0441\u0441\u044B modal \u0438 modal-box \u0432
     \u0440\u0430\u0437\u043C\u0435\u0442\u043A\u0435), \u043F\u043E\u044D\u0442\u043E\u043C\u0443 \u0437\u0434\u0435\u0441\u044C \u043D\u0438 \u0446\u0432\u0435\u0442\u043E\u0432, \u043D\u0438 \u0441\u043A\u0440\u0443\u0433\u043B\u0435\u043D\u0438\u0439, \u043D\u0438 \u0442\u0435\u043D\u0435\u0439.

     \u0412\u0410\u0416\u041D\u041E: \u043A\u043B\u0430\u0441\u0441 modal \u043D\u0430 \u0441\u0430\u043C\u043E\u043C dialog \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u0435\u043D. \u0423 daisyUI 5 modal-box \u043B\u0435\u0436\u0438\u0442
     \u041F\u0420\u041E\u0417\u0420\u0410\u0427\u041D\u042B\u041C (opacity: 0; scale: .95), \u0430 \u0432\u0438\u0434\u0438\u043C\u044B\u043C \u0435\u0433\u043E \u0434\u0435\u043B\u0430\u0435\u0442 \u043F\u0440\u0430\u0432\u0438\u043B\u043E \u0432\u0438\u0434\u0430
     .modal:is([open], .modal-open) > .modal-box. \u0411\u0435\u0437 modal \u043D\u0430 \u0440\u043E\u0434\u0438\u0442\u0435\u043B\u0435 \u043E\u043A\u043D\u043E
     \u0447\u0435\u0441\u0442\u043D\u043E \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u2014 dialog.open === true, \u044D\u043B\u0435\u043C\u0435\u043D\u0442 \u0432 top layer, \u0440\u0430\u0437\u043C\u0435\u0440\u044B
     \u0435\u0441\u0442\u044C, \u2014 \u0438 \u043F\u0440\u0438 \u044D\u0442\u043E\u043C \u0435\u0433\u043E \u043D\u0435 \u0432\u0438\u0434\u043D\u043E \u0412\u041E\u041E\u0411\u0429\u0415. \u041E\u0434\u0438\u043D \u043A\u043B\u0430\u0441\u0441, \u043F\u043E\u043B\u0447\u0430\u0441\u0430 \u043F\u043E\u0438\u0441\u043A\u043E\u0432. */
  .dumb-modal .dumb-modal-box { width: var(--dumb-modal-w, min(560px, 92vw));
                                max-width: min(100vw, var(--dumb-modal-w, 560px)) }
  /* \u043F\u043E\u044F\u0432\u043B\u0435\u043D\u0438\u0435 \u0440\u0438\u0441\u0443\u0435\u0442 daisyUI (scale + opacity \u0443 modal-box); \u043D\u0430\u0448\u0435 \u0434\u0435\u043B\u043E \u2014 \u0443\u043C\u0435\u0442\u044C
     \u0435\u0433\u043E \u0432\u044B\u043A\u043B\u044E\u0447\u0438\u0442\u044C, \u043A\u043E\u0433\u0434\u0430 \u043F\u043E\u0442\u0440\u0435\u0431\u0438\u0442\u0435\u043B\u044C \u043F\u043E\u043F\u0440\u043E\u0441\u0438\u043B \u0438\u043B\u0438 \u043A\u043E\u0433\u0434\u0430 \u043F\u0440\u043E\u0441\u0438\u0442 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 */
  .dumb-modal[data-animate="0"] .dumb-modal-box { transition: none }
  @media (prefers-reduced-motion: reduce) { .dumb-modal .dumb-modal-box { transition: none } }

  /* \u043F\u0440\u043E\u043A\u0440\u0443\u0447\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u0422\u0415\u041B\u041E, \u0430 \u043D\u0435 \u043E\u043A\u043D\u043E \u0446\u0435\u043B\u0438\u043A\u043E\u043C: \u0448\u0430\u043F\u043A\u0430 \u0438 \u043A\u043D\u043E\u043F\u043A\u0438 \u0434\u043E\u043B\u0436\u043D\u044B \u043E\u0441\u0442\u0430\u0442\u044C\u0441\u044F \u043D\u0430
     \u0432\u0438\u0434\u0443, \u043A\u043E\u0433\u0434\u0430 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u0433\u043E \u043C\u043D\u043E\u0433\u043E */
  .dumb-modal-body { max-height: 70vh; overflow: auto; overscroll-behavior: contain }
`;
function DumbModal(props) {
  injectStyle("modal", STYLES);
  let dialog;
  let returnTo = null;
  const side = () => resolveCloseSide(props.closeSide);
  const closeButton = () => (() => {
    var _el$ = _tmpl$();
    _el$.$$click = () => void tryClose();
    return _el$;
  })();
  async function tryClose() {
    if (props.onBeforeClose) {
      const ok = await props.onBeforeClose();
      if (!ok) return;
    }
    props.onClose();
  }
  effect(() => {
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
    var _el$2 = _tmpl$4(), _el$3 = _el$2.firstChild, _el$6 = _el$3.firstChild;
    _el$2.$$click = (ev) => {
      if (props.keepOnBackdrop) return;
      if (ev.target === ev.currentTarget) void tryClose();
    };
    _el$2.addEventListener("cancel", (ev) => {
      ev.preventDefault();
      if (!props.keepOnEsc) void tryClose();
    });
    var _ref$ = dialog;
    typeof _ref$ === "function" ? use(_ref$, _el$2) : dialog = _el$2;
    insert(_el$3, createComponent(Show, {
      get when() {
        return props.title;
      },
      get children() {
        var _el$4 = _tmpl$2(), _el$5 = _el$4.firstChild;
        insert(_el$4, createComponent(Show, {
          get when() {
            return side() === "left";
          },
          get children() {
            return closeButton();
          }
        }), _el$5);
        insert(_el$5, () => props.title);
        insert(_el$4, createComponent(Show, {
          get when() {
            return side() === "right";
          },
          get children() {
            return closeButton();
          }
        }), null);
        return _el$4;
      }
    }), _el$6);
    insert(_el$6, () => props.children);
    insert(_el$3, createComponent(Show, {
      get when() {
        return props.footer;
      },
      get children() {
        var _el$7 = _tmpl$3();
        insert(_el$7, () => props.footer);
        return _el$7;
      }
    }), null);
    effect$1((_p$) => {
      var _v$ = `dumb-modal modal ${props.class ?? ""}`, _v$2 = shouldAnimate(props.animate) ? "1" : "0", _v$3 = {
        ...props.width ? {
          "--dumb-modal-w": props.width
        } : {},
        ...props.style
      };
      _v$ !== _p$.e && className(_el$2, _p$.e = _v$);
      _v$2 !== _p$.t && setAttribute(_el$2, "data-animate", _p$.t = _v$2);
      _p$.a = style(_el$2, _v$3, _p$.a);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0
    });
    return _el$2;
  })();
}
delegateEvents(["click"]);

// src/modalBus.ts
function createModalBus() {
  let queue = [];
  let seq = 0;
  const subs = /* @__PURE__ */ new Set();
  const emit = () => subs.forEach((f) => f());
  function push(q) {
    const id = ++seq;
    queue = [...queue, { ...q, id }];
    emit();
    return id;
  }
  function finish(id, value) {
    const q = queue.find((x) => x.id === id);
    if (!q) return;
    queue = queue.filter((x) => x.id !== id);
    q.done(value);
    emit();
  }
  const bus = {
    current: () => queue[0] ?? null,
    pending: () => Math.max(0, queue.length - 1),
    ask(text, actions, opts) {
      return new Promise((done2) => {
        push({
          title: opts?.title,
          text,
          actions,
          width: opts?.width,
          dismissible: opts?.dismissible ?? true,
          dismiss: opts?.dismiss,
          done: done2
        });
      });
    },
    confirm(text, opts) {
      return bus.ask(
        text,
        [
          { label: opts?.no ?? "\u041E\u0442\u043C\u0435\u043D\u0430", value: false },
          {
            label: opts?.yes ?? "\u0414\u0430",
            value: true,
            kind: opts?.danger ? "danger" : "primary"
          }
        ],
        { ...opts, dismiss: false }
      );
    },
    alert(text, opts) {
      return bus.ask(text, [{ label: opts?.ok ?? "\u041F\u043E\u043D\u044F\u0442\u043D\u043E", value: void 0, kind: "primary" }], opts).then(() => void 0);
    },
    answer: (id, value) => finish(id, value),
    dismiss(id) {
      const q = queue.find((x) => x.id === id);
      if (q) finish(id, q.dismiss);
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    }
  };
  return bus;
}
var modal = createModalBus();

// src/DumbModalHost.tsx
var _tmpl$5 = /* @__PURE__ */ template(`<p class="dumb-modal-ask text-sm">`);
var _tmpl$22 = /* @__PURE__ */ template(`<div class="flex flex-wrap justify-end gap-2">`);
var _tmpl$32 = /* @__PURE__ */ template(`<button type=button>`);
var actionClass = (kind) => kind === "primary" ? "btn btn-sm btn-neutral" : kind === "danger" ? "btn btn-sm btn-error" : "btn btn-sm";
function DumbModalHost(props) {
  const bus = () => props.bus ?? modal;
  const [tick, bump] = createSignal(0, {
    equals: false
  });
  onMounted(() => {
    const off = bus().subscribe(() => bump(0));
    onCleanup(off);
  });
  const cur = () => (tick(), bus().current());
  const ask = () => cur();
  const answer = (value) => {
    const q = ask();
    if (q) bus().answer(q.id, value);
  };
  return createComponent(DumbModal, {
    open: () => ask() !== null,
    onClose: () => {
      const q = ask();
      if (q) bus().dismiss(q.id);
    },
    get title() {
      return ask()?.title;
    },
    get width() {
      return ask()?.width;
    },
    get keepOnEsc() {
      return memo(() => !!ask())() ? !ask().dismissible : false;
    },
    get keepOnBackdrop() {
      return memo(() => !!ask())() ? !ask().dismissible : false;
    },
    get ["class"]() {
      return props.class;
    },
    get footer() {
      return (() => {
        var _el$2 = _tmpl$22();
        insert(_el$2, createComponent(For, {
          get each() {
            return ask()?.actions ?? [];
          },
          children: (a) => (() => {
            var _el$3 = _tmpl$32();
            _el$3.$$click = () => answer(a.value);
            insert(_el$3, () => a.label);
            effect$1((_p$) => {
              var _v$ = actionClass(a.kind), _v$2 = a.kind;
              _v$ !== _p$.e && className(_el$3, _p$.e = _v$);
              _v$2 !== _p$.t && setAttribute(_el$3, "data-kind", _p$.t = _v$2);
              return _p$;
            }, {
              e: void 0,
              t: void 0
            });
            return _el$3;
          })()
        }));
        return _el$2;
      })();
    },
    get children() {
      var _el$ = _tmpl$5();
      insert(_el$, () => ask()?.text);
      return _el$;
    }
  });
}
delegateEvents(["click"]);

export { DumbModal, DumbModalHost, createModalBus, modal };
