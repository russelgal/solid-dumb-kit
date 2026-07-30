// Solid-обёртка: отписки движка на onCleanup, состояние жеста в сигналах.

import { createSignal, onCleanup } from 'solid-js'
import { createGridDndEngine, type DndDragging, type DndGroupOptions, type DndZoneOptions } from './dndCore'

export type DndActive = DndDragging | null
export type DndDrop = { grid: string; index: number } | null

export type DumbGridDndHandle = {
  /** ref на контейнер сетки */
  container: (el: HTMLElement) => void
  /** ref на блок — он становится нативно перетаскиваемым */
  bind: (id: string) => (el: HTMLElement) => void
  /** блок, который тащат из ЭТОЙ сетки */
  active: () => string | null
}

export type DumbGridDndGroupHandle = {
  grid: (name: string, opts: DndZoneOptions) => DumbGridDndHandle
  /** что тащат сейчас */
  active: () => DndActive
  /** сетка под указателем — для подсветки приёмника */
  over: () => string | null
  /** куда встанет блок прямо сейчас */
  drop: () => DndDrop
}

export function createDumbGridDndGroup(opts: DndGroupOptions = {}): DumbGridDndGroupHandle {
  const [active, setActive] = createSignal<DndActive>(null)
  const [over, setOver] = createSignal<string | null>(null)
  const [drop, setDrop] = createSignal<DndDrop>(null)

  const engine = createGridDndEngine({
    ...opts,
    onActive: (state) => { setActive(state); opts.onActive?.(state) },
    onOver: (name) => { setOver(name); opts.onOver?.(name) },
    onDropTarget: (target) => { setDrop(target); opts.onDropTarget?.(target) },
  })
  onCleanup(engine.destroy)

  return {
    grid(name, zoneOpts) {
      const zone = engine.grid(name, zoneOpts)
      return {
        container: (el) => onCleanup(zone.attachContainer(el)),
        bind: (id) => (el) => onCleanup(zone.attach(el, id)),
        active: () => {
          const a = active()
          return a && a.grid === name ? a.id : null
        },
      }
    },
    active,
    over,
    drop,
  }
}
