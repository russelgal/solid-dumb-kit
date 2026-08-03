import { describe, it, expect } from 'vitest'
import {
  SCALES, clampEdge, columns, conflicts, dayBounds, floorsPerRow, fromX, headGroups, lengthOf,
  minLength, momentX, moveTo, snapEdge, stackFloors, toMinutes, toMoment, totalCols, type Scale,
} from '../src/scale'


const hotel = SCALES.hotel('2026-06-01', 30, 30)
const sauna = SCALES.sauna('2026-06-01', 3, 34)
const gaz = SCALES.gazebo('2026-06-01', 3, 34)
/** дневной объект с ОБРАТНЫМИ часами: заезд утром, выезд вечером (коворкинг, зал) */
const day: Scale = { first: '2026-06-01', days: 7, colW: 30, dayStart: 0, dayEnd: 1440,
                     stepMin: 1440, checkIn: 8 * 60, checkOut: 20 * 60 }

describe('АУДИТ: обратные часы (заезд 8:00, выезд 20:00)', () => {
  it('минимальная бронь — половина суток, а не сутки', () => {
    expect(minLength(day)).toBe(720)
  })
  it('полоса на день рисуется от 8 до 20', () => {
    const x = momentX('2026-06-02', day, 'from')
    const r = momentX('2026-06-02', day, 'to')
    expect(r - x).toBeCloseTo(30 / 2)   // 12 часов из 24 при колонке 30
  })
})

describe('АУДИТ: моменты РАНЬШЕ начала сетки', () => {
  it('позиция отрицательная, но считается', () => {
    expect(toMinutes('2026-05-30', hotel, 'from')).toBe(-2 * 1440 + 960)
    expect(momentX('2026-05-30', hotel, 'from')).toBeLessThan(0)
  })
  it('toMoment переживает отрицательные минуты', () => {
    expect(toMoment(-1440, hotel)).toBe('2026-05-31T00:00')
    expect(toMoment(-600, gaz)).toMatch(/^2026-05-31T/)
  })
})

describe('АУДИТ: туда-обратно', () => {
  it('момент → минуты → момент', () => {
    for (const s of [hotel, sauna, gaz, day]) {
      for (const m of ['2026-06-02T13:00', '2026-06-03T10:00', '2026-06-04T22:00']) {
        const min = toMinutes(m, s)
        const back = toMoment(min, s)
        // после прижатия к окну момент может измениться — но повторный проход стабилен
        expect(toMoment(toMinutes(back, s), s)).toBe(back)
      }
    }
  })
  it('пиксели → минуты → пиксели', () => {
    for (const s of [hotel, sauna, gaz]) {
      for (const px of [0, 17, 100, 333]) {
        const min = fromX(px, s)
        expect(fromX(momentX(toMoment(min, s), s, 'from'), s)).toBe(min)
      }
    }
  })
})

describe('АУДИТ: этажи при обратных часах', () => {
  it('выезд в 20:00 конфликтует с заездом в 8:00 того же дня', () => {
    const spans = [
      { id: 'a', row: 'z', from: '2026-06-01', to: '2026-06-03' },   // до 20:00 третьего
      { id: 'b', row: 'z', from: '2026-06-03', to: '2026-06-05' },   // с 8:00 третьего
    ]
    // они пересекаются на 12 часов — должны разъехаться по этажам
    expect([...stackFloors(spans, day).values()]).toEqual([0, 1])
  })
})

describe('АУДИТ: колонки и группы', () => {
  it('число колонок кратно дням', () => {
    expect(totalCols({ ...sauna, days: 3 })).toBe(14 * 3)
    expect(totalCols({ ...gaz, days: 3 })).toBe(11 * 3)
    expect(totalCols({ ...hotel, days: 30 })).toBe(30)
  })
  it('группы покрывают все колонки без дыр', () => {
    for (const s of [hotel, sauna, gaz]) {
      const sum = headGroups(s).reduce((a, g) => a + g.span, 0)
      expect(sum).toBe(totalCols(s))
    }
  })
  it('подписи колонок идут строго по возрастанию', () => {
    for (const s of [sauna, gaz]) {
      const cols = columns(s)
      for (let i = 1; i < cols.length; i++) expect(cols[i] > cols[i - 1]).toBe(true)
    }
  })
})

describe('АУДИТ: границы суток', () => {
  it('dayBounds не съезжает на стыке', () => {
    const win = gaz.dayEnd - gaz.dayStart
    expect(dayBounds(0, gaz)).toEqual({ start: 0, end: win })
    expect(dayBounds(win - 1, gaz)).toEqual({ start: 0, end: win })
    expect(dayBounds(win, gaz)).toEqual({ start: win, end: 2 * win })
  })
  it('конец дня и начало следующего — одна точка, но разные моменты', () => {
    const win = gaz.dayEnd - gaz.dayStart
    expect(toMoment(win, gaz, true)).toBe('2026-06-01T23:00')
    expect(toMoment(win, gaz, false)).toBe('2026-06-02T12:00')
  })
})

