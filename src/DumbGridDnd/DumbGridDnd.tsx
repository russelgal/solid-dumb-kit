import { createMemo, For, Show, type JSX } from 'solid-js'
import { createDumbGridDndGroup, type DumbGridDndGroupHandle } from './solid'
import { packFlow, resolveSpan, rowCount, type SpanValue } from '../DumbGrid/gridMath'

// Сетка на нативном drag-and-drop.
//
// Отдельный компонент, а не режим `DumbGrid`: механики жеста разные, и сводить
// их в один код — то, чем уже ломали рабочее. Общая только математика раскладки.
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
  const placed = createMemo(() => packFlow(spans(), cols()))
  const posById = createMemo(() => new Map(placed().map((p) => [p.id, p])))
  const rows = createMemo(() => rowCount(placed()))

  const solo = props.group ? null : createDumbGridDndGroup()
  const g = (props.group ?? solo!).grid(props.name ?? 'grid', {
    order: () => props.items.map((it) => it.id),
    disabled: () => props.disabled === true,
    onReorder: (from, to) => props.onReorder?.(from, to),
  })

  return (
    <div
      ref={g.container}
      class={props.class}
      style={{
        display: 'grid',
        'grid-template-columns': `repeat(${cols()}, minmax(0, 1fr))`,
        'grid-auto-rows': `${rowH()}px`,
        gap: `${gap()}px`,
        'min-height': `${rows() * rowH() + Math.max(0, rows() - 1) * gap()}px`,
        ...props.style,
      }}
    >
      <For each={props.items}>
        {(it) => {
          const pos = () => posById().get(it.id)
          const dragging = () => g.active() === it.id
          return (
            <Show when={pos()}>
              {(p) => (
                <div
                  ref={props.disabled ? undefined : g.bind(it.id)}
                  class={props.blockClass}
                  style={{
                    // позицию считаем мы, браузер её не домысливает
                    'grid-column': `${p().col + 1} / span ${p().w}`,
                    'grid-row': `${p().row + 1} / span ${p().h}`,
                    position: 'relative',
                    'min-width': '0',
                    'min-height': '0',
                    'box-sizing': 'border-box',
                    cursor: props.disabled ? 'default' : 'grab',
                    opacity: dragging() ? '0.4' : undefined,
                    ...props.blockStyle,
                  }}
                >
                  {it.content()}
                </div>
              )}
            </Show>
          )
        }}
      </For>
    </div>
  )
}
