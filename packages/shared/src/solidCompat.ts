// Совместимость Solid 1 ↔ Solid 2.
//
// Кит отдаёт потребителю JSX-ИСХОДНИК (экспорт-условие "solid" в package.json),
// то есть код компилируется и линкуется компилятором и solid-js ПОТРЕБИТЕЛЯ.
// В Solid 2 исчезли onMount, batch, on (а также mergeProps, splitProps, Index,
// Suspense — их в ките нет), и именованный импорт пропавшего экспорта роняет
// ESM-линковку у потребителя целиком, даже если до этого кода не доходит.
//
// Поэтому: namespace-доступ вместо именованного импорта и свои замены с той же
// семантикой. В коде кита пропавшие API разрешено брать ТОЛЬКО отсюда.

import * as solid from 'solid-js'
import { createEffect, untrack } from 'solid-js'

/**
 * На какой линии Solid нас собрали. Признак — `batch`: в Solid 2 его убрали,
 * обновления батчатся сами. Считается ОДИН раз на модуль.
 */
const SOLID_2 = !('batch' in (solid as Record<string, unknown>))

/**
 * `createEffect(fn)` из Solid 1.
 *
 * В Solid 2 эффект стал ДВУХФАЗНЫМ: первая функция вычисляет и трекается,
 * вторая делает работу и не трекается. Одноаргументная форма там не просто
 * устарела — она падает с `MISSING_EFFECT_FN`, и вместе с ней валится вся
 * реактивность (`REACTIVITY_HALTED`).
 *
 * Здесь обе линии сведены к привычному одному колбэку. ВАЖНО: на Solid 2 тело
 * попадает в фазу ВЫЧИСЛЕНИЯ, а в ней запрещено писать в сигналы
 * (`REACTIVE_WRITE_IN_OWNED_SCOPE`). Поэтому `effect` годится для «прочитать и
 * потрогать DOM», а если внутри есть запись в сигнал — бери `watch` (следить
 * за этим — делать то) или `onMounted`: у них работа уходит во вторую фазу,
 * где запись разрешена.
 */
export function effect(fn: () => void): void {
  if (SOLID_2) (createEffect as unknown as (c: () => void, e: () => void) => void)(fn, () => {})
  else createEffect(fn)
}

/** `solid.batch`, где он есть (Solid 1); в Solid 2 обновления батчатся сами */
export const batch: <T>(fn: () => T) => T =
  (solid as { batch?: <T>(fn: () => T) => T }).batch ?? ((fn) => fn())

/** `onMount` из Solid 1: эффект, выполненный один раз после монтирования */
export function onMounted(fn: () => void): void {
  if (SOLID_2) {
    // вторая фаза: она и есть «эффект». Там разрешено писать в сигналы, а в
    // первой (вычисление) Solid 2 это запрещает — REACTIVE_WRITE_IN_OWNED_SCOPE
    ;(createEffect as unknown as (c: () => void, e: () => void) => void)(() => {}, fn)
  } else {
    createEffect(() => untrack(fn))
  }
}

/**
 * `createEffect(on(dep, fn, { defer: true }))` из Solid 1: следим за ОДНИМ
 * источником, тело не трекается; `defer` пропускает первый прогон.
 */
export function watch<T>(
  dep: () => T,
  fn: (value: T, prev: T | undefined) => void,
  opts?: { defer?: boolean },
): void {
  let first = true
  let prev: T | undefined

  // На Solid 2 это ровно двухфазный эффект и есть: следим первой функцией,
  // работаем второй. На Solid 1 сводим к одному createEffect.
  const step = (value: T) => {
    const skip = first && (opts?.defer ?? false)
    first = false
    const before = prev
    prev = value
    if (!skip) untrack(() => fn(value, before))
  }

  if (SOLID_2) (createEffect as unknown as (c: () => T, e: (v: T) => void) => void)(dep, step)
  else createEffect(() => step(dep()))
}

/**
 * Применить накопленные обновления ПРЯМО СЕЙЧАС.
 *
 * Solid 2 копит записи и флашит их микротаском. Обычно это то, что нужно, но
 * не в цепочке «записал — тут же прочитал»: движок жеста ставит выделение и
 * сразу читает его, чтобы отдать наружу, и без флаша видит пустоту.
 *
 * На Solid 1 обновления и так синхронные — там это пустышка.
 */
export function flushNow(): void {
  ;(solid as { flush?: () => void }).flush?.()
}
