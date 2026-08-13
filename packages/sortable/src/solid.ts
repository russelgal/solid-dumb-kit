// Solid-обёртки над движками. Всё, что они делают, — привязывают отписки
// движка к жизненному циклу компонента через onCleanup.
//
// Движки (./sortableCore, ./sortableGroup) от фреймворка не зависят вовсе,
// поэтому под другой фреймворк (или Solid 2) переписывается только этот файл.

import { onCleanup } from 'solid-js'
import { createSortableEngine, type DumbSortableOptions } from './sortableCore'
import {
  createSortableGroupEngine,
  type SortableGroupOptions,
  type SortableListOptions,
} from './sortableGroup'

export type DumbSortableHandle = {
  /** самодостаточный ref на элемент (ручка = дочка с [data-drag-handle]) */
  bind: (id: string) => (el: HTMLElement) => void
  /** низкоуровневый ref на элемент-ячейку */
  row: (id: string) => (el: HTMLElement) => void
  /** низкоуровневый ref на ручку-хендл */
  handle: (id: string) => (el: HTMLElement) => void
  /**
   * Старт драга для JSX: `ref={s.row(id)} onPointerDown={s.press(id)}`.
   *
   * Это и есть путь без своих слушателей: `pointerdown` у Solid делегирован —
   * один слушатель на документ вместо слушателя на каждой строке. На тысяче
   * строк разница в монтировании невелика, на двадцати тысячах — уже единицы
   * миллисекунд, и столько же на снятии.
   *
   * `bind` (самодостаточный ref со своим `addEventListener`) остаётся: движок
   * зовут и без Solid, а там JSX взять неоткуда.
   */
  press: (id: string) => (ev: PointerEvent) => void
  /** то же для ручки, которая не лежит внутри ячейки */
  pressHandle: (id: string) => (ev: PointerEvent) => void
}

export function createDumbSortable(opts: DumbSortableOptions): DumbSortableHandle {
  const engine = createSortableEngine(opts)
  onCleanup(engine.destroy)

  return {
    bind: (id) => (el) => onCleanup(engine.attach(el, id)),
    row: (id) => (el) => onCleanup(engine.attachRow(el, id)),
    handle: (id) => (el) => onCleanup(engine.attachHandle(el, id)),
    press: (id) => (ev) => engine.press(id, ev),
    pressHandle: (id) => (ev) =>
      engine.pressHandle(id, ev.currentTarget as HTMLElement, ev),
  }
}

export type SortableListHandle = {
  /** ref на контейнер зоны */
  container: (el: HTMLElement) => void
  /** ref на элемент зоны (ручка = дочка с [data-drag-handle]) */
  bind: (id: string) => (el: HTMLElement) => void
  /** ref на карточку без слушателя — в паре с press */
  card: (id: string) => (el: HTMLElement) => void
  /** старт драга для JSX: `onPointerDown={l.press(id)}` */
  press: (id: string) => (ev: PointerEvent) => void
}

export type SortableGroupHandle = {
  /** зарегистрировать зону */
  list: (name: string, opts: SortableListOptions) => SortableListHandle
  /** имя зоны под указателем во время драга (для подсветки), иначе null */
  activeList: () => string | null
  /** id перетаскиваемого элемента, иначе null */
  draggingId: () => string | null
}

export function createSortableGroup(opts: SortableGroupOptions): SortableGroupHandle {
  const engine = createSortableGroupEngine(opts)
  onCleanup(engine.destroy)

  return {
    list(name, listOpts) {
      const zone = engine.list(name, listOpts)
      return {
        container: (el) => onCleanup(zone.attachContainer(el)),
        bind: (id) => (el) => onCleanup(zone.attach(el, id)),
        card: (id) => (el) => onCleanup(zone.attachCard(el, id)),
        press: (id) => (ev) => zone.press(id, ev),
      }
    },
    activeList: engine.activeList,
    draggingId: engine.draggingId,
  }
}
