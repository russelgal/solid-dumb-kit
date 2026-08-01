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
    <div class="db-example">
      <h3>DumbBoard — секции, блоки и переносы между ними</h3>
      <p class="note">
        Внутри секции DOM не трогается — двигается только <code>order</code>. Перенос в соседнюю
        секцию без перестановки DOM невозможен (<code>order</code> живёт внутри одного контейнера),
        и это единственное место, где DOM меняется. Оба случая доигрывает <b>FLIP</b>.
      </p>
      <p class="note">
        Секции тащат за заголовок, размер тянут за правый край, нижний или угол; двойной клик по
        шапке — во всю ширину и обратно. Перенос идёт на нативном drag-and-drop, а ресайз — на
        указательных событиях: <code>dragover</code> не даёт покадровой точности, которая нужна,
        когда тянут размер.
      </p>
      <p class="note">
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
        class="db-board"
      >
        {(w) => (
          <article class="widget" style={{ '--hue': HUE(Number(w.id.slice(1))) }}>
            <span class="wtitle">{w.title}</span>
            <span class="wkind">{w.kind}</span>
          </article>
        )}
      </DumbBoard>

      <style>{`
        .db-example { padding: 16px 20px; color: #0f172a }
        .db-example h3 { margin: 0 0 4px }
        .db-example .note { margin: 0 0 8px; font-size: 13px; color: #64748b; max-width: 92ch }

        /* Оформление — целиком наше: кит дал только структуру и жест */
        .db-example .dumb-board-head { color: #475569 }
        .db-example .dumb-board-zone { padding: 10px; border-radius: 12px; background: #f8fafc;
                                       box-shadow: inset 0 0 0 1px #e2e8f0 }
        .db-example .dumb-board-panel.sizing { outline: 2px solid #6366f1; outline-offset: 4px;
                                               border-radius: 12px }
        .db-example .dumb-board-grip-x::after { content: ''; position: absolute; top: 8px; bottom: 8px;
                                                left: 5px; width: 2px; border-radius: 2px; background: #e2e8f0 }
        .db-example .dumb-board-grip-y::after { content: ''; position: absolute; left: 8px; right: 8px;
                                                top: 5px; height: 2px; border-radius: 2px; background: #e2e8f0 }
        .db-example .dumb-board-grip-xy::after { content: ''; position: absolute; right: 4px; bottom: 4px;
                                                 width: 8px; height: 8px; border-right: 2px solid #cbd5e1;
                                                 border-bottom: 2px solid #cbd5e1; border-radius: 0 0 3px 0 }
        .db-example .dumb-board-grip-x:hover::after,
        .db-example .dumb-board-grip-y:hover::after { background: #6366f1 }
        .db-example .dumb-board-grip-xy:hover::after { border-color: #6366f1 }

        .db-example .widget { display: flex; flex-direction: column; justify-content: center; gap: 3px;
                              height: 68px; padding: 8px 10px; border-radius: 10px; cursor: grab;
                              background: #fff; box-shadow: 0 1px 2px rgba(15,23,42,.06), inset 0 0 0 1px #e2e8f0;
                              border-top: 4px solid var(--hue) }
        .db-example .widget:active { cursor: grabbing }
        .db-example .wtitle { font-size: 13.5px; font-weight: 500 }
        .db-example .wkind { font-size: 11.5px; color: #94a3b8 }
      `}</style>
    </div>
  )
}
