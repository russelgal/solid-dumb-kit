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

/** `solid.batch`, где он есть (Solid 1); в Solid 2 обновления батчатся сами */
export const batch: <T>(fn: () => T) => T =
  (solid as { batch?: <T>(fn: () => T) => T }).batch ?? ((fn) => fn())

/** `onMount` из Solid 1: эффект, выполненный один раз после монтирования */
export function onMounted(fn: () => void): void {
  createEffect(() => untrack(fn))
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
  createEffect(() => {
    const value = dep()
    const skip = first && (opts?.defer ?? false)
    first = false
    const before = prev
    prev = value
    if (!skip) untrack(() => fn(value, before))
  })
}
