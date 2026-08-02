// DumbGrid — a dashboard grid: blocks sized in whole columns/rows, draggable and
// resizable in grid steps. Layout persists to localStorage (reload to see).
//
// Drag a block by its ⠿ header, resize from the bottom-right corner.
// Nothing here measures a single element: column width comes from a
// ResizeObserver on the container, everything else is arithmetic.
import { createSignal, For, Show } from 'solid-js'
import { Bar, Switch, Check, Pick, Btn } from '../_controls'
import { DumbGrid, type DumbGridItem } from '@solid-dumb-kit/grid'

const STORAGE_KEY = 'example:dumb-grid'

// Заголовок с ручкой: [data-drag-handle] внутри блока = тянем только за него,
// остальное содержимое блока остаётся кликабельным.
const Card = (p: { title: string; accent?: string; children?: any }) => (
  <div
    class="flex h-full box-border flex-col overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-sm"
    style={{ '--accent': p.accent ?? '#3b82f6' }}
  >
    {/* фон шапки — оттенок карточки: `--accent` каскадит от неё, поэтому цвет
        считается прямо здесь, а не заводится классом на каждый оттенок */}
    <div
      class="flex cursor-grab items-center gap-2 border-b border-base-200 px-2.5 py-2 select-none active:cursor-grabbing"
      style={{ background: 'color-mix(in srgb, var(--accent) 8%, var(--color-base-100))' }}
      data-drag-handle
    >
      <span class="text-sm/none text-base-content">⠿</span>
      <span class="pr-5 text-[13px] font-semibold text-base-content">{p.title}</span>
    </div>
    <div class="min-h-0 flex-1 overflow-auto p-2.5 [scrollbar-gutter:stable]">{p.children}</div>
  </div>
)

const bars = (values: Array<number>) => (
  <div class="flex h-full items-end gap-1 [&>i]:flex-1 [&>i]:rounded-t-[3px] [&>i]:bg-[color-mix(in_srgb,var(--accent)_70%,var(--color-base-100))]">
    <For each={values}>{(v) => <i style={{ height: `${v}%` }} />}</For>
  </div>
)

const kpi = (value: string, label: string) => (
  <div class="flex h-full flex-col justify-center [&>b]:text-[22px] [&>b]:text-base-content [&>span]:text-xs [&>span]:text-base-content">
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
      <ul class="m-0 list-none p-0 text-[13px] [&>li]:flex [&>li]:justify-between [&>li]:border-b [&>li]:border-dashed [&>li]:border-base-200 [&>li]:py-0.5 [&_b]:text-error">
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
      <input class="box-border w-full rounded-lg border border-base-300 px-2 py-1.5" placeholder="type here — drag still works from ⠿" />
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
  const [edit, setEdit] = createSignal(true)
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
    <div class="p-5 [&_[data-grid-remove]]:rounded-lg [&_[data-grid-remove]:hover]:!opacity-100 [&_[data-grid-remove]:hover]:text-error">
      <h3 class="mb-1 text-lg font-semibold">DumbGrid</h3>
      <p class="mb-2.5 text-[13px] text-base-content">
        Drag a block by its <b>⠿</b> header, resize from the <b>bottom-right corner</b> — both snap to
        whole columns and rows. In <b>free</b> mode you can drop a block anywhere, including the empty
        space below; a red frame means the spot is taken and the drop is refused. Layout is saved to
        <code>localStorage</code> per mode; reload and it sticks. Turn <b>edit mode</b> off and you get the
        plain grid — no handles, no buttons, no listeners on the blocks.
      </p>

      <Bar>
        <Switch checked={edit()} onChange={setEdit}>edit mode</Switch>
        <Pick
          label="mode"
          value={mode()}
          options={[
            { value: 'flow', label: 'flow — order, holes stay' },
            { value: 'dense', label: 'dense — holes get filled' },
            { value: 'free', label: 'free — put it anywhere' },
          ]}
          onChange={(v) => setMode(v as Mode)}
        />
        <Pick
          label="grid lines"
          value={String(showGrid())}
          options={[
            { value: 'drag', label: 'while dragging' },
            { value: 'true', label: 'always' },
            { value: 'false', label: 'never' },
          ]}
          onChange={(v) => setShowGrid(v === 'drag' ? 'drag' : v === 'true')}
        />
        <Pick
          label="columns"
          value={cols()}
          options={[4, 6, 8, 12].map((n) => ({ value: n }))}
          onChange={(v) => setCols(Number(v))}
        />
        <Check checked={animate()} onChange={setAnimate}>animate</Check>
        <Check checked={resizable()} onChange={setResizable}>resizable</Check>
        <For each={NEW_BLOCK}>
          {(p) => <Btn onClick={() => addBlock(p.w, p.h)}>{p.label}</Btn>}
        </For>
        <Btn onClick={reset}>Reset layout</Btn>
      </Bar>

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
          editable={edit()}
          onRemove={removeBlock}
          labels={{ remove: 'Remove block' }}
          blockStyle={{ cursor: 'default' }}
        />
      </Show>

    </div>
  )
}
