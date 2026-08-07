// Длинный список: миллион строк, пул узлов, сортировка и фильтр в воркере.
//
// Пример отвечает на три вопроса, и у каждого — свой счётчик под панелью.
//
// 1. Сколько узлов В РАЗМЕТКЕ. Это умеет любая виртуализация: рисуем окно, а не
//    весь список.
// 2. Сколько узлов СОЗДАНО с начала. Вот тут виртуализации расходятся. Обычная
//    рисует окно списком (`For` по индексам окна): пролистал экран — старые
//    строки удалены, новые созданы, и счётчик растёт тысячами. Пул создаёт
//    ровно столько узлов, сколько влезает в окно, и дальше только меняет в них
//    текст и `transform`. Прокрутка перестаёт трогать структуру документа
//    вообще — ровно этим живёт fast-grid.
// 3. Сколько ждёт ГЛАВНЫЙ ПОТОК. Сортировка миллиона строк — это секунды, и
//    пока они идут, страница не отвечает. Поэтому порядок строк считает
//    `createRowIndex` в воркере, порциями, отменяя устаревший запрос на
//    полуслове: набирай в поле фильтра сколько угодно быстро — прокрутка не
//    заикнётся.
//
// Про высоту: миллион строк по 28px — это 28 млн пикселей распорки, а браузер
// не даёт элементу расти дальше ~17–33 млн (у каждого свой предел). Дальше
// распорка молча перестаёт расти, и полоса прокрутки начинает врать.
// `createVirtualizer` зажимает её потолком и растягивает прокрутку сам.
import { For, Show, createEffect, createSignal, onCleanup, untrack } from 'solid-js'
import {
  createRowIndex,
  createVirtualizer,
  onMounted,
  type RowIndex,
  type VirtualRange,
} from '@solid-dumb-kit/shared'
import { fmtNum } from '@solid-dumb-kit/utils'
import { Bar, Btn, Check, Note, Pick, Seg, Code, Doc, Props } from '../_controls'
// Сниппеты доки живут отдельным файлом: их подсвечивает Shiki на сборке, и
// сюда приезжает уже готовая разметка (playground/snippets.ts).
import SNIP from './virtual.snippets'

const VIRT_PROPS = [
  { name: 'count', type: '() => number', about: 'Сколько всего элементов.' },
  { name: 'itemSize', type: '() => number', about: 'Высота ряда ВМЕСТЕ с зазором, px.' },
  {
    name: 'itemSizes',
    type: '() => ArrayLike<number>',
    about: 'Размеры рядов поштучно, когда они разные. Заявленные, а не измеренные. Массив должен быть НОВЫМ при изменении.',
  },
  { name: 'columns', type: '() => number', def: '1', about: 'Сколько элементов в ряду — сетка плиток.' },
  { name: 'axis', type: "'x' | 'y'", def: "'y'", about: 'Вдоль какой оси прокрутка. x — шкала времени и прочее, что едет вбок.' },
  {
    name: 'lead',
    type: '() => number',
    def: '0',
    about: 'Сколько px стоит перед первым рядом в том же скроллере: липкая колонка, шапка. Без поправки окно уедет на её размер.',
  },
  { name: 'scroller', type: '() => HTMLElement | null', about: 'Что прокручивается.' },
  { name: 'overscan', type: 'number', def: '3', about: 'Сколько рядов рисовать сверх видимого. Меньше двух — при быстрой прокрутке появляется белая полоса.' },
  { name: 'maxHeight', type: 'number', about: 'Потолок высоты распорки. Ниже дефолта имеет смысл опускать разве что в тестах.' },
  { name: 'onChange', type: '(range: VirtualRange) => void', about: 'Окно изменилось: { start, end, offset, total }.' },
]

const VIRT_API = [
  { name: 'refresh()', type: '() => void', about: 'Пересчитать принудительно: сменилось число элементов или размер ряда.' },
  { name: 'destroy()', type: '() => void', about: 'Снять слушатели. В Solid вешается на onCleanup.' },
  { name: 'range.start / end', type: 'number', about: 'Что рисовать: полуинтервал индексов.' },
  { name: 'range.offset', type: 'number', about: 'На сколько сдвинуть нарисованное вдоль оси — transform, а не top.' },
  { name: 'range.total', type: 'number', about: 'Размер распорки. НЕ всегда count × itemSize: у высоты элемента есть потолок, за которым браузер врёт.' },
]

const ROW = 28
/** ширина колонки, когда список едет вбок */
const COL = 132
/** сколько строк вообще имеет смысл рисовать без виртуализации */
const PLAIN_CAP = 100_000

