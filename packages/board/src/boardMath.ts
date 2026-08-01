// Арифметика доски. Ни DOM, ни Solid — только числа, поэтому проверяется
// тестами без браузера.

/** место на экране: левый верхний угол */
export type Slot = { left: number; top: number }

export type PanelBox = { id: string; span: number; height: number }

/**
 * Куда лягут коробки при заданном порядке — поток, как `grid-auto-flow: row`.
 * Коробка занимает `span` колонок; не влезла в остаток строки — переносится на
 * следующую, а высота строки это максимум высот тех, кто в ней стоит.
 *
 * Этим считаются СЕКЦИИ доски: они разной ширины и высоты, и высота у них
 * произвольная — задаётся содержимым, поэтому приходит замером. Блоки ВНУТРИ
 * секции считаются иначе (`packFlow` из сетки): там размеры целые, и высота
 * строки известна заранее.
 *
 * Позиции НЕ снимаются заранее, а считаются вот этим, потому что коробки разной
 * ширины: обмен местами «половина» ↔ «во всю ширину» перекладывает всю сетку.
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
