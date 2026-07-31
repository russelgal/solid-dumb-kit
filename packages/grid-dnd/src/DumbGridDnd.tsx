import { createMemo, For, Show, type JSX } from 'solid-js'
import { createDumbGridDndGroup, type DumbGridDndGroupHandle } from './solid'
import { packFlow, resolveSpan, rowCount, type SpanValue } from '@solid-dumb-kit/grid'

// Сетка на нативном drag-and-drop.
//
// Отдельный компонент, а не режим `DumbGrid`: механики жеста разные, и сводить
// их в один код — то, чем уже ломали рабочее. Общая только математика раскладки.
//
// Раскладку рисует компонент, а всё, что происходит во время жеста, — движок:
// соседи расступаются трансформом (FLIP), на будущем месте стоит контур. DOM при
// этом не переставляется вовсе, поэтому под курсором ничего не скачет и моргать
// нечему — блоки просто едут.
//
// Состояния здесь нет вовсе: порядок блоков — это порядок `items`, и правит его
// потребитель по `onReorder` / `onTransfer`. Так первая версия остаётся честной
// и маленькой; персист, свободный режим и ресайз живут в `DumbGrid` и появятся
// тут только если понадобятся на деле.
//
//   <DumbGridDnd cols={12} rowHeight={80} items={items()}
//     onReorder={(from, to) => setItems(move(items(), from, to))} />

export type DumbGridDndItem = {
  id: string
  content: () => JSX.Element
  /** ширина: число колонок либо доля сетки (`'half'`, `'1/3'`, …) */
  w?: SpanValue
  /** высота в строках */
  h?: number
}

export type DumbGridDndProps = {
  items: Array<DumbGridDndItem>
  cols?: number
  rowHeight?: number
  gap?: number
  /** перестановка внутри этой сетки */
  onReorder?: (from: number, to: number) => void
  /** перетаскивание выключено — рисуем просто сетку */
  disabled?: boolean
  /** группа сеток: с ней блок можно утащить в соседнюю сетку */
  group?: DumbGridDndGroupHandle
  /** имя этой сетки в группе */
  name?: string
  class?: string
  style?: JSX.CSSProperties
  blockClass?: string
  blockStyle?: JSX.CSSProperties
}

const DEFAULT_COLS = 12
const DEFAULT_ROW_H = 80
const DEFAULT_GAP = 12

export function DumbGridDnd(props: DumbGridDndProps) {
  const cols = () => Math.max(1, Math.floor(props.cols ?? DEFAULT_COLS))
  const rowH = () => props.rowHeight ?? DEFAULT_ROW_H
  const gap = () => props.gap ?? DEFAULT_GAP

  const spans = createMemo(() =>
    props.items.map((it) => ({
      id: it.id,
      w: resolveSpan(it.w, cols()),
      h: Math.max(1, Math.round(it.h ?? 1) || 1),
    })),
  )

  const group = props.group ?? createDumbGridDndGroup()
  const name = () => props.name ?? 'grid'
  const g = group.grid(name(), {
    order: () => props.items.map((it) => it.id),
    spanOf: (id) => spans().find((s) => s.id === id) ?? { w: 1, h: 1 },
    // метрики нужны движку, чтобы считать место вставки арифметикой,
    // а не по тому, какой блок сейчас под курсором
    cols,
    rowHeight: rowH,
    gapX: gap,
    gapY: gap,
    disabled: () => props.disabled === true,
    onReorder: (from, to) => props.onReorder?.(from, to),
  })

  // Раскладка ОДНА и та же весь жест: превью движок показывает трансформом,
  // поэтому пересчитывать её на каждое движение не нужно.
  const placed = createMemo(() => packFlow(spans(), cols()))
  const posById = createMemo(() => new Map(placed().map((p) => [p.id, p])))
  const rows = createMemo(() => rowCount(placed()))

  /**
   * Высоту во время жеста диктует движок: он один знает, какой станет раскладка,
   * если бросить блок прямо сейчас. Сами позиции блоков при этом не трогаем —
   * они едут трансформом, а перестановка под курсором вернула бы дребезг.
   *
   * Нужно это не только для вида: пока контейнер прежней высоты, разъехавшиеся
   * блоки торчат за его краем, и курсор над ними оказывается вне зоны приёма —
   * дроп туда не проходит.
   */
  const liveRows = () => {
    const base = Math.max(rows(), group.rows(name()))
    // Лишняя строка снизу нужна затем, что под последним блоком иначе сразу
    // кончается контейнер, а с ним и зона приёма: уронить блок «в конец» некуда,
    // курсор там уже вне цели.
    //
    // Но держим её только там, где ронять и правда собираются — у сетки-источника
    // и у той, над которой курсор. Иначе на каждый чужой жест дёргаются все сетки
    // группы разом, и это заметно шумит.
    const a = group.active()
    const mine = a && (a.grid === name() || group.over() === name())
    return mine ? base + 1 : base
  }

  return (
    <div
      ref={g.container}
      class={props.class}
      style={{
        display: 'grid',
        // контур будущего места движок кладёт сюда абсолютом — без этого он
        // считался бы от body и улетал в угол страницы
        position: 'relative',
        'grid-template-columns': `repeat(${cols()}, minmax(0, 1fr))`,
        'grid-auto-rows': `${rowH()}px`,
        gap: `${gap()}px`,
        'min-height': `${(() => {
          const n = liveRows()
          return n * rowH() + Math.max(0, n - 1) * gap()
        })()}px`,
        // высота меняется на входе гостя — плавно, чтобы не прыгало
        transition: 'min-height .15s ease',
        ...props.style,
      }}
    >
      <For each={props.items}>
        {(it) => {
          const pos = () => posById().get(it.id)
          const dragging = () => g.active() === it.id
          return (
            <div
              ref={props.disabled ? undefined : g.bind(it.id)}
              class={props.blockClass}
              style={{
                // позицию считаем мы, браузер её не домысливает
                'grid-column': `${(pos()?.col ?? 0) + 1} / span ${pos()?.w ?? 1}`,
                'grid-row': `${(pos()?.row ?? 0) + 1} / span ${pos()?.h ?? 1}`,
                position: 'relative',
                'min-width': '0',
                'min-height': '0',
                'box-sizing': 'border-box',
                cursor: props.disabled ? 'default' : 'grab',
                ...props.blockStyle,
              }}
            >
              {it.content()}
            </div>
          )
        }}
      </For>
    </div>
  )
}
