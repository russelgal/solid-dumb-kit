import { describe, it, expect } from 'vitest'
import { daysApart, shiftDay } from '../src/timelineMath'

describe('календарные сутки', () => {
  it('считает сутки между датами через месяц и год', () => {
    expect(daysApart('2026-06-01', '2026-06-04')).toBe(3)
    expect(daysApart('2026-06-30', '2026-07-01')).toBe(1)
    expect(daysApart('2026-12-31', '2027-01-01')).toBe(1)
    expect(daysApart('2026-06-04', '2026-06-01')).toBe(-3)
  })

  it('время в моменте не влияет: считаем ночи, а не часы', () => {
    expect(daysApart('2026-06-01T22:00', '2026-06-02T01:00')).toBe(1)
  })

  it('переход через сутки не зависит от часового пояса', () => {
    expect(shiftDay('2026-03-29', 1)).toBe('2026-03-30')   // переход на летнее время
    expect(shiftDay('2026-10-25', 1)).toBe('2026-10-26')   // и обратно
    expect(shiftDay('2026-02-28', 1)).toBe('2026-03-01')
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31')
  })
})
