import { describe, it, expect } from 'vitest'
import { buildOffsets, indexAt, windowOf } from '../virtualMath'

const keys = (n: number) => Array.from({ length: n }, (_, i) => `k${i}`)
const fixed = (h: number) => ({ get: () => undefined, estimate: h })

describe('buildOffsets', () => {
  it('оценка, пока ничего не измерено', () => {
    expect(buildOffsets(keys(3), fixed(10))).toEqual([0, 10, 20, 30])
  })

  it('измеренные высоты идут в дело, остальные — по оценке', () => {
    const measured = new Map([['k1', 50]])
    const offsets = buildOffsets(keys(3), { get: (k) => measured.get(k), estimate: 10 })
    expect(offsets).toEqual([0, 10, 60, 70])
  })

  it('пустой список — только ноль', () => {
    expect(buildOffsets([], fixed(10))).toEqual([0])
  })
})

describe('indexAt', () => {
  const offsets = [0, 10, 20, 30, 40]      // 4 строки по 10

  it('находит строку по точке', () => {
    expect(indexAt(offsets, 0)).toBe(0)
    expect(indexAt(offsets, 15)).toBe(1)
    expect(indexAt(offsets, 39)).toBe(3)
  })

  it('за границами не выходит за список', () => {
    expect(indexAt(offsets, -100)).toBe(0)
    expect(indexAt(offsets, 9999)).toBe(3)
  })

  it('граница строки принадлежит следующей', () => {
    expect(indexAt(offsets, 10)).toBe(1)
  })
})

describe('windowOf', () => {
  const offsets = buildOffsets(keys(100), fixed(10))   // 1000px контента

  it('в начале списка окно от нуля, верхней распорки нет', () => {
    const w = windowOf({ offsets, scrollTop: 0, viewportH: 100, overscan: 0 })
    expect(w.first).toBe(0)
    expect(w.padTop).toBe(0)
    expect(w.total).toBe(1000)
  })

  it('распорки в сумме с окном дают полную высоту — иначе скроллбар врёт', () => {
    const w = windowOf({ offsets, scrollTop: 300, viewportH: 100, overscan: 2 })
    const windowH = offsets[w.last] - offsets[w.first]
    expect(w.padTop + windowH + w.padBottom).toBe(w.total)
  })

  it('overscan расширяет окно в обе стороны', () => {
    const tight = windowOf({ offsets, scrollTop: 300, viewportH: 100, overscan: 0 })
    const loose = windowOf({ offsets, scrollTop: 300, viewportH: 100, overscan: 5 })
    expect(loose.first).toBeLessThan(tight.first)
    expect(loose.last).toBeGreaterThan(tight.last)
  })

  it('у конца списка окно не убегает за последнюю строку', () => {
    const w = windowOf({ offsets, scrollTop: 950, viewportH: 100, overscan: 4 })
    expect(w.last).toBe(100)
    expect(w.padBottom).toBe(0)
  })

  it('строки разной высоты: окно считается по реальным позициям', () => {
    const measured = new Map([['k0', 200], ['k1', 200]])
    const mixed = buildOffsets(keys(10), { get: (k) => measured.get(k), estimate: 10 })
    expect(mixed.slice(0, 4)).toEqual([0, 200, 400, 410])

    // точка 250 — внутри второй строки (200…400), а не третьей
    const inside = windowOf({ offsets: mixed, scrollTop: 250, viewportH: 50, overscan: 0 })
    expect(inside.first).toBe(1)
    expect(inside.padTop).toBe(200)

    // а 420 — уже за двумя высокими, среди мелких
    const past = windowOf({ offsets: mixed, scrollTop: 420, viewportH: 50, overscan: 0 })
    expect(past.first).toBe(4)
    expect(past.padTop).toBe(420)
  })

  it('пустой набор — пустое окно', () => {
    const w = windowOf({ offsets: [0], scrollTop: 0, viewportH: 100 })
    expect(w).toEqual({ first: 0, last: 0, padTop: 0, padBottom: 0, total: 0 })
  })
})
