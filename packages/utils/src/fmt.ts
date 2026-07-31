// --- Числа ---

const RubIntl2 = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const RubIntl0 = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})

const RubIntl4 = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 4,
})

type Numeric = number | string | null | undefined

function toNum(v: Numeric): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : null
}

/** 1 234,56 ₽ */
export function RubR2(v: Numeric): string {
  const n = toNum(v)
  return n != null ? RubIntl2.format(n) + ' \u20BD' : ''
}

/** 1 234,56 */
export function Rub2(v: Numeric): string {
  const n = toNum(v)
  return n != null ? RubIntl2.format(n) : ''
}

/** 1 235 */
export function Rub0(v: Numeric): string {
  const n = toNum(v)
  return n != null ? RubIntl0.format(n) : ''
}

/** 1 235 ₽ */
export function Rub0R(v: Numeric): string {
  const n = toNum(v)
  return n != null ? RubIntl0.format(n) + ' \u20BD' : ''
}

/** 1 234,5678 */
export function Rub4(v: Numeric): string {
  const n = toNum(v)
  return n != null ? RubIntl4.format(n) : ''
}

/** 1 234 или — */
export function fmtNum(v: Numeric): string {
  const n = toNum(v)
  return n != null ? RubIntl0.format(n) : '\u2014'
}

/** 1 234,56 ₽ или — */
export function fmtPrice(v: Numeric): string {
  const n = toNum(v)
  return n != null ? RubIntl2.format(n) + ' \u20BD' : '\u2014'
}

// --- Даты ---

type DateInput = string | number | Date | null | undefined

const DateTimeFmt = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

const DateTimeShortFmt = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const DateFmt = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const TimeFmt = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

const DateMonthFmt = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function toDate(v: DateInput): Date | null {
  if (v == null || v === '') return null
  const d = v instanceof Date ? v : new Date(v)
  return isNaN(d.getTime()) ? null : d
}

/** 23.02.2026, 16:40:22 */
export function fmtDateTime(v: DateInput): string {
  const d = toDate(v)
  return d ? DateTimeFmt.format(d) : ''
}

/** 23.02.2026, 16:40 */
export function fmtDateTimeShort(v: DateInput): string {
  const d = toDate(v)
  return d ? DateTimeShortFmt.format(d) : ''
}

/** 23.02.2026 */
export function fmtDate(v: DateInput): string {
  const d = toDate(v)
  return d ? DateFmt.format(d) : ''
}

/** 16:40:22 */
export function fmtTime(v: DateInput): string {
  const d = toDate(v)
  return d ? TimeFmt.format(d) : ''
}

/** 23 февр. 2026 г. */
export function fmtDateMonth(v: DateInput): string {
  const d = toDate(v)
  return d ? DateMonthFmt.format(d) : ''
}

// --- Размер файла ---

/** 512 Б / 24 КБ / 1.3 МБ */
export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

/** "2 ч. назад", "3 дн. назад" или — */
export function timeAgo(v: DateInput): string {
  const d = toDate(v)
  if (!d) return '\u2014'
  const diff = Date.now() - d.getTime()
  if (diff < 0) return 'только что'
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'только что'
  if (minutes < 60) return `${minutes} мин. назад`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ч. назад`
  const days = Math.floor(hours / 24)
  return `${days} дн. назад`
}
