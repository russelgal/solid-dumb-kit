// Математика сетки — то место, где живёт вся корректность DumbGrid: живой драг
// тестами не проверить, а вот «куда встанет блок» и «на сколько уедут соседи»
// проверяется без DOM вообще.
import { describe, it, expect } from 'vitest'
import {
  cellRect, colWidth, firstFreeCell, fitSpan, insertIndex, moveDeltas, overlaps, packFlow, placeFree,
  pointToCell, reorder, resolveSpan, rowCount, snapSpan, spanSize,
  type Metrics,
} from '../src/gridMath'
import { gridLinesBackground, mergeLayout, type DumbGridItem } from '../src/DumbGrid'

const span = (id: string, w = 1, h = 1) => ({ id, w, h })

// колонка 100px, зазоров нет — так координаты читаются глазами
const M: Metrics = { cols: 12, colW: 100, rowH: 100, gapX: 0, gapY: 0 }

describe('packFlow', () => {
  it('раскладывает по строке, пока хватает колонок', () => {
    const out = packFlow([span('a', 6), span('b', 3), span('c', 3)], 12)
    expect(out.map((p) => [p.col, p.row])).toEqual([[0, 0], [6, 0], [9, 0]])
  })

  it('переносит на новую строку, когда блок не влезает в остаток', () => {
    const out = packFlow([span('a', 6), span('b', 4), span('c', 4)], 12)
    expect(out.map((p) => [p.col, p.row])).toEqual([[0, 0], [6, 0], [0, 1]])
  })

  it('обтекает высокий блок, а не залезает на него', () => {
    // a занимает колонки 0–5 в строках 0 и 1
    const out = packFlow([span('a', 6, 2), span('b', 3), span('c', 3), span('d', 3)], 12)
    expect(out.map((p) => [p.col, p.row])).toEqual([[0, 0], [6, 0], [9, 0], [6, 1]])
  })

  it('курсор назад не возвращается — порядок остаётся читаемым', () => {
    // после широкого блока в строке остаётся дырка, но следующий узкий блок
    // уходит вниз, а не назад: это поведение grid-auto-flow без dense
    const out = packFlow([span('a', 8), span('b', 6), span('c', 2)], 12)
    expect(out.map((p) => [p.col, p.row])).toEqual([[0, 0], [0, 1], [6, 1]])
  })

  it('ширину шире сетки зажимает, дробную и нулевую нормализует', () => {
    const out = packFlow([span('a', 99), span('b', 0, 0), span('c', 2.4, 1.6)], 6)
    expect(out[0].w).toBe(6)
    expect([out[1].w, out[1].h]).toEqual([1, 1])
    expect([out[2].w, out[2].h]).toEqual([2, 2])
  })

  it('rowCount считает строки с учётом высоких блоков', () => {
    expect(rowCount(packFlow([span('a', 12, 3)], 12))).toBe(3)
    expect(rowCount(packFlow([span('a', 6), span('b', 6), span('c', 6)], 12))).toBe(2)
  })
})

describe('packFlow — режим dense', () => {
  it('затыкает дырку, оставленную широким блоком', () => {
    // a=8 занимает 0–7, b=6 не влезает и уходит вниз, c=2 в dense возвращается
    // в дырку строки 0 (в flow он встал бы за b)
    const items = [span('a', 8), span('b', 6), span('c', 2)]
    expect(packFlow(items, 12, 'dense').map((p) => [p.col, p.row])).toEqual([[0, 0], [0, 1], [8, 0]])
    expect(packFlow(items, 12, 'flow').map((p) => [p.col, p.row])).toEqual([[0, 0], [0, 1], [6, 1]])
  })

  it('обходит высокие блоки так же честно, как flow', () => {
    const out = packFlow([span('a', 6, 2), span('b', 6), span('c', 3)], 12, 'dense')
    expect(out.map((p) => [p.col, p.row])).toEqual([[0, 0], [6, 0], [6, 1]])
  })

  it('плотная укладка короче или равна обычной по числу строк', () => {
    const items = [span('a', 7), span('b', 6), span('c', 5), span('d', 4)]
    expect(rowCount(packFlow(items, 12, 'dense'))).toBeLessThanOrEqual(rowCount(packFlow(items, 12, 'flow')))
  })
})

