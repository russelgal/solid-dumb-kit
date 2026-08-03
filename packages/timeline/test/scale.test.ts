import { describe, it, expect } from 'vitest'
import {
  SCALES, clampEdge, closesAtNight, columns, conflicts, fromX, lengthOf, minLength, momentX,
  moveTo, snapEdge, toMinutes, toMoment, totalCols,
} from '../src/scale'

describe('гостиница: колонка — сутки', () => {
  const s = SCALES.hotel('2026-06-01', 30, 30)

  it('дата без времени превращается в заезд 16:00 и выезд 12:00', () => {
    // заезд: 16/24 суток от начала → 20px при колонке 30
    expect(momentX('2026-06-01', s, 'from')).toBeCloseTo(20)
    // выезд третьего: двое суток + 12/24 → 75px
    expect(momentX('2026-06-03', s, 'to')).toBeCloseTo(75)
  })

  it('в день пересменки остаётся щель на уборку', () => {
    const outX = momentX('2026-06-03', s, 'to')
    const inX = momentX('2026-06-03', s, 'from')
    expect(inX - outX).toBeCloseTo(5)   // 4 часа × (30 / 24)
  })

  it('явное время побеждает час по умолчанию', () => {
    expect(momentX('2026-06-01T00:00', s, 'from')).toBe(0)
  })
})

describe('баня: сетка почасовая, окно 10:00…24:00', () => {
  const s = SCALES.sauna('2026-06-01', 7, 60)

  it('ночь вырезана: в сутках 14 колонок, а не 24', () => {
    expect(totalCols({ ...s, days: 1 })).toBe(14)
    expect(columns({ ...s, days: 1 })[0]).toBe('2026-06-01T10:00')
  })

  it('следующий день начинается сразу после закрытия', () => {
    const cols = columns({ ...s, days: 2 })
    expect(cols[14]).toBe('2026-06-02T10:00')    // не 00:00 и не 02:00
  })

  it('сеанс на два часа занимает две часовые колонки', () => {
    const from = momentX('2026-06-01T12:00', s, 'from')
    const to = momentX('2026-06-01T14:00', s, 'to')
    expect(to - from).toBe(120)
  })

  it('зазор на уборку не даёт поставить встык', () => {
    const a = { from: '2026-06-01T12:00', to: '2026-06-01T14:00' }
    const next = { from: '2026-06-01T14:00', to: '2026-06-01T16:00' }
    // без зазора встык можно
    expect(conflicts(a, next, s, 0)).toBe(false)
    // с получасом на уборку — уже нет
    expect(conflicts(a, next, s, 30)).toBe(true)
    // а через полчаса — снова можно
    expect(conflicts(a, { from: '2026-06-01T14:30', to: '2026-06-01T16:30' }, s, 30)).toBe(false)
  })

  it('момент, попавший в закрытую ночь, прижимается к краю окна', () => {
    // 03:00 — вне окна; прижимается к 10:00, то есть к нулю дня
    expect(toMinutes('2026-06-01T03:00', s)).toBe(0)
  })
})

describe('беседка: день с 12:00 до 23:00', () => {
  const s = SCALES.gazebo('2026-06-01', 3, 34)

  it('в дне 11 колонок по часу', () => {
    expect(totalCols({ ...s, days: 1 })).toBe(11)
  })

  it('аренда на весь день — вся ширина дня', () => {
    const from = momentX('2026-06-01T12:00', s, 'from')
    const to = momentX('2026-06-01T23:00', s, 'to')
    expect(to - from).toBe(11 * 34)
  })

  it('момент и пиксели ходят туда-обратно без потерь', () => {
    const min = toMinutes('2026-06-02T15:00', s)
    expect(toMoment(min, s)).toBe('2026-06-02T15:00')
    expect(fromX(momentX('2026-06-02T15:00', s), s)).toBe(min)
  })

  it('перенос сохраняет длительность и в дневном окне', () => {
    const span = { from: '2026-06-01T14:00', to: '2026-06-01T18:00' }
    const len = lengthOf(span, s)
    const moved = moveTo(span, toMinutes('2026-06-02T12:00', s), s)
    expect(moved).toEqual({ from: '2026-06-02T12:00', to: '2026-06-02T16:00' })
    expect(lengthOf(moved, s)).toBe(len)
  })
})

