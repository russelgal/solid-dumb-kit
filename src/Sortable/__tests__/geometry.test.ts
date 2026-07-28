import { describe, it, expect } from 'vitest'
import {
  autoScrollSpeed, clampDragged, gapOf, gridLayout, hitIndex, holeTop, listLayout, nextInsertIndex, shiftLayout, viewOrigin,
  EDGE, MAX_SPEED, ACCEL, type Cell, type Item,
} from '../geometry'

// строка i: top = i*step, высота h
const rows = (n: number, h = 10, gap = 0): Cell[] =>
  Array.from({ length: n }, (_, i) => ({ left: 0, top: i * (h + gap), width: 100, height: h }))

const itemsOf = (cells: Cell[], ids: string[], skip?: string): Item[] =>
  ids.map((id, i) => ({ id, cell: cells[i] }))
    .filter(x => x.id !== skip)
    .map(({ id, cell }) => ({
      id, cx: cell.left + cell.width / 2, cy: cell.top + cell.height / 2,
      top: cell.top, bottom: cell.top + cell.height,
    }))

describe('hitIndex — список', () => {
  const cells = rows(3)                       // центры: 5, 15, 25
  const others = itemsOf(cells, ['a', 'b', 'c'], 'a')  // b, c

  it('выше всех центров → в начало', () => {
    expect(hitIndex(others, 0, 0, false)).toBe(0)
  })
  it('между центрами → между ними', () => {
    expect(hitIndex(others, 0, 16, false)).toBe(1)
  })
  it('ниже всех центров → в конец', () => {
    expect(hitIndex(others, 0, 99, false)).toBe(2)
  })
  it('ровно на центре не считается пройденным', () => {
    expect(hitIndex(others, 0, 15, false)).toBe(0)
  })
})

describe('hitIndex — сетка', () => {
  // две ячейки в ряду: (0,0) и (100,0), высота 50
  const cells: Cell[] = [
    { left: 0, top: 0, width: 100, height: 50 },
    { left: 100, top: 0, width: 100, height: 50 },
    { left: 0, top: 50, width: 100, height: 50 },
  ]
  const others = itemsOf(cells, ['a', 'b', 'c'], 'a')   // b (правее), c (ниже)

  it('левее центра соседа в том же ряду → перед ним', () => {
    expect(hitIndex(others, 20, 25, true)).toBe(0)
  })
  it('правее центра соседа в том же ряду → после него', () => {
    expect(hitIndex(others, 190, 25, true)).toBe(1)
  })
  it('внутри нижнего ряда левее центра → перед его ячейкой', () => {
    expect(hitIndex(others, 10, 99, true)).toBe(1)
  })
  it('ниже всех рядов → в конец', () => {
    expect(hitIndex(others, 10, 150, true)).toBe(2)
  })
})

describe('listLayout — раскладка вертикального списка', () => {
  const ids = ['a', 'b', 'c']

  it('элемент на своём месте — никто не двигается', () => {
    const moves = listLayout({ ids, dragId: 'a', fromIndex: 0, k: 0, cells: rows(3) })
    expect(moves).toEqual([{ id: 'b', dy: 0 }, { id: 'c', dy: 0 }])
  })

  it('перенос в конец поднимает всех остальных на его высоту', () => {
    const moves = listLayout({ ids, dragId: 'a', fromIndex: 0, k: 2, cells: rows(3) })
    expect(moves).toEqual([{ id: 'b', dy: -10 }, { id: 'c', dy: -10 }])
  })

  it('перенос из конца в начало опускает остальных', () => {
    const moves = listLayout({ ids, dragId: 'c', fromIndex: 2, k: 0, cells: rows(3) })
    expect(moves).toEqual([{ id: 'a', dy: 10 }, { id: 'b', dy: 10 }])
  })

  it('считает по РЕАЛЬНЫМ высотам, а не по усреднённому шагу', () => {
    // a: 10px, b: 40px, c: 10px
    const cells: Cell[] = [
      { left: 0, top: 0, width: 100, height: 10 },
      { left: 0, top: 10, width: 100, height: 40 },
      { left: 0, top: 50, width: 100, height: 10 },
    ]
    // тащим высокий b в начало: a должен опуститься ровно на 40, c остаться
    const moves = listLayout({ ids, dragId: 'b', fromIndex: 1, k: 0, cells })
    expect(moves).toEqual([{ id: 'a', dy: 40 }, { id: 'c', dy: 0 }])
  })

  it('учитывает зазор между строками', () => {
    const cells = rows(3, 10, 6)              // top: 0, 16, 32
    const moves = listLayout({ ids, dragId: 'a', fromIndex: 0, k: 2, cells })
    expect(moves).toEqual([{ id: 'b', dy: -16 }, { id: 'c', dy: -16 }])
  })

  it('пустой снимок не роняет', () => {
    expect(listLayout({ ids, dragId: 'a', fromIndex: 0, k: 0, cells: [] })).toEqual([])
  })
})

