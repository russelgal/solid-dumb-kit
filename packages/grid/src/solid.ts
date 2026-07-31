// Solid-обёртка над движком сетки: вешает его отписки на onCleanup и
// заворачивает «кто под жестом» в сигнал. Больше здесь ничего нет — под другой
// фреймворк (или Solid 2) переписывается только этот файл.

import { createSignal, onCleanup } from 'solid-js'
import { createGridEngine, type DumbGridOptions } from './gridCore'
import { createGridGroupEngine, type GridGroupOptions, type GridZoneOptions } from './gridGroup'

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

/* ────────── группа сеток: блок переезжает из одной в другую ────────── */

export type GridGroupActive = { grid: string; id: string; kind: 'move' | 'resize' } | null

export type DumbGridGroupHandle = {
  /** зарегистрировать сетку; результат отдаётся компоненту как проп `group` */
  grid: (name: string, opts: GridZoneOptions) => DumbGridHandle
  /** что сейчас тащат, реактивно */
  active: () => GridGroupActive
  /** над какой сеткой указатель, реактивно (для подсветки приёмника) */
  over: () => string | null
}

export function createDumbGridGroup(opts: GridGroupOptions): DumbGridGroupHandle {
  const [active, setActive] = createSignal<GridGroupActive>(null)
  const [over, setOver] = createSignal<string | null>(null)
  const engine = createGridGroupEngine({
    ...opts,
    onActive: (state) => { setActive(state); opts.onActive?.(state) },
    onOver: (name) => { setOver(name); opts.onOver?.(name) },
  })
  onCleanup(engine.destroy)

  return {
    grid(name, zoneOpts) {
      const zone = engine.grid(name, zoneOpts)
      return {
        container: (el) => onCleanup(zone.attachContainer(el)),
        bind: (id) => (el) => onCleanup(zone.attach(el, id)),
        resize: (id) => (el) => onCleanup(zone.attachResize(el, id)),
        // «активен ли этот блок» — общий сигнал группы, суженный до своей сетки
        active: () => {
          const a = active()
          return a && a.grid === name ? { id: a.id, kind: a.kind } : null
        },
      }
    },
    active,
    over,
  }
}