describe('снап края при ресайзе', () => {
  const hotel = SCALES.hotel('2026-06-01', 30, 30)

  it('правый край встаёт на выезд 12:00, а не на полночь', () => {
    // тянем примерно к третьим суткам: 2 колонки + чуть-чуть
    const at = snapEdge(2 * 30 + 10, hotel, 'to')
    expect(at).toBe('2026-06-03T12:00')
  })

  it('левый край встаёт на заезд 16:00', () => {
    expect(snapEdge(2 * 30 + 10, hotel, 'from')).toBe('2026-06-03T16:00')
  })

  it('после ресайза длина в сутках остаётся целой', () => {
    const from = '2026-06-01'
    const to = snapEdge(4 * 30 + 5, hotel, 'to')
    // 1 июня 16:00 → 5 июня 12:00 = 4 ночи (в минутах 4×1440 − 4ч)
    expect(lengthOf({ from, to }, hotel) / 1440).toBeCloseTo(4 - 4 / 24)
  })

  it('на часовой сетке отметок нет — снап идёт в час', () => {
    const sauna = SCALES.sauna('2026-06-01', 3, 60)
    expect(snapEdge(60 * 2.4, sauna, 'to')).toBe('2026-06-01T12:00')
    expect(snapEdge(60 * 3.6, sauna, 'to')).toBe('2026-06-01T14:00')
  })
})

describe('край упирается в соседа, а не прыгает за него', () => {
  const hotel = SCALES.hotel('2026-06-01', 30, 30)
  const me = { id: 'a', row: '101', from: '2026-06-01', to: '2026-06-04' }
  const sosed = { id: 'b', row: '101', from: '2026-06-06', to: '2026-06-09' }

  it('вправо тянется только до заезда соседа', () => {
    // хотим до 8 июня, а сосед заезжает 6-го
    const want = toMinutes('2026-06-08', hotel, 'to')
    const at = clampEdge(me, 'to', want, [sosed], hotel)
    expect(toMoment(at!, hotel)).toBe('2026-06-06T16:00')
  })

  it('в свободное место тянется куда просили', () => {
    const want = toMinutes('2026-06-05', hotel, 'to')
    const at = clampEdge(me, 'to', want, [sosed], hotel)
    expect(toMoment(at!, hotel)).toBe('2026-06-05T12:00')
  })

  it('сосед в ДРУГОЙ строке не мешает', () => {
    const other = { ...sosed, row: '102' }
    const want = toMinutes('2026-06-08', hotel, 'to')
    expect(toMoment(clampEdge(me, 'to', want, [other], hotel)!, hotel)).toBe('2026-06-08T12:00')
  })

  it('влево упирается в выезд соседа слева', () => {
    const later = { id: 'a', row: '101', from: '2026-06-10', to: '2026-06-14' }
    const left = { id: 'c', row: '101', from: '2026-06-05', to: '2026-06-08' }
    const want = toMinutes('2026-06-06', hotel, 'from')
    expect(toMoment(clampEdge(later, 'from', want, [left], hotel)!, hotel)).toBe('2026-06-08T12:00')
  })

  it('за левый край сетки не пускает: там ничего не нарисовано', () => {
    const want = toMinutes('2026-05-20', hotel, 'from')
    const at = clampEdge({ ...me, from: '2026-06-03', to: '2026-06-08' }, 'from', want, [], hotel)
    expect(at).toBe(0)
  })

  it('зазор на уборку тоже держит край', () => {
    const sauna = SCALES.sauna('2026-06-01', 3, 60)
    const seans = { id: 'a', row: 'b1', from: '2026-06-01T12:00', to: '2026-06-01T14:00' }
    const next = { id: 'b', row: 'b1', from: '2026-06-01T16:00', to: '2026-06-01T18:00' }
    const want = toMinutes('2026-06-01T18:00', sauna, 'to')
    // упираемся не в 16:00, а на полчаса раньше — там уборка
    expect(toMoment(clampEdge(seans, 'to', want, [next], sauna, 30)!, sauna)).toBe('2026-06-01T15:30')
  })

  it('упёрлись насмерть — отказ, а не схлопывание', () => {
    const tight = { id: 'b', row: '101', from: '2026-06-02', to: '2026-06-03' }
    const want = toMinutes('2026-05-20', hotel, 'to')
    expect(clampEdge(me, 'to', want, [tight], hotel)).toBe(null)
  })
})

