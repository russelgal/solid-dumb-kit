// Арифметика доски. Ни DOM, ни Solid — только числа, поэтому проверяется
// тестами без браузера.

/** место в сетке секции: колонка и строка выводятся из одного числа */
export type Slot = { left: number; top: number }

/** три числа на секцию плюс число колонок — больше о её геометрии знать нечего */
export type ZoneGeom = { left: number; top: number; stepX: number; stepY: number; cols: number }

/**
 * Где лежит k-е место в секции. Блоки одинаковые, шаг известен — значит позиция
 * это арифметика, а не замер. Состав секции на неё не влияет: блоки уезжают,
 * места остаются.
 */
export function slotAt(g: ZoneGeom | undefined, k: number): Slot | null {
  if (!g) return null
  return {
    left: g.left + (k % g.cols) * g.stepX,
    top: g.top + Math.floor(k / g.cols) * g.stepY,
  }
}

/** сколько строк занимает секция с `count` блоками при `cols` колонках */
export const rowsFor = (count: number, cols: number) => Math.max(1, Math.ceil(count / Math.max(1, cols)))

export type PanelBox = { id: string; span: number; height: number }

/**
 * Куда лягут секции при заданном порядке — поток, как `grid-auto-flow: row`.
 * Секция занимает `span` колонок; не влезла в остаток строки — переносится на
 * следующую, а высота строки это максимум высот тех, кто в ней стоит.
 *
 * Позиции секций НЕ снимаются заранее, а считаются вот этим: секции разной
 * ширины, и обмен местами «половина» ↔ «во всю ширину» перекладывает всю сетку.
 * Снятые заранее места после первой же перестановки врут, а FLIP по ним дёргается.
 */
export function panelFlow(
  order: Array<PanelBox>,
  opts: { cols: number; colW: number; gap: number; origin: Slot },
): Record<string, Slot> {
  const { cols, colW, gap, origin } = opts
  const step = colW + gap
  const out: Record<string, Slot> = {}
  let used = 0
  let top = 0
  let rowH = 0

  for (const p of order) {
    const w = Math.max(1, Math.min(cols, p.span))
    if (used + w > cols && used > 0) {
      top += rowH + gap
      used = 0
      rowH = 0
    }
    out[p.id] = { left: origin.left + used * step, top: origin.top + top }
    used += w
    rowH = Math.max(rowH, p.height)
  }
  return out
}

/**
 * Переставить элемент массива на место `to`. Возвращает НОВЫЙ массив — источник
 * истины у потребителя, мы его массивы не трогаем.
 */
export function moveAt<T>(list: Array<T>, from: number, to: number): Array<T> {
  if (from === to || from < 0) return list
  const next = list.slice()
  next.splice(Math.max(0, Math.min(next.length, to)), 0, next.splice(from, 1)[0])
  return next
}
