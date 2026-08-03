import { delegateEvents, use, insert, createComponent, setAttribute, effect, setStyleProperty, className, template } from 'solid-js/web';
import { createSignal, createMemo, createEffect, onCleanup, Show } from 'solid-js';

// src/DumbLightbox.tsx

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

// src/DumbLightbox.tsx
var _tmpl$ = /* @__PURE__ */ template(`<dialog>`);
var _tmpl$2 = /* @__PURE__ */ template(`<div class=dumb-lightbox-stage><img class=dumb-lightbox-img>`);
var _tmpl$3 = /* @__PURE__ */ template(`<span class=dumb-lightbox-count> / `);
var _tmpl$4 = /* @__PURE__ */ template(`<button type=button>1:1`);
var _tmpl$5 = /* @__PURE__ */ template(`<div class=dumb-lightbox-bar data-at=top><span class=dumb-lightbox-title></span><button type=button title="\u0437\u0430\u043A\u0440\u044B\u0442\u044C (Esc)">\u2715`);
var _tmpl$6 = /* @__PURE__ */ template(`<button type=button class=dumb-lightbox-nav data-side=prev title="\u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0430\u044F (\u2190)">\u2039`);
var _tmpl$7 = /* @__PURE__ */ template(`<button type=button class=dumb-lightbox-nav data-side=next title="\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0430\u044F (\u2192)">\u203A`);
var _tmpl$8 = /* @__PURE__ */ template(`<div class=dumb-lightbox-bar data-at=bottom>`);
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
  const [pan, setPan] = createSignal({
    x: 0,
    y: 0
  });
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
    setPan({
      x: 0,
      y: 0
    });
  };
  const close = () => {
    reset();
    props.onIndexChange(null);
  };
  createEffect(() => {
    const open = at() !== null;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });
  createEffect(() => {
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
  createEffect(() => {
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });
  function onWheel(ev) {
    ev.preventDefault();
    const k = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
    setZoom((z) => {
      const next = Math.min(8, Math.max(1, z * k));
      if (next === 1) setPan({
        x: 0,
        y: 0
      });
      return next;
    });
  }
  let from = null;
  function onDown(ev) {
    if (zoom() === 1) return;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    from = {
      x: ev.clientX,
      y: ev.clientY,
      ...{
        px: pan().x,
        py: pan().y
      }
    };
    setDragging(true);
  }
  function onMove(ev) {
    if (!from) return;
    setPan({
      x: from.px + (ev.clientX - from.x),
      y: from.py + (ev.clientY - from.y)
    });
  }
  function onUp() {
    from = null;
    setDragging(false);
  }
  return (() => {
    var _el$ = _tmpl$();
    _el$.addEventListener("cancel", (ev) => {
      ev.preventDefault();
      close();
    });
    _el$.addEventListener("close", () => at() !== null && close());
    var _ref$ = dialog;
    typeof _ref$ === "function" ? use(_ref$, _el$) : dialog = _el$;
    insert(_el$, createComponent(Show, {
      get when() {
        return item();
      },
      children: (cur) => [(() => {
        var _el$2 = _tmpl$2(), _el$3 = _el$2.firstChild;
        _el$2.$$click = (ev) => ev.target === ev.currentTarget && close();
        _el$2.addEventListener("pointercancel", onUp);
        _el$2.$$pointerup = onUp;
        _el$2.$$pointermove = onMove;
        _el$2.$$pointerdown = onDown;
        _el$2.addEventListener("wheel", onWheel);
        _el$3.$$dblclick = () => zoom() === 1 ? setZoom(2.5) : reset();
        setAttribute(_el$3, "draggable", false);
        effect((_p$) => {
          var _v$3 = dragging() ? "1" : void 0, _v$4 = cur().url, _v$5 = cur().title ?? "", _v$6 = `translate(${pan().x}px, ${pan().y}px) scale(${zoom()})`;
          _v$3 !== _p$.e && setAttribute(_el$2, "data-drag", _p$.e = _v$3);
          _v$4 !== _p$.t && setAttribute(_el$3, "src", _p$.t = _v$4);
          _v$5 !== _p$.a && setAttribute(_el$3, "alt", _p$.a = _v$5);
          _v$6 !== _p$.o && setStyleProperty(_el$3, "transform", _p$.o = _v$6);
          return _p$;
        }, {
          e: void 0,
          t: void 0,
          a: void 0,
          o: void 0
        });
        return _el$2;
      })(), (() => {
        var _el$4 = _tmpl$5(), _el$5 = _el$4.firstChild, _el$9 = _el$5.nextSibling;
        insert(_el$5, () => cur().title);
        insert(_el$4, createComponent(Show, {
          get when() {
            return props.items.length > 1;
          },
          get children() {
            var _el$6 = _tmpl$3(), _el$7 = _el$6.firstChild;
            insert(_el$6, () => (at() ?? 0) + 1, _el$7);
            insert(_el$6, () => props.items.length, null);
            return _el$6;
          }
        }), _el$9);
        insert(_el$4, createComponent(Show, {
          get when() {
            return zoom() !== 1;
          },
          get children() {
            var _el$8 = _tmpl$4();
            _el$8.$$click = reset;
            return _el$8;
          }
        }), _el$9);
        _el$9.$$click = close;
        return _el$4;
      })(), createComponent(Show, {
        get when() {
          return props.items.length > 1;
        },
        get children() {
          return [(() => {
            var _el$0 = _tmpl$6();
            _el$0.$$click = () => go(-1);
            return _el$0;
          })(), (() => {
            var _el$1 = _tmpl$7();
            _el$1.$$click = () => go(1);
            return _el$1;
          })()];
        }
      }), createComponent(Show, {
        get when() {
          return props.actions;
        },
        get children() {
          var _el$10 = _tmpl$8();
          insert(_el$10, () => props.actions(cur(), at() ?? 0));
          return _el$10;
        }
      })]
    }));
    effect((_p$) => {
      var _v$ = `dumb-lightbox ${props.class ?? ""}`, _v$2 = shouldAnimate(props.animate) ? "1" : void 0;
      _v$ !== _p$.e && className(_el$, _p$.e = _v$);
      _v$2 !== _p$.t && setAttribute(_el$, "data-animate", _p$.t = _v$2);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$;
  })();
}
delegateEvents(["pointerdown", "pointermove", "pointerup", "click", "dblclick"]);

export { DumbLightbox };
