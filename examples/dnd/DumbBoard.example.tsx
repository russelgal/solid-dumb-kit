// DumbBoard — секции с блоками: перенос между секциями, сортировка и ресайз
// самих секций.
//
// Состояние потребителя — ОДИН массив: секции, у каждой свои блоки внутри.
// Компонент ничего не хранит и ничего не мутирует: на каждом шаге жеста он
// отдаёт новый массив в `setSections`, а хранишь его ты.
import { createSignal } from 'solid-js'
import { DumbBoard, type BoardSection, type BlockLimits } from '@solid-dumb-kit/board'
import { Bar, Switch, Check, Pick, Btn, Note, Code, Doc, Props } from '../_controls'
// Сниппеты доки живут отдельным файлом: их подсвечивает Shiki на сборке, и
// сюда приезжает уже готовая разметка (playground/snippets.ts).
import SNIP from './DumbBoard.snippets'

const BOARD_PROPS = [
  { name: 'sections', type: 'BoardSection<T>[]', about: 'Секции вместе с блоками — один массив, он же всё состояние доски.' },
  {
    name: 'setSections',
    type: '(next) => void',
    about: 'Новая раскладка. Зовётся ПО ХОДУ жеста, на каждом шаге; массив не мутируется.',
  },
  { name: 'id', type: '(item: T) => string', about: 'Стабильный ключ блока.' },
  { name: 'onMove', type: '(item, toSection, toIndex) => void', about: 'Блок переехал — сюда вешают сохранение.' },
  { name: 'onSectionMove', type: '(from, to) => void', about: 'Секцию перетащили за заголовок.' },
  { name: 'onSectionResize', type: '(id, { span, rows }) => void', about: 'Секция сменила размер: колонок доски и строк сетки блоков.' },
  {
    name: 'blockSpan',
    type: '(item) => number | доля',
    def: '1',
    about: "Сколько колонок зоны занимает блок. Кроме числа принимается доля ('half', '1/3').",
  },
  {
    name: 'blockLimits',
    type: '(item) => BlockLimits',
    about: 'Пределы в ячейках. minW работает дважды: до него блок ужмётся, чтобы влезть в остаток строки, и ниже него не пустит ресайз.',
  },
  { name: 'blockRows', type: '(item) => number', def: '1', about: 'Высота блока в строках сетки зоны.' },
  {
    name: 'onBlockResize',
    type: '(item, { w, h }) => void',
    about: 'Пока проп не задан, у блоков нет ни ручки, ни жеста: размер живёт в твоих данных.',
  },
  { name: 'cols', type: 'number', def: '12', about: 'Колонок у самой доски.' },
  { name: 'gap / zoneGap', type: 'number', def: '14 / 8', about: 'Зазор доски и зазор внутри секции, px.' },
  { name: 'rowHeight', type: 'number', def: '76', about: 'Шаг строки внутри секции — он же высота ячейки зоны.' },
  { name: 'minSpan', type: 'number', def: '3', about: 'Минимальная ширина секции в колонках.' },
  { name: 'showGrid', type: "boolean | 'drag'", def: "'drag'", about: 'Разметка сетки внутри секций.' },
  { name: 'editable', type: 'boolean', def: 'true', about: 'Без неё нет ни жестов, ни ручек, ни единого слушателя на блоках.' },
  { name: 'resizable', type: 'boolean', def: 'true', about: 'Разрешить ресайз секций.' },
  { name: 'sectionActions', type: '(section) => JSX.Element', about: 'Свои кнопки в правой части шапки секции.' },
  { name: 'children', type: '(item, section) => JSX.Element', about: 'Верни ОДИН корневой элемент — доска привяжется прямо к нему.' },
]

