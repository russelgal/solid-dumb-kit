// src/DumbContextMenu.tsx
import { For, Show, createEffect as createEffect2, createSignal, onCleanup } from "solid-js";

// ../shared/dist/index.js
import * as solid from "solid-js";
import { createEffect, untrack } from "solid-js";
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

// src/DumbContextMenu.tsx
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
`;
function DumbContextMenu(props) {
  injectStyle("menu", STYLES);
  const HOLD = 250;
  const TOL = 6;
  const [at, setAt] = createSignal(null);
  let pressedAt = 0;
  let pressedPoint = { x: 0, y: 0 };
  const [active, setActive] = createSignal(-1);
  let box;
  let returnTo = null;
  const open = () => at() !== null;
  const items = () => open() ? props.items() : [];
  const pickable = () => items().map((it, i) => ({ it, i })).filter(({ it }) => it.kind !== "separator" && !it.disabled);
  function close() {
    if (!open()) return;
    if (box?.matches(":popover-open")) box.hidePopover();
    setAt(null);
    setActive(-1);
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
    pressedPoint = { x: ev.clientX, y: ev.clientY };
    setAt({ x: ev.clientX, y: ev.clientY });
    setActive(-1);
    props.onToggle?.(true);
  }
  function onKey(ev) {
    if (!open()) return;
    const list = pickable();
    if (ev.key === "Escape") return void (ev.preventDefault(), close());
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      if (!list.length) return;
      const cur = list.findIndex(({ i }) => i === active());
      const step = ev.key === "ArrowDown" ? 1 : -1;
      const next = (cur + step + list.length) % list.length;
      setActive(list[next < 0 ? list.length - 1 : next].i);
      return;
    }
    if (ev.key === "Enter" || ev.key === " ") {
      const it = items()[active()];
      if (it && it.kind !== "separator") {
        ev.preventDefault();
        it.run();
        close();
      }
    }
  }
  createEffect2(() => {
    window.addEventListener("contextmenu", onContext);
    window.addEventListener("keydown", onKey);
    const away = (ev) => {
      if (open() && !box?.contains(ev.target)) close();
    };
    window.addEventListener("pointerdown", away, true);
    const release = (ev) => {
      if (!open()) return;
      const held = performance.now() - pressedAt;
      const moved = Math.hypot(ev.clientX - pressedPoint.x, ev.clientY - pressedPoint.y);
      if (held < HOLD && moved < TOL) return;
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      const hit = under?.closest(".dumb-menu-item");
      if (hit && !hit.disabled) hit.click();
      else close();
    };
    window.addEventListener("pointerup", release, true);
    const track = (ev) => {
      if (!open() || !ev.buttons) return;
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      const hit = under?.closest(".dumb-menu-item");
      if (!hit) return void setActive(-1);
      const all = Array.from(box?.querySelectorAll(".dumb-menu-item") ?? []);
      const rows = Array.from(box?.querySelectorAll("li") ?? []);
      setActive(rows.findIndex((li) => li.contains(hit)));
      void all;
    };
    window.addEventListener("pointermove", track, true);
    const bail = () => close();
    window.addEventListener("scroll", bail, true);
    window.addEventListener("blur", bail);
    onCleanup(() => {
      window.removeEventListener("contextmenu", onContext);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", away, true);
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointermove", track, true);
      window.removeEventListener("scroll", bail, true);
      window.removeEventListener("blur", bail);
    });
  });
  createEffect2(() => {
    if (!open()) return;
    queueMicrotask(() => {
      if (box && !box.matches(":popover-open")) box.showPopover?.();
      box?.focus();
    });
  });
  const place = () => {
    const p = at();
    if (!p) return {};
    if (window.CSS?.supports?.("anchor-name: --x")) return {};
    const flipX = p.x > window.innerWidth / 2;
    const flipY = p.y > window.innerHeight / 2;
    return {
      left: flipX ? "auto" : `${p.x}px`,
      right: flipX ? `${window.innerWidth - p.x}px` : "auto",
      top: flipY ? "auto" : `${p.y}px`,
      bottom: flipY ? `${window.innerHeight - p.y}px` : "auto"
    };
  };
  return <Show when={open()}>
      {
    /* якорь стоит ровно там, где щёлкнули: меню цепляется за него */
  }
      <div class="dumb-menu-anchor" style={{ left: `${at().x}px`, top: `${at().y}px` }} />
      <div
    ref={box}
    class={`dumb-menu ${props.class ?? ""}`}
    popover="manual"
    style={place()}
    tabindex={-1}
    role="menu"
  >
        <ul>
          <For each={items()}>
            {(it, i) => <Show
    when={it.kind !== "separator"}
    fallback={<li class="dumb-menu-sep" role="separator" />}
  >
                <li>
                  <button
    type="button"
    role="menuitem"
    class="dumb-menu-item"
    data-active={active() === i() ? "1" : void 0}
    data-danger={it.danger ? "1" : void 0}
    disabled={it.disabled}
    onMouseEnter={() => setActive(i())}
    onClick={() => {
      ;
      it.run();
      close();
    }}
  >
                    <Show when={it.icon}>
                      <span class={`dumb-menu-icon ${it.icon}`} />
                    </Show>
                    <span class="dumb-menu-label">{it.label}</span>
                    <Show when={it.hint}>
                      <span class="dumb-menu-hint">{it.hint}</span>
                    </Show>
                  </button>
                </li>
              </Show>}
          </For>
        </ul>
      </div>
    </Show>;
}

// src/DumbPopover.tsx
import { Show as Show2, createEffect as createEffect3, onCleanup as onCleanup2 } from "solid-js";
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
  createEffect3(() => {
    const open = props.at() !== null;
    if (!open) {
      if (box?.matches(":popover-open")) box.hidePopover();
      return;
    }
    queueMicrotask(() => {
      if (box && !box.matches(":popover-open")) box.showPopover?.();
    });
  });
  createEffect3(() => {
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
    onCleanup2(() => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", away, true);
      window.removeEventListener("scroll", bail, true);
    });
  });
  return <Show2 when={props.at()}>
      {(spot) => <>
          <div
    class="dumb-pop-anchor"
    style={{ left: `${spot().x}px`, top: `${spot().y}px` }}
  />
          <div
    ref={box}
    popover="manual"
    class={`dumb-pop ${props.class ?? ""}`}
    style={props.width ? { "--dumb-pop-w": props.width } : void 0}
  >
            <Show2 when={props.title}>
              <div class="dumb-pop-head">
                <div class="dumb-pop-title">{props.title}</div>
                <button type="button" class="dumb-pop-x" title="закрыть" onClick={close}>
                  ✕
                </button>
              </div>
            </Show2>
            <div class="dumb-pop-body">{props.children}</div>
            <Show2 when={props.footer}>
              <div class="dumb-pop-foot">{props.footer}</div>
            </Show2>
          </div>
        </>}
    </Show2>;
}
export {
  DumbContextMenu,
  DumbPopover
};