type Mode = 'pool' | 'window' | 'plain'
type Dir = 'none' | 'asc' | 'desc'
type Axis = 'y' | 'x'
/** слот пула: живёт от монтирования до конца, меняется только его содержимое */
type Slot = { at: () => number; put: (pos: number) => void }

export default function VirtualExample() {
  const [mode, setMode] = createSignal<Mode>('pool')
  const [axis, setAxis] = createSignal<Axis>('y')
  const [count, setCount] = createSignal(100_000)
  const [needle, setNeedle] = createSignal('')
  const [dir, setDir] = createSignal<Dir>('none')
  const [inline, setInline] = createSignal(false)

  const [range, setRange] = createSignal<VirtualRange>({ start: 0, end: 0, offset: 0, total: 0 })
  // порядок строк: `null` — исходный. Сравнение выключено: воркер отдаёт окно в
  // ту же память, и по ссылке новый ответ от старого не отличить
  const [order, setOrder] = createSignal<Uint32Array | null>(null, { equals: false })
  const [shown, setShown] = createSignal(100_000)
  const [stat, setStat] = createSignal({ ms: 0, partial: false })
  const [progress, setProgress] = createSignal<number | null>(null)
  const [slots, setSlots] = createSignal<Slot[]>([])

  const [nodes, setNodes] = createSignal(0)
  const [born, setBorn] = createSignal(0)
  /** чем движок порядка считает на самом деле, а не чем мы его просили */
  const [how, setHow] = createSignal({ threaded: false, shared: false })
  /** счётчик созданных узлов: копится в переменной, в сигнал попадает по таймеру */
  let created = 0

  let scroller!: HTMLDivElement
  let list: HTMLDivElement | undefined
  let index: RowIndex | null = null

  /** значения строк; выдумываются один раз и живут типизированным массивом */
  const [values, setValues] = createSignal(makeValues(100_000))

  function makeValues(n: number) {
    const v = new Float64Array(n)
    for (let i = 0; i < n; i++) v[i] = (i * 37) % 997
    return v
  }

  /** запрос к движку порядка; пустой — значит показываем всё как есть */
  function askedQuery() {
    const contains = needle().trim()
    const sort = dir() === 'none' ? undefined : { column: 'value', dir: dir() as 'asc' | 'desc' }
    const filter = contains ? { column: 'value', contains } : undefined
    return { sort, filter }
  }

  function ask() {
    const q = untrack(askedQuery)
    const total = untrack(values).length
    if (!q.sort && !q.filter) {
      // ни сортировки, ни фильтра — гонять миллион строк через воркер незачем
      index?.cancel()
      setOrder(null)
      setShown(total)
      setStat({ ms: 0, partial: false })
      setProgress(null)
      return
    }
    index?.query(q)
  }

  /** движок порядка пересоздаётся, когда меняют поток: он у него один на жизнь */
  createEffect(() => {
    const useInline = inline()
    const engine = createRowIndex({
      inline: useInline,
      onProgress: (p) => setProgress(p.done),
      onResult: (r) => {
        setOrder(r.order)
        setShown(r.matched)
        setStat({ ms: r.ms, partial: r.partial })
        if (!r.partial) setProgress(null)
      },
    })
    index = engine
    setHow({ threaded: engine.threaded, shared: engine.shared })
    engine.setData({
      count: untrack(values).length,
      columns: { value: { kind: 'number', values: untrack(values) } },
    })
    untrack(ask)
    onCleanup(() => {
      engine.destroy()
      if (index === engine) index = null
    })
  })

  /** сменилось число строк — данные едут в движок заново */
  createEffect(() => {
    const v = values()
    untrack(() => {
      index?.setData({ count: v.length, columns: { value: { kind: 'number', values: v } } })
      ask()
    })
  })

  /** сменился запрос — считаем порядок; предыдущий расчёт движок бросит сам */
  createEffect(() => {
    needle()
    dir()
    untrack(ask)
  })

  /** список едет вбок: та же арифметика, но по `scrollLeft` и ширине окна */
  const sideways = () => axis() === 'x'
  /** размер элемента вдоль оси прокрутки */
  const step = () => (sideways() ? COL : ROW)

  onMounted(() => {
    // ось движок берёт при создании (она решает, что читать — `scrollTop` или
    // `scrollLeft`), поэтому на её смену виртуализатор пересоздаётся
    createEffect(() => {
      const ax = axis()
      const v = createVirtualizer({
        count: () => shown(),
        itemSize: () => (ax === 'x' ? COL : ROW),
        axis: ax,
        scroller: () => scroller,
        onChange: setRange,
      })
      // окно зависит от числа видимых строк и от режима — пересчитываем явно,
      // а не опросом по таймеру
      createEffect(() => {
        shown()
        mode()
        v.refresh()
      })
      onCleanup(() => v.destroy())
    })
    const tick = setInterval(() => {
      setNodes(list ? list.childElementCount : 0)
      setBorn(created)
    }, 300)
    onCleanup(() => clearInterval(tick))
  })

  /**
   * Раздача позиций по слотам. Слот `s` держит ту позицию окна, у которой
   * остаток от деления на размер пула равен `s`: при сдвиге окна на строку
   * меняется ровно один слот, а не всё окно.
   */
  createEffect(() => {
    if (mode() !== 'pool') return
    const r = range()
    const need = Math.max(0, r.end - r.start)
    let pool = untrack(slots)
    if (pool.length < need + 2) {
      // пул только растёт: ужимать его при уменьшении окна — это снова
      // удалять узлы, то есть ровно то, от чего мы уходим
      const grown = pool.slice()
      while (grown.length < need + 2) {
        const [at, put] = createSignal(-1)
        grown.push({ at, put })
      }
      pool = grown
      setSlots(pool)
    }
    const size = pool.length
    for (let s = 0; s < size; s++) {
      const base = r.start + ((((s - r.start) % size) + size) % size)
      pool[s].put(base < r.end ? base : -1)
    }
  })

  /** какая строка данных стоит на позиции `pos` показанного порядка */
  const rowAt = (pos: number) => {
    if (pos < 0) return -1
    const o = order()
    if (!o) return pos
    return pos < o.length ? o[pos] : -1
  }

  const reset = () => {
    created = 0
    setBorn(0)
    setSlots([])
    scroller.scrollTop = 0
    scroller.scrollLeft = 0
  }

  /** одна строка; позиция приходит функцией — у пула она меняется без пересоздания */
  function Row(props: { pos: () => number }) {
    created++
    const row = () => rowAt(props.pos())
    /** сдвиг вдоль оси прокрутки — единственное, что меняется при прокрутке */
    const shift = () => range().offset + (props.pos() - range().start) * step()
    return (
      <div
        class={
          sideways()
            ? 'absolute inset-y-0 left-0 flex flex-col justify-center gap-1 border-r border-base-200 px-3 text-sm'
            : 'absolute inset-x-0 top-0 flex items-center gap-3 border-b border-base-200 px-3 text-sm'
        }
        style={{
          ...(sideways() ? { width: `${COL}px` } : { height: `${ROW}px` }),
          transform: sideways() ? `translateX(${shift()}px)` : `translateY(${shift()}px)`,
          visibility: row() < 0 ? 'hidden' : 'visible',
        }}
      >
        <span
          class={
            sideways()
              ? 'tabular-nums font-semibold text-base-content'
              : 'w-24 shrink-0 tabular-nums text-base-content'
          }
        >
          {row() < 0 ? '' : fmtNum(row() + 1)}
        </span>
        <span class="truncate">{row() < 0 ? '' : `${values()[row()]} у.е.`}</span>
      </div>
    )
  }

  /** окно позиций для режима «обычный `For`»: массив пересобирается на каждый сдвиг */
  const windowPositions = () => {
    const r = range()
    return Array.from({ length: Math.max(0, r.end - r.start) }, (_, i) => r.start + i)
  }

  const plainPositions = () => {
    const n = Math.min(shown(), PLAIN_CAP)
    return Array.from({ length: n }, (_, i) => i)
  }

  const isolated = () =>
    typeof globalThis !== 'undefined' &&
    (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated === true

  /**
   * Включить изоляцию страницы. Общая память с воркером требует заголовков
   * COOP/COEP, а статика (GitHub Pages) их не отдаёт — заголовки дописывает
   * service worker витрины, после чего страница перезагружается уже изолированной.
   */
  const enableIsolation = async () => {
    const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
    await navigator.serviceWorker.register(`${base}coi-sw.js`, { scope: base })
    await navigator.serviceWorker.ready
    location.reload()
  }

  return (
    <div class="p-5 text-base-content">
      <h3 class="mb-1 text-lg font-semibold">
        createVirtualizer + createRowIndex — миллион строк
      </h3>
      <p class="mb-3 max-w-[92ch] text-sm text-base-content">
        Размер элемента <b>заявлен</b> ({sideways() ? `${COL}px ширины` : `${ROW}px высоты`}), поэтому
        окно считается арифметикой, а элементы не измеряются ни разу: ходовые виртуализаторы зовут{' '}
        <code>getBoundingClientRect</code> по строке, и на тысяче строк это тысяча forced layout. Из
        DOM берётся только <code>{sideways() ? 'scrollLeft' : 'scrollTop'}</code> и{' '}
        {sideways() ? 'ширина' : 'высота'} скроллера через <code>ResizeObserver</code>. Порядок строк
        считает воркер и отменяет расчёт, как только пришёл запрос посвежее.
      </p>

      <Bar>
        <Seg
          label="рисуем"
          value={mode()}
          options={[
            { value: 'pool', label: 'пул узлов' },
            { value: 'window', label: 'For по окну' },
            { value: 'plain', label: 'без виртуализации' },
          ]}
          onChange={(v) => {
            reset()
            setMode(v as Mode)
          }}
        />
        <Pick
          label="строк"
          value={count()}
          options={[10_000, 100_000, 1_000_000].map((n) => ({ value: n, label: fmtNum(n) }))}
          onChange={(v) => {
            const n = Number(v)
            reset()
            setCount(n)
            setValues(makeValues(n))
          }}
        />
        <Seg
          label="ось"
          value={axis()}
          options={[
            { value: 'y', label: 'вниз' },
            { value: 'x', label: 'вбок' },
          ]}
          onChange={(v) => {
            reset()
            setAxis(v as Axis)
          }}
        />
        <Pick
          label="порядок"
          value={dir()}
          options={[
            { value: 'none', label: 'как есть' },
            { value: 'asc', label: 'по возрастанию' },
            { value: 'desc', label: 'по убыванию' },
          ]}
          onChange={(v) => setDir(v as Dir)}
        />
        <label class="inline-flex items-center gap-1.5">
          фильтр
          <input
            class="input input-sm input-bordered w-32"
            placeholder="цифры"
            value={needle()}
            onInput={(e) => setNeedle(e.currentTarget.value)}
          />
        </label>
        <Check checked={inline()} onChange={setInline}>
          считать в главном потоке
        </Check>
      </Bar>

      <Bar>
        <Note>
          узлов в разметке: <b>{fmtNum(nodes())}</b> · создано с начала:{' '}
          <b>{fmtNum(born())}</b> · показано: <b>{fmtNum(shown())}</b> из {fmtNum(count())}
        </Note>
        <Note>
          {progress() != null
            ? `считаем… ${Math.round((progress() as number) * 100)}%`
            : stat().ms > 0
              ? `порядок посчитан за ${stat().ms.toFixed(1)} мс`
              : 'порядок исходный'}
        </Note>
        <Note>
          поток: <b>{how().threaded ? 'воркер' : 'главный'}</b> · память:{' '}
          <b>{how().shared ? 'общая' : 'копиями'}</b>
        </Note>
        <Show when={!isolated() && typeof navigator !== 'undefined' && 'serviceWorker' in navigator}>
          <Btn onClick={enableIsolation}>включить общую память</Btn>
        </Show>
      </Bar>

      <Show when={mode() === 'plain' && count() > PLAIN_CAP}>
        <p class="mb-2 max-w-[92ch] text-sm text-error">
          Без виртуализации рисуем не больше {fmtNum(PLAIN_CAP)} строк: миллион узлов вкладка не
          переживёт. Даже сто тысяч подвесят её на несколько секунд — это и есть показание прибора.
        </p>
      </Show>

      <div
        ref={scroller}
        class={
          sideways()
            ? 'max-w-[92ch] overflow-x-auto overflow-y-hidden rounded-box border border-base-300'
            : 'max-w-[92ch] overflow-y-auto rounded-box border border-base-300'
        }
        style={{ height: sideways() ? '160px' : '60vh' }}
      >
        <Show
          when={mode() !== 'plain'}
          fallback={
            <div ref={list} class={sideways() ? 'flex h-full w-max' : undefined}>
              <For each={plainPositions()}>
                {(p) => {
                  created++
                  const row = () => rowAt(p)
                  return (
                    <div
                      class={
                        sideways()
                          ? 'flex shrink-0 flex-col justify-center gap-1 border-r border-base-200 px-3 text-sm'
                          : 'flex items-center gap-3 border-b border-base-200 px-3 text-sm'
                      }
                      style={sideways() ? { width: `${COL}px` } : { height: `${ROW}px` }}
                    >
                      <span
                        class={
                          sideways()
                            ? 'tabular-nums font-semibold text-base-content'
                            : 'w-24 shrink-0 tabular-nums text-base-content'
                        }
                      >
                        {fmtNum(row() + 1)}
                      </span>
                      <span class="truncate">{values()[row()]} у.е.</span>
                    </div>
                  )
                }}
              </For>
            </div>
          }
        >
          {/* распорка держит полосу прокрутки; её размер вдоль оси зажимает потолок браузера */}
          <div
            style={{
              position: 'relative',
              width: sideways() ? `${range().total}px` : undefined,
              height: sideways() ? '100%' : `${range().total}px`,
            }}
          >
            <div ref={list}>
              <Show
                when={mode() === 'pool'}
                fallback={<For each={windowPositions()}>{(p) => <Row pos={() => p} />}</For>}
              >
                <For each={slots()}>{(slot) => <Row pos={slot.at} />}</For>
              </Show>
            </div>
          </div>
        </Show>
      </div>

      <p class="mt-3 max-w-[92ch] text-sm text-base-content">
        Переключи «рисуем» между пулом и <code>For</code> и пролистай список: узлов в разметке
        поровну, а вот «создано с начала» у <code>For</code> растёт всю дорогу — это и есть работа,
        которой у пула нет. Поставь галочку «считать в главном потоке» и набери что-нибудь в фильтре
        на миллионе строк: расчёт начнёт делить кадры с прокруткой, и она поедет рывками. Порции и
        отмена не дают ей встать совсем — но полностью из-под ног работа уходит только в воркере.
      </p>
      <p class="mt-2 max-w-[92ch] text-sm text-base-content">
        Переключатель «ось» разворачивает тот же список вбок: движок берёт{' '}
        <code>axis: &apos;x&apos;</code>, читает <code>scrollLeft</code> вместо{' '}
        <code>scrollTop</code> и меряет ширину видимой части, а элемент едет{' '}
        <code>translateX</code>. Ни счётчики, ни потолок распорки от этого не меняются — арифметика
        одна и та же, разница только в имени оси.
      </p>

      <hr class="my-6 border-base-300" />

      <h4 class="text-lg font-semibold">Как это подключить</h4>
      <p class="mt-1 max-w-[92ch] text-sm">
        Виртуализатор живёт в общем пакете кита — том же, что FLIP, автопрокрутка и очередь заливки.
      </p>
      <Code title="Установка" code={SNIP.install} />

      <Doc title="Окно вместо списка">
        <p>
          Движок не рисует ничего сам: он говорит, какие индексы сейчас в окне и на сколько сдвинуть
          нарисованное. Разметка, теги и классы остаются вашими. Сдвиг делается{' '}
          <code>transform</code>, а не <code>top</code> — это композитор, а не layout.
        </p>
      </Doc>
      <Code title="Список на миллион строк" code={SNIP.basic} />

      <Doc title="Ряды разной высоты">
        <p>
          Высоты — ЗАЯВЛЕННЫЕ, а не измеренные: шахматка знает высоту строки как «этажей × высота
          этажа», и это по-прежнему арифметика без единого обращения к элементам. Правку движок
          узнаёт по ссылке на массив, поэтому менять его на месте можно только вместе с{' '}
          <code>refresh()</code>.
        </p>
      </Doc>
      <Code title="Свои размеры" code={SNIP.sizes} />

      <Doc title="Сетки и горизонталь">
        <p>
          Плитки — это <code>columns</code>, шкала времени — <code>axis: &apos;x&apos;</code>. Если
          внутри того же скроллера есть липкая колонка или шапка, её ширину надо отдать в{' '}
          <code>lead</code>: иначе окно окажется сдвинутым ровно на её размер — на шахматке это
          полдюжины колонок мимо.
        </p>
      </Doc>
      <Code title="Плитки и шкала" code={SNIP.axis} />

      <Doc title="Потолок высоты">
        <p>
          У элемента есть предел высоты, за которым браузер начинает врать про <code>scrollTop</code>
          . На миллионе строк он давно пройден, поэтому распорка обрезается, а позиция
          пересчитывается пропорционально. Для потребителя вывод один: рисовать по <code>range</code>
          , а не по своим формулам.
        </p>
      </Doc>
      <Code title="Почему total не count × itemSize" code={SNIP.why} />

      <h4 class="mt-6 text-lg font-semibold">createVirtualizer</h4>
      <Props rows={VIRT_PROPS} />

      <h4 class="mt-6 text-lg font-semibold">Virtual и VirtualRange</h4>
      <Props rows={VIRT_API} />

    </div>
  )
}
