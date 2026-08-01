import { For, type JSX } from 'solid-js'
import { createDumbSortableDnd } from './solid'

// Сортировка списка на нативном drag-and-drop.
//
// Приём тот же, что у `DumbSortable`: из children ты возвращаешь СВОЙ элемент, и
// компонент цепляется прямо к нему — тег, классы и стили строки остаются твоими.
// Отличие — жест ведёт браузер, а не наши указательные события.
//
//   <DumbSortableDnd items={list()} setItems={setList} id={(x) => x.id} class="rows">
//     {(item) => (
//       <div class="row">
//         <button data-drag-handle>⠿</button>
//         {item.label}
//       </div>
//     )}
//   </DumbSortableDnd>
//
// Контейнер, в отличие от `DumbSortable`, рисует компонент: он же и зона приёма,
// без неё браузеру некуда доставлять дроп. Нужен свой — бери примитив
// `createDumbSortableDnd`, он отдаёт `container` отдельным ref'ом.

export type DumbSortableDndProps<T> = {
  items: Array<T>
  /**
   * Позвать с новым порядком. Зовётся ПО ХОДУ жеста, на каждом шаге, — так же,
   * как у `DumbBoard`: данные всё время совпадают с тем, что на экране, и ничего
   * не теряется, если браузер не доставит `drop`.
   */
  setItems: (next: Array<T>) => void
  /** стабильный id элемента */
  id: (item: T) => string
  /** `y` — вертикальный список (по умолчанию), `grid` — сетка плиток */
  axis?: 'y' | 'grid'
  disabled?: boolean
  /** жест закончен: откуда и куда переехал элемент — удобно для сохранения */
  onEnd?: (fromIndex: number, toIndex: number) => void
  /** анимировать расступание; по умолчанию да, но не при prefers-reduced-motion */
  animate?: boolean
  class?: string
  style?: JSX.CSSProperties
  /** ВЕРНИ один корневой элемент — компонент привяжется прямо к нему */
  children: (item: T, index: () => number) => JSX.Element
}

export function DumbSortableDnd<T>(props: DumbSortableDndProps<T>) {
  const s = createDumbSortableDnd({
    order: () => props.items.map(props.id),
    axis: () => props.axis ?? 'y',
    disabled: () => props.disabled === true,
    animate: props.animate,
    onMove: (from, to) => {
      const next = props.items.slice()
      next.splice(to, 0, next.splice(from, 1)[0])
      props.setItems(next)
    },
    onEnd: (from, to) => props.onEnd?.(from, to),
  })

  return (
    <div ref={s.container} class={props.class} style={props.style}>
      <For each={props.items}>
        {(item, i) => {
          const el = props.children(item, i) as unknown as Node
          if (el instanceof HTMLElement) s.bind(props.id(item))(el)
          return el as unknown as JSX.Element
        }}
      </For>
    </div>
  )
}
