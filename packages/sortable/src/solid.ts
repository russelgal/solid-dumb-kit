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
}

export function createDumbSortable(opts: DumbSortableOptions): DumbSortableHandle {
  const engine = createSortableEngine(opts)
  onCleanup(engine.destroy)

  return {
    bind: (id) => (el) => onCleanup(engine.attach(el, id)),
    row: (id) => (el) => onCleanup(engine.attachRow(el, id)),
    handle: (id) => (el) => onCleanup(engine.attachHandle(el, id)),
  }
}

export type SortableListHandle = {
  /** ref на контейнер зоны */
  container: (el: HTMLElement) => void
  /** ref на элемент зоны (ручка = дочка с [data-drag-handle]) */
  bind: (id: string) => (el: HTMLElement) => void
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
      }
    },
    activeList: engine.activeList,
    draggingId: engine.draggingId,
  }
}
