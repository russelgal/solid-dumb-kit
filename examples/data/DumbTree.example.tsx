// DumbTree — sidebar tree (hierarchy by `parent`) and a flat, drag-reorderable list.
//
// DumbTree is the one component in the kit that renders Tailwind + daisyUI class
// names. In a daisyUI app you need nothing extra. This example is standalone, so
// it ships a ~60-line shim below that fakes just the classes DumbTree touches —
// delete it in a real app.
import { createSignal, For } from 'solid-js'
import { DumbTree, type DumbTreeNode } from '@solid-dumb-kit/tree'

// ── эмодзи-иконки: в настоящем приложении тут твой icon-set ──
//
// Раньше здесь лежал шестидесятистрочный шим, подделывавший классы daisyUI
// своими цветами. В витрине daisyUI подключён по-настоящему, а Tailwind видит
// `examples/` через `@source` — шим только перебивал тему захардкоженным белым
// и в тёмной теме светился. Осталось то, чего не даёт ни тот, ни другой.
const SHIM = `
.dt-demo .ic::before{display:block;line-height:1;font-size:14px}
.dt-demo .ic-folder::before{content:"📁"}.dt-demo .ic-folder-open::before{content:"📂"}
.dt-demo .ic-leaf::before{content:"📄"}.dt-demo .ic-down::before{content:"▾"}
.dt-demo .ic-right::before{content:"▸"}.dt-demo .ic-search::before{content:"🔍"}
.dt-demo .ic-sort-index::before{content:"🔢"}.dt-demo .ic-sort-name::before{content:"🔤"}
.dt-demo .ic-drag::before{content:"⠿"}
`

// In a real app these are your icon-set classes (iconify, Solar, Lucide…).
const icons = {
  folder: 'ic ic-folder',
  folderOpen: 'ic ic-folder-open',
  leaf: 'ic ic-leaf',
  expanded: 'ic ic-down',
  collapsed: 'ic ic-right',
  search: 'ic ic-search',
  sortIndex: 'ic ic-sort-index',
  sortName: 'ic ic-sort-name',
  dragHandle: 'ic ic-drag',
}

type Cat = DumbTreeNode & { count: number; hidden?: boolean }

// parent points at the id of the parent node; the root is the one whose parent
// is outside the set (here: -1).
const CATS: Cat[] = [
  { id: 0, parent: -1, title: 'Catalogue', index: 0, count: 0 },
  { id: 1, parent: 0, title: 'Accommodation', index: 0, count: 42, meta: 'stay' },
  { id: 11, parent: 1, title: 'A-frames', index: 0, count: 8 },
  { id: 12, parent: 1, title: 'Guest houses', index: 1, count: 15 },
  { id: 13, parent: 1, title: 'Hotel rooms', index: 2, count: 19, meta: 'rooms' },
  { id: 2, parent: 0, title: 'Food', index: 1, count: 31 },
  { id: 21, parent: 2, title: 'Cold starters', index: 0, count: 12 },
  { id: 22, parent: 2, title: 'Hot dishes', index: 1, count: 14 },
  { id: 23, parent: 2, title: 'Desserts', index: 2, count: 5, hidden: true },
  { id: 3, parent: 0, title: 'Activities', index: 2, count: 17, meta: 'fun' },
  { id: 31, parent: 3, title: 'Outdoors', index: 0, count: 9 },
  { id: 32, parent: 3, title: 'Indoors', index: 1, count: 8 },
  { id: 4, parent: 0, title: 'Events', index: 3, count: 11 },
  { id: 41, parent: 4, title: 'Weddings', index: 0, count: 6 },
  { id: 42, parent: 4, title: 'Corporate', index: 1, count: 5, hidden: true },
]

const FLAT: Cat[] = CATS.filter((c) => c.parent !== -1 && String(c.id).length === 1)
  .map((c, i) => ({ ...c, parent: -1, index: i }))

export default function DumbTreeExample() {
  const [active, setActive] = createSignal<number | string | null>(13)
  const [flat, setFlat] = createSignal<Cat[]>(FLAT)
  const [log, setLog] = createSignal('click a row →')

  const badge = (n: Cat) => (
    <span class="text-[11px] text-base-content tabular-nums">
      {n.count || ''}
    </span>
  )

  return (
    <div class="dt-demo p-5 text-base-content">
      <style>{SHIM}</style>

      <p class="mb-4 text-[13px] text-base-content">
        Type in the search box (fuzzy — <code>gst hs</code> finds “Guest houses”), toggle the sort
        mode, collapse folders and reload the page: expanded folders and sort mode are persisted
        per <code>storageKey</code>. Hidden items are dimmed via <code>rowClass</code>, counts come
        from <code>rowExtra</code> — the kit itself knows nothing about those fields.
      </p>

      <div class="flex flex-wrap items-start gap-6">
        <section>
          <h3 class="mb-2 text-sm">Tree — hierarchy by <code>parent</code></h3>
          <DumbTree
            nodes={CATS}
            title="CATALOGUE"
            storageKey="demo:tree"
            icons={icons}
            activeId={active}
            onSelect={(id, node) => { setActive(id); setLog(`onSelect(${id}, "${node.title}")`) }}
            placeholder="Search…"
            labels={{ search: 'Search', sortIndex: 'Index', sortName: 'Name' }}
            rowExtra={badge}
            rowClass={(n) => (n.hidden ? 'dt-dim' : undefined)}
            rowTitle={(n) => `${n.title} — ${n.count} items`}
          />
        </section>

        <section>
          <h3 class="mb-2 text-sm">Flat + <code>sortable</code> — drag by ⠿</h3>
          <DumbTree
            nodes={flat()}
            flat
            title="SECTIONS"
            storageKey="demo:flat"
            icons={icons}
            hideSort
            placeholder="Filter…"
            labels={{ search: 'Filter' }}
            rowExtra={badge}
            sortable={(from, to) => {
              const next = flat().slice()
              next.splice(to, 0, next.splice(from, 1)[0])
              setFlat(next)
              setLog(`sortable(${from} → ${to})`)
            }}
          />
        </section>

        <section class="min-w-60 flex-1">
          <h3 class="mb-2 text-sm">Callbacks</h3>
          <code class="block rounded-box bg-neutral px-3 py-2.5 text-[13px] text-neutral-content">{log()}</code>
          <p class="text-[13px]/relaxed text-base-content">
            Current order:<br />
            <For each={flat()}>{(n, i) => <span>{i() > 0 ? ' · ' : ''}{n.title}</span>}</For>
          </p>
          <p class="text-xs text-base-content">
            Drag-reorder is flat-only, and switches off while a filter is typed — the displayed
            order no longer maps to the source one.
          </p>
        </section>
      </div>

    </div>
  )
}
