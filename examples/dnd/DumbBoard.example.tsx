// DumbBoard — секции с блоками: перенос между секциями, сортировка и ресайз
// самих секций.
//
// Состояние потребителя — ОДИН массив: секции, у каждой свои блоки внутри.
// Компонент ничего не хранит и ничего не мутирует: на каждом шаге жеста он
// отдаёт новый массив в `setSections`, а хранишь его ты.
import { createSignal } from 'solid-js'
import { DumbBoard, type BoardSection } from '@solid-dumb-kit/board'
import { Bar, Switch, Check, Pick, Btn, Note } from '../_controls'

type Widget = { id: string; title: string; kind: string; w: number; h: number }

const KINDS = ['график', 'таблица', 'счётчик', 'карта', 'лента']

// Размеры блоков — В ЯЧЕЙКАХ сетки, а не в пикселях: ширина колонками зоны,
// высота строками. Иначе блоки не сходятся с сеткой по высоте, и в строке
// остаются рваные просветы там, где сосед оказался выше.
const ROW = 76
const ZONE_GAP = 8
const cellH = (h: number) => h * ROW + (h - 1) * ZONE_GAP

const SIZES = [
  { w: 1, h: 1 },
  { w: 2, h: 1 },
  { w: 1, h: 2 },
  { w: 1, h: 1 },
  { w: 2, h: 2 },
  { w: 1, h: 1 },
]
const widget = (i: number): Widget => ({
  id: `w${i}`,
  title: `Блок ${i + 1}`,
  kind: KINDS[i % KINDS.length],
  ...SIZES[i % SIZES.length],
})

/**
 * Блоки лежат ВНУТРИ своих секций. Переезд — это перенос ТОГО ЖЕ объекта из
 * одного массива в другой; копию делать нельзя (`{ ...item }`), иначе `<For>`
 * сочтёт блок другим элементом, пересоздаст узел, и анимировать станет нечего:
 * FLIP держится за живой элемент.
 */
const SECTIONS0: Array<BoardSection<Widget>> = [
  {
    id: 'sales',
    title: 'Продажи',
    subtitle: 'выручка и заказы',
    cols: 3,
    span: 6,
    items: Array.from({ length: 9 }, (_, i) => widget(i)),
  },
  {
    id: 'stock',
    title: 'Склад',
    subtitle: 'остатки',
    cols: 3,
    span: 6,
    items: Array.from({ length: 6 }, (_, i) => widget(i + 9)),
  },
  {
    id: 'archive',
    title: 'Архив',
    cols: 6,
    span: 12,
    items: Array.from({ length: 9 }, (_, i) => widget(i + 15)),
  },
]

const HUE = (i: number) => `oklch(0.75 0.12 ${(i * 53) % 360})`

export default function DumbBoardExample() {
  const [sections, setSections] = createSignal(SECTIONS0)
  const [edit, setEdit] = createSignal(true)
  const [animate, setAnimate] = createSignal(true)
  const [cols, setCols] = createSignal(3)
  const [log, setLog] = createSignal('тащи блок — или секцию за заголовок')

  // колонки внутри секций крутим снаружи — у широкой их вдвое больше
  const withCols = () =>
    sections().map((s) => ({ ...s, cols: s.id === 'archive' ? cols() * 2 : cols() }))

  return (
    <div class="p-5 text-slate-900">
      <h3 class="mb-1 text-lg font-semibold">DumbBoard — секции, блоки и переносы между ними</h3>
      <p class="mb-2 max-w-[92ch] text-sm text-base-content/80">
        <b>Блоки разной ширины и высоты</b> — размер в ячейках сетки: ширина колонками зоны
        (<code>blockSpan</code>), высота строками. Внутри секции DOM не трогается — двигается только{' '}
        <code>order</code>. Перенос в соседнюю секцию без перестановки DOM невозможен
        (<code>order</code> живёт внутри одного контейнера), и это единственное место, где DOM
        меняется. Оба случая доигрывает <b>FLIP</b>.
      </p>
      <p class="mb-2 max-w-[92ch] text-sm text-base-content/80">
        Секции тащат за заголовок, размер тянут за правый край, нижний или угол; двойной клик по
        шапке — во всю ширину и обратно. Перенос идёт на нативном drag-and-drop, а ресайз — на
        указательных событиях: <code>dragover</code> не даёт покадровой точности, которая нужна,
        когда тянут размер.
      </p>
      <p class="mb-2 max-w-[92ch] text-sm text-base-content/80">
        Состояние — <b>один массив</b>: секции, у каждой свои блоки. Доска ничего не хранит и не
        мутирует, а на каждом шаге жеста отдаёт новый массив в <code>setSections</code>.
      </p>

      <Bar>
        <Switch checked={edit()} onChange={setEdit}>режим правки</Switch>
        <Check checked={animate()} onChange={setAnimate}>анимация</Check>
        <Pick
          label="колонок в секции"
          value={cols()}
          options={[2, 3, 4, 6].map((n) => ({ value: n }))}
          onChange={(v) => setCols(Number(v))}
        />
        <Btn onClick={() => { setSections(SECTIONS0); setLog('раскладка сброшена') }}>
          Сбросить раскладку
        </Btn>
        <Note>{log()}</Note>
      </Bar>

      <DumbBoard
        sections={withCols()}
        setSections={setSections}
        id={(w) => w.id}
        blockSpan={(w) => w.w}
        onMove={(w, to, k) =>
          setLog(`${w.title} → «${sections().find((s) => s.id === to)?.title}», место ${k}`)}
        onSectionMove={(from, to) => setLog(`секция ${from} → место ${to}`)}
        onSectionResize={(id, size) =>
          setLog(`«${sections().find((s) => s.id === id)?.title}» — ${size.span} из 12 колонок, ${size.rows || '·'} строк`)}
        editable={edit()}
        animate={animate()}
        class="[&_.dumb-board-head]:text-slate-600"
      >
        {(w) => (
          <article
            class="flex cursor-grab flex-col justify-center gap-0.5 rounded-[10px] border-t-4 bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,.06),inset_0_0_0_1px_#e2e8f0] active:cursor-grabbing"
            style={{ 'border-top-color': HUE(Number(w.id.slice(1))), height: `${cellH(w.h)}px` }}
          >
            <span class="text-[13.5px] font-medium">{w.title}</span>
            <span class="text-[11.5px] text-slate-400">{w.kind}</span>
            <span class="text-[11px] text-slate-300">{w.w}×{w.h} ячеек</span>
          </article>
        )}
      </DumbBoard>
    </div>
  )
}
