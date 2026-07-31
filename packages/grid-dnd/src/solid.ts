// Solid-обёртка: отписки движка на onCleanup, состояние жеста в сигналах.

import { createSignal, onCleanup } from 'solid-js'
import { createGridDndEngine, type DndDragging, type DndGroupOptions, type DndZoneOptions } from './dndCore'

export type DndActive = DndDragging | null

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
  /** сколько строк займёт сетка, если бросить блок сейчас (0 — жеста нет) */
  rows: (grid: string) => number
}

export function createDumbGridDndGroup(opts: DndGroupOptions = {}): DumbGridDndGroupHandle {
  const [active, setActive] = createSignal<DndActive>(null)
  const [over, setOver] = createSignal<string | null>(null)
  const [rows, setRows] = createSignal<Record<string, number>>({})
  const engine = createGridDndEngine({
    ...opts,
    onActive: (state) => { setActive(state); opts.onActive?.(state) },
    onOver: (name) => { setOver(name); opts.onOver?.(name) },
    onRows: (grid, n) => {
      setRows((prev) => (prev[grid] === n ? prev : { ...prev, [grid]: n }))
      opts.onRows?.(grid, n)
    },
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
    rows: (grid) => rows()[grid] ?? 0,
  }
}
