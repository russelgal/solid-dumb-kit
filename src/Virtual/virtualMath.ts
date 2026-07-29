// Виртуальное окно при РАЗНОЙ высоте строк: ни DOM, ни фреймворка — только числа.
//
// Измеренные высоты храним, для ещё не показанных берём оценку, позиции считаем
// префиксными суммами. Ключевое отличие от «классической» схемы: прокрутку мы
// НЕ подправляем. Коррекция scrollTop — главный источник глюков (список ползёт
// под курсором, а events от собственной прокрутки надо отличать от чужих).
// Вместо этого окно всегда выводится из текущего scrollTop: уточнилась высота —
// просто пересчитали, кто виден.

export type Heights = {
  get: (key: string) => number | undefined
  estimate: number
}

/** offsets[i] — верх строки i; последний элемент — полная высота контента */
export function buildOffsets(keys: Array<string>, h: Heights): Array<number> {
  const offsets = new Array<number>(keys.length + 1)
  offsets[0] = 0
  for (let i = 0; i < keys.length; i++) {
    offsets[i + 1] = offsets[i] + (h.get(keys[i]) ?? h.estimate)
  }
  return offsets
}

/** Индекс строки, на которую приходится точка y (двоичный поиск). */
export function indexAt(offsets: Array<number>, y: number): number {
  const last = offsets.length - 2
  if (last < 0) return 0
  if (y <= 0) return 0
  if (y >= offsets[last]) return last

  let lo = 0, hi = last
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (offsets[mid] <= y) lo = mid
    else hi = mid - 1
  }
  return lo
}

export type VirtualWindow = {
  /** видимое окно: [first, last) */
  first: number
  last: number
  /** высота строк выше и ниже окна — распорки */
  padTop: number
  padBottom: number
  /** полная высота контента */
  total: number
}

export function windowOf(args: {
  offsets: Array<number>
  scrollTop: number
  viewportH: number
  overscan?: number
}): VirtualWindow {
  const { offsets, scrollTop, viewportH } = args
  const overscan = args.overscan ?? 6
  const count = offsets.length - 1
  const total = offsets[count] ?? 0
  if (!count) return { first: 0, last: 0, padTop: 0, padBottom: 0, total: 0 }

  const first = Math.max(0, indexAt(offsets, scrollTop) - overscan)
  const last = Math.min(count, indexAt(offsets, scrollTop + viewportH) + 1 + overscan)

  return { first, last, padTop: offsets[first], padBottom: total - offsets[last], total }
}