describe('placeFree — свободный режим', () => {
  const at = (id: string, x: number, y: number, w = 3, h = 1) => ({ id, x, y, w, h })

  it('ставит блоки ровно туда, куда сказано, и дырки не трогает', () => {
    const out = placeFree([at('a', 0, 0), at('b', 6, 3)], 12)
    expect(out.map((p) => [p.col, p.row])).toEqual([[0, 0], [6, 3]])
    expect(rowCount(out)).toBe(4)                 // пустые строки между ними живы
  })

  it('координаты за краем сетки зажимает', () => {
    const out = placeFree([at('a', 99, -5, 4)], 12)
    expect([out[0].col, out[0].row]).toEqual([8, 0])   // 12 − 4
  })

  it('наложение из устаревшего стора разводит в ближайшее свободное место', () => {
    const out = placeFree([at('a', 0, 0, 6), at('b', 0, 0, 6)], 12)
    expect([out[0].col, out[0].row]).toEqual([0, 0])
    expect([out[1].col, out[1].row]).toEqual([6, 0])   // в той же строке правее, а не вниз
  })

  it('если в строке места нет — уводит строкой ниже, но блок не теряется', () => {
    const out = placeFree([at('a', 0, 0, 12), at('b', 0, 0, 12)], 12)
    expect([out[1].col, out[1].row]).toEqual([0, 1])
  })

  it('расставленные блоки друг на друга не залезают', () => {
    const out = placeFree([at('a', 0, 0, 6, 2), at('b', 0, 0, 6, 2), at('c', 0, 1, 6)], 12)
    for (const p of out) {
      const others = out.filter((o) => o.id !== p.id)
      expect(overlaps({ placed: others, id: p.id, col: p.col, row: p.row, w: p.w, h: p.h })).toBe(false)
    }
  })

  it('блоки без координат укладывает потоком', () => {
    const out = placeFree([{ id: 'a', w: 6, h: 1 }, { id: 'b', w: 6, h: 1 }], 12)
    expect(out.map((p) => [p.col, p.row])).toEqual([[0, 0], [6, 0]])
  })
})

describe('pointToCell', () => {
  const m: Metrics = { cols: 12, colW: 100, rowH: 100, gapX: 0, gapY: 0 }

  it('прилипает к ближайшей ячейке по углу блока', () => {
    expect(pointToCell({ x: 240, y: 260, w: 3, m })).toEqual({ col: 2, row: 3 })
    expect(pointToCell({ x: 249, y: 40, w: 3, m })).toEqual({ col: 2, row: 0 })
    expect(pointToCell({ x: 251, y: 40, w: 3, m })).toEqual({ col: 3, row: 0 })
  })

  it('не даёт блоку вылезти за правый край', () => {
    expect(pointToCell({ x: 1400, y: 0, w: 4, m }).col).toBe(8)
  })

  it('выше первой строки не поднимает, а вниз пускает сколько угодно', () => {
    expect(pointToCell({ x: 0, y: -500, w: 1, m }).row).toBe(0)
    expect(pointToCell({ x: 0, y: 2000, w: 1, m }).row).toBe(20)
  })
})

describe('fitSpan — ресайз в свободном режиме', () => {
  // a: 0–2 строка 0, b: 6–8 строка 0
  const placed = placeFree([{ id: 'a', x: 0, y: 0, w: 3, h: 1 }, { id: 'b', x: 6, y: 0, w: 3, h: 1 }], 12)

  it('обрезает ширину по соседу справа', () => {
    expect(fitSpan({ placed, id: 'a', col: 0, row: 0, want: { w: 12, h: 1 } }).w).toBe(6)
  })

  it('свободное место отдаёт целиком', () => {
    expect(fitSpan({ placed, id: 'a', col: 0, row: 0, want: { w: 5, h: 1 } })).toEqual({ w: 5, h: 1 })
  })

  it('вниз растёт свободно — там никого нет', () => {
    expect(fitSpan({ placed, id: 'a', col: 0, row: 0, want: { w: 3, h: 4 } }).h).toBe(4)
  })

  it('минимум не съедает даже когда места нет', () => {
    const tight = placeFree([{ id: 'a', x: 0, y: 0, w: 3, h: 1 }, { id: 'b', x: 3, y: 0, w: 9, h: 1 }], 12)
    expect(fitSpan({ placed: tight, id: 'a', col: 0, row: 0, want: { w: 8, h: 1 }, limits: { minW: 2 } })).toEqual({ w: 3, h: 1 })
  })
})

