// DumbGrid — a dashboard grid: blocks sized in whole columns/rows, draggable and
// resizable in grid steps. Layout persists to localStorage (reload to see).
//
// Drag a block by its ⠿ header, resize from the bottom-right corner.
// Nothing here measures a single element: column width comes from a
// ResizeObserver on the container, everything else is arithmetic.
import { createSignal, For, Show } from 'solid-js'
import { DumbGrid, type DumbGridItem } from 'solid-dumb-kit'

const STORAGE_KEY = 'example:dumb-grid'

// Заголовок с ручкой: [data-drag-handle] внутри блока = тянем только за него,
// остальное содержимое блока остаётся кликабельным.
const Card = (p: { title: string; accent?: string; children?: any }) => (
  <div class="card" style={{ '--accent': p.accent ?? '#3b82f6' }}>
    <div class="card-head" data-drag-handle>
      <span class="grip">⠿</span>
      <span class="card-title">{p.title}</span>
    </div>
    <div class="card-body">{p.children}</div>
  </div>
)

const bars = (values: Array<number>) => (
  <div class="bars">
    <For each={values}>{(v) => <i style={{ height: `${v}%` }} />}</For>
  </div>
)

const kpi = (value: string, label: string) => (
  <div class="kpi">
    <b>{value}</b>
    <span>{label}</span>
  </div>
)

// Стартовый набор. Ширины заданы пресетами ('half', 'quarter', '1/4') — числа
// колонок тоже работают, пресет просто читается лучше на 12-колоночной сетке.
const initialItems = (): Array<DumbGridItem> => [
  { id: 'revenue', w: 'half', h: 2, minW: 'quarter', minH: 2, content: () => (
    <Card title="Revenue" accent="#3b82f6">
      {bars([40, 65, 52, 78, 61, 88, 72, 95, 83, 70, 91, 100])}
    </Card>
  ) },
  { id: 'orders', w: 'quarter', h: 1, content: () => <Card title="Orders" accent="#10b981">{kpi('1 284', 'this week')}</Card> },
  { id: 'refunds', w: 'quarter', h: 1, content: () => <Card title="Refunds" accent="#f97316">{kpi('37', 'this week')}</Card> },
  { id: 'stock', w: 'quarter', h: 2, minH: 2, content: () => (
    <Card title="Low stock" accent="#ef4444">
      <ul class="list">
        <For each={['Chair Oak', 'Table Pine', 'Lamp Brass', 'Rug Wool', 'Shelf Ash']}>
          {(name, i) => <li><span>{name}</span><b>{5 - i()}</b></li>}
        </For>
      </ul>
    </Card>
  ) },
  { id: 'traffic', w: 'half', h: 2, minW: 'third', content: () => (
    <Card title="Traffic by source" accent="#8b5cf6">
      {bars([88, 54, 44, 30, 22, 18, 12, 8])}
    </Card>
  ) },
  { id: 'notes', w: '1/4', h: 1, content: () => (
    <Card title="Note (has an input)" accent="#64748b">
      <input placeholder="type here — drag still works from ⠿" />
    </Card>
  ) },
  { id: 'pinned', w: 'quarter', h: 1, locked: true, removable: false, content: () => (
    <Card title="Pinned (locked)" accent="#0ea5e9">{kpi('🔒', 'not draggable')}</Card>
  ) },
]

type Mode = 'flow' | 'dense' | 'free'

// пресеты для кнопки «добавить»: подпись + размер
const NEW_BLOCK = [
  { label: '+ full × 2', w: 'full' as const, h: 2 },
  { label: '+ half', w: 'half' as const, h: 1 },
  { label: '+ quarter', w: 'quarter' as const, h: 1 },
] satisfies Array<{ label: string; w: DumbGridItem['w']; h: number }>

