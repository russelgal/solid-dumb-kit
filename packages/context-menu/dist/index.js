import { delegateEvents, createComponent, effect, setStyleProperty, use, insert, className, style, setAttribute, template } from 'solid-js/web';
import { createSignal, createEffect, onCleanup, Show, For } from 'solid-js';

// src/DumbContextMenu.tsx
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

// src/DumbContextMenu.tsx
var _tmpl$ = /* @__PURE__ */ template(`<div class=dumb-menu-anchor>`);
var _tmpl$2 = /* @__PURE__ */ template(`<div popover=manual tabindex=-1 role=menu><ul>`);
var _tmpl$3 = /* @__PURE__ */ template(`<span>`);
var _tmpl$4 = /* @__PURE__ */ template(`<span class=dumb-menu-hint>`);
var _tmpl$5 = /* @__PURE__ */ template(`<span class=dumb-menu-more aria-hidden=true>\u25B8`);
var _tmpl$6 = /* @__PURE__ */ template(`<li><button type=button role=menuitem class=dumb-menu-item><span class=dumb-menu-label>`);
var _tmpl$7 = /* @__PURE__ */ template(`<li class=dumb-menu-sep role=separator>`);
var STYLES = `
  /* \u044F\u043A\u043E\u0440\u044C: \u043F\u0438\u043A\u0441\u0435\u043B\u044C \u0432 \u0442\u043E\u0447\u043A\u0435 \u043A\u043B\u0438\u043A\u0430, \u043A \u043D\u0435\u043C\u0443 \u043F\u0440\u0438\u0432\u044F\u0437\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043C\u0435\u043D\u044E */
  .dumb-menu-anchor { position: fixed; width: 1px; height: 1px; pointer-events: none;
                      anchor-name: --dumb-menu-at }
  .dumb-menu { position: fixed; margin: 0; min-width: 190px; padding: 4px;
               border-radius: 10px; font-size: 13px;
               color: var(--dumb-menu-fg, #0f172a);
               background: var(--dumb-menu-bg, #fff);
               border: 1px solid var(--dumb-menu-line, rgb(0 0 0 / .12));
               box-shadow: 0 10px 30px rgb(0 0 0 / .18);
               /* \u0432 top layer: \u043D\u0438 z-index, \u043D\u0438 overflow \u043F\u0440\u0435\u0434\u043A\u043E\u0432 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435 \u0432\u0430\u0436\u043D\u044B */
               overflow: visible;
               /* \u043C\u0435\u0441\u0442\u043E \u0432\u044B\u0431\u0438\u0440\u0430\u0435\u0442 \u0431\u0440\u0430\u0443\u0437\u0435\u0440: \u0433\u0434\u0435 \u043D\u0435 \u0432\u043B\u0435\u0437\u0430\u0435\u0442 \u2014 \u0440\u0430\u0441\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u0432 \u0434\u0440\u0443\u0433\u0443\u044E
                  \u0441\u0442\u043E\u0440\u043E\u043D\u0443. \u041D\u0438 \u043E\u0434\u043D\u043E\u0433\u043E \u0437\u0430\u043C\u0435\u0440\u0430 \u0441 \u043D\u0430\u0448\u0435\u0439 \u0441\u0442\u043E\u0440\u043E\u043D\u044B */
               position-anchor: --dumb-menu-at;
               /* \u043F\u0440\u0438\u0432\u044F\u0437\u043A\u0430 \u0447\u0435\u0440\u0435\u0437 anchor(), \u0430 \u043D\u0435 position-area: \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0432\u0438\u0434\u0430
                  bottom span-inline-end Chrome \u043E\u0442\u0431\u0440\u0430\u0441\u044B\u0432\u0430\u0435\u0442 \u043A\u0430\u043A \u043D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u043E\u0435, \u0438
                  \u043C\u0435\u043D\u044E \u043C\u043E\u043B\u0447\u0430 \u0443\u0435\u0437\u0436\u0430\u0435\u0442 \u0432 \u043B\u0435\u0432\u044B\u0439 \u0432\u0435\u0440\u0445\u043D\u0438\u0439 \u0443\u0433\u043E\u043B */
               top: anchor(--dumb-menu-at bottom);
               left: anchor(--dumb-menu-at right);
               /* \u0443 \u043A\u0440\u0430\u044F \u043E\u043A\u043D\u0430 \u0431\u0440\u0430\u0443\u0437\u0435\u0440 \u0441\u0430\u043C \u043F\u0435\u0440\u0435\u0432\u043E\u0440\u0430\u0447\u0438\u0432\u0430\u0435\u0442: \u0432\u0432\u0435\u0440\u0445 \u0438/\u0438\u043B\u0438 \u0432\u043B\u0435\u0432\u043E */
               position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline }
  .dumb-menu:popover-open { display: block }
  .dumb-menu ul { list-style: none; margin: 0; padding: 0 }
  .dumb-menu-item { display: flex; align-items: center; gap: 8px; width: 100%;
                    padding: 5px 8px; border: 0; border-radius: 6px; background: none;
                    font: inherit; color: inherit; text-align: left; cursor: pointer }
  .dumb-menu-item:hover:not([disabled]),
  .dumb-menu-item[data-active="1"] { background: var(--dumb-menu-hover, rgb(0 0 0 / .07)) }
  .dumb-menu-item[disabled] { opacity: .45; cursor: default }
  .dumb-menu-item[data-danger="1"] { color: var(--dumb-menu-danger, #b91c1c) }
  .dumb-menu-icon { flex: none; width: 1.1em; height: 1.1em }
  .dumb-menu-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis;
                     white-space: nowrap }
  /* \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0430 \u0442\u0443\u0441\u043A\u043B\u0435\u0435 \u0442\u0435\u043A\u0441\u0442\u0430, \u043D\u043E \u0447\u0438\u0442\u0430\u0435\u043C\u043E: \u0441\u0435\u0440\u043E\u043C\u0443 \u043F\u043E \u0441\u0435\u0440\u043E\u043C\u0443 \u0442\u0443\u0442 \u043D\u0435 \u043C\u0435\u0441\u0442\u043E */
  .dumb-menu-hint { flex: none; font-size: .85em; color: var(--dumb-menu-dim, #475569) }
  .dumb-menu-sep { height: 1px; margin: 4px 6px;
                   background: var(--dumb-menu-line, rgb(0 0 0 / .12)) }
  /* \u0441\u0442\u0440\u0435\u043B\u043A\u0430 \u0432\u0435\u0442\u043A\u0438 \u2014 \u043F\u043E\u043B\u043D\u044B\u043C \u0446\u0432\u0435\u0442\u043E\u043C: \u044D\u0442\u043E \u0443\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u044C, \u0430 \u043D\u0435 \u0443\u043A\u0440\u0430\u0448\u0435\u043D\u0438\u0435 */
  .dumb-menu-more { flex: none; font-size: .9em }

  /* \u041F\u043E\u0434\u043C\u0435\u043D\u044E. \u0422\u043E\u0442 \u0436\u0435 popover, \u0442\u043E\u0442 \u0436\u0435 top layer \u2014 \u0437\u043D\u0430\u0447\u0438\u0442 \u0435\u0433\u043E \u0442\u0430\u043A \u0436\u0435 \u043D\u0435 \u0440\u0435\u0436\u0435\u0442 \u043D\u0438
     overflow, \u043D\u0438 clip-path \u043F\u0440\u0435\u0434\u043A\u043E\u0432, \u0438 z-index \u0435\u043C\u0443 \u043D\u0435 \u043D\u0443\u0436\u0435\u043D.

     \u042F\u043A\u043E\u0440\u044C \u0443 \u043D\u0435\u0433\u043E \u0421\u0412\u041E\u0419 \u2014 \u043F\u0438\u043A\u0441\u0435\u043B\u044C \u0432 \u0442\u043E\u0447\u043A\u0435, \u0433\u0434\u0435 \u043A\u0443\u0440\u0441\u043E\u0440 \u0432\u043E\u0448\u0451\u043B \u0432 \u043F\u0443\u043D\u043A\u0442-\u0432\u0435\u0442\u043A\u0443. \u041D\u0435
     \u0441\u0430\u043C\u0430 \u043A\u043D\u043E\u043F\u043A\u0430: \u043E\u043D\u0430 \u043B\u0435\u0436\u0438\u0442 \u0432\u043D\u0443\u0442\u0440\u0438 \u0440\u043E\u0434\u0438\u0442\u0435\u043B\u044C\u0441\u043A\u043E\u0433\u043E popover, \u0430 \u043D\u0430 \u044D\u043B\u0435\u043C\u0435\u043D\u0442 \u0432 top
     layer anchor() \u043D\u0435 \u0440\u0430\u0437\u0440\u0435\u0448\u0430\u0435\u0442\u0441\u044F, \u0438 \u043F\u0430\u043D\u0435\u043B\u044C \u0443\u0435\u0437\u0436\u0430\u0435\u0442 \u0432 \u0441\u0442\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0443\u044E \u043F\u043E\u0437\u0438\u0446\u0438\u044E.
     \u0421\u0442\u043E\u0440\u043E\u043D\u0443, \u043A\u0430\u043A \u0438 \u0443 \u043A\u043E\u0440\u043D\u0435\u0432\u043E\u0433\u043E \u043C\u0435\u043D\u044E, \u0432\u044B\u0431\u0438\u0440\u0430\u0435\u0442 \u0431\u0440\u0430\u0443\u0437\u0435\u0440; \u0437\u0430\u043C\u0435\u0440\u043E\u0432 \u043F\u043E-\u043F\u0440\u0435\u0436\u043D\u0435\u043C\u0443
     \u043D\u043E\u043B\u044C \u2014 \u043A\u043E\u043E\u0440\u0434\u0438\u043D\u0430\u0442\u044B \u0431\u0435\u0440\u0443\u0442\u0441\u044F \u0438\u0437 \u0441\u043E\u0431\u044B\u0442\u0438\u044F, \u0430 \u043D\u0435 \u0438\u0437 \u0440\u0430\u0441\u043A\u043B\u0430\u0434\u043A\u0438. */
  .dumb-menu-sub { top: anchor(top); left: anchor(right);
                   /* \u043D\u0435\u043C\u043D\u043E\u0433\u043E \u0432\u0432\u0435\u0440\u0445, \u0447\u0442\u043E\u0431\u044B \u043F\u0435\u0440\u0432\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430 \u043F\u043E\u0434\u043C\u0435\u043D\u044E \u043E\u043A\u0430\u0437\u0430\u043B\u0430\u0441\u044C \u043D\u0430
                      \u0443\u0440\u043E\u0432\u043D\u0435 \u043F\u0443\u043D\u043A\u0442\u0430, \u0430 \u043D\u0435 \u043F\u043E\u0434 \u043A\u0443\u0440\u0441\u043E\u0440\u043E\u043C */
                   margin-top: -6px; margin-left: 2px;
                   position-try-fallbacks: flip-inline, flip-block, flip-inline flip-block }
`;
function Panel(props) {
  const [active, setActive] = createSignal(-1);
  const [sub, setSub] = createSignal(null);
  let el;
  const subAnchor = `--dumb-sub-${props.depth + 1}`;
  const isItem = (it) => it.kind !== "separator";
  const asItem = (it) => it;
  const branch = (it) => isItem(it) ? (asItem(it).items?.length ?? 0) > 0 : false;
  const pickable = () => props.items.map((it, i) => ({
    it,
    i
  })).filter(({
    it
  }) => isItem(it) && !asItem(it).disabled);
  const highlight = (i, x, y, spread = true) => {
    setActive(i);
    const it = props.items[i];
    if (it && branch(it) && spread) setSub({
      i,
      x,
      y
    });
    else setSub(null);
  };
  createEffect(() => {
    queueMicrotask(() => {
      if (el && !el.matches(":popover-open")) el.showPopover?.();
      if (props.depth === 0) el?.focus();
    });
  });
  onCleanup(() => {
    if (el?.matches(":popover-open")) el.hidePopover();
  });
  createEffect(() => {
    const api = {
      depth: props.depth,
      get el() {
        return el;
      },
      move: (step) => {
        const list = pickable();
        if (!list.length) return;
        const cur = list.findIndex(({
          i: i2
        }) => i2 === active());
        const next = (cur + step + list.length) % list.length;
        const i = list[cur < 0 && step < 0 ? list.length - 1 : next].i;
        highlight(i, props.at.x, props.at.y, false);
      },
      focusItem: (btn) => {
        const rows = Array.from(el?.querySelectorAll(":scope > ul > li") ?? []);
        const i = rows.findIndex((li) => li.contains(btn));
        if (i >= 0 && i !== active()) highlight(i, props.at.x, props.at.y);
      },
      openSub: () => {
        const it = props.items[active()];
        if (!it || !branch(it)) return false;
        setSub({
          i: active(),
          x: props.at.x,
          y: props.at.y
        });
        return true;
      },
      closeSub: () => setSub(null),
      runActive: () => {
        const it = props.items[active()];
        if (!it || !isItem(it) || branch(it) || asItem(it).disabled) return false;
        asItem(it).run?.();
        return true;
      }
    };
    onCleanup(props.register(api));
  });
  const place = () => {
    const anchored = window.CSS?.supports?.("anchor-name: --x");
    if (anchored) return props.anchor ? {
      "position-anchor": props.anchor
    } : {};
    const p = props.at;
    const flipX = p.x > window.innerWidth / 2;
    const flipY = p.y > window.innerHeight / 2;
    return {
      left: flipX ? "auto" : `${p.x}px`,
      right: flipX ? `${window.innerWidth - p.x}px` : "auto",
      top: flipY ? "auto" : `${p.y}px`,
      bottom: flipY ? `${window.innerHeight - p.y}px` : "auto"
    };
  };
  return [createComponent(Show, {
    get when() {
      return props.depth > 0;
    },
    get children() {
      var _el$ = _tmpl$();
      effect((_p$) => {
        var _v$ = `${props.at.x}px`, _v$2 = `${props.at.y}px`, _v$3 = props.anchor;
        _v$ !== _p$.e && setStyleProperty(_el$, "left", _p$.e = _v$);
        _v$2 !== _p$.t && setStyleProperty(_el$, "top", _p$.t = _v$2);
        _v$3 !== _p$.a && setStyleProperty(_el$, "anchor-name", _p$.a = _v$3);
        return _p$;
      }, {
        e: void 0,
        t: void 0,
        a: void 0
      });
      return _el$;
    }
  }), (() => {
    var _el$2 = _tmpl$2(), _el$3 = _el$2.firstChild;
    var _ref$ = el;
    typeof _ref$ === "function" ? use(_ref$, _el$2) : el = _el$2;
    insert(_el$3, createComponent(For, {
      get each() {
        return props.items;
      },
      children: (it, i) => createComponent(Show, {
        get when() {
          return isItem(it);
        },
        get fallback() {
          return _tmpl$7();
        },
        get children() {
          var _el$4 = _tmpl$6(), _el$5 = _el$4.firstChild, _el$7 = _el$5.firstChild;
          _el$5.$$click = (ev) => {
            if (branch(it)) return void highlight(i(), ev.clientX, ev.clientY);
            asItem(it).run?.();
            props.onRun();
          };
          _el$5.addEventListener("mouseenter", (ev) => highlight(i(), ev.clientX, ev.clientY));
          insert(_el$5, createComponent(Show, {
            get when() {
              return asItem(it).icon;
            },
            get children() {
              var _el$6 = _tmpl$3();
              effect(() => className(_el$6, `dumb-menu-icon ${asItem(it).icon}`));
              return _el$6;
            }
          }), _el$7);
          insert(_el$7, () => asItem(it).label);
          insert(_el$5, createComponent(Show, {
            get when() {
              return asItem(it).hint;
            },
            get children() {
              var _el$8 = _tmpl$4();
              insert(_el$8, () => asItem(it).hint);
              return _el$8;
            }
          }), null);
          insert(_el$5, createComponent(Show, {
            get when() {
              return branch(it);
            },
            get children() {
              return _tmpl$5();
            }
          }), null);
          effect((_p$) => {
            var _v$7 = active() === i() ? "1" : void 0, _v$8 = asItem(it).danger ? "1" : void 0, _v$9 = branch(it) ? "1" : void 0, _v$0 = branch(it) ? "menu" : void 0, _v$1 = branch(it) ? sub()?.i === i() ? "true" : "false" : void 0, _v$10 = asItem(it).disabled;
            _v$7 !== _p$.e && setAttribute(_el$5, "data-active", _p$.e = _v$7);
            _v$8 !== _p$.t && setAttribute(_el$5, "data-danger", _p$.t = _v$8);
            _v$9 !== _p$.a && setAttribute(_el$5, "data-sub", _p$.a = _v$9);
            _v$0 !== _p$.o && setAttribute(_el$5, "aria-haspopup", _p$.o = _v$0);
            _v$1 !== _p$.i && setAttribute(_el$5, "aria-expanded", _p$.i = _v$1);
            _v$10 !== _p$.n && (_el$5.disabled = _p$.n = _v$10);
            return _p$;
          }, {
            e: void 0,
            t: void 0,
            a: void 0,
            o: void 0,
            i: void 0,
            n: void 0
          });
          return _el$4;
        }
      })
    }));
    effect((_p$) => {
      var _v$4 = `dumb-menu ${props.depth > 0 ? "dumb-menu-sub" : ""} ${props.class ?? ""}`, _v$5 = place(), _v$6 = props.depth;
      _v$4 !== _p$.e && className(_el$2, _p$.e = _v$4);
      _p$.t = style(_el$2, _v$5, _p$.t);
      _v$6 !== _p$.a && setAttribute(_el$2, "data-depth", _p$.a = _v$6);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0
    });
    return _el$2;
  })(), createComponent(Show, {
    get when() {
      return sub();
    },
    children: (s) => createComponent(Panel, {
      get items() {
        return asItem(props.items[s().i]).items;
      },
      get depth() {
        return props.depth + 1;
      },
      anchor: subAnchor,
      get at() {
        return {
          x: s().x,
          y: s().y
        };
      },
      get onRun() {
        return props.onRun;
      },
      get register() {
        return props.register;
      },
      get ["class"]() {
        return props.class;
      }
    })
  })];
}
function DumbContextMenu(props) {
  injectStyle("menu", STYLES);
  const HOLD = 250;
  const TOL = 6;
  const [at, setAt] = createSignal(null);
  let pressedAt = 0;
  let pressedPoint = {
    x: 0,
    y: 0
  };
  let returnTo = null;
  const stack = [];
  const register = (api) => {
    stack.push(api);
    stack.sort((a, b) => a.depth - b.depth);
    return () => {
      const i = stack.indexOf(api);
      if (i >= 0) stack.splice(i, 1);
    };
  };
  const deepest = () => stack[stack.length - 1];
  const inside = (node) => stack.some((p) => p.el?.contains(node));
  const open = () => at() !== null;
  function close() {
    if (!open()) return;
    setAt(null);
    props.onToggle?.(false);
    returnTo?.focus?.();
    returnTo = null;
  }
  function onContext(ev) {
    if (props.disabled?.()) return;
    const host = props.target?.();
    if (host && !host.contains(ev.target)) return;
    const t = ev.target;
    if (t?.closest('input, textarea, [contenteditable="true"]')) return;
    ev.preventDefault();
    returnTo = document.activeElement ?? null;
    pressedAt = performance.now();
    pressedPoint = {
      x: ev.clientX,
      y: ev.clientY
    };
    setAt({
      x: ev.clientX,
      y: ev.clientY
    });
    props.onToggle?.(true);
  }
  function onKey(ev) {
    if (!open()) return;
    const top = deepest();
    if (!top) return;
    if (ev.key === "Escape") {
      ev.preventDefault();
      if (top.depth > 0) stack[stack.length - 2]?.closeSub();
      else close();
      return;
    }
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      top.move(ev.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (ev.key === "ArrowRight") {
      ev.preventDefault();
      if (top.openSub()) queueMicrotask(() => deepest()?.move(1));
      return;
    }
    if (ev.key === "ArrowLeft") {
      ev.preventDefault();
      if (top.depth > 0) stack[stack.length - 2]?.closeSub();
      return;
    }
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      if (top.runActive()) close();
      else if (top.openSub()) queueMicrotask(() => deepest()?.move(1));
    }
  }
  createEffect(() => {
    window.addEventListener("contextmenu", onContext);
    window.addEventListener("keydown", onKey);
    const away = (ev) => {
      if (open() && !inside(ev.target)) close();
    };
    window.addEventListener("pointerdown", away, true);
    const release = (ev) => {
      if (!open()) return;
      const held = performance.now() - pressedAt;
      const moved = Math.hypot(ev.clientX - pressedPoint.x, ev.clientY - pressedPoint.y);
      if (held < HOLD && moved < TOL) return;
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      const hit = under?.closest(".dumb-menu-item");
      if (hit?.dataset.sub === "1") return;
      if (hit && !hit.disabled) hit.click();
      else close();
    };
    window.addEventListener("pointerup", release, true);
    let hitRaf = 0;
    let hitX = 0, hitY = 0;
    const hitTest = () => {
      hitRaf = 0;
      if (!open()) return;
      const under = document.elementFromPoint(hitX, hitY);
      const hit = under?.closest(".dumb-menu-item");
      if (!hit) return;
      const panel = hit.closest(".dumb-menu");
      stack.find((p) => p.el === panel)?.focusItem(hit);
    };
    const track = (ev) => {
      if (!open() || !ev.buttons) return;
      hitX = ev.clientX;
      hitY = ev.clientY;
      if (!hitRaf) hitRaf = requestAnimationFrame(hitTest);
    };
    window.addEventListener("pointermove", track, true);
    const bail = () => close();
    window.addEventListener("scroll", bail, true);
    window.addEventListener("resize", bail);
    window.addEventListener("blur", bail);
    onCleanup(() => {
      window.removeEventListener("contextmenu", onContext);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", away, true);
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointermove", track, true);
      if (hitRaf) cancelAnimationFrame(hitRaf);
      window.removeEventListener("scroll", bail, true);
      window.removeEventListener("resize", bail);
      window.removeEventListener("blur", bail);
    });
  });
  return createComponent(Show, {
    get when() {
      return at();
    },
    children: (p) => [(() => {
      var _el$1 = _tmpl$();
      effect((_p$) => {
        var _v$11 = `${p().x}px`, _v$12 = `${p().y}px`;
        _v$11 !== _p$.e && setStyleProperty(_el$1, "left", _p$.e = _v$11);
        _v$12 !== _p$.t && setStyleProperty(_el$1, "top", _p$.t = _v$12);
        return _p$;
      }, {
        e: void 0,
        t: void 0
      });
      return _el$1;
    })(), createComponent(Panel, {
      get items() {
        return props.items();
      },
      depth: 0,
      get at() {
        return p();
      },
      onRun: close,
      register,
      get ["class"]() {
        return props.class;
      }
    })]
  });
}
delegateEvents(["click"]);
var _tmpl$8 = /* @__PURE__ */ template(`<div class=dumb-pop-anchor>`);
var _tmpl$22 = /* @__PURE__ */ template(`<div class=dumb-pop-head><div class=dumb-pop-title></div><button type=button class=dumb-pop-x title=\u0437\u0430\u043A\u0440\u044B\u0442\u044C>\u2715`);
var _tmpl$32 = /* @__PURE__ */ template(`<div class=dumb-pop-foot>`);
var _tmpl$42 = /* @__PURE__ */ template(`<div popover=manual><div class=dumb-pop-body>`);
var STYLES2 = `
  .dumb-pop-anchor { position: fixed; width: 1px; height: 1px; pointer-events: none;
                     anchor-name: --dumb-pop-at }
  .dumb-pop { position: fixed; margin: 0; padding: 0; overflow: visible;
              width: var(--dumb-pop-w, min(320px, 92vw));
              border-radius: 12px; font-size: 13px;
              color: var(--dumb-pop-fg, #0f172a);
              background: var(--dumb-pop-bg, #fff);
              border: 1px solid var(--dumb-pop-line, rgb(0 0 0 / .12));
              box-shadow: 0 12px 34px rgb(0 0 0 / .2);
              position-anchor: --dumb-pop-at;
              /* \u043F\u0440\u0438\u0432\u044F\u0437\u043A\u0430 \u0447\u0435\u0440\u0435\u0437 anchor(): position-area \u0441\u043E span-* Chrome
                 \u043E\u0442\u0431\u0440\u0430\u0441\u044B\u0432\u0430\u0435\u0442 \u043A\u0430\u043A \u043D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u043E\u0435, \u0438 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u0443\u0435\u0437\u0436\u0430\u0435\u0442 \u0432 \u0443\u0433\u043E\u043B */
              top: anchor(--dumb-pop-at bottom);
              left: anchor(--dumb-pop-at right);
              position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline }
  .dumb-pop:popover-open { display: block }
  .dumb-pop-head { display: flex; align-items: center; gap: 8px;
                   padding: 9px 12px 4px; font-weight: 600 }
  .dumb-pop-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis;
                    white-space: nowrap }
  .dumb-pop-x { flex: none; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 6px;
                cursor: pointer; font: inherit; background: none;
                color: var(--dumb-pop-dim, #475569) }
  .dumb-pop-x:hover { background: var(--dumb-pop-hover, rgb(0 0 0 / .07)) }
  .dumb-pop-body { padding: 4px 12px 12px }
  .dumb-pop-foot { display: flex; justify-content: flex-end; gap: 6px; padding: 8px 12px;
                   border-top: 1px solid var(--dumb-pop-line, rgb(0 0 0 / .12)) }
`;
function DumbPopover(props) {
  injectStyle("popover", STYLES2);
  let box;
  const close = () => {
    if (box?.matches(":popover-open")) box.hidePopover();
    props.onClose();
  };
  createEffect(() => {
    const open = props.at() !== null;
    if (!open) {
      if (box?.matches(":popover-open")) box.hidePopover();
      return;
    }
    queueMicrotask(() => {
      if (box && !box.matches(":popover-open")) box.showPopover?.();
    });
  });
  createEffect(() => {
    if (props.at() === null) return;
    const onKey = (e) => e.key === "Escape" && close();
    const away = (e) => {
      if (props.keepOnOutside) return;
      if (!box?.contains(e.target)) close();
    };
    const bail = () => close();
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", away, true);
    window.addEventListener("scroll", bail, true);
    onCleanup(() => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", away, true);
      window.removeEventListener("scroll", bail, true);
    });
  });
  return createComponent(Show, {
    get when() {
      return props.at();
    },
    children: (spot) => [(() => {
      var _el$ = _tmpl$8();
      effect((_p$) => {
        var _v$ = `${spot().x}px`, _v$2 = `${spot().y}px`;
        _v$ !== _p$.e && setStyleProperty(_el$, "left", _p$.e = _v$);
        _v$2 !== _p$.t && setStyleProperty(_el$, "top", _p$.t = _v$2);
        return _p$;
      }, {
        e: void 0,
        t: void 0
      });
      return _el$;
    })(), (() => {
      var _el$2 = _tmpl$42(), _el$6 = _el$2.firstChild;
      var _ref$ = box;
      typeof _ref$ === "function" ? use(_ref$, _el$2) : box = _el$2;
      insert(_el$2, createComponent(Show, {
        get when() {
          return props.title;
        },
        get children() {
          var _el$3 = _tmpl$22(), _el$4 = _el$3.firstChild, _el$5 = _el$4.nextSibling;
          insert(_el$4, () => props.title);
          _el$5.$$click = close;
          return _el$3;
        }
      }), _el$6);
      insert(_el$6, () => props.children);
      insert(_el$2, createComponent(Show, {
        get when() {
          return props.footer;
        },
        get children() {
          var _el$7 = _tmpl$32();
          insert(_el$7, () => props.footer);
          return _el$7;
        }
      }), null);
      effect((_p$) => {
        var _v$3 = `dumb-pop ${props.class ?? ""}`, _v$4 = props.width ? {
          "--dumb-pop-w": props.width
        } : void 0;
        _v$3 !== _p$.e && className(_el$2, _p$.e = _v$3);
        _p$.t = style(_el$2, _v$4, _p$.t);
        return _p$;
      }, {
        e: void 0,
        t: void 0
      });
      return _el$2;
    })()]
  });
}
delegateEvents(["click"]);

export { DumbContextMenu, DumbPopover };
