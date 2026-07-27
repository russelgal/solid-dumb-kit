import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  Rub0, Rub2, Rub4, RubR2, Rub0R,
  fmtNum, fmtPrice,
  fmtDate, fmtDateTime, fmtDateTimeShort, fmtTime, fmtDateMonth,
  fmtSize,
  timeAgo,
} from '../fmt'

// ── Числа ──

describe('Rub0 — целое число без копеек', () => {
  it('форматирует положительное число', () => {
    // Intl ru-RU использует неразрывный пробел (U+00A0) как разделитель групп
    expect(Rub0(1234)).toBe('1\u00A0234')
  })

  it('форматирует ноль', () => {
    expect(Rub0(0)).toBe('0')
  })

  it('округляет дробные числа', () => {
    expect(Rub0(1234.6)).toBe('1\u00A0235')
  })

  it('возвращает пустую строку для null', () => {
    expect(Rub0(null)).toBe('')
  })

  it('возвращает пустую строку для undefined', () => {
    expect(Rub0(undefined)).toBe('')
  })

  it('парсит строковое число', () => {
    expect(Rub0('5000')).toBe('5\u00A0000')
  })

  it('возвращает пустую строку для пустой строки', () => {
    expect(Rub0('')).toBe('')
  })

  it('возвращает пустую строку для NaN-строки', () => {
    expect(Rub0('abc')).toBe('')
  })
})

describe('Rub2 — число с двумя знаками', () => {
  it('форматирует целое число с дробной частью', () => {
    expect(Rub2(1234)).toBe('1\u00A0234,00')
  })

  it('форматирует дробное число', () => {
    expect(Rub2(1234.56)).toBe('1\u00A0234,56')
  })

  it('форматирует ноль', () => {
    expect(Rub2(0)).toBe('0,00')
  })

  it('форматирует отрицательное число', () => {
    expect(Rub2(-500.1)).toBe('-500,10')
  })

  it('возвращает пустую строку для null', () => {
    expect(Rub2(null)).toBe('')
  })
})

describe('Rub4 — число с четырьмя знаками максимум', () => {
  it('форматирует число с 4 знаками', () => {
    expect(Rub4(1.1234)).toBe('1,1234')
  })

  it('отбрасывает лишние знаки', () => {
    expect(Rub4(1.12345)).toBe('1,1235')
  })

  it('не добавляет нули если не нужно', () => {
    expect(Rub4(100)).toBe('100')
  })

  it('возвращает пустую строку для null', () => {
    expect(Rub4(null)).toBe('')
  })
})

describe('RubR2 — число с копейками и знаком рубля', () => {
  it('форматирует число с символом рубля', () => {
    expect(RubR2(1234.5)).toBe('1\u00A0234,50 \u20BD')
  })

  it('форматирует ноль', () => {
    expect(RubR2(0)).toBe('0,00 \u20BD')
  })

  it('возвращает пустую строку для null', () => {
    expect(RubR2(null)).toBe('')
  })
})

describe('Rub0R — целое число со знаком рубля', () => {
  it('форматирует число с символом рубля', () => {
    expect(Rub0R(1500)).toBe('1\u00A0500 \u20BD')
  })

  it('форматирует ноль', () => {
    expect(Rub0R(0)).toBe('0 \u20BD')
  })

  it('возвращает пустую строку для null', () => {
    expect(Rub0R(null)).toBe('')
  })
})

describe('fmtNum — число или em dash', () => {
  it('форматирует число', () => {
    expect(fmtNum(999)).toBe('999')
  })

  it('форматирует большое число с разделителем', () => {
    expect(fmtNum(1000000)).toBe('1\u00A0000\u00A0000')
  })

  it('возвращает em dash для null', () => {
    expect(fmtNum(null)).toBe('\u2014')
  })

  it('возвращает em dash для undefined', () => {
    expect(fmtNum(undefined)).toBe('\u2014')
  })

  it('возвращает em dash для пустой строки', () => {
    expect(fmtNum('')).toBe('\u2014')
  })
})

describe('fmtPrice — цена с рублём или em dash', () => {
  it('форматирует цену', () => {
    expect(fmtPrice(1500)).toBe('1\u00A0500,00 \u20BD')
  })

  it('форматирует ноль', () => {
    expect(fmtPrice(0)).toBe('0,00 \u20BD')
  })

  it('возвращает em dash для null', () => {
    expect(fmtPrice(null)).toBe('\u2014')
  })

  it('возвращает em dash для undefined', () => {
    expect(fmtPrice(undefined)).toBe('\u2014')
  })

  it('парсит строковую цену', () => {
    expect(fmtPrice('2500.50')).toBe('2\u00A0500,50 \u20BD')
  })
})

// ── Даты ──