describe('overlaps', () => {
  const placed = placeFree([{ id: 'a', x: 0, y: 0, w: 4, h: 2 }], 12)

  it('пересечение по обеим осям — занято', () => {
    expect(overlaps({ placed, id: 'x', col: 3, row: 1, w: 2, h: 1 })).toBe(true)
  })

  it('касание вплотную — свободно', () => {
    expect(overlaps({ placed, id: 'x', col: 4, row: 0, w: 2, h: 2 })).toBe(false)
    expect(overlaps({ placed, id: 'x', col: 0, row: 2, w: 4, h: 1 })).toBe(false)
  })

  it('сам себя занятым не считает', () => {
    expect(overlaps({ placed, id: 'a', col: 0, row: 0, w: 4, h: 2 })).toBe(false)
  })
})

describe('метрики', () => {
  it('colWidth делит остаток после зазоров', () => {
    expect(colWidth(1200, 12, 0)).toBe(100)
    expect(colWidth(1200 + 11 * 10, 12, 10)).toBe(100)
  })

  it('spanSize включает внутренние зазоры', () => {
    expect(spanSize(1, 100, 10)).toBe(100)
    expect(spanSize(3, 100, 10)).toBe(320)
  })

  it('cellRect переводит единицы сетки в px', () => {
    const m: Metrics = { cols: 12, colW: 100, rowH: 80, gapX: 10, gapY: 10 }
    expect(cellRect({ id: 'a', col: 2, row: 1, w: 3, h: 2 }, m)).toEqual({
      x: 220, y: 90, width: 320, height: 170,
    })
  })
})

describe('insertIndex', () => {
  const base = packFlow([span('a', 4), span('b', 4), span('c', 4)], 12)

  it('указатель правее центра соседа = встать за ним', () => {
    // b занимает 400–800, его центр 600
    const k = insertIndex({ base, dragId: 'a', m: M, pointerX: 850, pointerY: 50 })
    expect(k).toBe(1)
  })

  it('указатель левее всех = в начало', () => {
    expect(insertIndex({ base, dragId: 'c', m: M, pointerX: 10, pointerY: 50 })).toBe(0)
  })

  it('указатель ниже всей строки = в конец', () => {
    expect(insertIndex({ base, dragId: 'a', m: M, pointerX: 10, pointerY: 500 })).toBe(2)
  })

  it('перетаскиваемый в подсчёте не участвует', () => {
    // все три блока правее указателя, но один из них — сам перетаскиваемый
    const k = insertIndex({ base, dragId: 'b', m: M, pointerX: 1150, pointerY: 50 })
    expect(k).toBe(2)
  })
})

describe('moveDeltas', () => {
  it('соседи уезжают ровно на разницу двух раскладок', () => {
    const blocks = [span('a', 6), span('b', 3), span('c', 3)]
    const base = packFlow(blocks, 12)
    const next = packFlow(reorder(blocks, 0, 1), 12)   // a переезжает за b

    const moves = moveDeltas({ base, next, m: M, skipId: 'a' })
    expect(moves).toEqual([
      { id: 'b', dx: -600, dy: 0 },
      { id: 'c', dx: 0, dy: 0 },
    ])
  })

  it('перенос на другую строку даёт дельту по обеим осям', () => {
    const blocks = [span('a', 6), span('b', 6), span('c', 6)]
    const base = packFlow(blocks, 12)                 // a,b в строке 0; c в строке 1
    const next = packFlow(reorder(blocks, 2, 0), 12)  // c встаёт первым

    const moves = moveDeltas({ base, next, m: M, skipId: 'c' })
    expect(moves).toEqual([
      { id: 'a', dx: 600, dy: 0 },
      { id: 'b', dx: -600, dy: 100 },
    ])
  })
})

