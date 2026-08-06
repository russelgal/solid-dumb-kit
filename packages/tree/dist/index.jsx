// src/DumbTree.tsx
import { createMemo, createSignal, For, Show } from "solid-js";

// ../shared/dist/index.js
import * as solid from "solid-js";
import { createEffect, untrack } from "solid-js";
function watch(dep, fn, opts) {
  let first = true;
  let prev;
  createEffect(() => {
    const value = dep();
    const skip = first && (opts?.defer ?? false);
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
var STYLES = `
  /* \u0412\u0438\u0434 \u2014 daisyUI (menu, bg-base-*, text-primary) \u0432 \u0440\u0430\u0437\u043C\u0435\u0442\u043A\u0435. \u0417\u0434\u0435\u0441\u044C \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F
     \u0442\u043E, \u0447\u0435\u0433\u043E \u043A\u043B\u0430\u0441\u0441\u0430\u043C\u0438 \u043D\u0435 \u0441\u0434\u0435\u043B\u0430\u0442\u044C: \u043F\u043E\u043B\u043E\u0441\u044B \u041E\u0414\u041D\u0418\u041C \u0433\u0440\u0430\u0434\u0438\u0435\u043D\u0442\u043E\u043C \u0441 \u0448\u0430\u0433\u043E\u043C \u0432 \u0441\u0442\u0440\u043E\u043A\u0443
     (\u043A\u043B\u0430\u0441\u0441\u043E\u043C \u043D\u0430 \u043A\u0430\u0436\u0434\u0443\u044E \u0432\u0442\u043E\u0440\u0443\u044E \u043E\u043D\u0438 \u0441\u0431\u0438\u0432\u0430\u043B\u0438\u0441\u044C \u0431\u044B \u0441 \u0440\u0438\u0442\u043C\u0430 \u0432\u043D\u0443\u0442\u0440\u0438 \u0432\u0435\u0442\u043E\u043A) \u0438 \u0441\u0442\u0440\u043E\u043A\u0430
     \u0440\u043E\u0432\u043D\u043E \u0432 1lh, \u043E\u0442 \u043A\u043E\u0442\u043E\u0440\u043E\u0439 \u043F\u043B\u044F\u0448\u0443\u0442 \u0441\u0442\u0440\u0435\u043B\u043A\u0430 \u0438 \u0437\u043D\u0430\u0447\u043E\u043A. */
  .dumb-tree { list-style: none; margin: 0; padding: 0; line-height: 1.4;
               font-size: var(--dumb-tree-size, 13px); user-select: none }
  .dumb-tree[data-stripes="1"] {
    background-image: repeating-linear-gradient(to bottom,
      transparent 0, transparent 1lh,
      var(--dumb-tree-zebra, rgb(0 0 0 / .035)) 1lh,
      var(--dumb-tree-zebra, rgb(0 0 0 / .035)) 2lh);
    background-attachment: local }
  .dumb-tree ul { list-style: none; margin: 0; padding-left: 1rem }
  .dumb-tree-row { height: 1lh }
  .dumb-tree-twist { width: 13px; height: 1lh }
  .dumb-tree-twist > span { width: 10px; height: 10px; transition: transform .12s }
  .dumb-tree-row[data-open="1"] .dumb-tree-twist > span { transform: rotate(90deg) }
  @media (prefers-reduced-motion: reduce) { .dumb-tree-twist > span { transition: none } }
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
  injectStyle("tree", STYLES);
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
  watch(
    () => p.tree.refreshKey?.(),
    () => {
      if (loaded()) load();
    },
    { defer: true }
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
        <li class="dumb-tree-wait px-1"><span class="loading loading-dots loading-xs" /></li>
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
      <Show when={branch()} fallback={<span class="dumb-tree-twist shrink-0" />}>
        <button
    type="button"
    class="dumb-tree-twist grid shrink-0 cursor-pointer place-items-center border-0 bg-transparent p-0 text-xs"
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
        <span class={`dumb-tree-icon size-[15px] shrink-0 ${icon()}`} />
      </Show>
      <span class="dumb-tree-label min-w-0 flex-1 truncate">{p.node.label}</span>
      <Show when={p.tree.renderAction}>{p.tree.renderAction(p.node)}</Show>
      <Show when={p.node.badge !== void 0 && p.node.badge !== ""}>
        <span class="dumb-tree-badge badge badge-sm badge-ghost tabular-nums">{p.node.badge}</span>
      </Show>
    </>;
  const rowProps = {
    get class() {
      return `dumb-tree-row flex cursor-pointer items-center gap-1.5 rounded-sm px-1 no-underline hover:bg-base-200 ${chosen() ? "bg-primary/15 text-primary font-medium" : ""} ${p.node.class ?? ""}`;
    },
    get "aria-current"() {
      return chosen();
    },
    get "data-open"() {
      return open() ? "1" : void 0;
    },
    "data-id": p.node.id,
    get draggable() {
      return !!drag();
    },
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
