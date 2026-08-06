import { delegateEvents, insert, createComponent, effect, className, setAttribute, style, memo, spread, mergeProps, template } from 'solid-js/web';
import { createSignal, createMemo, Show, For, createEffect, untrack } from 'solid-js';

// src/DumbTree.tsx
function watch(dep, fn, opts) {
  let first = true;
  let prev;
  createEffect(() => {
    const value = dep();
    const skip = first && (opts?.defer);
    first = false;
    const before = prev;
    prev = value;
    if (!skip) untrack(() => fn(value, before));
  });
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

// src/DumbTree.tsx
var _tmpl$ = /* @__PURE__ */ template(`<ul>`);
var _tmpl$2 = /* @__PURE__ */ template(`<li class=dumb-tree-wait>\u2026`);
var _tmpl$3 = /* @__PURE__ */ template(`<span>`);
var _tmpl$4 = /* @__PURE__ */ template(`<button type=button class=dumb-tree-twist data-no-select>`);
var _tmpl$5 = /* @__PURE__ */ template(`<span class=dumb-tree-label>`);
var _tmpl$6 = /* @__PURE__ */ template(`<span class=dumb-tree-badge>`);
var _tmpl$7 = /* @__PURE__ */ template(`<span class=dumb-tree-twist>`);
var _tmpl$8 = /* @__PURE__ */ template(`<a>`);
var _tmpl$9 = /* @__PURE__ */ template(`<li>`);
var _tmpl$0 = /* @__PURE__ */ template(`<div>`);
var CSS = `
  .dumb-tree { list-style: none; margin: 0; padding: 0; line-height: 1.4;
               font-size: var(--dumb-tree-size, 13px);
               color: var(--dumb-tree-fg, inherit); user-select: none }
  .dumb-tree[data-stripes="1"] {
    background-image: repeating-linear-gradient(to bottom,
      transparent 0, transparent 1lh,
      var(--dumb-tree-zebra, rgb(0 0 0 / .035)) 1lh,
      var(--dumb-tree-zebra, rgb(0 0 0 / .035)) 2lh);
    background-attachment: local }
  .dumb-tree ul { list-style: none; margin: 0; padding-left: 1rem }
  .dumb-tree-row { display: flex; align-items: center; gap: .375rem; height: 1lh;
                   padding: 0 4px; border-radius: 3px; cursor: pointer;
                   text-decoration: none; color: inherit }
  .dumb-tree-row:hover { background: var(--dumb-tree-hover, rgb(0 0 0 / .06)) }
  .dumb-tree-row[aria-current="true"] { font-weight: 500;
                                        color: var(--dumb-tree-accent, #2563eb);
                                        background: var(--dumb-tree-sel, rgb(37 99 235 / .14)) }
  .dumb-tree-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis;
                     white-space: nowrap }
  .dumb-tree-badge { flex: none; font-size: .82em; font-variant-numeric: tabular-nums;
                     color: var(--dumb-tree-dim, #475569) }
  /* \u0441\u0442\u0440\u0435\u043B\u043A\u0430 \u043E\u0434\u043D\u0430 \u043D\u0430 \u043E\u0431\u0430 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F: \u0440\u0430\u0441\u043A\u0440\u044B\u0442\u0430\u044F \u2014 \u0442\u0430 \u0436\u0435, \u043F\u043E\u0432\u0451\u0440\u043D\u0443\u0442\u0430\u044F */
  .dumb-tree-twist { flex: none; width: 13px; height: 1lh; padding: 0; border: 0;
                     display: grid; place-items: center; background: none; cursor: pointer;
                     color: var(--dumb-tree-dim, #475569); font-size: .8em }
  .dumb-tree-twist > span { width: 10px; height: 10px; transition: transform .12s }
  .dumb-tree-row[data-open="1"] .dumb-tree-twist > span { transform: rotate(90deg) }
  .dumb-tree-icon { flex: none; width: 15px; height: 15px }
  .dumb-tree-wait { flex: none; width: 13px; text-align: center; opacity: .6 }
`;
function createOpened(key) {
  const read = () => {
    if (!key) return /* @__PURE__ */ new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem(key) ?? "[]"));
    } catch {
      return /* @__PURE__ */ new Set();
    }
  };
  const [ids, setIds] = createSignal(read());
  const save = (next) => {
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify([...next]));
    } catch {
    }
  };
  return {
    has: (id) => ids().has(id),
    toggle: (id) => setIds((was) => {
      const next = new Set(was);
      next.has(id) ? next.delete(id) : next.add(id);
      save(next);
      return next;
    })
  };
}
function DumbTree(props) {
  injectStyle("tree", CSS);
  const opened = createOpened(props.storageKey);
  const query = () => props.query?.().trim().toLowerCase() ?? "";
  const matches = (n) => props.match ? props.match(n, query()) : n.label.toLowerCase().includes(query());
  return (() => {
    var _el$ = _tmpl$();
    insert(_el$, createComponent(Branch, {
      parentId: "",
      get nodes() {
        return props.roots;
      },
      opened,
      tree: props,
      matches
    }));
    effect((_p$) => {
      var _v$ = `dumb-tree ${props.class ?? ""}`, _v$2 = props.stripes === false ? void 0 : "1", _v$3 = {
        ...props.size ? {
          "--dumb-tree-size": props.size
        } : {},
        ...props.style
      };
      _v$ !== _p$.e && className(_el$, _p$.e = _v$);
      _v$2 !== _p$.t && setAttribute(_el$, "data-stripes", _p$.t = _v$2);
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
function Branch(p) {
  const [loaded, setLoaded] = createSignal(null);
  const [busy, setBusy] = createSignal(false);
  const load = () => {
    const fn = p.tree.loadChildren;
    if (!fn || p.nodes) return;
    setBusy(true);
    fn(p.parentId).then(setLoaded).catch(() => setLoaded([])).finally(() => setBusy(false));
  };
  if (!p.nodes) load();
  watch(() => p.tree.refreshKey?.(), () => {
    if (loaded()) load();
  }, {
    defer: true
  });
  const list = createMemo(() => {
    const all = p.nodes ?? loaded() ?? [];
    const q = p.tree.query?.().trim();
    if (!q) return all;
    const fits = (n) => p.matches(n) || (n.children ?? []).some(fits);
    return all.filter(fits);
  });
  return [createComponent(Show, {
    get when() {
      return memo(() => !!busy())() && !p.parentId;
    },
    get children() {
      return _tmpl$2();
    }
  }), createComponent(For, {
    get each() {
      return list();
    },
    children: (node) => createComponent(Row, {
      node,
      get opened() {
        return p.opened;
      },
      get tree() {
        return p.tree;
      },
      get matches() {
        return p.matches;
      }
    })
  })];
}
function Row(p) {
  const kids = () => p.node.children;
  const branch = () => !!p.node.isFolder || !!kids()?.length;
  const open = () => p.opened.has(p.node.id) || !!p.tree.query?.().trim();
  const chosen = () => p.tree.selected?.() === p.node.id;
  const icon = () => p.node.icon ?? (branch() ? open() ? p.tree.icons?.folderOpen ?? p.tree.icons?.folder : p.tree.icons?.folder : p.tree.icons?.leaf);
  const drag = () => p.tree.getDragData?.(p.node) ?? null;
  const inner = [createComponent(Show, {
    get when() {
      return branch();
    },
    get fallback() {
      return _tmpl$7();
    },
    get children() {
      var _el$3 = _tmpl$4();
      _el$3.$$click = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        p.opened.toggle(p.node.id);
      };
      insert(_el$3, createComponent(Show, {
        get when() {
          return p.tree.icons?.twist;
        },
        get fallback() {
          return open() ? "\u25BE" : "\u25B8";
        },
        get children() {
          var _el$4 = _tmpl$3();
          effect(() => className(_el$4, p.tree.icons.twist));
          return _el$4;
        }
      }));
      effect(() => setAttribute(_el$3, "title", open() ? "\u0441\u0432\u0435\u0440\u043D\u0443\u0442\u044C" : "\u0440\u0430\u0437\u0432\u0435\u0440\u043D\u0443\u0442\u044C"));
      return _el$3;
    }
  }), createComponent(Show, {
    get when() {
      return icon();
    },
    get children() {
      var _el$5 = _tmpl$3();
      effect(() => className(_el$5, `dumb-tree-icon ${icon()}`));
      return _el$5;
    }
  }), (() => {
    var _el$6 = _tmpl$5();
    insert(_el$6, () => p.node.label);
    return _el$6;
  })(), createComponent(Show, {
    get when() {
      return p.tree.renderAction;
    },
    get children() {
      return p.tree.renderAction(p.node);
    }
  }), createComponent(Show, {
    get when() {
      return memo(() => p.node.badge !== void 0)() && p.node.badge !== "";
    },
    get children() {
      var _el$7 = _tmpl$6();
      insert(_el$7, () => p.node.badge);
      return _el$7;
    }
  })];
  const rowProps = {
    class: `dumb-tree-row ${p.node.class ?? ""}`,
    "aria-current": chosen(),
    "data-open": open() ? "1" : void 0,
    "data-id": p.node.id,
    draggable: !!drag(),
    onDragStart: (ev) => {
      const d = drag();
      if (!d || !ev.dataTransfer) return;
      ev.dataTransfer.setData("application/json", JSON.stringify(d));
      ev.dataTransfer.effectAllowed = "copy";
    },
    onClick: () => p.tree.onSelect?.(p.node),
    onContextMenu: (ev) => p.tree.onContextMenu?.(ev, p.node)
  };
  return (() => {
    var _el$9 = _tmpl$9();
    insert(_el$9, createComponent(Show, {
      get when() {
        return p.node.href;
      },
      get fallback() {
        return (() => {
          var _el$10 = _tmpl$0();
          spread(_el$10, rowProps, false, true);
          insert(_el$10, inner);
          return _el$10;
        })();
      },
      get children() {
        var _el$0 = _tmpl$8();
        spread(_el$0, mergeProps(rowProps, {
          get href() {
            return p.node.href;
          }
        }), false, true);
        insert(_el$0, inner);
        return _el$0;
      }
    }), null);
    insert(_el$9, createComponent(Show, {
      get when() {
        return memo(() => !!branch())() && open();
      },
      get children() {
        var _el$1 = _tmpl$();
        insert(_el$1, createComponent(Branch, {
          get parentId() {
            return p.node.id;
          },
          get nodes() {
            return kids();
          },
          get opened() {
            return p.opened;
          },
          get tree() {
            return p.tree;
          },
          get matches() {
            return p.matches;
          }
        }));
        return _el$1;
      }
    }), null);
    return _el$9;
  })();
}
delegateEvents(["click"]);

export { DumbTree };