describe('nextInsertIndex — позиция вставки по видимым позициям', () => {
  // колонка: три карточки по 10px без зазора; тащим карточку высотой 10
  const cells = rows(3)
  const base = { cells, gap: 0, top: 0, holeH: 10 }

  it('дырка не двигается, пока курсор внутри неё', () => {
    // k=1 → видимо: A(0-10), дырка(10-20), B(20-30), C(30-40)
    expect(nextInsertIndex({ ...base, k: 1, pointerY: 12 })).toBe(1)
    expect(nextInsertIndex({ ...base, k: 1, pointerY: 19 })).toBe(1)
  })

  it('вниз переключается по центру ВИДИМОЙ карточки под дыркой, а не снятой', () => {
    // видимый центр B при k=1 — это 25, а снятый был бы 15
    expect(nextInsertIndex({ ...base, k: 1, pointerY: 24 })).toBe(1)   // ещё рано
    expect(nextInsertIndex({ ...base, k: 1, pointerY: 26 })).toBe(2)   // прошли центр
  })

  it('вверх переключается по центру карточки над дыркой', () => {
    // k=2 → видимо: A(0-10), B(10-20), дырка(20-30), C(30-40); центр B = 15
    expect(nextInsertIndex({ ...base, k: 2, pointerY: 16 })).toBe(2)
    expect(nextInsertIndex({ ...base, k: 2, pointerY: 14 })).toBe(1)
  })

  it('на границе не дребезжит: пороги вниз и вверх разнесены', () => {
    // из k=1 вниз порог 25, из k=2 вверх порог 15 — между ними состояние стабильно
    expect(nextInsertIndex({ ...base, k: 1, pointerY: 20 })).toBe(1)
    expect(nextInsertIndex({ ...base, k: 2, pointerY: 20 })).toBe(2)
  })

  it('быстрый рывок проскакивает несколько карточек за кадр', () => {
    expect(nextInsertIndex({ ...base, k: 0, pointerY: 999 })).toBe(3)
    expect(nextInsertIndex({ ...base, k: 3, pointerY: -999 })).toBe(0)
  })

  it('не вылезает за границы списка', () => {
    expect(nextInsertIndex({ ...base, k: 3, pointerY: 999 })).toBe(3)
    expect(nextInsertIndex({ ...base, k: 0, pointerY: -999 })).toBe(0)
  })

  it('пустая колонка — всегда нулевая позиция', () => {
    expect(nextInsertIndex({ cells: [], gap: 0, top: 0, holeH: 40, k: 0, pointerY: 500 })).toBe(0)
  })

  it('учитывает разную высоту карточек и зазор', () => {
    const mixed: Cell[] = [
      { left: 0, top: 0, width: 10, height: 20 },
      { left: 0, top: 26, width: 10, height: 60 },
    ]
    // k=0: дырка(0-40 c зазором), первая карточка видимо на 46-66, центр 56
    expect(nextInsertIndex({ cells: mixed, gap: 6, top: 0, holeH: 40, k: 0, pointerY: 50 })).toBe(0)
    expect(nextInsertIndex({ cells: mixed, gap: 6, top: 0, holeH: 40, k: 0, pointerY: 60 })).toBe(1)
  })
})

