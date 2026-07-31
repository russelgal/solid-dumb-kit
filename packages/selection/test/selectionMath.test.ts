import { describe, it, expect } from 'vitest'
import {
  areaFrom, clampPoint, hits, pickHits, resolveSelection, tapSelection, diffSelection, type Box,
} from '../src/selectionMath'

const box = (left: number, top: number, width = 10, height = 10): Box => ({ left, top, width, height })

describe('areaFrom — прямоугольник по двум точкам', () => {
  it('тянем вправо-вниз', () => {
    expect(areaFrom(0, 0, 10, 20)).toEqual({ left: 0, top: 0, width: 10, height: 20 })
  })
  it('тянем влево-вверх — та же рамка', () => {
    expect(areaFrom(10, 20, 0, 0)).toEqual({ left: 0, top: 0, width: 10, height: 20 })
  })
  it('вырожденная рамка (клик без движения)', () => {
    expect(areaFrom(5, 5, 5, 5)).toEqual({ left: 5, top: 5, width: 0, height: 0 })
  })
})

describe('clampPoint — рамка не выезжает за контейнер', () => {
  const b = { minX: 0, minY: 0, maxX: 100, maxY: 200 }

  it('внутри границ точка не меняется', () => {
    expect(clampPoint(50, 60, b)).toEqual({ x: 50, y: 60 })
  })
  it('увели курсор вправо-вниз за край', () => {
    expect(clampPoint(999, 999, b)).toEqual({ x: 100, y: 200 })
  })
  it('увели влево-вверх за край', () => {
    expect(clampPoint(-50, -10, b)).toEqual({ x: 0, y: 0 })
  })
  it('контейнер со смещением (не сам скроллер)', () => {
    const off = { minX: 20, minY: 30, maxX: 120, maxY: 130 }
    expect(clampPoint(0, 0, off)).toEqual({ x: 20, y: 30 })
    expect(clampPoint(500, 500, off)).toEqual({ x: 120, y: 130 })
  })
})

describe('hits — режимы попадания', () => {
  const cell = box(10, 10, 20, 20)   // 10..30 по обеим осям

  it('touch: достаточно коснуться', () => {
    expect(hits(box(0, 0, 11, 11), cell, 'touch')).toBe(true)     // задели угол
    expect(hits(box(0, 0, 10, 10), cell, 'touch')).toBe(false)    // впритык, но не задели
  })

  it('cover: только полное накрытие', () => {
    expect(hits(box(5, 5, 30, 30), cell, 'cover')).toBe(true)
    expect(hits(box(15, 15, 30, 30), cell, 'cover')).toBe(false)  // накрыли половину
  })

  it('center: важен только центр элемента', () => {
    expect(hits(box(19, 19, 2, 2), cell, 'center')).toBe(true)    // центр 20,20
    expect(hits(box(0, 0, 15, 15), cell, 'center')).toBe(false)   // задели, но не центр
  })
})

describe('pickHits — индексы задетых', () => {
  const cells = [box(0, 0), box(0, 20), box(0, 40)]

  it('возвращает попавшие по порядку', () => {
    expect(pickHits(box(0, 0, 5, 45), cells, 'touch')).toEqual([0, 1, 2])
  })
  it('пустая рамка никого не задевает', () => {
    expect(pickHits(box(0, 0, 0, 0), cells, 'touch')).toEqual([])
  })
  it('промах между элементами', () => {
    expect(pickHits(box(0, 12, 5, 5), cells, 'touch')).toEqual([])
  })
})

describe('resolveSelection — рамка + модификатор', () => {
  const base = new Set(['a', 'b'])

  it('без модификатора выделение заменяется', () => {
    expect([...resolveSelection({ base, touched: ['c'], additive: false })]).toEqual(['c'])
  })

  it('с модификатором добавляется к прежнему', () => {
    const next = resolveSelection({ base, touched: ['c'], additive: true })
    expect([...next].sort()).toEqual(['a', 'b', 'c'])
  })

  it('с модификатором рамка только добавляет — по уже выделенному не гасит', () => {
    const next = resolveSelection({ base, touched: ['a'], additive: true })
    expect([...next].sort()).toEqual(['a', 'b'])
  })

  it('с модификатором добавляет задетое, сохраняя всё прежнее', () => {
    const next = resolveSelection({ base, touched: ['a', 'c'], additive: true })
    expect([...next].sort()).toEqual(['a', 'b', 'c'])
  })

  it('пустая рамка с модификатором ничего не меняет', () => {
    const next = resolveSelection({ base, touched: [], additive: true })
    expect([...next].sort()).toEqual(['a', 'b'])
  })

  it('исходное множество не мутируется', () => {
    resolveSelection({ base, touched: ['a', 'z'], additive: true })
    expect([...base].sort()).toEqual(['a', 'b'])
  })
})

describe('tapSelection — одиночный клик', () => {
  const current = new Set(['a', 'b'])

  it('клик по элементу выделяет только его', () => {
    expect([...tapSelection({ current, key: 'c', additive: false })]).toEqual(['c'])
  })

  it('Cmd/Shift+клик добавляет к выделению', () => {
    expect([...tapSelection({ current, key: 'c', additive: true })].sort()).toEqual(['a', 'b', 'c'])
  })

  it('Cmd/Shift+клик по уже выделенному — снимает', () => {
    expect([...tapSelection({ current, key: 'a', additive: true })]).toEqual(['b'])
  })

  it('клик мимо элементов сбрасывает выделение', () => {
    expect([...tapSelection({ current, key: null, additive: false })]).toEqual([])
  })

  it('Cmd+клик мимо элементов ничего не ломает', () => {
    expect([...tapSelection({ current, key: null, additive: true })].sort()).toEqual(['a', 'b'])
  })

  it('исходное множество не мутируется', () => {
    tapSelection({ current, key: 'a', additive: true })
    expect([...current].sort()).toEqual(['a', 'b'])
  })
})

describe('diffSelection', () => {
  it('находит добавленные и снятые', () => {
    const d = diffSelection(new Set(['a', 'b']), new Set(['b', 'c']))
    expect(d).toEqual({ added: ['c'], removed: ['a'] })
  })
  it('одинаковые множества — пустой diff', () => {
    const d = diffSelection(new Set(['a']), new Set(['a']))
    expect(d).toEqual({ added: [], removed: [] })
  })
})
