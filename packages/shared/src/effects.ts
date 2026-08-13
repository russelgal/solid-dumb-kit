// Два помощника поверх ДВУХФАЗНОГО эффекта Solid 2.
//
// В Solid 2 `createEffect(compute, effect)` разведён по фазам: первая функция
// трекается и только читает, вторая делает работу и не трекается. Разделение не
// формальность — от него зависит, работает код или падает:
//
//   • в первой фазе ЗАПРЕЩЕНО писать в сигналы (REACTIVE_WRITE_IN_OWNED_SCOPE);
//   • первая фаза идёт ДО монтирования, поэтому `ref` там ещё не присвоен —
//     обращение к DOM падает на первом же прогоне.
//
// Раньше здесь жил ещё и шим `effect(fn)`, сводивший обе линии Solid к одному
// колбэку. Он клал тело в фазу вычисления и ровно поэтому трижды ломал кит
// (белый экран у DumbModal, невидимая гидратация, DumbTree) — выкинут. Работа с
// DOM и запись в сигналы живут во второй фазе, а её дают `watch` и `onMounted`.
//
// Отдельного шима под Solid 1 тут больше нет: кит на второй линии
// (`peerDependencies: solid-js >=2.0.0-rc.0`), а `createEffect` в первой линии
// принимает вторым аргументом начальное значение, а не работу, — сводить их
// одним кодом уже нечестно.

import { createEffect, untrack } from 'solid-js'
import * as solid from 'solid-js'

/** двухфазный `createEffect`: типы solid-js под первую линию его не знают */
const twoPhase = createEffect as unknown as <T>(
  compute: () => T,
  effect: (value: T) => (() => void) | undefined,
) => void

/**
 * Что вернула работа, тем и убираемся — но ТОЛЬКО если это функция.
 *
 * Solid 2 понимает возврат второй фазы как cleanup и на всё остальное ругается:
 * «effect callback returned an invalid cleanup value». А возвращается там что
 * попало само собой — `watch(open, (v) => setShown(v))` отдаёт результат
 * сеттера, и безобидная стрелка без фигурных скобок роняла бы реактивность
 * целиком (REACTIVITY_HALTED).
 */
const cleanupOnly = (out: unknown): (() => void) | undefined =>
  typeof out === 'function' ? (out as () => void) : undefined

/**
 * `onMount` из Solid 1: работа один раз, когда DOM уже смонтирован.
 *
 * Это пустая первая фаза плюс вторая, где и разрешено всё: трогать `ref`,
 * писать в сигналы, вешать наблюдателей (`onCleanup` внутри работает как
 * обычно).
 */
export function onMounted(fn: () => void | (() => void)): void {
  twoPhase(() => {}, () => cleanupOnly(fn()))
}

/**
 * «Следить за этим — делать то»: `createEffect(on(dep, fn, { defer }))` из
 * Solid 1, а на второй линии — прямая запись двухфазного эффекта.
 *
 * `dep` читает сигналы и больше ничего, `fn` работает: DOM, запись, слушатели.
 * `defer` пропускает первый прогон — например, когда сброс нужен на СМЕНУ
 * значения, а не на появление.
 */
export function watch<T>(
  dep: () => T,
  fn: (value: T, prev: T | undefined) => void | (() => void),
  opts?: { defer?: boolean },
): void {
  let first = true
  let prev: T | undefined

  twoPhase(dep, (value: T) => {
    const skip = first && (opts?.defer ?? false)
    first = false
    const before = prev
    prev = value
    if (skip) return undefined
    return cleanupOnly(untrack(() => fn(value, before)))
  })
}

/**
 * Применить накопленные обновления ПРЯМО СЕЙЧАС.
 *
 * Solid 2 копит записи и флашит их микротаском. Обычно это то, что нужно, но
 * не в цепочке «записал — тут же прочитал»: движок жеста ставит выделение и
 * сразу читает его, чтобы отдать наружу, и без флаша видит пустоту.
 *
 * Через namespace, а не именованным импортом: кит отдаёт потребителю
 * JSX-исходник, и отсутствующий у него экспорт уронил бы ESM-линковку целиком.
 */
export function flushNow(): void {
  ;(solid as { flush?: () => void }).flush?.()
}
