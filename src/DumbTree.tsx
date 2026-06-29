import { createMemo, createSignal, For, Show, type JSX } from 'solid-js'
import { makePersisted } from '@solid-primitives/storage'
import { createDumbSortable } from './sortableCore'

// Раскрывающееся дерево (иерархия по parent) ИЛИ плоский список (flat) с нечётким
// поиском, сортировкой (индекс/название) и опциональным drag-reorder (наш sortableCore).
// Styled-but-configurable: даёт готовый daisyUI-вид, но иконки/строки/классы и доп.
// контент строки переопределяются пропсами. Прикладные поля узла (published/count/…)
// в кит НЕ протекают — выражай их через rowExtra/rowClass/titleClass/rowTitle.
//
//   <DumbTree nodes={cats()} title="Каталог" storageKey="cat"
//     activeId={() => active()} onSelect={id => go(id)} />

export type DumbTreeNode = {
  id: number | string
  parent: number | string
  title: string
  /** порядок среди соседей (для сортировки «по индексу») */
  index?: number
  /** доп. строка для поиска/тултипа (бренд категории и т.п.) */
  meta?: string | null
}

type Id = number | string

// Нечёткий матч: подстрока ИЛИ подпоследовательность (регистронезависимо).
function fuzzy(q: string, text: string): boolean {
  if (!q) return true
  q = q.toLowerCase()
  text = (text || '').toLowerCase()
  if (text.includes(q)) return true
  let i = 0
  for (const ch of text) {
    if (ch === q[i]) i++
    if (i === q.length) return true
  }
  return false
}

// Классы иконок передаёт ПОТРЕБИТЕЛЬ — кит не завязан на конкретный набор
// (Solar/Lucide/…). Так строки `icon-[…]` живут в исходниках приложения, и его
// собственный Tailwind/iconify компилирует CSS — без сканирования node_modules.
export type DumbTreeIcons = {
  /** папка свёрнута */
  folder: string
  /** папка раскрыта */
  folderOpen: string
  /** лист (flat-режим / узел без детей) */
  leaf: string
  /** стрелка раскрытой папки */
  expanded: string
  /** стрелка свёрнутой папки */
  collapsed: string
  search: string
  sortIndex: string
  sortName: string
  dragHandle: string
}

export type DumbTreeLabels = Partial<{
  search: string
  sortIndex: string
  sortName: string
}>

export type DumbTreeProps<T extends DumbTreeNode> = {
  /** плоский массив узлов (иерархия по parent). undefined → спиннер загрузки */
  nodes?: Array<T>
  /** заголовок сайдбара */
  title?: string
  /** активный (выбранный) id — реактивный аксессор */
  activeId?: () => Id | null | undefined
  /** клик по строке */
  onSelect?: (id: T['id'], node: T) => void

  /** плоский список без иерархии/сворачивания */
  flat?: boolean

  /** скрыть поле поиска */
  hideSearch?: boolean
  placeholder?: string
  /** свой матчер поиска (по умолчанию fuzzy по title/meta/id) */
  match?: (node: T, query: string) => boolean

  /** скрыть тоггл сортировки и держать порядок строго по index */
  hideSort?: boolean
  /** локаль для сравнения названий (по умолчанию — браузерная) */
  locale?: string
  /** ключ localStorage для раскрытых папок и режима сортировки */
  storageKey?: string

  /** drag-reorder flat-списка: переставить from→to в порядке отображения */
  sortable?: (from: number, to: number) => void

  /** доп. контент справа в строке (бейджи/иконки статуса) */
  rowExtra?: (node: T) => JSX.Element
  /** доп. класс на строку-ссылку (напр. opacity-50 для скрытых) */
  rowClass?: (node: T) => string | undefined
  /** доп. класс на текст строки (напр. line-through) */
  titleClass?: (node: T) => string | undefined
  /** свой tooltip строки (по умолчанию «title · meta · id N») */
  rowTitle?: (node: T) => string

  /** доп. класс на корневой <aside> */
  class?: string
  /** классы иконок (обязательно — кит не несёт свой набор) */
  icons: DumbTreeIcons
  labels?: DumbTreeLabels
}

