// Когда жест вообще начинается. Правила одинаковы для драга строк, драга блоков
// и ресайза, поэтому живут отдельно от конкретной фичи.
//
// Два разных момента проверки цели — не дублирование:
//  • pointerdown приходит ДО того, как браузер переставит фокус, поэтому клик по
//    полю/кнопке ловится только по ev.target;
//  • к моменту фактического старта фокус уже там, где нужно, и любой
//    фокусируемый элемент внутри блока отменяет жест без перечисления селекторов.

/** с чего жест не начинается, когда тянут за весь элемент, а не за ручку */
export const NO_DRAG =
  'input, textarea, select, option, button, a, label, [contenteditable=""], [contenteditable="true"], [data-no-drag]'

export function targetIsInteractive(ev: PointerEvent): boolean {
  return ev.target instanceof Element && !!ev.target.closest(NO_DRAG)
}

/** внутри элемента что-то в фокусе (значит его редактируют, а не двигают) */
export function focusInside(el: HTMLElement): boolean {
  const active = document.activeElement
  return !!active && active !== document.body && active !== el && el.contains(active)
}

export const LONGPRESS = 350   // тач: удержание до старта жеста, мс
export const MOVE_TOL = 10     // тач: сдвиг за время удержания = скролл, отменяем, px

export type PressGateOptions = {
  /** тач: удержание до старта, мс (0 = сразу). По умолчанию 350 */
  pressDelay?: number
  /** мышь: long-press до старта, мс (0 = выкл). Приоритетнее mouseThreshold */
  mousePressDelay?: number
  /** мышь: дистанция до старта, px (0 = сразу) */
  mouseThreshold?: number
}

export type PressGate = {
  /**
   * Принять pointerdown. `start` позовётся, когда условие старта выполнено:
   * сразу, после удержания или после сдвига на порог.
   */
  arm: (ev: PointerEvent, start: (x: number, y: number) => void) => void
  /** ждём ли мы сейчас старта (чтобы не начать второй жест поверх) */
  pending: () => boolean
  cancel: () => void
}

/**
 * Калитка старта жеста: на тач-устройстве ждём удержания (иначе палец не сможет
 * прокрутить страницу), мышью — сразу либо после порога-дистанции.
 */
export function createPressGate(opts: PressGateOptions = {}): PressGate {
  const pressDelay = opts.pressDelay ?? LONGPRESS
  const mousePress = opts.mousePressDelay ?? 0
  const mouseThresh = opts.mouseThreshold ?? 0

  type Wait = {
    pid: number
    x: number
    y: number
    timer: ReturnType<typeof setTimeout> | 0
    mode: 'press' | 'dist'
    thresh: number
    start: (x: number, y: number) => void
  }
  let wait: Wait | null = null

  const clear = () => {
    if (!wait) return
    if (wait.timer) clearTimeout(wait.timer)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onCancel)
    window.removeEventListener('pointercancel', onCancel)
    wait = null
  }
  const listen = () => {
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onCancel)
    window.addEventListener('pointercancel', onCancel)
  }
  function onMove(ev: PointerEvent) {
    if (!wait || ev.pointerId !== wait.pid) return
    const moved =
      Math.abs(ev.clientX - wait.x) > wait.thresh || Math.abs(ev.clientY - wait.y) > wait.thresh
    if (!moved) return
    if (wait.mode === 'press') {
      clear()                                    // палец поехал = скролл, отменяем
      return
    }
    const w = wait
    clear()
    w.start(ev.clientX, ev.clientY)              // мышь прошла порог — старт
  }
  function onCancel(ev: PointerEvent) {
    if (wait && ev.pointerId === wait.pid) clear()
  }

  return {
    arm(ev, start) {
      if (wait) return
      const touch = ev.pointerType === 'touch'
      const delay = touch ? pressDelay : mousePress

      if (delay > 0) {
        wait = { pid: ev.pointerId, x: ev.clientX, y: ev.clientY, timer: 0, mode: 'press', thresh: MOVE_TOL, start }
        wait.timer = setTimeout(() => {
          const w = wait
          clear()
          if (w) {
            if (touch) navigator.vibrate?.(8)
            w.start(w.x, w.y)
          }
        }, delay)
        listen()
        return
      }
      if (!touch && mouseThresh > 0) {
        wait = { pid: ev.pointerId, x: ev.clientX, y: ev.clientY, timer: 0, mode: 'dist', thresh: mouseThresh, start }
        listen()
        return
      }
      ev.preventDefault()
      start(ev.clientX, ev.clientY)
    },
    pending: () => wait !== null,
    cancel: clear,
  }
}
