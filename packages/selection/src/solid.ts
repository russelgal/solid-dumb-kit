// Solid-обёртка над движком выделения: единственное, что она добавляет, —
// привязку отписок к жизненному циклу компонента.

import { onCleanup } from 'solid-js'
import { ownedRef } from '@solid-dumb-kit/shared'
import { createSelectionEngine, type SelectionCoreOptions } from './selectionCore'

export function createSelectionArea(opts: SelectionCoreOptions) {
  const engine = createSelectionEngine(opts)
  onCleanup(engine.destroy)

  return {
    /** повесить жест на контейнер; годится и как ref — owner захвачен здесь */
    attach: ownedRef((el: HTMLElement) => {
      onCleanup(engine.attach(el))
    }),
  }
}
