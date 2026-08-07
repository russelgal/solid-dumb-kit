// DumbGrid — a dashboard grid: blocks sized in whole columns/rows, draggable and
// resizable in grid steps. Layout persists to localStorage (reload to see).
//
// Drag a block by its ⠿ header, resize from the bottom-right corner.
// Nothing here measures a single element: column width comes from a
// ResizeObserver on the container, everything else is arithmetic.
import { createSignal, For, Show } from 'solid-js'
import { Bar, Switch, Check, Pick, Btn, Code, Doc, Props } from '../_controls'
// Сниппеты доки живут отдельным файлом: их подсвечивает Shiki на сборке, и
// сюда приезжает уже готовая разметка (playground/snippets.ts).
import SNIP from './DumbGrid.snippets'

const GRID_PROPS = [
  { name: 'items', type: 'DumbGridItem[]', about: 'Блоки: id и content-функция. Набором владеет потребитель.' },
  {
    name: 'mode',
    type: "'flow' | 'dense' | 'free'",
    def: "'flow'",
    about: 'Течь по порядку, затыкать дырки или стоять по своим {x, y}.',
  },
  { name: 'cols', type: 'number', def: '12', about: 'Колонок в сетке.' },
  { name: 'rowHeight', type: 'number', def: '80', about: 'Высота строки, px.' },
  { name: 'gap / gapX / gapY', type: 'number', def: '12', about: 'Зазор, px.' },
  { name: 'storageKey', type: 'string', about: 'Ключ localStorage. Без него раскладка живёт только в памяти.' },
  { name: 'layout / onLayout', type: 'DumbGridLayout / (next) => void', about: 'Внешнее управление раскладкой — вместо storageKey, когда она едет на сервер.' },
  {
    name: 'onRemove',
    type: '(id: string) => void',
    about: 'Задан — на блоках появляется ✕. Убрать блок из items потребитель должен сам; кит чистит за ним раскладку.',
  },
  { name: 'group / name', type: 'DumbGridGroupHandle / string', about: 'Группа сеток: с ней блок можно перетащить в соседнюю сетку.' },
  { name: 'resizable', type: 'boolean', def: 'true', about: 'Разрешён ли ресайз блоков.' },
  {
    name: 'editable',
    type: 'boolean',
    def: 'true',
    about: 'false — боевой экран: отдельная ветка рендера без ручек, кнопок и обработчиков.',
  },
  { name: 'disabled', type: 'boolean', def: 'false', about: 'Жесты выключены, но разметка редактора остаётся — например, пока идёт сохранение.' },
  { name: 'showGrid', type: "boolean | 'drag'", def: "'drag'", about: 'Разметка сетки: во время жеста, всегда или никогда. Один элемент-подложка с градиентом.' },
  {
    name: 'spareRows',
    type: 'number',
    def: '2 в free, 0 в потоке',
    about: 'Запас пустых строк под раскладкой. Постоянный: расти во время жеста нельзя — появится полоса прокрутки и собьёт шаг колонок.',
  },
  { name: 'pressDelay / mouseThreshold', type: 'number', def: '350 / —', about: 'Пороги старта: удержание для пальца, расстояние для мыши.' },
  { name: 'animate', type: 'boolean', def: 'системная настройка', about: 'Расступание и приземление; не при prefers-reduced-motion.' },
  { name: 'blockClass / blockStyle', type: 'string / JSX.CSSProperties', about: 'Оформление блока-обёртки.' },
]

const ITEM_PROPS = [
  { name: 'id', type: 'string', about: 'Ключ блока — по нему хранится раскладка.' },
  { name: 'content', type: '() => JSX.Element', about: 'Содержимое блока.' },
  {
    name: 'w',
    type: "number | 'half' | 'third' | '5/12' | …",
    def: '1',
    about: 'Ширина: колонками или долей сетки. Доля округляется ВНИЗ, иначе N блоков по 1/N не влезут в строку.',
  },
  { name: 'h', type: 'number', def: '1', about: 'Высота в строках.' },
  { name: 'x / y', type: 'number', about: 'Стартовая клетка в режиме free. В потоке не нужны — это мусор в сторе.' },
  { name: 'minW / maxW / minH / maxH', type: 'SpanValue / number', about: 'Пределы ресайза; ширина — тоже числом или пресетом.' },
]
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


      <hr class="my-6 border-base-300" />

      <h4 class="text-lg font-semibold">Как это подключить</h4>
      <p class="mt-1 max-w-[92ch] text-sm">
        Пакет ставится отдельно от остального кита — потребитель берёт только то, что взял.
      </p>
      <Code title="Установка" code={SNIP.install} />

      <Doc title="Дашборд">
        <p>
          Размеры блоков целые: <code>w</code> колонок на <code>h</code> строк. Ширина колонки
          известна из <code>ResizeObserver</code>, поэтому все позиции считаются арифметикой — по
          блокам не снимается ни одного прямоугольника. Позиции проставляются явно
          (<code>grid-column-start</code>), а не авто-потоком: иначе браузер домысливал бы
          раскладку и она расходилась бы с расчётом.
        </p>
      </Doc>
      <Code title="Сетка с сохранением" code={SNIP.basic} />

      <Doc title="Три режима">
        <p>
          Компакции и каскада коллизий нет ни в одном режиме — это сознательно, дашборд не должен
          перекладываться сам. В потоковых блоки текут по порядку, а расступание соседей считается
          вычитанием двух раскладок. В <code>free</code> соседи не двигаются вовсе: дроп на занятое
          отклоняется, ресайз обрезается по свободному месту.
        </p>
      </Doc>
      <Code title="flow, dense, free" code={SNIP.modes} />

      <Doc title="Ширина долями">
        <p>
          Кроме числа колонок ширину можно задать долей сетки. Доля округляется ВНИЗ: иначе три
          блока по <code>third</code> не влезли бы в строку на неделящейся сетке. Движок при этом
          работает только числами — пресеты разрешаются на границе.
        </p>
      </Doc>
      <Code title="Доли и пределы" code={SNIP.size} />

      <Doc title="Где живёт раскладка">
        <p>
          Проще всего отдать её киту вместе с <code>storageKey</code>. Если раскладка едет на
          сервер — берётся пара <code>layout</code> / <code>onLayout</code>. И в обоих случаях
          сохранённое стоит прогонять через <code>mergeLayout</code>: набор блоков меняется, а в
          хранилище лежит вчерашний снимок.
        </p>
      </Doc>
      <Code title="Своё хранилище" code={SNIP.state} />

      <Doc title="Просмотр против редактирования">
        <p>
          <code>editable={"{false}"}</code> — это отдельная ветка рендера, а не флаг: ref навешивается
          при создании элемента, так что «выключить потом» означало бы оставить слушатели висеть.{' '}
          <code>disabled</code> — другое: обвязка остаётся, глушатся только жесты.
        </p>
      </Doc>
      <Code title="Боевой экран" code={SNIP.view} />

      <Doc title="Две сетки рядом">
        <p>
          Перенос блока между сетками — отдельный движок (<code>createDumbGridGroup</code>): весь
          жест там живёт в координатах чужого контейнера, и веткой в основном коде это не
          выражается. Локальные перестановки каждая сетка по-прежнему делает сама.
        </p>
      </Doc>
      <Code title="Группа сеток" code={SNIP.group} />

      <h4 class="mt-6 text-lg font-semibold">DumbGrid</h4>
      <Props rows={GRID_PROPS} />

      <h4 class="mt-6 text-lg font-semibold">DumbGridItem</h4>
      <Props rows={ITEM_PROPS} />

    </div>
  )
}