describe('shiftLayout — перестановка как сдвиг блока', () => {
  const A = 46          // высота перетаскиваемой + зазор

  it('позиция вставки = исходная → НИКТО не двигается', () => {
    expect(shiftLayout({ count: 5, from: 2, to: 2, amount: A })).toEqual([0, 0, 0, 0, 0])
  })

  it('едет вниз — поднимается только блок между старым и новым местом', () => {
    expect(shiftLayout({ count: 5, from: 1, to: 3, amount: A })).toEqual([0, -A, -A, 0, 0])
  })

  it('едет вверх — блок опускается', () => {
    expect(shiftLayout({ count: 5, from: 3, to: 1, amount: A })).toEqual([0, A, A, 0, 0])
  })

  it('в самое начало', () => {
    expect(shiftLayout({ count: 3, from: 2, to: 0, amount: A })).toEqual([A, A, 0])
  })

  it('в самый конец', () => {
    expect(shiftLayout({ count: 3, from: 0, to: 3, amount: A })).toEqual([-A, -A, -A])
  })

  it('гость из другой колонки раздвигает всё от точки вставки', () => {
    expect(shiftLayout({ count: 4, from: null, to: 2, amount: A })).toEqual([0, 0, A, A])
  })

  it('перетаскиваемую увели к соседям — место держится, никто не двигается', () => {
    expect(shiftLayout({ count: 4, from: 1, to: null, amount: A })).toEqual([0, 0, 0, 0])
  })

  it('пустая колонка-приёмник', () => {
    expect(shiftLayout({ count: 0, from: null, to: 0, amount: A })).toEqual([])
  })
})

describe('holeTop — куда приземлится перетаскиваемая', () => {
  const cells = rows(3, 10, 6)          // высоты 10, зазор 6 → 0, 16, 32

  it('вставка в начало — верх колонки', () => {
    expect(holeTop({ cells, gap: 6, top: 0, k: 0 })).toBe(0)
  })
  it('вставка в середину — за первой карточкой с зазором', () => {
    expect(holeTop({ cells, gap: 6, top: 0, k: 1 })).toBe(16)
  })
  it('вставка в конец — за всеми', () => {
    expect(holeTop({ cells, gap: 6, top: 0, k: 3 })).toBe(48)
  })
  it('колонка начинается не с нуля', () => {
    expect(holeTop({ cells, gap: 6, top: 100, k: 1 })).toBe(116)
  })
  it('пустая колонка — сразу верх', () => {
    expect(holeTop({ cells: [], gap: 6, top: 12, k: 0 })).toBe(12)
  })
  it('k больше длины — не выходит за конец', () => {
    expect(holeTop({ cells, gap: 6, top: 0, k: 99 })).toBe(48)
  })
})

describe('gapOf', () => {
  it('выводит зазор из первых двух ячеек', () => {
    expect(gapOf(rows(3, 10, 6))).toBe(6)
  })
  it('без зазора — ноль', () => {
    expect(gapOf(rows(3, 10, 0))).toBe(0)
  })
  it('одна ячейка — зазор неизвестен, считаем нулём', () => {
    expect(gapOf(rows(1))).toBe(0)
  })
  it('отрицательный зазор (перекрытие) не пропускается', () => {
    const cells: Cell[] = [
      { left: 0, top: 0, width: 10, height: 20 },
      { left: 0, top: 10, width: 10, height: 20 },
    ]
    expect(gapOf(cells)).toBe(0)
  })
})

describe('gridLayout — раскладка сетки', () => {
  const cells: Cell[] = [
    { left: 0, top: 0, width: 100, height: 50 },
    { left: 100, top: 0, width: 100, height: 50 },
    { left: 0, top: 50, width: 100, height: 50 },
  ]
  const ids = ['a', 'b', 'c']

  it('сдвиг на одну позицию двигает только затронутых', () => {
    const moves = gridLayout({ ids, dragId: 'a', fromIndex: 0, k: 1, cells })
    // b встаёт на место a (влево), c остаётся
    expect(moves).toEqual([
      { id: 'b', dx: -100, dy: 0 },
      { id: 'c', dx: 0, dy: 0 },
    ])
  })

  it('перенос в конец: диагональный прыжок через границу ряда', () => {
    const moves = gridLayout({ ids, dragId: 'a', fromIndex: 0, k: 2, cells })
    expect(moves).toEqual([
      { id: 'b', dx: -100, dy: 0 },     // из (100,0) в (0,0)
      { id: 'c', dx: 100, dy: -50 },    // из (0,50) в (100,0)
    ])
  })

  it('перетаскиваемый сам не двигается', () => {
    const moves = gridLayout({ ids, dragId: 'a', fromIndex: 0, k: 2, cells })
    expect(moves.some(m => m.id === 'a')).toBe(false)
  })
})

