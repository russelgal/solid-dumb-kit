import { describe, it, expect } from 'vitest'
import {
  addDays, addMonths, checkRange, daysBetween, diffDays, endOfMonth, monthGrid, orderRange,
  overlaps, reachTo, startOfMonth, today, weekIndex,
} from '../src/dateMath'

describe('АУДИТ дат: границы', () => {
  it('високосный февраль и переход года', () => {
    expect(endOfMonth('2024-02-01')).toBe('2024-02-29')
    expect(endOfMonth('2100-02-01')).toBe('2100-02-28')   // не високосный, хоть и кратен 4
    expect(addDays('2024-02-28', 2)).toBe('2024-03-01')
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01')
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-01')
  })

  it('переходы на летнее время не крадут сутки', () => {
    // в разных поясах эти даты — дни перевода часов
    for (const d of ['2026-03-08', '2026-03-29', '2026-10-25', '2026-11-01']) {
      expect(diffDays(d, addDays(d, 1))).toBe(1)
      expect(addDays(addDays(d, 1), -1)).toBe(d)
    }
  })

  it('сетка месяца всегда 42 дня и начинается с понедельника', () => {
    for (const m of ['2026-01-01', '2026-02-01', '2026-08-01', '2027-11-01']) {
      const g = monthGrid(m)
      expect(g).toHaveLength(42)
      expect(weekIndex(g[0])).toBe(0)
      // первый день месяца обязан быть внутри сетки
      expect(g).toContain(startOfMonth(m))
      // дни идут подряд, без дыр
      for (let i = 1; i < g.length; i++) expect(diffDays(g[i - 1], g[i])).toBe(1)
    }
  })

  it('диапазон симметричен и включителен', () => {
    expect(orderRange('2026-06-10', '2026-06-05')).toEqual(orderRange('2026-06-05', '2026-06-10'))
    expect(daysBetween('2026-06-01', '2026-06-01')).toEqual(['2026-06-01'])
  })
})

describe('АУДИТ дат: занятость', () => {
  const busy = [{ from: '2026-06-10', to: '2026-06-15' }]

  it('пересечение симметрично', () => {
    const a = { from: '2026-06-12', to: '2026-06-20' }
    expect(overlaps(a, busy[0])).toBe(overlaps(busy[0], a))
  })

  it('вложенный отрезок — пересечение с обеих сторон', () => {
    const inner = { from: '2026-06-11', to: '2026-06-12' }
    expect(overlaps(inner, busy[0])).toBe(true)
    expect(overlaps(busy[0], inner)).toBe(true)
  })

  it('нулевой отрезок ведёт себя как точка', () => {
    // Внутри занятого — пересечение: 12-е и правда занято. Это не вырожденный
    // случай ради галочки, а ответ на вопрос «свободен ли этот день».
    expect(overlaps({ from: '2026-06-12', to: '2026-06-12' }, busy[0])).toBe(true)
    // снаружи — нет
    expect(overlaps({ from: '2026-06-20', to: '2026-06-20' }, busy[0])).toBe(false)
    // ровно на границе выезда — тоже нет: границы смыкаются
    expect(overlaps({ from: '2026-06-15', to: '2026-06-15' }, busy[0])).toBe(false)
    expect(overlaps({ from: '2026-06-10', to: '2026-06-10' }, busy[0])).toBe(false)
  })

  it('reachTo не уводит раньше самой даты', () => {
    const from = '2026-06-12'   // внутри занятого
    expect(diffDays(from, reachTo(from, busy, '2026-12-31'))).toBeGreaterThanOrEqual(0)
  })

  it('checkRange согласован с overlaps', () => {
    for (const [f, t] of [['2026-06-05', '2026-06-10'], ['2026-06-12', '2026-06-13'],
                          ['2026-06-15', '2026-06-18'], ['2026-06-01', '2026-06-30']]) {
      const byCheck = checkRange({ from: f, to: t, busy }).ok
      const byOverlap = !overlaps({ from: f, to: t }, busy[0])
      expect(byCheck).toBe(byOverlap)
    }
  })

  it('сегодня — валидная дата в формате шкалы', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