describe('АУДИТ: пересечения', () => {
  it('касание границами не считается пересечением', () => {
    const a = { from: '2026-06-01T10:00', to: '2026-06-01T12:00' }
    const b = { from: '2026-06-01T12:00', to: '2026-06-01T14:00' }
    expect(conflicts(a, b, sauna)).toBe(false)
    expect(conflicts(b, a, sauna)).toBe(false)     // симметрично
  })
  it('вложенный интервал — пересечение', () => {
    const a = { from: '2026-06-01T10:00', to: '2026-06-01T20:00' }
    const b = { from: '2026-06-01T12:00', to: '2026-06-01T14:00' }
    expect(conflicts(a, b, sauna)).toBe(true)
    expect(conflicts(b, a, sauna)).toBe(true)
  })
  it('зазор симметричен', () => {
    const a = { from: '2026-06-01T10:00', to: '2026-06-01T12:00' }
    const b = { from: '2026-06-01T12:20', to: '2026-06-01T14:00' }
    expect(conflicts(a, b, sauna, 30)).toBe(conflicts(b, a, sauna, 30))
  })
})

describe('АУДИТ: перенос сохраняет длительность', () => {
  it('в любой шкале', () => {
    for (const s of [hotel, sauna, gaz]) {
      const span = { from: '2026-06-01T12:00', to: '2026-06-01T14:00' }
      const len = lengthOf(span, s)
      const moved = moveTo(span, toMinutes('2026-06-02T12:00', s), s)
      expect(lengthOf(moved, s)).toBe(len)
    }
  })
})

describe('АУДИТ: снап края идемпотентен', () => {
  it('повторный снап того же места ничего не меняет', () => {
    for (const s of [hotel, sauna, gaz]) {
      for (const px of [40, 90, 150, 300]) {
        const first = snapEdge(px, s, 'to')
        const again = snapEdge(momentX(first, s, 'to'), s, 'to')
        expect(again).toBe(first)
      }
    }
  })
})

describe('АУДИТ: clampEdge не выдаёт мусор', () => {
  it('никогда не возвращает край короче минимума', () => {
    const me = { id: 'a', row: 'r', from: '2026-06-05', to: '2026-06-09' }
    for (const want of [-9999, 0, 100, 99999]) {
      const to = clampEdge(me, 'to', want, [], hotel)
      if (to !== null) expect(to - toMinutes(me.from, hotel, 'from')).toBeGreaterThanOrEqual(minLength(hotel))
      const from = clampEdge(me, 'from', want, [], hotel)
      if (from !== null) expect(toMinutes(me.to, hotel, 'to') - from).toBeGreaterThanOrEqual(minLength(hotel))
    }
  })
})

describe('АУДИТ: этажи — общие свойства', () => {
  it('зазор учитывается и в раскладке: после уборки этаж ещё занят', () => {
    const spans = [
      { id: 'a', row: 'b1', from: '2026-06-01T12:00', to: '2026-06-01T14:00' },
      { id: 'b', row: 'b1', from: '2026-06-01T14:00', to: '2026-06-01T16:00' },
    ]
    expect([...stackFloors(spans, sauna, 0).values()]).toEqual([0, 0])
    expect([...stackFloors(spans, sauna, 30).values()]).toEqual([0, 1])
  })

  it('порядок в массиве не влияет на результат', () => {
    const a = { id: 'a', row: 'r', from: '2026-06-01T10:00', to: '2026-06-01T14:00' }
    const b = { id: 'b', row: 'r', from: '2026-06-01T12:00', to: '2026-06-01T16:00' }
    const one = stackFloors([a, b], sauna)
    const two = stackFloors([b, a], sauna)
    expect(one.get('a')).toBe(two.get('a'))
    expect(one.get('b')).toBe(two.get('b'))
  })

  it('этажей в строке ровно столько, сколько максимум наложений', () => {
    const spans = [
      { id: 'a', row: 'r', from: '2026-06-01T10:00', to: '2026-06-01T20:00' },
      { id: 'b', row: 'r', from: '2026-06-01T11:00', to: '2026-06-01T13:00' },
      { id: 'c', row: 'r', from: '2026-06-01T12:00', to: '2026-06-01T14:00' },
    ]
    expect(floorsPerRow(spans, stackFloors(spans, sauna)).get('r')).toBe(3)
  })
})