describe('snapSpan', () => {
  const m: Metrics = { cols: 12, colW: 100, rowH: 50, gapX: 10, gapY: 10 }   // шаг 110 / 60

  it('округляет к ближайшей колонке', () => {
    expect(snapSpan({ start: { w: 2, h: 1 }, dx: 110, dy: 0, m }).w).toBe(3)
    expect(snapSpan({ start: { w: 2, h: 1 }, dx: 80, dy: 0, m }).w).toBe(3)
    expect(snapSpan({ start: { w: 2, h: 1 }, dx: 40, dy: 0, m }).w).toBe(2)
    expect(snapSpan({ start: { w: 2, h: 1 }, dx: -80, dy: 0, m }).w).toBe(1)
  })

  it('высота снапится по строкам', () => {
    expect(snapSpan({ start: { w: 1, h: 2 }, dx: 0, dy: 60, m }).h).toBe(3)
    expect(snapSpan({ start: { w: 1, h: 2 }, dx: 0, dy: -60, m }).h).toBe(1)
  })

  it('меньше одной единицы и шире сетки не выпускает', () => {
    expect(snapSpan({ start: { w: 1, h: 1 }, dx: -9999, dy: -9999, m })).toEqual({ w: 1, h: 1 })
    expect(snapSpan({ start: { w: 1, h: 1 }, dx: 9999, dy: 0, m }).w).toBe(12)
  })

  it('уважает пределы блока', () => {
    const limits = { minW: 2, maxW: 4, minH: 2, maxH: 3 }
    expect(snapSpan({ start: { w: 3, h: 2 }, dx: 9999, dy: 9999, m, limits })).toEqual({ w: 4, h: 3 })
    expect(snapSpan({ start: { w: 3, h: 2 }, dx: -9999, dy: -9999, m, limits })).toEqual({ w: 2, h: 2 })
  })
})

describe('mergeLayout', () => {
  const item = (id: string, extra: Partial<DumbGridItem> = {}): DumbGridItem =>
    ({ id, content: () => null, ...extra })

  it('без сохранённого берёт размеры из пропов', () => {
    const out = mergeLayout(null, [item('a', { w: 6, h: 2 }), item('b')], 12)
    expect(out).toEqual([{ id: 'a', w: 6, h: 2 }, { id: 'b', w: 1, h: 1 }])
  })

  it('сохранённый порядок сильнее порядка items', () => {
    const saved = [{ id: 'b', w: 3, h: 1 }, { id: 'a', w: 6, h: 2 }]
    const out = mergeLayout(saved, [item('a'), item('b')], 12)
    expect(out.map((s) => s.id)).toEqual(['b', 'a'])
  })

  it('исчезнувшие блоки выбрасывает, новые дописывает в конец', () => {
    const saved = [{ id: 'ghost', w: 3, h: 1 }, { id: 'a', w: 3, h: 1 }]
    const out = mergeLayout(saved, [item('a'), item('new', { w: 4 })], 12)
    expect(out).toEqual([{ id: 'a', w: 3, h: 1 }, { id: 'new', w: 4, h: 1 }])
  })

  it('сохранённые размеры зажимает в пределы и в число колонок', () => {
    const saved = [{ id: 'a', w: 99, h: 99 }, { id: 'b', w: 1, h: 1 }]
    const out = mergeLayout(saved, [item('a', { maxH: 3 }), item('b', { minW: 2 })], 6)
    expect(out).toEqual([{ id: 'a', w: 6, h: 3 }, { id: 'b', w: 2, h: 1 }])
  })

  it('мусор в сторе не роняет раскладку — нечисла падают на минимум', () => {
    const saved = [{ id: 'a', w: Number.NaN, h: Number.POSITIVE_INFINITY }]
    const out = mergeLayout(saved, [item('a')], 12)
    expect(out).toEqual([{ id: 'a', w: 1, h: 1 }])
  })
})

