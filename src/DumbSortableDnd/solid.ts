// Solid-обёртка: отписки движка на onCleanup, «кого тащат» — в сигнал.

import { createSignal, onCleanup } from 'solid-js'
import { createSortDndEngine, type SortDndOptions } from './sortDndCore'

export type DumbSortableDndHandle = {
  /** ref на контейнер списка */
  container: (el: HTMLElement) => void
  /** ref на строку (ручка — дочка с [data-drag-handle]) */
  bind: (id: string) => (el: HTMLElement) => void
  /** id строки, которую тащат */
  active: () => string | null
}

export function createDumbSortableDnd(opts: SortDndOptions): DumbSortableDndHandle {
  const [active, setActive] = createSignal<string | null>(null)
  const engine = createSortDndEngine({
    ...opts,
    onActive: (id) => { setActive(id); opts.onActive?.(id) },
  })
  onCleanup(engine.destroy)

  return {
    container: (el) => onCleanup(engine.attachContainer(el)),
    bind: (id) => (el) => onCleanup(engine.attach(el, id)),
    active,
  }
}
