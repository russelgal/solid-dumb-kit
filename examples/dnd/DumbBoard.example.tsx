// DumbBoard — секции с блоками: перенос между секциями, сортировка и ресайз
// самих секций.
//
// Состояние потребителя — два массива. Порядок в `items` и есть порядок блоков,
// порядок в `sections` — порядок секций; размер живёт прямо на секции. Компонент
// ничего не хранит: он сообщает, что произошло, а массивы правишь ты.
import { createSignal, For } from 'solid-js'
import { DumbBoard, type BoardSection } from '@solid-dumb-kit/board'
import { Bar, Switch, Check, Pick, Btn, Note } from '../_controls'

type Widget = { id: string; title: string; kind: string }

const KINDS = ['график', 'таблица', 'счётчик', 'карта', 'лента']
const SECTIONS0: Array<BoardSection> = [
  { id: 'sales', title: 'Продажи', subtitle: 'выручка и заказы', cols: 3, span: 6 },
  { id: 'stock', title: 'Склад', subtitle: 'остатки', cols: 3, span: 6 },
  { id: 'archive', title: 'Архив', cols: 6, span: 12 },
]
const WIDGETS0: Array<Widget> = Array.from({ length: 24 }, (_, i) => ({
  id: `w${i}`,
  title: `Блок ${i + 1}`,
  kind: KINDS[i % KINDS.length],
}))
/**
 * В какой секции блок — ОТДЕЛЬНО от самого блока.
 *
 * Соблазн держать `section` полем виджета велик, но тогда переезд приходится
 * писать как `{ ...item, section }` — а это новый объект, `<For>` считает его
 * другим элементом и пересоздаёт узел. Пересозданный узел анимировать нечем:
 * FLIP цепляется за элемент, которого уже нет, и соседи стоят как вкопанные.
 */
const WHERE0: Record<string, string> = Object.fromEntries(
  WIDGETS0.map((w, i) => [w.id, i < 9 ? 'sales' : i < 15 ? 'stock' : 'archive']),
)
const HUE = (i: number) => `oklch(0.75 0.12 ${(i * 53) % 360})`

export default function DumbBoardExample() {
  const [sections, setSections] = createSignal(SECTIONS0)
  const [widgets, setWidgets] = createSignal(WIDGETS0)
  const [where, setWhere] = createSignal(WHERE0)
  const [edit, setEdit] = createSignal(true)
  const [animate, setAnimate] = createSignal(true)
  const [cols, setCols] = createSignal(3)
  const [log, setLog] = createSignal('тащи блок — или секцию за заголовок')

  /**
   * Блок переехал. Двигаем ТОТ ЖЕ объект — переставляем его в массиве и
   * записываем новую секцию рядом. Ни одного нового объекта: узлы переживают
   * переезд, и FLIP есть за что зацепиться.
   */
  const move = (item: Widget, toSection: string, toIndex: number) => {
    const rest = widgets().filter((w) => w.id !== item.id)
    const inTarget = rest.filter((w) => where()[w.id] === toSection)
    const anchor = toIndex < inTarget.length
      ? rest.indexOf(inTarget[toIndex])
      : inTarget.length
        ? rest.indexOf(inTarget[inTarget.length - 1]) + 1
        : rest.length
    setWhere({ ...where(), [item.id]: toSection })
    setWidgets([...rest.slice(0, anchor), item, ...rest.slice(anchor)])
    setLog(`${item.title} → «${sections().find((s) => s.id === toSection)?.title}», место ${toIndex}`)
  }

  const moveSection = (from: number, to: number) => {
    const next = sections().slice()
    next.splice(to, 0, next.splice(from, 1)[0])
    setSections(next)
    setLog(`секция «${next[to].title}» → место ${to}`)
  }

  const resize = (id: string, size: { span: number; rows: number }) => {
    setSections(sections().map((s) => (s.id === id ? { ...s, ...size } : s)))
    setLog(`«${sections().find((s) => s.id === id)?.title}» — ${size.span} из 12 колонок, ${size.rows || '·'} строк`)
  }

  const reset = () => {
    setSections(SECTIONS0)
    setWidgets(WIDGETS0)
    setWhere(WHERE0)
    setLog('раскладка сброшена')
  }

  // колонки внутри секций крутим снаружи — у широкой их вдвое больше
  const withCols = () => sections().map((s) => ({ ...s, cols: s.id === 'archive' ? cols() * 2 : cols() }))

  return (
    <div class="p-5 text-slate-900">
      <h3 class="mb-1 text-lg font-semibold">DumbBoard — секции, блоки и переносы между ними</h3>
      <p class="mb-2 max-w-[92ch] text-sm text-base-content/80">
        Внутри секции DOM не трогается — двигается только <code>order</code>. Перенос в соседнюю
        секцию без перестановки DOM невозможен (<code>order</code> живёт внутри одного контейнера),
        и это единственное место, где DOM меняется. Оба случая доигрывает <b>FLIP</b>.
      </p>
      <p class="mb-2 max-w-[92ch] text-sm text-base-content/80">
        Секции тащат за заголовок, размер тянут за правый край, нижний или угол; двойной клик по
        шапке — во всю ширину и обратно. Перенос идёт на нативном drag-and-drop, а ресайз — на
        указательных событиях: <code>dragover</code> не даёт покадровой точности, которая нужна,
        когда тянут размер.
      </p>
      <p class="mb-2 max-w-[92ch] text-sm text-base-content/80">
        Состояние — <b>два массива</b>: порядок в <code>items</code> и есть порядок блоков,
        размер живёт на самой секции. Компонент ничего не хранит.
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
        <Btn onClick={reset}>Сбросить раскладку</Btn>
        <Note>{log()}</Note>
      </Bar>

      <DumbBoard
        sections={withCols()}
        items={widgets()}
        id={(w) => w.id}
        section={(w) => where()[w.id]}
        onMove={move}
        onSectionMove={moveSection}
        onSectionResize={resize}
        editable={edit()}
        animate={animate()}
        class="[&_.dumb-board-head]:text-slate-600"
      >
        {(w) => (
          <article
            class="flex h-[68px] cursor-grab flex-col justify-center gap-0.5 rounded-[10px] border-t-4 bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,.06),inset_0_0_0_1px_#e2e8f0] active:cursor-grabbing"
            style={{ 'border-top-color': HUE(Number(w.id.slice(1))) }}
          >
            <span class="text-[13.5px] font-medium">{w.title}</span>
            <span class="text-[11.5px] text-slate-400">{w.kind}</span>
          </article>
        )}
      </DumbBoard>

    </div>
  )
}