describe('fmtDate — дата ДД.ММ.ГГГГ', () => {
  it('форматирует строку ISO', () => {
    const result = fmtDate('2026-03-15T10:30:00Z')
    expect(result).toMatch(/15\.03\.2026/)
  })

  it('форматирует объект Date', () => {
    const result = fmtDate(new Date(2026, 0, 1)) // январь
    expect(result).toMatch(/01\.01\.2026/)
  })

  it('возвращает пустую строку для null', () => {
    expect(fmtDate(null)).toBe('')
  })

  it('возвращает пустую строку для undefined', () => {
    expect(fmtDate(undefined)).toBe('')
  })

  it('возвращает пустую строку для невалидной даты', () => {
    expect(fmtDate('not-a-date')).toBe('')
  })
})

describe('fmtDateTime — дата и время с секундами', () => {
  it('форматирует полную дату-время', () => {
    const result = fmtDateTime('2026-03-15T10:30:45Z')
    // Содержит дату и время
    expect(result).toMatch(/15\.03\.2026/)
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/)
  })

  it('возвращает пустую строку для null', () => {
    expect(fmtDateTime(null)).toBe('')
  })
})

describe('fmtDateTimeShort — дата и время без секунд', () => {
  it('форматирует дату с часами и минутами', () => {
    const result = fmtDateTimeShort('2026-06-20T14:05:00Z')
    expect(result).toMatch(/20\.06\.2026/)
    // Должен быть формат ЧЧ:ММ без секунд
    expect(result).toMatch(/\d{2}:\d{2}/)
  })

  it('возвращает пустую строку для null', () => {
    expect(fmtDateTimeShort(null)).toBe('')
  })
})

describe('fmtTime — только время ЧЧ:ММ:СС', () => {
  it('возвращает время', () => {
    const result = fmtTime('2026-03-15T10:30:45Z')
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/)
  })

  it('возвращает пустую строку для null', () => {
    expect(fmtTime(null)).toBe('')
  })
})

describe('fmtDateMonth — дата с названием месяца', () => {
  it('форматирует дату с месяцем', () => {
    const result = fmtDateMonth(new Date(2026, 1, 23)) // февраль
    // Содержит число и год
    expect(result).toMatch(/23/)
    expect(result).toMatch(/2026/)
  })

  it('возвращает пустую строку для null', () => {
    expect(fmtDateMonth(null)).toBe('')
  })
})

// ── Размер файла ──

describe('fmtSize — размер файла', () => {
  it('отображает байты', () => {
    expect(fmtSize(512)).toBe('512 Б')
  })

  it('отображает 0 байт', () => {
    expect(fmtSize(0)).toBe('0 Б')
  })

  it('отображает килобайты', () => {
    expect(fmtSize(1024)).toBe('1 КБ')
  })

  it('отображает килобайты (большое значение)', () => {
    expect(fmtSize(500 * 1024)).toBe('500 КБ')
  })

  it('отображает мегабайты', () => {
    expect(fmtSize(1024 * 1024)).toBe('1.0 МБ')
  })

  it('отображает мегабайты дробные', () => {
    expect(fmtSize(1.5 * 1024 * 1024)).toBe('1.5 МБ')
  })

  it('отображает большие файлы в МБ', () => {
    expect(fmtSize(100 * 1024 * 1024)).toBe('100.0 МБ')
  })

  it('граница между Б и КБ', () => {
    expect(fmtSize(1023)).toBe('1023 Б')
  })
})

// ── timeAgo ──

describe('timeAgo — относительное время', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-28T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('возвращает em dash для null', () => {
    expect(timeAgo(null)).toBe('\u2014')
  })

  it('возвращает em dash для undefined', () => {
    expect(timeAgo(undefined)).toBe('\u2014')
  })

  it('"только что" для текущего времени', () => {
    expect(timeAgo(new Date('2026-03-28T12:00:00Z'))).toBe('только что')
  })

  it('"только что" для будущего времени', () => {
    expect(timeAgo(new Date('2026-03-28T13:00:00Z'))).toBe('только что')
  })

  it('"только что" для менее минуты назад', () => {
    expect(timeAgo(new Date('2026-03-28T11:59:30Z'))).toBe('только что')
  })

  it('минуты назад', () => {
    expect(timeAgo(new Date('2026-03-28T11:55:00Z'))).toBe('5 мин. назад')
  })

  it('часы назад', () => {
    expect(timeAgo(new Date('2026-03-28T09:00:00Z'))).toBe('3 ч. назад')
  })

  it('дни назад', () => {
    expect(timeAgo(new Date('2026-03-25T12:00:00Z'))).toBe('3 дн. назад')
  })

  it('много дней назад', () => {
    expect(timeAgo(new Date('2026-02-28T12:00:00Z'))).toBe('28 дн. назад')
  })
})
