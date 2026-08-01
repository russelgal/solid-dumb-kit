// DumbBoard — секции с блоками: перенос между секциями, сортировка и ресайз
// самих секций.
//
// Состояние потребителя — ОДИН массив: секции, у каждой свои блоки внутри.
// Компонент ничего не хранит и ничего не мутирует: на каждом шаге жеста он
// отдаёт новый массив в `setSections`, а хранишь его ты.
import { createSignal } from 'solid-js'
import { DumbBoard, type BoardSection, type BlockLimits } from '@solid-dumb-kit/board'
import { Bar, Switch, Check, Pick, Btn, Note } from '../_controls'

type Widget = { id: string; title: string; kind: string; w: number; h: number } & BlockLimits

const KINDS = ['график', 'таблица', 'счётчик', 'карта', 'лента']

// Размеры блоков — В ЯЧЕЙКАХ сетки, а не в пикселях: ширина колонками зоны
// (`blockSpan`), высота строками (`blockRows`). Высоту в пикселях задавать не
// надо вовсе — блок занимает свои ячейки целиком.
//
// Пределы разные нарочно, чтобы витрина показывала все случаи:
//  • `minW` — до какой ширины блок согласен УЖАТЬСЯ, лишь бы не уезжать вниз
//    (не задан — уезжает целым, но сузить его ресайзом всё равно можно);
//  • `maxW`/`maxH` — докуда пускает ресайз; ширину можно долей (`'half'`).
const SIZES: Array<Pick<Widget, 'w' | 'h'> & BlockLimits> = [
  { w: 1, h: 1, maxW: 'half', maxH: 2 },
  { w: 2, h: 1, minW: 1, maxH: 3 },
  { w: 1, h: 2, minH: 2, maxH: 4 },
  { w: 1, h: 1 },
  { w: 2, h: 2, minW: 1, maxW: 'full', maxH: 4 },
  { w: 1, h: 1, minW: 1, maxW: 2 },
]
const widget = (i: number): Widget => ({
  id: `w${i}`,
  title: `Блок ${i + 1}`,
  kind: KINDS[i % KINDS.length],
  ...SIZES[i % SIZES.length],
})

/** пределы блока — одним местом: и в проп доски, и в подпись на карточке */
const limitsOf = (w: Widget): BlockLimits => ({
  minW: w.minW, maxW: w.maxW, minH: w.minH, maxH: w.maxH,
})
/** «1…half» — компактная запись предела: пропуск значит «без ограничения» */
const range = (min: BlockLimits['minW'], max: BlockLimits['maxW']) =>
  `${min ?? 1}…${max ?? '∞'}`

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

  /**
   * Размеры держим ОТДЕЛЬНОЙ картой, а не полями блока: объект блока обязан
   * пережить переезд между секциями (`{ ...w, ...size }` — уже другой объект,
   * `<For>` пересоздал бы узел, и FLIP анимировать было бы нечего).
   */
  const [sizes, setSizes] = createSignal<Record<string, { w: number; h: number }>>({})
  const sizeOf = (w: Widget) => sizes()[w.id] ?? { w: w.w, h: w.h }

  // колонки внутри секций крутим снаружи — у широкой их вдвое больше
  const withCols = () =>
    sections().map((s) => ({ ...s, cols: s.id === 'archive' ? cols() * 2 : cols() }))

  return (
    <div class="p-5 text-slate-900">
      <h3 class="mb-1 text-lg font-semibold">DumbBoard — секции, блоки и переносы между ними</h3>
      <p class="mb-2 max-w-[92ch] text-sm text-base-content">
        <b>Блоки живут на сетке ячеек</b> — размер целый: ширина колонками зоны
        (<code>blockSpan</code>), высота строками (<code>blockRows</code>). Место задаётся явными{' '}
        <code>grid-column</code>/<code>grid-row</code>, посчитанными арифметикой, поэтому внутри
        секции DOM не трогается вовсе. Перенос в соседнюю секцию без перестановки DOM невозможен, и
        это единственное место, где DOM меняется. Оба случая доигрывает <b>FLIP</b>.
      </p>
      <p class="mb-2 max-w-[92ch] text-sm text-base-content">
        Секции тащат за заголовок, размер тянут за правый край, нижний или угол; двойной клик по
        шапке — во всю ширину и обратно. Перенос идёт на нативном drag-and-drop, а ресайз — на
        указательных событиях: <code>dragover</code> не даёт покадровой точности, которая нужна,
        когда тянут размер.
      </p>
      <p class="mb-2 max-w-[92ch] text-sm text-base-content">
        Состояние — <b>один массив</b>: секции, у каждой свои блоки. Доска ничего не хранит и не
        мутирует, а на каждом шаге жеста отдаёт новый массив в <code>setSections</code>. Ужатая
        ширина тоже нигде не хранится: широкий блок с <code>minW</code> из{' '}
        <code>blockLimits</code> втискивается в остаток строки, а на просторном месте сам
        разворачивается обратно. Размер блока тянут за уголок — пока тянешь, едет рамка-превью,
        а <code>onBlockResize</code> отдаёт новый размер тебе.
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
        <Btn onClick={() => { setSections(SECTIONS0); setSizes({}); setLog('раскладка сброшена') }}>
          Сбросить раскладку
        </Btn>
        <Note>{log()}</Note>
      </Bar>

      <DumbBoard
        sections={withCols()}
        setSections={setSections}
        id={(w) => w.id}
        blockSpan={(w) => sizeOf(w).w}
        blockRows={(w) => sizeOf(w).h}
        // minW задан не у всех: без него блок не ужимается сам, но ресайзом
        // сузить его всё равно можно — это разные вещи
        blockLimits={limitsOf}
        onBlockResize={(w, size) => {
          setSizes({ ...sizes(), [w.id]: size })
          setLog(`${w.title} — ${size.w}×${size.h} ячеек`)
        }}
        showGrid="drag"
        onMove={(w, to, k) =>
          setLog(`${w.title} → «${sections().find((s) => s.id === to)?.title}», место ${k}`)}
        onSectionMove={(from, to) => setLog(`секция ${from} → место ${to}`)}
        onSectionResize={(id, size) =>
          setLog(`«${sections().find((s) => s.id === id)?.title}» — ${size.span} из 12 колонок, ${size.rows || '·'} строк`)}
        editable={edit()}
        animate={animate()}
        class="[&_.dumb-board-head]:text-slate-800"
      >
        {(w) => (
          <article
            class="flex h-full cursor-grab flex-col justify-center gap-0.5 overflow-hidden rounded-[10px] border-t-4 bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,.06),inset_0_0_0_1px_#e2e8f0] active:cursor-grabbing"
            style={{ 'border-top-color': HUE(Number(w.id.slice(1))) }}
          >
            <span class="text-[13.5px] font-medium text-slate-900">{w.title}</span>
            <span class="text-[11.5px] text-slate-600">{w.kind}</span>
            <span class="text-[11px] text-slate-700">{sizeOf(w).w}×{sizeOf(w).h} ячеек</span>
            {/* пределы — те же, что уходят в blockLimits: видно, докуда тянется
                ресайз и с какой ширины блок готов ужиматься */}
            <span class="text-[11px] leading-tight text-slate-600">
              Ш {range(w.minW, w.maxW)} · В {range(w.minH, w.maxH)}
              {w.minW === undefined ? '' : ' · ужимается'}
            </span>
          </article>
        )}
      </DumbBoard>
    </div>
  )
}