const SECTION_PROPS = [
  { name: 'id', type: 'string', about: 'Ключ секции — он же приходит в onMove и accepts.' },
  { name: 'items', type: 'T[]', about: 'Блоки этой секции; порядок в массиве = порядок на экране.' },
  { name: 'title / subtitle', type: 'JSX.Element', about: 'Заголовок (он же ручка переноса секции) и приписка мельче. Нет заголовка — нет и шапки.' },
  { name: 'cols', type: 'number', def: '3', about: 'Колонок внутри секции.' },
  { name: 'span', type: 'number', def: 'половина', about: 'Ширина секции в колонках доски.' },
  { name: 'rows', type: 'number', def: 'по содержимому', about: 'Высота в строках сетки блоков.' },
  { name: 'accepts', type: '(from: string) => boolean', about: 'Пускать ли сюда блоки из секции from.' },
]

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

  /**
   * Удаление — на стороне потребителя: доска ничего не хранит, `sections` наш
   * массив, и выбросить из него блок или секцию можно тем же `setSections`.
   */
  const dropBlock = (id: string, title: string) => {
    setSections(sections().map((s) => ({ ...s, items: s.items.filter((w) => w.id !== id) })))
    setLog(`«${title}» удалён`)
  }
  const dropSection = (id: string, title: string) => {
    setSections(sections().filter((s) => s.id !== id))
    setLog(`секция «${title}» удалена вместе с блоками`)
  }

  // колонки внутри секций крутим снаружи — у широкой их вдвое больше
  const withCols = () =>
    sections().map((s) => ({ ...s, cols: s.id === 'archive' ? cols() * 2 : cols() }))

  return (
    <div class="p-5 text-base-content">
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
      <p class="mb-2 max-w-[92ch] text-sm text-base-content">
        Блоки тут нарочно разнокалиберные — на них видно укладку потоком. Обычный дашборд, где все
        карточки одной высоты, показан отдельной вкладкой <b>Дашборд на DumbBoard</b>.
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
        sectionActions={(s) => (
          <button
            class="btn btn-ghost btn-xs"
            title="удалить секцию вместе с блоками"
            onClick={() => dropSection(s.id, String(s.title))}
          >
            ✕
          </button>
        )}
        class="[&_.dumb-board-head]:text-base-content"
      >
        {(w) => (
          <article
            class="group relative flex h-full cursor-grab flex-col justify-center gap-0.5 overflow-hidden rounded-box border-t-4 bg-base-100 px-2.5 py-2 shadow-sm ring-1 ring-base-300 active:cursor-grabbing"
            style={{ 'border-top-color': HUE(Number(w.id.slice(1))) }}
          >
            {/* `data-no-drag` — иначе нажатие уедет в перетаскивание и клика не
                случится: кнопка лежит внутри перетаскиваемого блока */}
            <button
              data-no-drag
              class="btn btn-ghost btn-xs absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100"
              title="удалить блок"
              onClick={() => dropBlock(w.id, w.title)}
            >
              ✕
            </button>
            <span class="text-[13.5px] font-medium text-base-content">{w.title}</span>
            <span class="text-[11.5px] text-base-content">{w.kind}</span>
            <span class="text-[11px] text-base-content">{sizeOf(w).w}×{sizeOf(w).h} ячеек</span>
            {/* пределы — те же, что уходят в blockLimits: видно, докуда тянется
                ресайз и с какой ширины блок готов ужиматься */}
            <span class="text-[11px] leading-tight text-base-content">
              Ш {range(w.minW, w.maxW)} · В {range(w.minH, w.maxH)}
              {w.minW === undefined ? '' : ' · ужимается'}
            </span>
          </article>
        )}
      </DumbBoard>

      <hr class="my-6 border-base-300" />

      <h4 class="text-lg font-semibold">Как это подключить</h4>
      <p class="mt-1 max-w-[92ch] text-sm">
        Пакет ставится отдельно от остального кита — потребитель берёт только то, что взял.
      </p>
      <Code title="Установка" code={SNIP.install} />

      <Doc title="Секции и блоки">
        <p>
          Доска — это секции с сеткой блоков внутри. Всё состояние умещается в один массив: у
          секции есть свои блоки, своя ширина на доске и своя внутренняя сетка. Разметку блока
          отдаёт <code>children</code> — доска цепляет жест прямо к возвращённому элементу.
        </p>
      </Doc>
      <Code title="Доска на две секции" code={SNIP.basic} />

      <Doc title="Данные не отстают от картинки">
        <p>
          <code>setSections</code> зовётся на каждом шаге жеста, а не один раз на дропе: браузер
          может не доставить <code>drop</code> (например, бросили за окном), и тогда «отложенное»
          применение потеряло бы перенос. Сохранять при этом надо в событиях —{' '}
          <code>onMove</code>, <code>onSectionMove</code>, <code>onSectionResize</code>, — иначе на
          каждый кадр уедет запрос.
        </p>
      </Doc>
      <Code title="Где сохранять" code={SNIP.state} />

      <Doc title="Размер блока">
        <p>
          Ширина задаётся колонками зоны или долей. <code>minW</code> работает дважды: до него блок
          согласен ужаться, чтобы влезть в остаток строки вместо переезда вниз, и ниже него его не
          пустит ресайз. Ужатая ширина нигде не хранится — на свободном месте блок сам вернётся к
          своей.
        </p>
      </Doc>
      <Code title="Ширина, пределы, ручка" code={SNIP.sizes} />

      <Doc title="Настройка секций">
        <p>
          Секция сама решает, кого принимать: <code>accepts</code> получает имя секции, откуда
          тянут. Плюс свои кнопки в шапке, разметка сетки во время жеста и режим просмотра —{' '}
          <code>editable={"{false}"}</code> не оставляет на блоках ни одного слушателя.
        </p>
      </Doc>
      <Code title="Секции и приём" code={SNIP.sections} />

      <h4 class="mt-6 text-lg font-semibold">DumbBoard</h4>
      <Props rows={BOARD_PROPS} />

      <h4 class="mt-6 text-lg font-semibold">BoardSection</h4>
      <Props rows={SECTION_PROPS} />

    </div>
  )
}