export default function DumbGridExample() {
  const [items, setItems] = createSignal<Array<DumbGridItem>>(initialItems())
  const [seq, setSeq] = createSignal(0)
  const [cols, setCols] = createSignal(12)
  const [mode, setMode] = createSignal<Mode>('flow')
  const [showGrid, setShowGrid] = createSignal<boolean | 'drag'>('drag')
  const [animate, setAnimate] = createSignal(true)
  const [resizable, setResizable] = createSignal(true)
  // Сброс = вычистить ключ и перемонтировать: стор — это просто localStorage-ключ
  const [nonce, setNonce] = createSignal(1)
  const addBlock = (w: DumbGridItem['w'], h: number) => {
    const n = seq() + 1
    setSeq(n)
    setItems((list) => [
      ...list,
      {
        id: `extra-${n}`, w, h,
        content: () => <Card title={`Added #${n}`} accent="#14b8a6">{kpi('🆕', `${w} × ${h}`)}</Card>,
      },
    ])
  }
  // Удаление: набором блоков владеет пример, кит только рисует кнопку ✕
  const removeBlock = (id: string) => setItems((list) => list.filter((it) => it.id !== id))

  const reset = () => {
    // у каждого режима свой стор: у free там ещё и координаты, и мешать их
    // с потоковой раскладкой смысла нет
    for (const m of ['flow', 'dense', 'free']) localStorage.removeItem(`${STORAGE_KEY}:${m}`)
    setItems(initialItems())
    setSeq(0)
    setNonce((n) => n + 1)
  }

  return (
    <div class="dg-example">
      <h3>DumbGrid</h3>
      <p class="note">
        Drag a block by its <b>⠿</b> header, resize from the <b>bottom-right corner</b> — both snap to
        whole columns and rows. In <b>free</b> mode you can drop a block anywhere, including the empty
        space below; a red frame means the spot is taken and the drop is refused. Layout is saved to
        <code>localStorage</code> per mode; reload and it sticks.
      </p>

      <div class="bar">
        <label>
          mode
          <select value={mode()} onChange={(e) => setMode(e.currentTarget.value as Mode)}>
            <option value="flow">flow — order, holes stay</option>
            <option value="dense">dense — holes get filled</option>
            <option value="free">free — put it anywhere</option>
          </select>
        </label>
        <label>
          grid lines
          <select
            value={String(showGrid())}
            onChange={(e) => {
              const v = e.currentTarget.value
              setShowGrid(v === 'drag' ? 'drag' : v === 'true')
            }}
          >
            <option value="drag">while dragging</option>
            <option value="true">always</option>
            <option value="false">never</option>
          </select>
        </label>
        <label>
          columns
          <select value={cols()} onChange={(e) => setCols(Number(e.currentTarget.value))}>
            <For each={[4, 6, 8, 12]}>{(n) => <option value={n}>{n}</option>}</For>
          </select>
        </label>
        <label><input type="checkbox" checked={animate()} onChange={(e) => setAnimate(e.currentTarget.checked)} /> animate</label>
        <label><input type="checkbox" checked={resizable()} onChange={(e) => setResizable(e.currentTarget.checked)} /> resizable</label>
        <For each={NEW_BLOCK}>
          {(p) => <button onClick={() => addBlock(p.w, p.h)}>{p.label}</button>}
        </For>
        <button onClick={reset}>Reset layout</button>
      </div>

      {/* keyed по nonce+режиму: смена значения пересоздаёт компонент. Нужно и для
          кнопки Reset (перечитать уже пустой стор), и для переключения режима —
          storageKey компонент читает при монтировании, а сторы у режимов разные */}
      <Show when={`${nonce()}:${mode()}`} keyed>
        <DumbGrid
          storageKey={`${STORAGE_KEY}:${mode()}`}
          mode={mode()}
          showGrid={showGrid()}
          cols={cols()}
          rowHeight={92}
          gap={12}
          animate={animate()}
          resizable={resizable()}
          items={items()}
          onRemove={removeBlock}
          labels={{ remove: 'Remove block' }}
          blockStyle={{ cursor: 'default' }}
        />
      </Show>

      <style>{`
        .dg-example { padding: 16px; max-width: 1100px; margin: 0 auto }
        .dg-example h3 { margin: 0 0 4px }
        .dg-example .note { margin: 0 0 10px; font-size: 13px; color: #64748b }
        .dg-example .bar { display: flex; gap: 14px; align-items: center; flex-wrap: wrap;
                           margin: 0 0 12px; font-size: 13px; color: #334155 }
        .dg-example .bar label { display: inline-flex; gap: 6px; align-items: center }
        .dg-example [data-grid-remove] { border-radius: 8px }
        .dg-example [data-grid-remove]:hover { opacity: 1 !important; color: #ef4444 }
        .dg-example .bar select, .dg-example .bar button {
          font: inherit; padding: 4px 8px; border: 1px solid #cbd5e1;
          border-radius: 8px; background: #fff; cursor: pointer }

        .dg-example .card { height: 100%; display: flex; flex-direction: column;
                            box-sizing: border-box; overflow: hidden;
                            border: 1px solid #e2e8f0; border-radius: 12px; background: #fff;
                            box-shadow: 0 1px 2px rgba(15,23,42,.04) }
        .dg-example .card-head { display: flex; align-items: center; gap: 8px;
                                 padding: 8px 10px; cursor: grab; user-select: none;
                                 border-bottom: 1px solid #eef2f7;
                                 background: color-mix(in srgb, var(--accent) 8%, #fff) }
        .dg-example .card-head:active { cursor: grabbing }
        .dg-example .grip { color: #94a3b8; font-size: 14px; line-height: 1 }
        .dg-example .card-title { font-size: 13px; font-weight: 600; color: #0f172a;
                                  padding-right: 20px }
        .dg-example .card-body { flex: 1; min-height: 0; padding: 10px; overflow: auto;
                                 scrollbar-gutter: stable }

        .dg-example .bars { display: flex; align-items: flex-end; gap: 4px; height: 100% }
        .dg-example .bars i { flex: 1; border-radius: 3px 3px 0 0;
                              background: color-mix(in srgb, var(--accent) 70%, #fff) }
        .dg-example .kpi { display: flex; flex-direction: column; justify-content: center; height: 100% }
        .dg-example .kpi b { font-size: 22px; color: #0f172a }
        .dg-example .kpi span { font-size: 12px; color: #64748b }
        .dg-example .list { margin: 0; padding: 0; list-style: none; font-size: 13px }
        .dg-example .list li { display: flex; justify-content: space-between;
                               padding: 3px 0; border-bottom: 1px dashed #eef2f7 }
        .dg-example .list b { color: #ef4444 }
        .dg-example input { font: inherit; width: 100%; box-sizing: border-box;
                            padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 8px }
      `}</style>
    </div>
  )
}
