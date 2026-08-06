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
// Своих иконок и цветов компонент не несёт: значки приходят КЛАССАМИ
// (`icons`), цвета — CSS-переменными с контрастными фолбэками. Ни Tailwind, ни
// daisyUI не требуются, но и не мешают.

// watch вместо createEffect(on(...)): в Solid 2 `on` не экспортируется (shared/solidCompat)
import { createMemo, createSignal, For, Show, type JSX } from 'solid-js'
import { injectStyle, watch } from '@solid-dumb-kit/shared'

export type TreeNode = {
  id: string
  label: string
  /** свой класс значка; не задан — берётся из `icons` по виду узла */
  icon?: string
  /** ветка ли это. Узел с `children` веткой считается и без флага */
  isFolder?: boolean
  children?: Array<TreeNode>
  /** мелким справа: счётчик, размер, статус — что угодно */
  badge?: string | number
  /** строка станет ссылкой; навигацию делает потребитель */
  href?: string
  /** доп. класс на строку */
  class?: string
}

/** Классы значков. Кит не завязан на набор — Solar, Phosphor, Lucide, эмодзи. */
export type DumbTreeIcons = {
  /** стрелка ветки; ОДНА на оба состояния — раскрытая поворачивается на 90° */
  twist?: string
  folder?: string
  folderOpen?: string
  leaf?: string
}

