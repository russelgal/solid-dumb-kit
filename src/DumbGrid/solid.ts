// Solid-обёртка над движком сетки: вешает его отписки на onCleanup и
// заворачивает «кто под жестом» в сигнал. Больше здесь ничего нет — под другой
// фреймворк (или Solid 2) переписывается только этот файл.

import { createSignal, onCleanup } from 'solid-js'
import { createGridEngine, type DumbGridOptions } from './gridCore'

export type GridActive = { id: string; kind: 'move' | 'resize' } | null

export type DumbGridHandle = {
  /** ref на контейнер сетки (обязателен: с него берётся ширина колонки) */
  container: (el: HTMLElement) => void
  /** ref на блок (ручка = дочка с [data-drag-handle]) */
  bind: (id: string) => (el: HTMLElement) => void
  /** ref на ручку ресайза внутри блока */
  resize: (id: string) => (el: HTMLElement) => void
  /** блок под жестом и вид жеста, реактивно */
  active: () => GridActive
}

export function createDumbGrid(opts: DumbGridOptions): DumbGridHandle {
  const [active, setActive] = createSignal<GridActive>(null)
  const engine = createGridEngine({
    ...opts,
    onActive: (state) => {
      setActive(state)
      opts.onActive?.(state)
    },
  })
  onCleanup(engine.destroy)

  return {
    container: (el) => onCleanup(engine.attachContainer(el)),
    bind: (id) => (el) => onCleanup(engine.attach(el, id)),
    resize: (id) => (el) => onCleanup(engine.attachResize(el, id)),
    active,
  }
}
