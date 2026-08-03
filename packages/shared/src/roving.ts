// Клавиатура по списку и по сетке: стрелки, Home/End, диапазон с Shift.
//
// Чистая арифметика над ИНДЕКСАМИ — ни DOM, ни фреймворка. Компонент знает,
// сколько у него колонок и сколько элементов; отсюда однозначно считается, куда
// уводит стрелка. Поэтому функция тестируется без браузера и одинаково служит и
// файндеру, и галерее, и таблице.
//
// Почему не «просто ArrowDown +1»: в сетке вниз — это +колонки, в списке +1, а
// на краю ряда вправо должно переносить на следующий ряд, иначе курсор
// упирается в стену там, где глаз ждёт продолжения.

export type MoveKey =
  | 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
  | 'Home' | 'End' | 'PageUp' | 'PageDown'

export type MoveArgs = {
  /** откуда идём; `-1` — курсора ещё нет */
  from: number
  count: number
  /** колонок в ряду; 1 — список */
  columns?: number
  /** сколько рядов в экране — для PageUp/PageDown */
  page?: number
}

/**
 * Куда уводит клавиша. `null` — эта клавиша не про перемещение, обрабатывать
 * её не надо (и, что важнее, не надо гасить событие).
 */
export function moveIndex(key: string, args: MoveArgs): number | null {
  const { from, count } = args
  if (count <= 0) return null
  const cols = Math.max(1, args.columns ?? 1)
  const page = Math.max(1, args.page ?? 1) * cols
  // курсора нет — любая стрелка ставит его на край, а не «никуда»
  const cur = from < 0 ? (key === 'ArrowUp' || key === 'End' ? count : -1) : from

  const clamp = (i: number) => Math.max(0, Math.min(count - 1, i))

  switch (key as MoveKey) {
    case 'ArrowRight': return clamp(cur + 1)
    case 'ArrowLeft':  return clamp(cur - 1)
    case 'ArrowDown':  return clamp(cur + cols)
    case 'ArrowUp':    return clamp(cur - cols)
    case 'PageDown':   return clamp(cur + page)
    case 'PageUp':     return clamp(cur - page)
    case 'Home':       return 0
    case 'End':        return count - 1
    default:           return null
  }
}

/**
 * Выделение после нажатия. Три случая, и все три знакомы по любому файловому
 * менеджеру: просто стрелка переносит выделение, Shift растягивает диапазон от
 * якоря, Ctrl/Cmd только двигает курсор, ничего не трогая.
 */
export function moveSelection<T>(args: {
  keys: Array<T>
  /** индекс, с которого начался диапазон */
  anchor: number
  next: number
  current: Set<T>
  shift: boolean
  ctrl: boolean
}): { selected: Set<T>; anchor: number } {
  const { keys, next, current, shift, ctrl } = args
  if (ctrl && !shift) return { selected: new Set(current), anchor: next }

  if (shift) {
    const from = args.anchor < 0 ? next : args.anchor
    const [a, b] = from <= next ? [from, next] : [next, from]
    const selected = new Set<T>()
    for (let i = a; i <= b; i++) if (keys[i] !== undefined) selected.add(keys[i])
    // якорь при растягивании НЕ двигается: иначе диапазон «уползает» за
    // курсором и вернуться к исходной точке уже нельзя
    return { selected, anchor: from }
  }

  const one = keys[next]
  return { selected: one === undefined ? new Set<T>() : new Set([one]), anchor: next }
}

/** относится ли клавиша к перемещению — чтобы решить, гасить ли событие */
export const isMoveKey = (key: string): key is MoveKey =>
  key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight' ||
  key === 'Home' || key === 'End' || key === 'PageUp' || key === 'PageDown'
