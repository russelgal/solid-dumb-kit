// DumbTree — sidebar tree (hierarchy by `parent`) and a flat, drag-reorderable list.
//
// DumbTree is the one component in the kit that renders Tailwind + daisyUI class
// names. In a daisyUI app you need nothing extra. This example is standalone, so
// it ships a ~60-line shim below that fakes just the classes DumbTree touches —
// delete it in a real app.
import { createSignal, For } from 'solid-js'
import { DumbTree, type DumbTreeNode } from 'solid-dumb-kit'

// ── the shim: daisyUI-ish classes + emoji icons, so the demo stands alone ──
const SHIM = `
.dt-demo .w-64{width:16rem}.dt-demo .shrink-0{flex-shrink:0}.dt-demo .grow,.dt-demo .flex-1{flex:1}
.dt-demo .flex{display:flex}.dt-demo .items-center{align-items:center}
.dt-demo .gap-1{gap:.25rem}.dt-demo .gap-1\\.5{gap:.375rem}.dt-demo .gap-2{gap:.5rem}
.dt-demo .mb-2{margin-bottom:.5rem}.dt-demo .ml-auto{margin-left:auto}.dt-demo .ml-3{margin-left:.75rem}
.dt-demo .pl-3{padding-left:.75rem}.dt-demo .px-1{padding:0 .25rem}.dt-demo .p-2{padding:.5rem}
.dt-demo .px-1\\.5{padding-left:.375rem;padding-right:.375rem}.dt-demo .py-0\\.5{padding-top:.125rem;padding-bottom:.125rem}
.dt-demo .w-full{width:100%}.dt-demo .min-w-0{min-width:0}.dt-demo .text-sm{font-size:13px}.dt-demo .text-xs{font-size:11px}
.dt-demo .opacity-50{opacity:.5}.dt-demo .truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dt-demo .rounded{border-radius:6px}.dt-demo .rounded-box{border-radius:12px}
.dt-demo .size-4{width:1rem;height:1rem}.dt-demo .size-3\\.5{width:.875rem;height:.875rem}
.dt-demo .w-5{width:1.25rem}.dt-demo .cursor-pointer{cursor:pointer}.dt-demo .cursor-grab{cursor:grab}
.dt-demo .overflow-auto,.dt-demo .overflow-y-auto{overflow:auto}
.dt-demo .max-h-\\[80vh\\]{max-height:80vh}.dt-demo .max-h-screen{max-height:100vh}
.dt-demo .sticky{position:sticky}.dt-demo .top-0{top:0}.dt-demo .self-start{align-self:flex-start}
.dt-demo .bg-base-100{background:#fff}.dt-demo .shadow{box-shadow:0 1px 3px rgba(15,23,42,.12)}
.dt-demo .border-l{border-left:1px solid}.dt-demo .border-base-200{border-color:#e2e8f0}
.dt-demo .bg-primary\\/10{background:rgba(59,130,246,.1)}.dt-demo .text-primary{color:#2563eb}
.dt-demo .hover\\:bg-base-200:hover{background:#f1f5f9}
.dt-demo .text-base-content\\/30{color:rgba(15,23,42,.3)}.dt-demo .hover\\:text-base-content:hover{color:#0f172a}
.dt-demo .input{display:flex;height:2rem;padding:0 .625rem;border-radius:8px;background:#fff}
.dt-demo .input-bordered{box-shadow:inset 0 0 0 1px #cbd5e1}
.dt-demo .input input{border:none;outline:none;background:none;font:inherit;min-width:0}
.dt-demo .btn{display:inline-flex;align-items:center;justify-content:center;gap:.25rem;
  border:none;border-radius:8px;background:#f1f5f9;color:#0f172a;font:inherit;cursor:pointer}
.dt-demo .btn-xs{height:1.5rem;padding:0 .5rem;font-size:11px}
.dt-demo .btn-square{width:1.5rem;padding:0}
.dt-demo .btn-ghost{background:transparent}
.dt-demo .btn-active.btn-primary{background:#2563eb;color:#fff}
.dt-demo .join{display:flex}
.dt-demo .join-item:not(:first-child){border-top-left-radius:0;border-bottom-left-radius:0}
.dt-demo .join-item:not(:last-child){border-top-right-radius:0;border-bottom-right-radius:0;margin-right:1px}
.dt-demo .loading{display:inline-block}
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
    <span style={{ 'font-size': '11px', color: '#94a3b8', 'font-variant-numeric': 'tabular-nums' }}>
      {n.count || ''}
    </span>
  )

  return (
    <div class="dt-demo" style={{ padding: '16px', 'max-width': '1040px', margin: '0 auto', color: '#0f172a' }}>
      <style>{SHIM}</style>

      <p style={{ margin: '0 0 16px', 'font-size': '13px', color: '#64748b', 'max-width': '68ch' }}>
        Type in the search box (fuzzy — <code>gst hs</code> finds “Guest houses”), toggle the sort
        mode, collapse folders and reload the page: expanded folders and sort mode are persisted
        per <code>storageKey</code>. Hidden items are dimmed via <code>rowClass</code>, counts come
        from <code>rowExtra</code> — the kit itself knows nothing about those fields.
      </p>

      <div style={{ display: 'flex', gap: '24px', 'align-items': 'flex-start', 'flex-wrap': 'wrap' }}>
        <section>
          <h3 style={{ margin: '0 0 8px', 'font-size': '14px' }}>Tree — hierarchy by <code>parent</code></h3>
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
          <h3 style={{ margin: '0 0 8px', 'font-size': '14px' }}>Flat + <code>sortable</code> — drag by ⠿</h3>
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

        <section style={{ flex: '1', 'min-width': '240px' }}>
          <h3 style={{ margin: '0 0 8px', 'font-size': '14px' }}>Callbacks</h3>
          <code style={{ display: 'block', padding: '10px 12px', 'border-radius': '10px',
                         background: '#0f172a', color: '#e2e8f0', 'font-size': '13px' }}>
            {log()}
          </code>
          <p style={{ 'font-size': '13px', color: '#64748b', 'line-height': '1.6' }}>
            Current order:<br />
            <For each={flat()}>{(n, i) => <span>{i() > 0 ? ' · ' : ''}{n.title}</span>}</For>
          </p>
          <p style={{ 'font-size': '12px', color: '#94a3b8' }}>
            Drag-reorder is flat-only, and switches off while a filter is typed — the displayed
            order no longer maps to the source one.
          </p>
        </section>
      </div>

      <style>{`.dt-demo .dt-dim{opacity:.45}`}</style>
    </div>
  )
}
