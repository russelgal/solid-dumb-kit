import { describe, it, expect } from 'vitest'
import {
  addDays, addMonths, checkRange, daysBetween, diffDays, endOfMonth, inRange, monthGrid,
  orderRange, overlaps, reachTo, startOfMonth, weekIndex,
} from '../src/dateMath'

describe('арифметика дат', () => {
  it('не съезжает на границах месяца и года', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')   // 2026 не високосный
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28')
    expect(endOfMonth('2024-02-10')).toBe('2024-02-29')   // а 2024 — да
  })

  it('переход на летнее время не сдвигает сутки', () => {
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2)
  })

  it('месяц листается без потери числа', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-01')  // считаем от первого числа
    expect(startOfMonth('2026-07-15')).toBe('2026-07-01')
  })

  it('неделя начинается с понедельника', () => {
    expect(weekIndex('2026-06-01')).toBe(0)   // понедельник
    expect(weekIndex('2026-06-07')).toBe(6)   // воскресенье
  })

  it('сетка месяца всегда 42 дня — календарь не прыгает', () => {
    for (const m of ['2026-02-01', '2026-08-01', '2027-01-01']) {
      expect(monthGrid(m)).toHaveLength(42)
    }
    expect(monthGrid('2026-06-01')[0]).toBe('2026-06-01')  // июнь начинается с пн
  })
})

describe('диапазон', () => {
  it('тянется в любую сторону', () => {
    expect(orderRange('2026-06-10', '2026-06-05')).toEqual(['2026-06-05', '2026-06-10'])
  })

  it('входит ли день', () => {
    expect(inRange('2026-06-07', '2026-06-05', '2026-06-10')).toBe(true)
    expect(inRange('2026-06-11', '2026-06-05', '2026-06-10')).toBe(false)
    expect(inRange('2026-06-07', null, null)).toBe(false)
  })

  it('перечисляет дни включительно', () => {
    expect(daysBetween('2026-06-01', '2026-06-03')).toEqual(['2026-06-01', '2026-06-02', '2026-06-03'])
    expect(daysBetween('2026-06-03', '2026-06-01')).toEqual([])
  })
})

describe('занятость', () => {
  const busy = [{ from: '2026-06-10', to: '2026-06-15' }]

  it('выезд и заезд в один день не считаются пересечением', () => {
    expect(overlaps({ from: '2026-06-05', to: '2026-06-10' }, busy[0])).toBe(false)
    expect(overlaps({ from: '2026-06-15', to: '2026-06-20' }, busy[0])).toBe(false)
    expect(overlaps({ from: '2026-06-12', to: '2026-06-14' }, busy[0])).toBe(true)
  })

  it('проверка отрезка объясняет отказ', () => {
    expect(checkRange({ from: '2026-06-12', to: '2026-06-14', busy })).toEqual({ ok: false, why: 'занято' })
    expect(checkRange({ from: '2026-06-01', to: '2026-06-02', minNights: 3 }))
      .toEqual({ ok: false, why: 'минимум 3 ноч.' })
    expect(checkRange({ from: '2026-06-01', to: '2026-06-20', maxNights: 7 }))
      .toEqual({ ok: false, why: 'максимум 7 ноч.' })
    expect(checkRange({ from: '2026-06-05', to: '2026-06-01' }))
      .toEqual({ ok: false, why: 'конец раньше начала' })
    expect(checkRange({ from: '2026-06-01', to: '2026-06-05', busy })).toEqual({ ok: true })
  })

  it('докуда можно тянуть — до ближайшего занятого', () => {
    expect(reachTo('2026-06-05', busy, '2026-12-31')).toBe('2026-06-10')
    // занятое ПОЗАДИ не ограничивает
    expect(reachTo('2026-06-20', busy, '2026-12-31')).toBe('2026-12-31')
  })
})
