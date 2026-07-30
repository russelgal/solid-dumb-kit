// Solid-обёртки над нативным движком: вешают его отписки на onCleanup и
// заворачивают состояние жеста в сигналы. Ничего больше здесь нет.

import { createSignal, onCleanup } from 'solid-js'
import { createGridDndEngine, type DndGroupOptions, type DndZoneOptions } from './dndCore'

export type DndActive = { grid: string; id: string; kind: 'move' | 'resize' } | null

export type DumbGridDndHandle = {
  /** ref на контейнер сетки — он же приёмник dragover/drop */
  container: (el: HTMLElement) => void
  /** ref на блок (он становится нативно перетаскиваемым) */
  bind: (id: string) => (el: HTMLElement) => void
  /** ref на ручку ресайза */
  resize: (id: string) => (el: HTMLElement) => void
  /** блок под жестом в ЭТОЙ сетке, реактивно */
  active: () => { id: string; kind: 'move' | 'resize' } | null
}

export type DumbGridDndGroupHandle = {
  /** зарегистрировать сетку; результат отдаётся компоненту пропом `group` */
  grid: (name: string, opts: DndZoneOptions) => DumbGridDndHandle
  /** что тащат сейчас, реактивно */
  active: () => DndActive
  /** над какой сеткой указатель, реактивно (для подсветки приёмника) */
  over: () => string | null
}

export function createDumbGridDndGroup(opts: DndGroupOptions = {}): DumbGridDndGroupHandle {
  const [active, setActive] = createSignal<DndActive>(null)
  const [over, setOver] = createSignal<string | null>(null)
  const engine = createGridDndEngine({
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