describe('кто считается ближайшим соседом', () => {
  const hotel = SCALES.hotel('2026-06-01', 30, 30)
  const me = { id: 'a', row: '101', from: '2026-06-05', to: '2026-06-10' }

  it('сосед, начавшийся ВНУТРИ нас, всё равно держит правый край', () => {
    // данные противоречивые — брони уже пересекаются; растянуть сквозь чужую
    // нельзя даже в этом случае
    const inside = { id: 'b', row: '101', from: '2026-06-08', to: '2026-06-12' }
    const want = toMinutes('2026-06-20', hotel, 'to')
    expect(toMoment(clampEdge(me, 'to', want, [inside], hotel)!, hotel)).toBe('2026-06-08T16:00')
  })

  it('сосед, начавшийся ДО нас, правый край не ограничивает — он слева', () => {
    const before = { id: 'b', row: '101', from: '2026-06-01', to: '2026-06-03' }
    const want = toMinutes('2026-06-14', hotel, 'to')
    expect(toMoment(clampEdge(me, 'to', want, [before], hotel)!, hotel)).toBe('2026-06-14T12:00')
  })

  it('из нескольких соседей справа берётся ближайший', () => {
    const near = { id: 'b', row: '101', from: '2026-06-12', to: '2026-06-14' }
    const far = { id: 'c', row: '101', from: '2026-06-20', to: '2026-06-22' }
    const want = toMinutes('2026-06-25', hotel, 'to')
    expect(toMoment(clampEdge(me, 'to', want, [far, near], hotel)!, hotel)).toBe('2026-06-12T16:00')
  })

  it('слева — самый поздний из тех, кто закончился', () => {
    const early = { id: 'b', row: '101', from: '2026-06-01', to: '2026-06-02' }
    const late = { id: 'c', row: '101', from: '2026-06-02', to: '2026-06-04' }
    const want = toMinutes('2026-06-01', hotel, 'from')
    expect(toMoment(clampEdge(me, 'from', want, [early, late], hotel)!, hotel)).toBe('2026-06-04T12:00')
  })
})

describe('сетка бывает суточной или почасовой — и шаг такой же', () => {
  const sauna = SCALES.sauna('2026-06-01', 3, 34)

  it('колонка — час, шаг по умолчанию тот же', () => {
    expect(sauna.stepMin).toBe(60)
    expect(sauna.snapMin).toBeUndefined()
    expect(totalCols({ ...sauna, days: 1 })).toBe(14)   // 10:00…24:00
  })

  it('шапка подписана каждый час', () => {
    const cols = columns({ ...sauna, days: 1 })
    expect(cols.slice(0, 3)).toEqual(['2026-06-01T10:00', '2026-06-01T11:00', '2026-06-01T12:00'])
  })

  it('бронь двигается по часу', () => {
    expect(toMoment(fromX(34 * 1.4, sauna), sauna)).toBe('2026-06-01T11:00')
    expect(toMoment(fromX(34 * 3.4, sauna), sauna)).toBe('2026-06-01T13:00')
  })

  it('край при ресайзе тоже встаёт на час', () => {
    expect(snapEdge(34 * 2.6, sauna, 'to')).toBe('2026-06-01T13:00')
  })

  it('но крупный шаг можно задать, если единица продажи больше деления', () => {
    const byTwo = { ...sauna, snapMin: 120 }
    expect(toMoment(fromX(34 * 1.4, byTwo), byTwo)).toBe('2026-06-01T12:00')
  })
})