describe('gridLinesBackground — разметка сетки', () => {
  const lines = (image: string) => image.split(', ').filter((s) => s.startsWith('rgba')).length

  it('рисует границу перед каждой колонкой, кроме первой', () => {
    // по два стопа на линию: начало и конец
    expect(lines(gridLinesBackground({ cols: 12, gapX: 12, rowH: 80, gapY: 12 }).image.split('linear-gradient(to bottom')[0]))
      .toBe((12 - 1) * 2)
    expect(lines(gridLinesBackground({ cols: 4, gapX: 12, rowH: 80, gapY: 12 }).image.split('linear-gradient(to bottom')[0]))
      .toBe((4 - 1) * 2)
  })

  it('ширина колонки остаётся в calc — её считает браузер, не мы', () => {
    const { image } = gridLinesBackground({ cols: 6, gapX: 10, rowH: 90, gapY: 10 })
    expect(image).toContain('calc((100% - 50px) / 6)')     // (6−1) * 10px зазоров
  })

  it('вертикальные линии не тайлятся: проценты в стопах считаются от тайла', () => {
    // если по X появится тайл меньше 100%, calc(100% …) начнёт мерить тайл,
    // и вертикальные линии либо пропадут, либо встанут не туда
    expect(gridLinesBackground({ cols: 12, gapX: 12, rowH: 80, gapY: 12 }).size)
      .toBe('100% 100%, 100% 92px')
  })

  it('при нулевом зазоре линия всё равно видна — волосяная в 1px', () => {
    const { image } = gridLinesBackground({ cols: 3, gapX: 0, rowH: 100, gapY: 0 })
    expect(image).toContain('- 0px + 1px)')                // ширина линии не нулевая
    expect(image).toContain('transparent 99px')            // граница строки тоже
  })

  it('горизонтальные линии тайлятся шагом строки', () => {
    expect(gridLinesBackground({ cols: 12, gapX: 8, rowH: 70, gapY: 8 }).size).toContain('100% 78px')
  })
})

describe('resolveSpan — пресеты ширины', () => {
  it('именованные доли считаются от числа колонок', () => {
    expect(resolveSpan('full', 12)).toBe(12)
    expect(resolveSpan('half', 12)).toBe(6)
    expect(resolveSpan('third', 12)).toBe(4)
    expect(resolveSpan('quarter', 12)).toBe(3)
    expect(resolveSpan('two-thirds', 12)).toBe(8)
    expect(resolveSpan('three-quarters', 12)).toBe(9)
  })

  it('произвольные дроби тоже работают', () => {
    expect(resolveSpan('1/6', 12)).toBe(2)
    expect(resolveSpan('5/12', 12)).toBe(5)
    expect(resolveSpan('2/5', 10)).toBe(4)
  })

  it('произвольные числа остаются числами и зажимаются в сетку', () => {
    expect(resolveSpan(5, 12)).toBe(5)
    expect(resolveSpan(99, 12)).toBe(12)
    expect(resolveSpan(0, 12)).toBe(1)
    expect(resolveSpan(2.4, 12)).toBe(2)
  })

  it('доля округляется вниз — N блоков «1/N» обязаны влезать в строку', () => {
    // 5 колонок: half = 2, иначе два таких блока в строку уже не встанут
    expect(resolveSpan('half', 5)).toBe(2)
    expect(resolveSpan('half', 5) * 2).toBeLessThanOrEqual(5)
    expect(resolveSpan('third', 10) * 3).toBeLessThanOrEqual(10)
    expect(resolveSpan('quarter', 6) * 4).toBeLessThanOrEqual(6)
  })

  it('меньше колонки не бывает даже на мелкой сетке', () => {
    expect(resolveSpan('quarter', 2)).toBe(1)
    expect(resolveSpan('1/12', 3)).toBe(1)
  })

  it('опечатка в пресете даёт одну колонку, а не всю ширину', () => {
    expect(resolveSpan('halv' as never, 12)).toBe(1)
    expect(resolveSpan('1/0' as never, 12)).toBe(1)
    expect(resolveSpan(undefined, 12)).toBe(1)
  })
})

