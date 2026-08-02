// Дашборд на DumbBoard: все карточки одной высоты.
//
// Соседняя вкладка нарочно набита блоками разного калибра — на них видно, как
// работает укладка потоком. Здесь наоборот, обычный случай: высота у всех одна,
// разной остаётся только ширина. Строки перестают быть рваными, сетка выходит
// ровной, а движок при этом ТОТ ЖЕ — ничего специального для этого случая в
// ките нет: `blockRows` просто отдаёт одно и то же число для всех карточек.
//
// Высоту это не запрещает менять — она просто общая на всю доску: тянешь любую
// карточку за уголок, и меняется у всех сразу.
//
// Заодно тут проще разглядеть саму перестановку: соседи едут ровно на ширину
// блока, а не прыгают через полстроки.
import { createSignal } from 'solid-js'
import { DumbBoard, type BoardSection } from '@solid-dumb-kit/board'
import { Bar, Switch, Check, Pick, Btn, Note } from '../_controls'

/** Ширина в колонках зоны. Высоты нет вовсе — она у всех одна. */
type Card = { id: string; title: string; value: string; note: string; w: number }

const card = (id: string, title: string, value: string, note: string, w = 1): Card =>
  ({ id, title, value, note, w })

const SECTIONS0: Array<BoardSection<Card>> = [
  {
    id: 'today',
    title: 'Сегодня',
    subtitle: 'с начала суток',
    cols: 4,
    span: 12,
    items: [
      card('c1', 'Выручка', '1 284 900 ₽', '+12% ко вчера', 2),
      card('c2', 'Заказы', '317', '+4%'),
      card('c3', 'Средний чек', '4 053 ₽', '−1%'),
      card('c4', 'Конверсия', '3,8%', 'из визитов в заказ'),
      card('c5', 'Возвраты', '11', '0,3% от заказов'),
      card('c6', 'Новые клиенты', '86', '27% от заказов', 2),
    ],
  },
  {
    id: 'stock',
    title: 'Склад',
    subtitle: 'остатки и поставки',
    cols: 3,
    span: 6,
    items: [
      card('c7', 'Позиций', '4 812', 'активных SKU'),
      card('c8', 'Заканчивается', '37', 'меньше недельного запаса', 2),
      card('c9', 'В пути', '9', 'поставок'),
      card('c10', 'Просрочено', '2', 'поставки'),
    ],
  },
  {
    id: 'people',
    title: 'Люди',
    subtitle: 'смена',
    cols: 3,
    span: 6,
    items: [
      card('c11', 'На смене', '14', 'из 18'),
      card('c12', 'Открытых задач', '23', 'на отделе'),
      card('c13', 'Просрочено', '4', 'дольше суток', 2),
    ],
  },
]

const HUE = (i: number) => `oklch(0.75 0.12 ${(i * 47) % 360})`