const DEFAULT_LABELS: Required<DumbTreeLabels> = {
  search: 'Поиск',
  sortIndex: 'Индекс',
  sortName: 'Название',
}

export function DumbTree<T extends DumbTreeNode>(props: DumbTreeProps<T>) {
  const nodes = () => props.nodes
  const icons = () => props.icons
  const labels = (): Required<DumbTreeLabels> => ({ ...DEFAULT_LABELS, ...props.labels })
  const activeId = () => props.activeId?.()
  const [q, setQ] = createSignal('')

  const key = props.storageKey ?? 'dumb-tree'
  const [expanded, setExpanded] = makePersisted(createSignal<Set<Id>>(new Set()), {
    name: `${key}:expanded`,
    serialize: (s: Set<Id>) => JSON.stringify([...s]),
    deserialize: (str: string) => new Set<Id>(JSON.parse(str)),
  })

  // режим сортировки: по индексу (порядок в дереве) | по названию. Персист в localStorage.
  const [sort, setSort] = makePersisted(createSignal<'index' | 'name'>('index'), {
    name: `${key}:sort`,
    serialize: (vv: 'index' | 'name') => vv,
    deserialize: (s: string) => (s === 'name' ? 'name' : 'index'),
  })
  const sortMode = () => (props.hideSort ? 'index' : sort())
  // компаратор: основной ключ по режиму, второй — для стабильности
  const cmp = (a: T, b: T) =>
    sortMode() === 'name'
      ? a.title.localeCompare(b.title, props.locale) || (a.index ?? 0) - (b.index ?? 0)
      : (a.index ?? 0) - (b.index ?? 0) || a.title.localeCompare(b.title, props.locale)

  const byId = createMemo(() => new Map((nodes() ?? []).map(n => [n.id, n])))
  const childrenOf = createMemo(() => {
    const m = new Map<Id, Array<T>>()
    for (const n of nodes() ?? []) {
      let a = m.get(n.parent)
      if (!a) { a = []; m.set(n.parent, a) }
      a.push(n)
    }
    for (const a of m.values()) a.sort(cmp)
    return m
  })
  const rootId = createMemo<Id>(() => {
    const ns = nodes() ?? []
    if (!ns.length) return 0
    const ids = new Set(ns.map(n => n.id))
    return (ns.find(n => !ids.has(n.parent)) ?? ns[0]).id
  })

  const matches = (n: T, query: string) =>
    props.match
      ? props.match(n, query)
      : fuzzy(query, n.title) || (!!n.meta && fuzzy(query, n.meta)) || String(n.id).includes(query)

  // при поиске — множество видимых узлов (совпадения + их предки)
  const visible = createMemo<Set<Id> | null>(() => {
    const query = q().trim().toLowerCase()
    if (!query) return null
    const ids = byId()
    const show = new Set<Id>()
    for (const n of nodes() ?? []) {
      if (matches(n, query)) {
        let cur: T | undefined = n
        while (cur) { show.add(cur.id); cur = ids.get(cur.parent) }
      }
    }
    return show
  })

  // плоский список: фильтр поиском + сортировка по выбранному режиму
  const flatList = createMemo(() => {
    const query = q().trim().toLowerCase()
    return (nodes() ?? []).filter(n => !query || matches(n, query)).sort(cmp)
  })

  // drag-reorder flat-списка (отключаем во время поиска — порядок отображения ≠ исходный)
  const fs = createDumbSortable({
    order: () => flatList().map(n => String(n.id)),
    disabled: () => !!q().trim(),
    onEnd: (from, to) => props.sortable?.(from, to),
  })

  const toggle = (id: Id) =>
    setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const defaultTitle = (n: T) =>
    `${n.title}${n.meta ? ' · ' + n.meta : ''} · id ${n.id}`

  const RowLink = (p: { node: T; icon: string }) => (
    <a
      class={`flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer rounded px-1.5 py-0.5 ${activeId() === p.node.id ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'} ${props.rowClass?.(p.node) ?? ''}`}
      onClick={() => props.onSelect?.(p.node.id, p.node)}
      title={props.rowTitle ? props.rowTitle(p.node) : defaultTitle(p.node)}
    >
      <span class={`size-4 shrink-0 ${p.icon}`} />
      <span class={`truncate ${props.titleClass?.(p.node) ?? ''}`}>{p.node.title}</span>
      <Show when={props.rowExtra}>
        <span class="ml-auto shrink-0 flex items-center gap-1">{props.rowExtra!(p.node)}</span>
      </Show>
    </a>
  )

  function Node(p: { id: Id }) {
    const node = () => byId().get(p.id)
    const kids = () => childrenOf().get(p.id) ?? []
    const isExpanded = () => (visible() ? true : expanded().has(p.id))
    return (
      <Show when={node() && (!visible() || visible()!.has(p.id))}>
        <li>
          <div class="flex items-center">
            <Show when={kids().length} fallback={<span class="w-5 shrink-0" />}>
              <button class="btn btn-ghost btn-xs btn-square" onClick={() => toggle(p.id)}>
                <span class={`size-4 ${isExpanded() ? icons().expanded : icons().collapsed}`} />
              </button>
            </Show>
            <RowLink
              node={node()!}
              icon={isExpanded() && kids().length ? icons().folderOpen : icons().folder}
            />
          </div>
          <Show when={isExpanded() && kids().length}>
            <ul class="pl-3 border-l border-base-200 ml-3">
              <For each={kids()}>{k => <Node id={k.id} />}</For>
            </ul>
          </Show>
        </li>
      </Show>
    )
  }

  return (
    <aside class={`w-64 shrink-0 sticky top-0 self-start max-h-screen overflow-y-auto ${props.class ?? ''}`}>
      <Show when={props.title}>
        <div class="text-xs opacity-50 mb-2 px-1">{props.title}</div>
      </Show>
      <Show when={!props.hideSearch}>
        <label class="input input-sm input-bordered flex items-center gap-2 mb-2 w-full">
          <span class={`size-4 opacity-50 ${icons().search}`} />
          <input value={q()} onInput={e => setQ(e.currentTarget.value)} placeholder={props.placeholder ?? labels().search} class="grow" />
        </label>
      </Show>
      <Show when={!props.hideSort}>
        <div class="join mb-2 w-full">
          <button
            class={`btn btn-xs join-item grow gap-1 ${sort() === 'index' ? 'btn-active btn-primary' : 'btn-ghost'}`}
            onClick={() => setSort('index')}
            title={labels().sortIndex}
          >
            <span class={`size-3.5 ${icons().sortIndex}`} />
            {labels().sortIndex}
          </button>
          <button
            class={`btn btn-xs join-item grow gap-1 ${sort() === 'name' ? 'btn-active btn-primary' : 'btn-ghost'}`}
            onClick={() => setSort('name')}
            title={labels().sortName}
          >
            <span class={`size-3.5 ${icons().sortName}`} />
            {labels().sortName}
          </button>
        </div>
      </Show>
      <Show when={nodes()} fallback={<span class="loading loading-spinner" />}>
        <ul class="bg-base-100 rounded-box shadow w-full text-sm p-2 max-h-[80vh] overflow-auto">
          <Show
            when={props.flat}
            fallback={<For each={childrenOf().get(rootId()) ?? []}>{n => <Node id={n.id} />}</For>}
          >
            <For each={flatList()}>
              {n => (
                <li ref={props.sortable ? fs.bind(String(n.id)) : undefined} class="flex items-center">
                  <Show when={props.sortable}>
                    <button data-drag-handle type="button" class="cursor-grab text-base-content/30 hover:text-base-content shrink-0" title="Перетащить">
                      <span class={`size-4 ${icons().dragHandle}`} />
                    </button>
                  </Show>
                  <RowLink node={n} icon={icons().leaf} />
                </li>
              )}
            </For>
          </Show>
        </ul>
      </Show>
    </aside>
  )
}
