// Дерево: вложенные узлы, ленивая подгрузка ветки, зебра и выбор.
//
// Узлы задаются ВЛОЖЕННО (`children`), а не плоским списком с `parent`: дерево
// почти всегда приходит из хранилища уже вложенным, и разворачивать его в
// плоский массив только ради компонента — лишняя работа на каждом ответе.
//
// Ветку можно не грузить заранее: `loadChildren(id)` зовётся в момент
// раскрытия. Так дерево на десять тысяч узлов открывается мгновенно и тянет
// только то, куда полезли. Есть и то, и другое — `children` побеждает.
//
// Своих иконок компонент не несёт: значки приходят КЛАССАМИ (`icons`).
// Оформление — daisyUI, как и везде в ките: строка ведёт себя как пункт меню,
// выбранная красится акцентом темы. Свой CSS остался только на полосы и ритм
// строк в 1lh — классом такого не выразить.

// createEffect(dep, fn) вместо createEffect(on(...)): в Solid 2 эффект
// двухфазный, а `on` не экспортируется вовсе
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { Dynamic } from "@solidjs/web";
import type { JSX } from "@solidjs/web";
import { injectStyle } from "@solid-dumb-kit/shared";

export type TreeNode = {
  id: string;
  /**
   * Подпись строки. Обычно текст, но можно отдать и разметку — например, поле
   * ввода, когда узел переименовывают прямо в дереве. Для разметки поиск берёт
   * `searchText`: сравнивать не с чем, JSX не строка.
   */
  label: string | JSX.Element;
  /** по чему искать, если `label` — разметка */
  searchText?: string;
  /** свой класс значка; не задан — берётся из `icons` по виду узла */
  icon?: string;
  /** ветка ли это. Узел с `children` веткой считается и без флага */
  isFolder?: boolean;
  children?: Array<TreeNode>;
  /** мелким справа: счётчик, размер, статус — что угодно */
  badge?: string | number;
  /** строка станет ссылкой; навигацию делает потребитель */
  href?: string;
  /** доп. класс на строку */
  class?: string;
};

/** Классы значков. Кит не завязан на набор — Solar, Phosphor, Lucide, эмодзи. */
export type DumbTreeIcons = {
  /** стрелка ветки; ОДНА на оба состояния — раскрытая поворачивается на 90° */
  twist?: string;
  folder?: string;
  folderOpen?: string;
  leaf?: string;
};

export type DumbTreeProps = {
  /** корни дерева; не заданы — тянем через `loadChildren('')` */
  roots?: Array<TreeNode>;
  /**
   * Содержимое ветки по требованию. Зовётся при первом раскрытии и повторно —
   * когда сменился `refreshKey`.
   */
  loadChildren?: (parentId: string) => Promise<Array<TreeNode>>;

  /** выбранный узел */
  selected?: () => string | null | undefined;
  onSelect?: (node: TreeNode) => void;
  /** правый клик по строке */
  onContextMenu?: (ev: MouseEvent, node: TreeNode) => void;

  /** ключ localStorage для раскрытых веток; не задан — не помним */
  storageKey?: string;
  /** сменился — раскрытые ветки перечитываются */
  refreshKey?: () => number | string;

  /** фильтр по названию: показываем совпавшие и дорогу к ним */
  query?: () => string;
  /** свой матчер; по умолчанию подстрока без учёта регистра */
  match?: (node: TreeNode, query: string) => boolean;

  /**
   * До какой глубины ветки раскрыты, пока их не трогали руками: 1 — корневые,
   * 2 — и следующий уровень. Дальше решает сам человек, его выбор помнит
   * `storageKey`. Без этого дерево при первом заходе выглядит пустым списком
   * заголовков.
   */
  openDepth?: number;

  icons?: DumbTreeIcons;
  /** размер дерева одним кеглем: высота строк и отступы едут следом */
  size?: string;
  /** полосы через строку; по умолчанию есть */
  stripes?: boolean;

  /**
   * Своя подпись строки вместо `label` — например, ссылка роутера.
   *
   * Зовётся при отрисовке строки, то есть только для строк, которые видны:
   * в свёрнутых ветках подписи не строятся вовсе. Готовая разметка в `label`
   * создаётся сразу для всего дерева — на сотнях узлов со ссылками это десятки
   * миллисекунд впустую. `label` при этом остаётся текстом: по нему ищут.
   */
  renderLabel?: (node: TreeNode) => JSX.Element;
  /** свой контент справа в строке (кнопки, бейджи) */
  renderAction?: (node: TreeNode) => JSX.Element;
  /** узел можно тащить: что вернули — то и уедет в `dataTransfer` */
  getDragData?: (
    node: TreeNode,
  ) => { type: string; id: string; label: string } | null;

  class?: string;
  style?: JSX.CSSProperties;
};

