import { For, JSX } from 'solid-js'
import { createDumbSortable } from './sortableCore'

export type DumbSortableProps<T> = {
  items: Array<T>
  /** позвать с новым порядком (на дропе) */
  setItems: (next: Array<T>) => void
  /** стабильный id элемента */
  id: (item: T) => string
  axis?: 'y' | 'grid'
  disabled?: () => boolean
  pressDelay?: number
  mousePressDelay?: number
  mouseThreshold?: number
  /** ВЕРНИ один корневой элемент — компонент привяжется прямо к нему */
  children: (item: T, index: () => number) => JSX.Element
}

// Декларативная сортировка БЕЗ рефов, директив и обёрток.
// Приём: в Solid JSX из children возвращает реальный DOM-узел — компонент берёт
// ИМЕННО ТВОЙ элемент (полный контроль разметки: тег, классы, per-item стиль) и
// цепляет к нему drag. Ручка — дочка с [data-drag-handle]; нет её → тянем за весь элемент.
//
//   <div class="space-y-2 overflow-auto max-h-[60vh]">   ← контейнер ТВОЙ
//     <DumbSortable items={list()} setItems={setList} id={x => x.id}>
//       {(item) => (
//         <div class="row">                                ← элемент ТВОЙ, как хочешь
//           <button data-drag-handle>⠿</button>
//           {item.label}
//         </div>
//       )}
//     </DumbSortable>
//   </div>
export function DumbSortable<T>(props: DumbSortableProps<T>) {
  const s = createDumbSortable({
    order: () => props.items.map(props.id),
    axis: props.axis,
    disabled: props.disabled,
    pressDelay: props.pressDelay,
    mousePressDelay: props.mousePressDelay,
    mouseThreshold: props.mouseThreshold,
    onEnd: (from, to) => {
      const next = props.items.slice()
      next.splice(to, 0, next.splice(from, 1)[0])
      props.setItems(next)
    },
  })
  return (
    <For each={props.items}>
      {(item, i) => {
        const el = props.children(item, i) as unknown as Node
        if (el instanceof HTMLElement) s.bind(props.id(item))(el)
        return el as unknown as JSX.Element
      }}
    </For>
  )
}
