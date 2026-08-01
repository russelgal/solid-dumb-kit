import { For, createEffect, createMemo, type JSX } from 'solid-js'
import { createStableOrder } from '@solid-dumb-kit/shared'
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
// DOM НЕ ТРОГАЕТСЯ ВОВСЕ. Элементы рендерятся в неизменном порядке — по id, — а
// показывает их браузер по CSS `order`. Иначе `<For>` при каждой перестановке
// двигал бы узлы, и FLIP анимировал бы то, что фреймворк только что пересоздал.
//
// Отсюда одно требование к контейнеру: он должен быть flex или grid, иначе
// `order` браузер проигнорирует и порядок замрёт. Класс на нём — твой, поэтому
// проверить это за тебя мы не можем.
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

  const els = new Map<string, HTMLElement>()

  /**
   * Порядок РЕНДЕРА — по появлению, а не по показу. От перестановок он не
   * зависит, поэтому `<For>` при них не делает ничего: ни одного перемещения
   * узла за весь жест. На старте совпадает с порядком `items`, так что разметка
   * читается как исходный список.
   */
  const stable = createStableOrder(props.id)
  const rendered = createMemo(() => stable.sort(props.items))

  /** показное место каждого элемента — одной картой, а не поиском на каждый */
  const places = createMemo(() => new Map(props.items.map((it, i) => [props.id(it), i])))

  // `order` проставляем эффектом, а не в разметке: элемент отдаёт потребитель, и
  // раскладывать его атрибуты мы можем только после того, как он создан.
  //
  // Пишем ТОЛЬКО тем, у кого место изменилось. Перестановка задевает соседей
  // между старым местом и новым, остальных — нет, и трогать их `style` значило
  // бы будить браузер на триста строк вместо трёх.
  createEffect(() => {
    for (const [id, i] of places()) {
      const el = els.get(id)
      if (!el) continue
      const next = String(i)
      if (el.style.order !== next) el.style.order = next
    }
  })

  return (
    <div ref={s.container} class={props.class} style={props.style}>
      <For each={rendered()}>
        {(item) => {
          const id = props.id(item)
          const el = props.children(item, () => places().get(id) ?? 0) as unknown as Node
          if (el instanceof HTMLElement) {
            els.set(id, el)
            el.style.order = String(places().get(id) ?? 0)
            s.bind(id)(el)
          }
          return el as unknown as JSX.Element
        }}
      </For>
    </div>
  )
}