export type DumbTreeProps = {
  /** корни дерева; не заданы — тянем через `loadChildren('')` */
  roots?: Array<TreeNode>
  /**
   * Содержимое ветки по требованию. Зовётся при первом раскрытии и повторно —
   * когда сменился `refreshKey`.
   */
  loadChildren?: (parentId: string) => Promise<Array<TreeNode>>

  /** выбранный узел */
  selected?: () => string | null | undefined
  onSelect?: (node: TreeNode) => void
  /** правый клик по строке */
  onContextMenu?: (ev: MouseEvent, node: TreeNode) => void

  /** ключ localStorage для раскрытых веток; не задан — не помним */
  storageKey?: string
  /** сменился — раскрытые ветки перечитываются */
  refreshKey?: () => number | string

  /** фильтр по названию: показываем совпавшие и дорогу к ним */
  query?: () => string
  /** свой матчер; по умолчанию подстрока без учёта регистра */
  match?: (node: TreeNode, query: string) => boolean

  icons?: DumbTreeIcons
  /** размер дерева одним кеглем: высота строк и отступы едут следом */
  size?: string
  /** полосы через строку; по умолчанию есть */
  stripes?: boolean

  /** свой контент справа в строке (кнопки, бейджи) */
  renderAction?: (node: TreeNode) => JSX.Element
  /** узел можно тащить: что вернули — то и уедет в `dataTransfer` */
  getDragData?: (node: TreeNode) => { type: string; id: string; label: string } | null

  class?: string
  style?: JSX.CSSProperties
}

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
  /* стрелка одна на оба состояния: раскрытая — та же, повёрнутая */
  .dumb-tree-twist { flex: none; width: 13px; height: 1lh; padding: 0; border: 0;
                     display: grid; place-items: center; background: none; cursor: pointer;
                     color: var(--dumb-tree-dim, #475569); font-size: .8em }
  .dumb-tree-twist > span { width: 10px; height: 10px; transition: transform .12s }
  .dumb-tree-row[data-open="1"] .dumb-tree-twist > span { transform: rotate(90deg) }
  .dumb-tree-icon { flex: none; width: 15px; height: 15px }
  .dumb-tree-wait { flex: none; width: 13px; text-align: center; opacity: .6 }
`

/** раскрытые ветки: помним между заходами, если дали ключ */
function createOpened(key?: string) {
  const read = () => {
    if (!key) return new Set<string>()
    try {
      return new Set<string>(JSON.parse(localStorage.getItem(key) ?? '[]'))
    } catch {
      return new Set<string>()
    }
  }
  const [ids, setIds] = createSignal<Set<string>>(read())
  const save = (next: Set<string>) => {
    if (!key) return
    try {
      localStorage.setItem(key, JSON.stringify([...next]))
    } catch {
      /* приватный режим — не беда: это удобство, а не данные */
    }
  }
  return {
    has: (id: string) => ids().has(id),
    toggle: (id: string) =>
      setIds((was) => {
        const next = new Set(was)
        next.has(id) ? next.delete(id) : next.add(id)
        save(next)
        return next
      }),
  }
}

type Opened = ReturnType<typeof createOpened>

export function DumbTree(props: DumbTreeProps) {
  injectStyle('tree', STYLES)

  const opened = createOpened(props.storageKey)
  const query = () => props.query?.().trim().toLowerCase() ?? ''
  const matches = (n: TreeNode) =>
    props.match ? props.match(n, query()) : n.label.toLowerCase().includes(query())

  return (
    <ul
      class={`dumb-tree ${props.class ?? ''}`}
      data-stripes={props.stripes === false ? undefined : '1'}
      style={{ ...(props.size ? { '--dumb-tree-size': props.size } : {}), ...props.style }}
    >
      <Branch parentId="" nodes={props.roots} opened={opened} tree={props} matches={matches} />
    </ul>
  )
}

/**
 * Ветка. Узлы либо приходят готовыми, либо тянутся `loadChildren` — и то и
 * другое обрабатывается здесь, чтобы у строки не было двух разных путей.
 */
function Branch(p: {
  parentId: string
  nodes?: Array<TreeNode>
  opened: Opened
  tree: DumbTreeProps
  matches: (n: TreeNode) => boolean
}): JSX.Element {
  const [loaded, setLoaded] = createSignal<Array<TreeNode> | null>(null)
  const [busy, setBusy] = createSignal(false)

  const load = () => {
    const fn = p.tree.loadChildren
    if (!fn || p.nodes) return
    setBusy(true)
    fn(p.parentId)
      .then(setLoaded)
      .catch(() => setLoaded([]))
      .finally(() => setBusy(false))
  }

  // Тянем при создании ветки. Для корней это старт, для вложенных — момент
  // первого раскрытия: ветка рендерится только раскрытой, значит и запрос
  // уходит ровно тогда, когда в неё полезли.
  if (!p.nodes) load()
  // сменился ключ обновления — перечитываем то, что уже тянули
  watch(
    () => p.tree.refreshKey?.(),
    () => {
      if (loaded()) load()
    },
    { defer: true },
  )

  const list = createMemo(() => {
    const all = p.nodes ?? loaded() ?? []
    const q = p.tree.query?.().trim()
    if (!q) return all
    // узел виден, если совпал сам или совпало что-то внутри него
    const fits = (n: TreeNode): boolean =>
      p.matches(n) || (n.children ?? []).some(fits)
    return all.filter(fits)
  })

  return (
    <>
      <Show when={busy() && !p.parentId}>
        <li class="dumb-tree-wait">…</li>
      </Show>
      <For each={list()}>
        {(node) => (
          <Row node={node} opened={p.opened} tree={p.tree} matches={p.matches} />
        )}
      </For>
    </>
  )
}

function Row(p: {
  node: TreeNode
  opened: Opened
  tree: DumbTreeProps
  matches: (n: TreeNode) => boolean
}): JSX.Element {
  const kids = () => p.node.children
  const branch = () => !!p.node.isFolder || !!kids()?.length
  // при поиске раскрываем всё: иначе совпадение остаётся спрятанным в ветке
  const open = () => p.opened.has(p.node.id) || !!p.tree.query?.().trim()
  const chosen = () => p.tree.selected?.() === p.node.id

  const icon = () =>
    p.node.icon ??
    (branch()
      ? open()
        ? p.tree.icons?.folderOpen ?? p.tree.icons?.folder
        : p.tree.icons?.folder
      : p.tree.icons?.leaf)

  const drag = () => p.tree.getDragData?.(p.node) ?? null

  const inner = (
    <>
      <Show when={branch()} fallback={<span class="dumb-tree-twist" />}>
        <button
          type="button"
          class="dumb-tree-twist"
          data-no-select
          title={open() ? 'свернуть' : 'развернуть'}
          onClick={(ev) => {
            ev.preventDefault()
            ev.stopPropagation()
            p.opened.toggle(p.node.id)
          }}
        >
          <Show when={p.tree.icons?.twist} fallback={open() ? '▾' : '▸'}>
            <span class={p.tree.icons!.twist} />
          </Show>
        </button>
      </Show>
      <Show when={icon()}>
        <span class={`dumb-tree-icon ${icon()}`} />
      </Show>
      <span class="dumb-tree-label">{p.node.label}</span>
      <Show when={p.tree.renderAction}>{p.tree.renderAction!(p.node)}</Show>
      <Show when={p.node.badge !== undefined && p.node.badge !== ''}>
        <span class="dumb-tree-badge">{p.node.badge}</span>
      </Show>
    </>
  )

  // Поля — ГЕТТЕРАМИ, а не значениями: объект собирается один раз, и записанное
  // в него `chosen()` осталось бы навсегда тем, чем было в момент создания
  // строки. Наружу это вылезало так: выбрали узел из кода — подсветка не
  // переехала, раскрыли ветку — стрелка не повернулась (её поворачивает CSS по
  // `data-open`). При спреде Solid читает геттеры внутри эффекта, поэтому так
  // атрибуты снова следят за сигналами.
  const rowProps = {
    get class() { return `dumb-tree-row ${p.node.class ?? ''}` },
    get 'aria-current'() { return chosen() },
    get 'data-open'() { return open() ? '1' : undefined },
    'data-id': p.node.id,
    get draggable() { return !!drag() },
    onDragStart: (ev: DragEvent) => {
      const d = drag()
      if (!d || !ev.dataTransfer) return
      ev.dataTransfer.setData('application/json', JSON.stringify(d))
      ev.dataTransfer.effectAllowed = 'copy'
    },
    onClick: () => p.tree.onSelect?.(p.node),
    onContextMenu: (ev: MouseEvent) => p.tree.onContextMenu?.(ev, p.node),
  }

  return (
    <li>
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
    </li>
  )
}
