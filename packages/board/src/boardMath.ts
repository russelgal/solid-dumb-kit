// Арифметика доски. Ни DOM, ни Solid — только числа, поэтому проверяется
// тестами без браузера.

/** место в сетке секции: колонка и строка выводятся из одного числа */
export type Slot = { left: number; top: number }

/** три числа на секцию плюс число колонок — больше о её геометрии знать нечего */
export type ZoneGeom = { left: number; top: number; stepX: number; stepY: number; cols: number }

/**
 * Геометрия зоны с РАЗНЫМИ блоками: шага по вертикали тут нет вовсе — высота
 * строки это максимум высот тех, кто в ней стоит, а значит зависит от порядка.
 * Позиции считает `panelFlow` по снятым размерам, ровно как список в
 * `sortable-dnd` считает свои места по снятым высотам строк.
 */
export type ZoneFlow = { left: number; top: number; colW: number; gap: number; cols: number }

/**
 * Где лежит k-е место в секции с ОДИНАКОВЫМИ блоками. Шаг известен — значит
 * позиция это арифметика, а не замер, и состав секции на неё не влияет.
 *
 * Для блоков разного размера не годится: там строка тем выше, чем выше самый
 * высокий в ней, то есть место зависит от того, кто перед ним стоит. Считай
 * такие зоны через `panelFlow`, как считаются секции.
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
 * Куда лягут коробки при заданном порядке — поток, как `grid-auto-flow: row`.
 * Коробка занимает `span` колонок; не влезла в остаток строки — переносится на
 * следующую, а высота строки это максимум высот тех, кто в ней стоит.
 *
 * Этим считаются И секции доски, И блоки внутри секции: задача одна и та же.
 * Позиции НЕ снимаются заранее, а считаются вот этим, потому что коробки разной
 * ширины: обмен местами «половина» ↔ «во всю ширину» перекладывает всю сетку.
 * Снятые заранее места после первой же перестановки врут, а FLIP по ним дёргается.
 *
 * Требование к разметке: элементы не должны растягиваться на высоту строки
 * (`align-self: start`), иначе замеренная высота у всех в строке одинаковая, и
 * переехавший в другую строку блок посчитается не по своей.
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