describe('autoScrollSpeed', () => {
  const base = { viewTop: 0, clientH: 500, scrollY: 100, scrollMax: 1000 }

  it('в середине контейнера не скроллит', () => {
    expect(autoScrollSpeed({ ...base, pointerY: 250 })).toBe(0)
  })

  it('у верхнего края скроллит вверх, ускоряясь к краю', () => {
    const far = autoScrollSpeed({ ...base, pointerY: EDGE - 1 })
    const near = autoScrollSpeed({ ...base, pointerY: 1 })
    expect(far).toBeLessThan(0)
    expect(near).toBeLessThan(far)               // ближе к краю — быстрее
    expect(Math.abs(near)).toBeLessThanOrEqual(MAX_SPEED * ACCEL)
  })

  it('у нижнего края скроллит вниз', () => {
    expect(autoScrollSpeed({ ...base, pointerY: 500 - 1 })).toBeGreaterThan(0)
  })

  it('за пределами контейнера ускоряется, но не выше потолка', () => {
    const speed = autoScrollSpeed({ ...base, pointerY: -1000 })
    expect(speed).toBe(-MAX_SPEED * ACCEL)
  })

  it('в самом верху списка вверх не скроллит', () => {
    expect(autoScrollSpeed({ ...base, scrollY: 0, pointerY: 1 })).toBe(0)
  })

  it('в самом низу списка вниз не скроллит', () => {
    expect(autoScrollSpeed({ ...base, scrollY: 1000, pointerY: 499 })).toBe(0)
  })
})

describe('clampDragged', () => {
  const cell: Cell = { left: 0, top: 0, width: 100, height: 10 }
  const view = { scrollX: 0, scrollY: 0, clientW: 200, clientH: 100 }

  it('внутри области ничего не меняет', () => {
    expect(clampDragged({ cell, tx: 0, ty: 40, ...view, grid: false })).toEqual({ tx: 0, ty: 40 })
  })

  it('не пускает ниже нижней кромки', () => {
    expect(clampDragged({ cell, tx: 0, ty: 999, ...view, grid: false }).ty).toBe(90)
  })

  it('не пускает выше верхней кромки', () => {
    expect(clampDragged({ cell, tx: 0, ty: -999, ...view, grid: false }).ty).toBe(0)
  })

  it('в списке горизонталь не трогает', () => {
    expect(clampDragged({ cell, tx: 500, ty: 0, ...view, grid: false }).tx).toBe(500)
  })

  it('в сетке зажимает и по горизонтали', () => {
    expect(clampDragged({ cell, tx: 500, ty: 0, ...view, grid: true }).tx).toBe(100)
  })

  it('кромки считаются от текущего скролла', () => {
    const scrolled = { ...view, scrollY: 300 }
    expect(clampDragged({ cell, tx: 0, ty: 0, ...scrolled, grid: false }).ty).toBe(300)
  })
})

describe('viewOrigin — сдвиг контейнера от прокрутки страницы', () => {
  const geom = { top: 100, left: 20, clientH: 0, clientW: 0, max: 0, winX: 0, winY: 0 }

  it('страница не двигалась — позиция как на старте', () => {
    expect(viewOrigin(geom, 0, 0)).toEqual({ top: 100, left: 20 })
  })

  it('страница уехала вниз — контейнер поднялся ровно на столько же', () => {
    expect(viewOrigin(geom, 0, 30)).toEqual({ top: 70, left: 20 })
  })

  it('горизонтальная прокрутка страницы тоже учитывается', () => {
    expect(viewOrigin(geom, 5, 0)).toEqual({ top: 100, left: 15 })
  })

  it('старт при уже прокрученной странице — точка отсчёта от снимка', () => {
    const g = { ...geom, winY: 500 }
    expect(viewOrigin(g, 0, 520)).toEqual({ top: 80, left: 20 })
  })
})
