// Solid-обёртка над движком выделения: единственное, что она добавляет, —
// привязку отписок к жизненному циклу компонента.

import { onCleanup } from 'solid-js'
import { createSelectionEngine, type SelectionCoreOptions } from './selectionCore'

export function createSelectionArea(opts: SelectionCoreOptions) {
  const engine = createSelectionEngine(opts)
  onCleanup(engine.destroy)

  return {
    /** повесить жест на контейнер */
    attach(el: HTMLElement) {
      onCleanup(engine.attach(el))
    },
  }
}