describe('объект закрыт ночью — бронь не перетекает в следующие сутки', () => {
  const gaz = SCALES.gazebo('2026-06-01', 3, 34)   // окно 12:00…23:00

  it('правый край упирается в конец рабочего дня', () => {
    const me = { id: 'a', row: 'g1', from: '2026-06-01T14:00', to: '2026-06-01T18:00' }
    const want = toMinutes('2026-06-02T15:00', gaz, 'to')   // хотим в завтра
    expect(toMoment(clampEdge(me, 'to', want, [], gaz)!, gaz, true)).toBe('2026-06-01T23:00')
  })

  it('левый край упирается в открытие', () => {
    const me = { id: 'a', row: 'g1', from: '2026-06-02T14:00', to: '2026-06-02T18:00' }
    const want = toMinutes('2026-06-01T20:00', gaz, 'from')
    expect(toMoment(clampEdge(me, 'from', want, [], gaz)!, gaz)).toBe('2026-06-02T12:00')
  })

  it('перенос прижимается к концу дня, а не рвёт сутки', () => {
    const span = { from: '2026-06-01T12:00', to: '2026-06-01T16:00' }   // 4 часа
    const late = toMinutes('2026-06-01T21:00', gaz)                     // не влезает
    expect(moveTo(span, late, gaz)).toEqual({
      from: '2026-06-01T19:00',
      to: '2026-06-01T23:00',
    })
  })

  it('перенос в другой день сохраняет время, если влезает', () => {
    const span = { from: '2026-06-01T12:00', to: '2026-06-01T16:00' }
    const next = toMinutes('2026-06-02T14:00', gaz)
    expect(moveTo(span, next, gaz)).toEqual({
      from: '2026-06-02T14:00',
      to: '2026-06-02T18:00',
    })
  })

  it('круглосуточная шкала этого ограничения не знает', () => {
    const hotel = SCALES.hotel('2026-06-01', 30, 30)
    expect(closesAtNight(hotel)).toBe(false)
    const me = { id: 'a', row: '101', from: '2026-06-01', to: '2026-06-03' }
    const want = toMinutes('2026-06-09', hotel, 'to')
    expect(toMoment(clampEdge(me, 'to', want, [], hotel)!, hotel)).toBe('2026-06-09T12:00')
  })
})

describe('самая короткая бронь', () => {
  const hotel = SCALES.hotel('2026-06-01', 30, 30)

  it('на суточной сетке это ОДНИ сутки, а не двое', () => {
    // заезд 16:00 → выезд 12:00 следующего дня = 20 часов, а не 24
    expect(minLength(hotel)).toBe(1200)
  })

  it('правый край можно подтянуть до одних суток', () => {
    const me = { id: 'a', row: '101', from: '2026-06-05', to: '2026-06-09' }
    const want = toMinutes('2026-06-06', hotel, 'to')
    expect(toMoment(clampEdge(me, 'to', want, [], hotel)!, hotel, true)).toBe('2026-06-06T12:00')
  })

  it('а до нуля — нельзя', () => {
    const me = { id: 'a', row: '101', from: '2026-06-05', to: '2026-06-09' }
    const want = toMinutes('2026-06-05', hotel, 'to')
    expect(clampEdge(me, 'to', want, [], hotel)).toBe(null)
  })

  it('на часовой сетке минимум — один час', () => {
    const sauna = SCALES.sauna('2026-06-01', 3, 34)
    expect(minLength(sauna)).toBe(60)
  })
})
