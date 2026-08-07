// Арифметика времени и моментов. Ни DOM, ни Solid — обычные функции.
//
// Главное, что здесь проверяется: сравнение точек из РАЗНЫХ суток и то, что
// касание концами не считается пересечением. На втором держится вся логика
// «выезд в 12:00, заезд в 12:00 — один и тот же день свободен».

import { describe, it, expect } from 'vitest'
import {
  absMin, checkMomentRange, fmtLength, fmtMoment, fromAbsMin, minutesBetween,
  overlapsMoment, reachToMoment, slotBusy, slotsOfDay, snapTime, toMin, toTime,
} from '../src/timeMath'

describe('время как строка', () => {
  it('переводит туда и обратно', () => {
    expect(toMin('00:00')).toBe(0)
    expect(toMin('09:30')).toBe(570)
    expect(toMin('23:59')).toBe(1439)
    expect(toTime(570)).toBe('09:30')
    expect(toTime(0)).toBe('00:00')
  })

  it('мусор превращает в ноль, а не в NaN', () => {
    expect(toMin('')).toBe(0)
    expect(toMin('abc')).toBe(0)
  })

  it('за сутки не переносит: конец суток остаётся видимым', () => {
    expect(toTime(1440)).toBe('24:00')
    expect(toTime(1500)).toBe('25:00')
  })

  it('округляет вниз до шага сетки', () => {
    expect(snapTime('14:07', 30)).toBe('14:00')
    expect(snapTime('14:47', 30)).toBe('14:30')
    expect(snapTime('14:47', 15)).toBe('14:45')
  })
})

describe('моменты', () => {
  it('сравнивает точки из разных суток', () => {
    const base = '2026-08-12'
    expect(absMin({ day: '2026-08-12', time: '14:00' }, base)).toBe(840)
    expect(absMin({ day: '2026-08-13', time: '00:00' }, base)).toBe(1440)
    expect(absMin({ day: '2026-08-15', time: '12:00' }, base)).toBe(3 * 1440 + 720)
  })

  it('момент из минут собирается обратно, переваливая через полночь', () => {
    expect(fromAbsMin(1500, '2026-08-12')).toEqual({ day: '2026-08-13', time: '01:00' })
    expect(fromAbsMin(0, '2026-08-12')).toEqual({ day: '2026-08-12', time: '00:00' })
  })

  it('момент переживает переход через месяц', () => {
    expect(fromAbsMin(1440, '2026-08-31')).toEqual({ day: '2026-09-01', time: '00:00' })
  })

  it('считает длительность между сутками', () => {
    const from = { day: '2026-08-12', time: '14:00' }
    const to = { day: '2026-08-15', time: '12:00' }
    expect(minutesBetween(from, to)).toBe(3 * 1440 - 120)
  })
})

describe('слоты', () => {
  it('нарезает сутки шагом, не включая конец окна', () => {
    const s = slotsOfDay({ step: 60, openMin: 9 * 60, closeMin: 12 * 60 })
    expect(s).toEqual(['09:00', '10:00', '11:00'])
  })

  it('без окна берёт полные сутки', () => {
    expect(slotsOfDay({ step: 60 })).toHaveLength(24)
    expect(slotsOfDay({ step: 30 })).toHaveLength(48)
  })

  it('начало окна поднимает до ближайшего шага', () => {
    const s = slotsOfDay({ step: 30, openMin: 9 * 60 + 10, closeMin: 11 * 60 })
    expect(s[0]).toBe('09:30')
  })

  it('неположительный шаг молча становится получасом', () => {
    expect(slotsOfDay({ step: 0 })).toHaveLength(48)
  })
})