export default function DumbBoardEvenExample() {
  const [sections, setSections] = createSignal(SECTIONS0)
  const [edit, setEdit] = createSignal(true)
  const [animate, setAnimate] = createSignal(true)
  const [cols, setCols] = createSignal(0)
  const [log, setLog] = createSignal('тащи карточку — или секцию за заголовок')

  /**
   * Ширины держим ОТДЕЛЬНОЙ картой, а не полем карточки: объект обязан пережить
   * переезд между секциями. `{ ...c, w }` — уже другой объект, `<For>` счёл бы
   * его новым элементом и пересоздал узел, а FLIP держится за живой.
   */
  const [widths, setWidths] = createSignal<Record<string, number>>({})
  const widthOf = (c: Card) => widths()[c.id] ?? c.w

  /**
   * Высота — ОДНА на всю доску, а не на карточку.
   *
   * «Все одной высоты» не значит «высоту не трогать»: тянешь любую карточку за
   * уголок вверх-вниз — и меняется высота у ВСЕХ разом, равенство от этого не
   * рушится. Хранить её на карточке было бы неверно: тогда первая же протяжка
   * сделала бы её выше соседей.
   */
  const [rows, setRows] = createSignal(1)

  /**
   * Удаление — целиком на стороне потребителя: доска состояние не держит, а
   * `sections` тут наш массив. Выбрасываем карточку из её секции и отдаём новый
   * массив тем же `setSections`, каким доска пользуется сама.
   */
  const dropCard = (id: string, title: string) => {
    setSections(sections().map((s) => ({ ...s, items: s.items.filter((c) => c.id !== id) })))
    setLog(`«${title}» удалена`)
  }
  const dropSection = (id: string, title: string) => {
    setSections(sections().filter((s) => s.id !== id))
    setLog(`секция «${title}» удалена вместе с карточками`)
  }

  // ноль значит «как задано у секции»; иначе перебиваем у всех сразу
  const withCols = () =>
    cols() ? sections().map((s) => ({ ...s, cols: cols() })) : sections()

  return (
    <div class="p-5 text-base-content">
      <h3 class="mb-1 text-lg font-semibold">Дашборд на DumbBoard — карточки одной высоты</h3>
      <p class="mb-2 max-w-[92ch] text-sm text-base-content">
        Обычный случай: <b>высота у всех карточек одна</b>, разной остаётся только ширина.
        Специального режима под это в ките нет — <code>blockRows</code> просто отдаёт всем
        карточкам одно и то же число, и укладка потоком вырождается в ровную сетку без рваных
        просветов.
      </p>
      <p class="mb-2 max-w-[92ch] text-sm text-base-content">
        Высоту при этом <b>менять можно</b> — просто она общая: потянешь любую карточку за уголок
        вверх-вниз, и подрастут все разом, равенство никуда не денется. Ширина, наоборот, у каждой
        своя. Всё остальное как на соседней вкладке: карточки переставляются внутри секции и
        переезжают между ними, секции тащат за заголовок и меняют размер. Внутри секции DOM не
        трогается — место задаётся явными <code>grid-column</code>/<code>grid-row</code>, а
        движение доигрывает <b>FLIP</b>.
      </p>

      <Bar>
        <Switch checked={edit()} onChange={setEdit}>режим правки</Switch>
        <Check checked={animate()} onChange={setAnimate}>анимация</Check>
        <Pick
          label="колонок в секции"
          value={cols()}
          options={[
            { value: 0, label: 'как задано' },
            { value: 2 }, { value: 3 }, { value: 4 }, { value: 6 },
          ]}
          onChange={(v) => setCols(Number(v))}
        />
        <Btn onClick={() => { setSections(SECTIONS0); setWidths({}); setRows(1); setLog('раскладка сброшена') }}>
          Сбросить раскладку
        </Btn>
        <Note>{log()}</Note>
      </Bar>

      <DumbBoard
        sections={withCols()}
        setSections={setSections}
        id={(c) => c.id}
        blockSpan={widthOf}
        // вот и вся разница с соседней вкладкой: высота у всех общая
        blockRows={() => rows()}
        blockLimits={() => ({ minH: 1, maxH: 4, maxW: 'half' })}
        onBlockResize={(c, size) => {
          const wasRows = rows()          // сверять надо ДО записи, иначе всегда равно
          setWidths({ ...widths(), [c.id]: size.w })
          setRows(size.h)                 // высоту принимаем как общую — у всех сразу
          setLog(
            `${c.title} — ${size.w} ${size.w === 1 ? 'колонка' : 'колонки'}` +
            (size.h === wasRows ? '' : `; высота ВСЕХ карточек — ${size.h}`),
          )
        }}
        showGrid="drag"
        onMove={(c, to, k) =>
          setLog(`${c.title} → «${sections().find((s) => s.id === to)?.title}», место ${k}`)}
        onSectionMove={(from, to) => setLog(`секция ${from} → место ${to}`)}
        onSectionResize={(id, size) =>
          setLog(`«${sections().find((s) => s.id === id)?.title}» — ${size.span} из 12 колонок`)}
        editable={edit()}
        animate={animate()}
        sectionActions={(s) => (
          <button
            class="btn btn-ghost btn-xs"
            title="удалить секцию вместе с карточками"
            onClick={() => dropSection(s.id, String(s.title))}
          >
            ✕
          </button>
        )}
        class="[&_.dumb-board-head]:text-base-content"
      >
        {(c) => (
          <article
            class="group relative flex h-full cursor-grab flex-col justify-center gap-0.5 overflow-hidden rounded-box border-l-4 bg-base-100 px-3 py-2 shadow-sm ring-1 ring-base-300 active:cursor-grabbing"
            style={{ 'border-left-color': HUE(Number(c.id.slice(1))) }}
          >
            {/* `data-no-drag` — иначе жест начнётся с кнопки и удалить не выйдет:
                нажатие уедет в перетаскивание, а клика не случится */}
            <button
              data-no-drag
              class="btn btn-ghost btn-xs absolute top-1 right-1 opacity-0 group-hover:opacity-100"
              title="удалить карточку"
              onClick={() => dropCard(c.id, c.title)}
            >
              ✕
            </button>
            <span class="text-[11.5px] text-base-content">{c.title}</span>
            <span class="text-lg leading-tight font-semibold text-base-content tabular-nums">
              {c.value}
            </span>
            <span class="text-[11px] text-base-content">{c.note}</span>
          </article>
        )}
      </DumbBoard>
    </div>
  )
}
