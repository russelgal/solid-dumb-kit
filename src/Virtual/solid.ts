// Solid-обёртка: движок + сигнал окна, отписки на onCleanup.
import { createSignal, onCleanup } from 'solid-js'
import { createVirtualEngine, type VirtualOptions } from './virtualCore'
import type { VirtualWindow } from './virtualMath'

const EMPTY: VirtualWindow = { first: 0, last: 0, padTop: 0, padBottom: 0, total: 0 }

export function createVirtual(opts: Omit<VirtualOptions, 'onChange'>) {
  const [win, setWin] = createSignal<VirtualWindow>(EMPTY)
  const engine = createVirtualEngine({ ...opts, onChange: setWin })
  onCleanup(engine.destroy)

  return {
    /** ref на прокручиваемый контейнер */
    scroller: (el: HTMLElement) => onCleanup(engine.attach(el)),
    /** индексы окна и распорки */
    window: win,
    /** пересчитать после смены данных */
    refresh: engine.refresh,
    /** снять высоты отрисованных строк */
    measure: engine.measure,
  }
}