describe('занятость', () => {
  const busy = [
    {
      from: { day: '2026-08-12', time: '11:30' },
      to: { day: '2026-08-12', time: '12:30' },
      title: 'Иванов',
    },
  ]

  it('слот, накрытый бронью, занят', () => {
    expect(slotBusy('2026-08-12', '11:30', 30, busy)).not.toBeNull()
    expect(slotBusy('2026-08-12', '12:00', 30, busy)).not.toBeNull()
  })

  it('слот, который только КАСАЕТСЯ брони концом, свободен', () => {
    // бронь 11:30–12:30: слот 11:00–11:30 упирается в её начало и остаётся свободным,
    // слот 12:30–13:00 начинается ровно там, где она кончилась
    expect(slotBusy('2026-08-12', '11:00', 30, busy)).toBeNull()
    expect(slotBusy('2026-08-12', '12:30', 30, busy)).toBeNull()
  })

  it('пересечение отрезков: касание концами — не пересечение', () => {
    const a = { from: { day: '2026-08-12', time: '10:00' }, to: { day: '2026-08-12', time: '11:30' } }
    expect(overlapsMoment(a, busy[0])).toBe(false)

    const b = { from: { day: '2026-08-12', time: '10:00' }, to: { day: '2026-08-12', time: '11:31' } }
    expect(overlapsMoment(b, busy[0])).toBe(true)
  })

  it('докуда можно дотянуть — до начала ближайшей брони', () => {
    const reach = reachToMoment(
      { day: '2026-08-12', time: '09:00' },
      busy,
      { day: '2026-08-14', time: '00:00' },
    )
    expect(reach).toEqual({ day: '2026-08-12', time: '11:30' })
  })

  it('без броней тянется до предела', () => {
    const limit = { day: '2026-08-14', time: '00:00' }
    expect(reachToMoment({ day: '2026-08-12', time: '09:00' }, [], limit)).toEqual(limit)
  })
})

describe('проверка отрезка', () => {
  const from = { day: '2026-08-12', time: '14:00' }
  const to = { day: '2026-08-15', time: '12:00' }

  it('нормальный период проходит', () => {
    expect(checkMomentRange({ from, to })).toEqual({ ok: true })
  })

  it('конец раньше начала — отказ', () => {
    const r = checkMomentRange({ from: to, to: from })
    expect(r).toEqual({ ok: false, why: 'конец раньше начала' })
  })

  it('нулевая длительность — тоже отказ', () => {
    expect(checkMomentRange({ from, to: from }).ok).toBe(false)
  })

  it('минимум и максимум длительности объясняются словами', () => {
    const short = checkMomentRange({
      from,
      to: { day: '2026-08-12', time: '14:30' },
      minMinutes: 60,
    })
    expect(short).toEqual({ ok: false, why: 'минимум 1 ч' })

    const long = checkMomentRange({ from, to, maxMinutes: 1440 })
    expect(long).toEqual({ ok: false, why: 'максимум 1 сут' })
  })

  it('занятое называет по имени', () => {
    const r = checkMomentRange({
      from,
      to,
      busy: [
        {
          from: { day: '2026-08-13', time: '00:00' },
          to: { day: '2026-08-14', time: '00:00' },
          title: 'Петров',
        },
      ],
    })
    expect(r).toEqual({ ok: false, why: 'занято: Петров' })
  })

  it('границы min и max', () => {
    expect(checkMomentRange({ from, to, min: { day: '2026-08-13', time: '00:00' } })).toEqual({
      ok: false,
      why: 'слишком рано',
    })
    expect(checkMomentRange({ from, to, max: { day: '2026-08-14', time: '00:00' } })).toEqual({
      ok: false,
      why: 'слишком поздно',
    })
  })
})

describe('подписи', () => {
  it('длительность словами', () => {
    expect(fmtLength(30)).toBe('30 мин')
    expect(fmtLength(60)).toBe('1 ч')
    expect(fmtLength(90)).toBe('1 ч 30 мин')
    expect(fmtLength(1440)).toBe('1 сут')
    expect(fmtLength(2880)).toBe('2 сут')
  })

  it('момент словами', () => {
    expect(fmtMoment({ day: '2026-08-12', time: '14:00' })).toBe('12.08 14:00')
  })
})