describe('firstFreeCell — куда положить новый блок', () => {
  it('в пустую сетку — в самый угол', () => {
    expect(firstFreeCell({ placed: [], cols: 12, w: 4, h: 1 })).toEqual({ x: 0, y: 0 })
  })

  it('в первую дырку, а не в конец', () => {
    // строка 0: колонки 0–5 заняты; строка 1: занято всё
    const placed = placeFree([
      { id: 'a', x: 0, y: 0, w: 6, h: 1 },
      { id: 'b', x: 0, y: 1, w: 12, h: 1 },
    ], 12)
    expect(firstFreeCell({ placed, cols: 12, w: 3, h: 1 })).toEqual({ x: 6, y: 0 })
  })

  it('если в дырку не влезает — ищет ниже', () => {
    const placed = placeFree([{ id: 'a', x: 0, y: 0, w: 10, h: 1 }], 12)
    expect(firstFreeCell({ placed, cols: 12, w: 4, h: 1 })).toEqual({ x: 0, y: 1 })
  })

  it('учитывает высоту: место должно быть свободно на все строки блока', () => {
    const placed = placeFree([
      { id: 'a', x: 0, y: 0, w: 6, h: 1 },
      { id: 'b', x: 6, y: 1, w: 6, h: 1 },
    ], 12)
    // высокому блоку строка 0 не подходит: под ним занята строка 1
    expect(firstFreeCell({ placed, cols: 12, w: 6, h: 2 })).toEqual({ x: 0, y: 1 })
  })
})

describe('mergeLayout — добавление и удаление блоков', () => {
  const item = (id: string, extra: Partial<DumbGridItem> = {}): DumbGridItem =>
    ({ id, content: () => null, ...extra })

  it('пресеты разворачиваются в колонки', () => {
    const out = mergeLayout(null, [item('a', { w: 'full', h: 2 }), item('b', { w: 'half' })], 12)
    expect(out).toEqual([{ id: 'a', w: 12, h: 2 }, { id: 'b', w: 6, h: 1 }])
  })

  it('пределы тоже могут быть пресетами', () => {
    const saved = [{ id: 'a', w: 12, h: 1 }]
    const out = mergeLayout(saved, [item('a', { maxW: 'half' })], 12)
    expect(out[0].w).toBe(6)
  })

  it('удалённый блок уходит и из раскладки', () => {
    const saved = [{ id: 'a', w: 3, h: 1 }, { id: 'b', w: 3, h: 1 }]
    const out = mergeLayout(saved, [item('a')], 12)
    expect(out.map((s) => s.id)).toEqual(['a'])
  })

  it('в потоке добавленный блок идёт в конец без координат', () => {
    const saved = [{ id: 'a', w: 6, h: 1 }]
    const out = mergeLayout(saved, [item('a', { w: 6 }), item('new', { w: 3 })], 12)
    expect(out[1]).toEqual({ id: 'new', w: 3, h: 1 })     //x/y в потоке не нужны
  })

  it('в свободном режиме добавленный блок получает первую свободную ячейку', () => {
    const saved = [{ id: 'a', w: 6, h: 1, x: 0, y: 0 }]
    const out = mergeLayout(saved, [item('a', { w: 6 }), item('new', { w: 3 })], 12, 'free')
    expect(out[1]).toEqual({ id: 'new', w: 3, h: 1, x: 6, y: 0 })
  })

  it('явные x/y у нового блока сильнее автопоиска', () => {
    const saved = [{ id: 'a', w: 6, h: 1, x: 0, y: 0 }]
    const out = mergeLayout(saved, [item('a', { w: 6 }), item('new', { w: 3, x: 9, y: 4 })], 12, 'free')
    expect(out[1]).toEqual({ id: 'new', w: 3, h: 1, x: 9, y: 4 })
  })
})
