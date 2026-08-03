// src/DumbTree.tsx
import { createEffect, createMemo, createSignal, For, Show, on } from "solid-js";

// ../shared/dist/index.js
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

// src/DumbTree.tsx
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
  return <ul
    class={`dumb-tree ${props.class ?? ""}`}
    data-stripes={props.stripes === false ? void 0 : "1"}
    style={{ ...props.size ? { "--dumb-tree-size": props.size } : {}, ...props.style }}
  >
      <Branch parentId="" nodes={props.roots} opened={opened} tree={props} matches={matches} />
    </ul>;
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
  createEffect(
    on(
      () => p.tree.refreshKey?.(),
      () => {
        if (loaded()) load();
      },
      { defer: true }
    )
  );
  const list = createMemo(() => {
    const all = p.nodes ?? loaded() ?? [];
    const q = p.tree.query?.().trim();
    if (!q) return all;
    const fits = (n) => p.matches(n) || (n.children ?? []).some(fits);
    return all.filter(fits);
  });
  return <>
      <Show when={busy() && !p.parentId}>
        <li class="dumb-tree-wait">…</li>
      </Show>
      <For each={list()}>
        {(node) => <Row node={node} opened={p.opened} tree={p.tree} matches={p.matches} />}
      </For>
    </>;
}
function Row(p) {
  const kids = () => p.node.children;
  const branch = () => !!p.node.isFolder || !!kids()?.length;
  const open = () => p.opened.has(p.node.id) || !!p.tree.query?.().trim();
  const chosen = () => p.tree.selected?.() === p.node.id;
  const icon = () => p.node.icon ?? (branch() ? open() ? p.tree.icons?.folderOpen ?? p.tree.icons?.folder : p.tree.icons?.folder : p.tree.icons?.leaf);
  const drag = () => p.tree.getDragData?.(p.node) ?? null;
  const inner = <>
      <Show when={branch()} fallback={<span class="dumb-tree-twist" />}>
        <button
    type="button"
    class="dumb-tree-twist"
    data-no-select
    title={open() ? "\u0441\u0432\u0435\u0440\u043D\u0443\u0442\u044C" : "\u0440\u0430\u0437\u0432\u0435\u0440\u043D\u0443\u0442\u044C"}
    onClick={(ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      p.opened.toggle(p.node.id);
    }}
  >
          <Show when={p.tree.icons?.twist} fallback={open() ? "\u25BE" : "\u25B8"}>
            <span class={p.tree.icons.twist} />
          </Show>
        </button>
      </Show>
      <Show when={icon()}>
        <span class={`dumb-tree-icon ${icon()}`} />
      </Show>
      <span class="dumb-tree-label">{p.node.label}</span>
      <Show when={p.tree.renderAction}>{p.tree.renderAction(p.node)}</Show>
      <Show when={p.node.badge !== void 0 && p.node.badge !== ""}>
        <span class="dumb-tree-badge">{p.node.badge}</span>
      </Show>
    </>;
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
  return <li>
      <Show when={p.node.href} fallback={<div {...rowProps}>{inner}</div>}>
        <a {...rowProps} href={p.node.href}>
          {inner}
        </a>
      </Show>
      <Show when={branch() && open()}>
        <ul>
          <Branch
    parentId={p.node.id}
    nodes={kids()}
    opened={p.opened}
    tree={p.tree}
    matches={p.matches}
  />
        </ul>
      </Show>
    </li>;
}
export {
  DumbTree
};