/**
 * Структурные стили. Полосы рисуются ОДНИМ градиентом на всё дерево с шагом в
 * строку (`1lh`), а не классом на каждую вторую: при раскрытии вложенных счёт
 * начинался бы заново внутри каждого уровня и сбивался с общего ритма.
 * `background-attachment: local` — чтобы полосы ехали вместе с прокруткой.
 *
 * Отсюда же требование к строке: её высота — ровно 1lh. Меняешь размер —
 * меняется кегль, а высота, полосы и отступы едут следом сами.
 */
const STYLES = `
  /* Вид — daisyUI (menu, bg-base-*, text-primary) в разметке. Здесь остаётся
     то, чего классами не сделать: полосы ОДНИМ градиентом с шагом в строку
     (классом на каждую вторую они сбивались бы с ритма внутри веток) и строка
     ровно в 1lh, от которой пляшут стрелка и значок. */
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

/** текст узла для поиска: сама подпись, если она строка, иначе `searchText` */
const textOf = (n: TreeNode): string =>
  typeof n.label === "string" ? n.label : (n.searchText ?? "");

/** раскрытые ветки: помним между заходами, если дали ключ */
function createOpened(key?: string) {
  const read = () => {
    if (!key) return new Set<string>();
    try {
      return new Set<string>(JSON.parse(localStorage.getItem(key) ?? "[]"));
    } catch {
      return new Set<string>();
    }
  };
  const [ids, setIds] = createSignal<Set<string>>(read());
  const save = (next: Set<string>) => {
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify([...next]));
    } catch {
      /* приватный режим — не беда: это удобство, а не данные */
    }
  };
  return {
    has: (id: string) => ids().has(id),
    toggle: (id: string) =>
      setIds((was) => {
        const next = new Set(was);
        next.has(id) ? next.delete(id) : next.add(id);
        save(next);
        return next;
      }),
  };
}

type Opened = ReturnType<typeof createOpened>;

/**
 * Узел строки — для делегированного `dragstart`: обработчику нужен сам узел, а
 * не его `data-id`, и искать узел по id обходом дерева нельзя (подгруженные
 * ветки живут в сигнале своей `Branch`, в `roots` их нет).
 *
 * WeakMap, а не `Map`: ключ — сам элемент строки, и убирать за собой не нужно
 * вовсе — исчезла строка, исчезла и запись. `onCleanup` в колбэк-ref всё равно
 * не сработал бы (ref зовётся без owner'а).
 */
const ROW_NODE = new WeakMap<Element, () => TreeNode>();

export function DumbTree(props: DumbTreeProps) {
  injectStyle("tree", STYLES);

  const opened = createOpened(props.storageKey);
  const query = () => props.query?.().trim().toLowerCase() ?? "";
  const matches = (n: TreeNode) =>
    props.match
      ? props.match(n, query())
      : textOf(n).toLowerCase().includes(query());

  /**
   * `dragstart` — ОДИН слушатель на всё дерево, а не по одному на строку.
   *
   * Solid делегирует сам, но по фиксированному списку (`click`, `contextmenu`,
   * `pointerdown` — они у строки бесплатные), и `dragstart` в этот список не
   * входит: `onDragStart` в разметке строки означал настоящий
   * `addEventListener` на КАЖДУЮ строку. На дереве в три сотни узлов это три
   * сотни слушателей — и все они, кроме одного, ничего не делали, потому что
   * обработчик первым же действием выходил, когда `getDragData` не передан.
   *
   * Событие всплывает, поэтому делегируется вручную: слушатель здесь, строку
   * под курсором даёт `closest`, узел — `ROW_NODE`.
   */
  const onDragStart = (ev: DragEvent) => {
    const fn = props.getDragData;
    if (!fn || !ev.dataTransfer) return;

    const row = (ev.target as Element | null)?.closest?.(".dumb-tree-row");
    const node = row && ROW_NODE.get(row)?.();
    const data = node && fn(node);
    if (!data) return;

    ev.dataTransfer.setData("application/json", JSON.stringify(data));
    ev.dataTransfer.effectAllowed = "copy";
  };

  return (
    <ul
      class={`dumb-tree ${props.class ?? ""}`}
      data-stripes={props.stripes === false ? undefined : "1"}
      onDragStart={onDragStart}
      style={{
        ...(props.size ? { "--dumb-tree-size": props.size } : {}),
        ...props.style,
      }}
    >
      <Branch
        parentId=""
        nodes={props.roots}
        opened={opened}
        tree={props}
        matches={matches}
        depth={0}
      />
    </ul>
  );
}

/**
 * Ветка. Узлы либо приходят готовыми, либо тянутся `loadChildren` — и то и
 * другое обрабатывается здесь, чтобы у строки не было двух разных путей.
 */
function Branch(p: {
  parentId: string;
  nodes?: Array<TreeNode>;
  opened: Opened;
  tree: DumbTreeProps;
  matches: (n: TreeNode) => boolean;
  /** глубина ветки: 0 — корни. Нужна для `openDepth` */
  depth: number;
}): JSX.Element {
  const [loaded, setLoaded] = createSignal<Array<TreeNode> | null>(null);
  const [busy, setBusy] = createSignal(false);

  const load = () => {
    const fn = p.tree.loadChildren;
    if (!fn || p.nodes) return;
    setBusy(true);
    fn(p.parentId)
      .then(setLoaded)
      .catch(() => setLoaded([]))
      .finally(() => setBusy(false));
  };

  // Тянем при создании ветки. Для корней это старт, для вложенных — момент
  // первого раскрытия: ветка рендерится только раскрытой, значит и запрос
  // уходит ровно тогда, когда в неё полезли.
  //
  // Через эффект, а не разовый вызов в теле: проп РЕАКТИВЕН, и его
  // чтение в теле компонента Solid 2 отбивает — STRICT_READ_UNTRACKED («read
  // directly in <Branch> will not update»). Первая функция эффекта читает в
  // tracking scope, вторая работает в фазе применения, где запись в сигнал
  // (её делает `load`) разрешена.
  createEffect(
    () => !p.nodes,
    (needsLoad) => {
      if (needsLoad) load();
    },
  );
  // сменился ключ обновления — перечитываем то, что уже тянули
  createEffect(
    () => p.tree.refreshKey?.(),
    () => {
      if (loaded()) load();
    },
    { defer: true },
  );

  const list = createMemo(() => {
    const all = p.nodes ?? loaded() ?? [];
    const q = p.tree.query?.().trim();
    if (!q) return all;
    // узел виден, если совпал сам или совпало что-то внутри него
    const fits = (n: TreeNode): boolean =>
      p.matches(n) || (n.children ?? []).some(fits);
    return all.filter(fits);
  });

  return (
    <>
      <Show when={busy() && !p.parentId}>
        <li class="dumb-tree-wait px-1">
          <span class="loading loading-dots loading-xs" />
        </li>
      </Show>
      <For each={list()}>
        {(node) => (
          <Row
            node={node}
            opened={p.opened}
            tree={p.tree}
            matches={p.matches}
            depth={p.depth}
          />
        )}
      </For>
    </>
  );
}

function Row(p: {
  node: TreeNode;
  opened: Opened;
  tree: DumbTreeProps;
  matches: (n: TreeNode) => boolean;
  depth: number;
}): JSX.Element {
  const kids = () => p.node.children;
  const branch = () => !!p.node.isFolder || !!kids()?.length;
  const chosen = () => p.tree.selected?.() === p.node.id;

  /**
   * Выбранный узел лежит ВНУТРИ этой ветки — тогда её нельзя держать закрытой.
   *
   * Без этого дерево врёт при заходе по прямой ссылке: страница открыта, а в
   * дереве ветка свёрнута и ничего не подсвечено, будто выбора нет. Смотрим
   * только готовые `children`: подгружаемые ветки раскрывать нечем, пока их не
   * раскрыли, — там `selected` появится после загрузки.
   */
  const holdsChosen = (): boolean => {
    const id = p.tree.selected?.();
    if (!id) return false;
    const inside = (list?: Array<TreeNode>): boolean =>
      (list ?? []).some((n) => n.id === id || inside(n.children));
    return inside(kids());
  };

  // При поиске раскрываем всё: иначе совпадение остаётся спрятанным в ветке.
  // Выбранная ветка тоже раскрыта — и когда выбрана сама (человек на разделе,
  // покажи, что внутри), и когда выбран кто-то из её детей.
  const open = () =>
    p.opened.has(p.node.id) ||
    !!p.tree.query?.().trim() ||
    (branch() && chosen()) ||
    holdsChosen() ||
    p.depth < (p.tree.openDepth ?? 0);

  const icon = () =>
    p.node.icon ??
    (branch()
      ? open()
        ? (p.tree.icons?.folderOpen ?? p.tree.icons?.folder)
        : p.tree.icons?.folder
      : p.tree.icons?.leaf);

  const drag = () => p.tree.getDragData?.(p.node) ?? null;

  const inner = (
    <>
      <Show
        when={branch()}
        fallback={<span class="dumb-tree-twist shrink-0" />}
      >
        <button
          type="button"
          class="dumb-tree-twist grid shrink-0 cursor-pointer place-items-center border-0 bg-transparent p-0 text-xs"
          data-no-select
          title={open() ? "свернуть" : "развернуть"}
          onClick={(ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            p.opened.toggle(p.node.id);
          }}
        >
          <Show when={p.tree.icons?.twist} fallback={open() ? "▾" : "▸"}>
            <span class={p.tree.icons!.twist} />
          </Show>
        </button>
      </Show>
      <Show when={icon()}>
        <span class={`dumb-tree-icon size-[15px] shrink-0 ${icon()}`} />
      </Show>
      <span class="dumb-tree-label min-w-0 flex-1 truncate">
        {p.tree.renderLabel ? p.tree.renderLabel(p.node) : p.node.label}
      </span>
      <Show when={p.tree.renderAction}>{p.tree.renderAction!(p.node)}</Show>
      <Show when={p.node.badge !== undefined && p.node.badge !== ""}>
        <span class="dumb-tree-badge badge badge-sm badge-ghost tabular-nums">
          {p.node.badge}
        </span>
      </Show>
    </>
  );

  return (
    <li>
      {/* ОДНА строка, а не пара «div / a»: тег решает наличие `href`.
          Атрибуты стоят В РАЗМЕТКЕ, поэтому реактивными их делает компилятор —
          ни собранного объекта пропсов, ни геттеров руками. Объект был
          источником тихой поломки: поле-ЗНАЧЕНИЕ читается при сборке, то есть
          вне tracking scope, и с реактивным узлом (данные приходят стором —
          скажем, из TanStack Query) Solid 2 ругался `STRICT_READ_UNTRACKED` на
          каждую строку дерева. */}
      <Dynamic
        component={p.node.href ? "a" : "div"}
        href={p.node.href}
        // daisyUI: строка ведёт себя как пункт меню, выбранная — акцентом темы
        class={`dumb-tree-row flex cursor-pointer items-center gap-1.5 rounded-sm px-1 no-underline hover:bg-base-200 ${
          chosen() ? "bg-primary/15 text-primary font-medium" : ""
        } ${p.node.class ?? ""}`}
        // Строкой, а не булевым: у ARIA `aria-current` — перечисление
        // ('page' | 'step' | 'true' | 'false'), и компилятор второй линии
        // рендерит булево `true` как пустое значение, то есть подсказка для
        // скринридера молча пропадает.
        aria-current={chosen() ? "true" : undefined}
        data-open={open() ? "1" : undefined}
        data-id={p.node.id}
        // строкой: в HTML это перечисление, и вторая линия типизирует его так же
        draggable={drag() ? "true" : "false"}
        // Слушателя `dragstart` здесь НЕТ намеренно: он один на всё дерево (см.
        // `DumbTree`), а строка лишь оставляет ссылку на свой узел. Геттером, а
        // не значением: узел приходит пропом и может обновиться под той же
        // строкой, а WeakMap запомнила бы то, чем он был при монтировании.
        ref={(el: Element) => ROW_NODE.set(el, () => p.node)}
        onClick={() => p.tree.onSelect?.(p.node)}
        onContextMenu={(ev: MouseEvent) => p.tree.onContextMenu?.(ev, p.node)}
      >
        {inner}
      </Dynamic>
      <Show when={branch() && open()}>
        <ul>
          <Branch
            parentId={p.node.id}
            nodes={kids()}
            opened={p.opened}
            tree={p.tree}
            matches={p.matches}
            depth={p.depth + 1}
          />
        </ul>
      </Show>
    </li>
  );
}
