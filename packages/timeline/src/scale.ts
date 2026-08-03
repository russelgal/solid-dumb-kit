// Шкала времени: момент ↔ пиксель.
//
// Одна и та же сетка обслуживает три непохожих случая, и ровно поэтому шкала
// вынесена отдельно:
//
// 1. ГОСТИНИЦА — колонка сутки, заезд в 16:00, выезд в 12:00;
// 2. БАНЯ — колонка два часа, работа с 10:00 до 24:00, между сеансами
//    полчаса на уборку;
// 3. БЕСЕДКА — дневная аренда с 12:00 до 23:00, ночи на сетке нет вовсе.
//
// Общий знаменатель у них один: время — это МИНУТЫ ОТ НАЧАЛА ОТСЧЁТА, а
// колонка — фиксированное число минут. Сутки оказываются частным случаем
// (`stepMin = 1440`), и отдельного кода под них не нужно.
//
// РАБОЧЕЕ ОКНО — вторая половина дела. У беседки день кончается в 23:00, и
// одиннадцать ночных часов на сетке не нужны: они занимали бы половину экрана
// пустотой. Поэтому шкала «складывает» дни: после `dayEnd` сразу идёт `dayStart`
// следующего дня, а моменты в вырезанной ночи прижимаются к краю окна.

import { Temporal } from './temporal'

/** `YYYY-MM-DD` или `YYYY-MM-DDTHH:mm` — время необязательно */
export type Moment = string

/**
 * Правила ОДНОГО ресурса — сверх того, что задаёт общая шкала.
 *
 * Сетка у шахматки одна, а торгуют строки по-разному: баня — сеансами не короче
 * двух часов и с получасом уборки после, пейнтбол — от часа и с часом на
 * перезарядку, банкетный зал открыт с 14:00, хотя сетка начинается в 10:00.
 * Всё это — свойства строки, а не сетки, поэтому и живут они на строке.
 */
export type RowRules = {
  /** короче не продаём, мин: сеанс бани — 120 */
  minMin?: number
  /** зазор до соседей, мин: уборка после бани 30, перезарядка пейнтбола 60 */
  gapMin?: number
  /** своё рабочее окно, минуты от полуночи: банкетный зал 14:00…23:00 */
  openMin?: number
  closeMin?: number
}

export type Scale = {
  /** первый день сетки, `YYYY-MM-DD` */
  first: string
  /** сколько дней показываем */
  days: number
  /** минуты от полуночи: начало и конец рабочего окна дня */
  dayStart: number
  dayEnd: number
  /** самая короткая бронь на всей сетке, мин; у строки бывает своя (`RowRules`) */
  minMin?: number
  /** сколько минут в КОЛОНКЕ: 1440 — сутки, 60 — час. Это про сетку, не про снап */
  stepMin: number
  /**
   * Шаг, которым двигаются брони, мин. Не задан — равен колонке, и так в
   * подавляющем большинстве случаев: сетка бывает либо суточная, либо
   * почасовая, и двигать надо ровно по её делениям.
   *
   * Отдельный шаг нужен там, где единица продажи крупнее деления сетки:
   * например, сеанс продаётся строго по два часа, а часы в шапке всё равно
   * нужны, чтобы читать время.
   */
  snapMin?: number
  /** ширина колонки, px */
  colW: number
  /** во что превращать дату без времени: заезд и выезд */
  checkIn?: number
  checkOut?: number
}

const DAY = 1440

export const dayOf = (m: Moment): string => m.slice(0, 10)

/** минуты от полуночи; у даты без времени их нет — вернём `null` */
export function minutesOf(m: Moment): number | null {
  if (m.length < 16) return null
  const h = Number(m.slice(11, 13))
  const min = Number(m.slice(14, 16))
  return h * 60 + min
}

/*
  Календарь считает Temporal, но НЕ ПОКАДРОВО: за жест `toMinutes` зовётся в
  циклах по всем броням, и разбор даты на каждый вызов — это работа, которую
  уже делали. Ответы кэшируются: дат на сетке конечное число (дни сетки плюс
  даты броней), так что кэш ограничен сам собой.
*/
/**
 * Страховочный потолок кэшей. На практике ключи ограничены датами сетки и
 * броней, но `first` — часть ключа, и приложение, листающее шкалу день за
 * днём, копило бы записи вечно. Переполнился — просто начали заново: это кэш.
 */
const CACHE_CAP = 10_000

const idxCache = new Map<string, number>()
function dayIndex(first: string, day: string): number {
  const key = `${first}|${day}`
  let idx = idxCache.get(key)
  if (idx === undefined) {
    idx = Temporal.PlainDate.from(first)
      .until(Temporal.PlainDate.from(day), { largestUnit: 'day' }).days
    if (idxCache.size >= CACHE_CAP) idxCache.clear()
    idxCache.set(key, idx)
  }
  return idx
}

const nameCache = new Map<string, string>()
/** дата N-го дня сетки, `YYYY-MM-DD` */
function dayName(first: string, index: number): string {
  const key = `${first}#${index}`
  let name = nameCache.get(key)
  if (name === undefined) {
    name = Temporal.PlainDate.from(first).add({ days: index }).toString()
    if (nameCache.size >= CACHE_CAP) nameCache.clear()
    nameCache.set(key, name)
  }
  return name
}

/**
 * Момент → минуты по шкале, где ночи вне рабочего окна вырезаны.
 *
 * `edge` решает судьбу даты БЕЗ времени: у начала это час заезда, у конца — час
 * выезда. Без этого гостиничная бронь `2026-06-01 … 2026-06-03` рисовалась бы
 * от полуночи до полуночи, то есть врала бы на полсуток с каждого края.
 */
export function toMinutes(m: Moment, s: Scale, edge: 'from' | 'to' = 'from'): number {
  const win = Math.max(1, s.dayEnd - s.dayStart)
  const inDay = minutesOf(m) ?? (edge === 'from' ? s.checkIn ?? s.dayStart : s.checkOut ?? s.dayEnd)
  // момент в вырезанной ночи прижимаем к краю окна: иначе полоса уезжает
  // в чужой день и выглядит длиннее, чем есть
  const clamped = Math.min(Math.max(inDay, s.dayStart), s.dayEnd)
  return dayIndex(s.first, dayOf(m)) * win + (clamped - s.dayStart)
}

/** минуты по шкале → пиксели */
export const toX = (min: number, s: Scale): number => (min / s.stepMin) * s.colW

/** момент → пиксели, одним движением */
export const momentX = (m: Moment, s: Scale, edge: 'from' | 'to' = 'from'): number =>
  toX(toMinutes(m, s, edge), s)

/** шаг перемещения: не задан — равен колонке */
export const snapOf = (s: Scale): number => s.snapMin ?? s.stepMin

/**
 * Самая короткая бронь, какая тут бывает, в минутах.
 *
 * Не равна шагу сетки, и это не мелочь: на суточной сетке шаг — 1440 минут, а
 * бронь на ОДНУ НОЧЬ при заезде в 16:00 и выезде в 12:00 длится 1200. Сравнение
 * с шагом отбраковывало её как «слишком короткую», и полосу нельзя было сжать
 * до одних суток — минимумом оказывались двое.
 */
export function minLength(s: Scale, rules?: RowRules): number {
  // у строки свой минимум — он и решает: «баня от двух часов» сильнее сетки
  if (rules?.minMin) return rules.minMin
  if (s.minMin) return s.minMin
  const win = Math.max(1, s.dayEnd - s.dayStart)
  if (s.stepMin < win) return snapOf(s)          // часовая сетка — шаг и есть минимум
  const inH = s.checkIn ?? s.dayStart
  const outH = s.checkOut ?? s.dayStart

  // Выезд ПОЗЖЕ заезда — значит въезд и выезд бывают в один день (зал, коворкинг,
  // беседка на день): самая короткая бронь длится от заезда до выезда.
  if (outH > inH) return outH - inH
  // Обычная гостиница: выезд раньше заезда, поэтому минимум — ночь,
  // то есть сутки минус «дырка» между 12:00 и 16:00.
  return Math.max(1, win + outH - inH)
}

/** пиксели → минуты по шкале, со снапом в шаг перемещения */
export function fromX(x: number, s: Scale, snap = true): number {
  const raw = (x / s.colW) * s.stepMin
  const step = snapOf(s)
  return snap ? Math.round(raw / step) * step : raw
}

/**
 * Куда встаёт КРАЙ полосы при ресайзе.
 *
 * Обычный снап в шаг шкалы тут врёт: на суточной сетке он кладёт край на
 * полночь, а бронь кончается в 12:00. Полоса после растягивания становится
 * длиннее на полдня, и щель на пересменку пропадает.
 *
 * Поэтому на сетке, где колонка — целый день, округляем НОМЕР ДНЯ относительно
 * своей отметки (заезд для левого края, выезд для правого) и возвращаем момент
 * уже с нужным временем. На часовых сетках отметок нет — там обычный снап.
 */
export function snapEdge(x: number, s: Scale, edge: 'from' | 'to'): Moment {
  const raw = (x / s.colW) * s.stepMin
  const win = Math.max(1, s.dayEnd - s.dayStart)
  const mark = (edge === 'from' ? s.checkIn ?? s.dayStart : s.checkOut ?? s.dayEnd) - s.dayStart

  if (s.stepMin >= win) {
    const dayIdx = Math.max(0, Math.round((raw - mark) / win))
    return toMoment(dayIdx * win + mark, s)
  }
  const step = snapOf(s)
  return toMoment(Math.max(0, Math.round(raw / step) * step), s)
}

/**
 * Минуты по шкале → момент `YYYY-MM-DDTHH:mm`.
 *
 * `asEnd` решает спор о границе. Конец рабочего дня и начало следующего — на
 * склеенной шкале ОДНА И ТА ЖЕ точка, и без подсказки она превращается в
 * «12:00 завтра». Для конца брони это неверно вдвойне: аренда кончилась в
 * 23:00, а не началась завтра.
 */
export function toMoment(min: number, s: Scale, asEnd = false): Moment {
  const win = Math.max(1, s.dayEnd - s.dayStart)
  let day = Math.floor(min / win)
  let rest = min - day * win + s.dayStart
  if (asEnd && min > 0 && min % win === 0) {
    day -= 1
    rest = s.dayEnd
  }
  const hh = String(Math.floor(rest / 60)).padStart(2, '0')
  const mm = String(Math.round(rest % 60)).padStart(2, '0')
  return `${dayName(s.first, day)}T${hh}:${mm}`
}

/** сколько колонок в сетке целиком */
export const totalCols = (s: Scale): number =>
  Math.ceil((s.days * Math.max(1, s.dayEnd - s.dayStart)) / s.stepMin)

/**
 * Верхний ряд шапки: колонки, слитые в группы. На суточной сетке группа —
 * месяц, на часовой — день. Ровно так это и делают в системах бронирования:
 * без верхнего ряда на часовой шкале невозможно понять, какой сейчас день,
 * а на месячной — какой месяц.
 */
export function headGroups(s: Scale): Array<{ label: string; span: number; at: Moment }> {
  const out: Array<{ label: string; span: number; at: Moment }> = []
  const win = Math.max(1, s.dayEnd - s.dayStart)
  // сутки в колонке — группируем по месяцу, иначе по дню
  const byMonth = s.stepMin >= win
  for (let i = 0; i < totalCols(s); i++) {
    const at = toMoment(i * s.stepMin, s)
    const key = byMonth ? at.slice(0, 7) : at.slice(0, 10)
    const last = out[out.length - 1]
    if (last && (byMonth ? last.at.slice(0, 7) : last.at.slice(0, 10)) === key) last.span++
    else out.push({ label: key, span: 1, at })
  }
  return out
}

/** подписи колонок: момент начала каждой */
export function columns(s: Scale): Array<Moment> {
  return Array.from({ length: totalCols(s) }, (_, i) => toMoment(i * s.stepMin, s))
}

/**
 * Пересекаются ли отрезки с учётом ЗАЗОРА.
 *
 * Зазор — не украшение: после бани полчаса уборки, и следующий сеанс в это
 * время поставить нельзя, хотя формально время свободно. У гостиницы ту же роль
 * играет разница между выездом и заездом, поэтому там зазор обычно нулевой.
 */
export function conflicts(
  a: { from: Moment; to: Moment },
  b: { from: Moment; to: Moment },
  s: Scale,
  gapMin = 0,
): boolean {
  const a1 = toMinutes(a.from, s, 'from')
  const a2 = toMinutes(a.to, s, 'to')
  const b1 = toMinutes(b.from, s, 'from')
  const b2 = toMinutes(b.to, s, 'to')
  return a1 < b2 + gapMin && b1 < a2 + gapMin
}

/**
 * Границы суток, в которые попал момент (в минутах по шкале).
 *
 * Нужны там, где объект НОЧЬЮ ЗАКРЫТ: беседка сдаётся с 12:00 до 23:00, и
 * аренда «с двух дня до полудня следующего» не существует — между ними
 * одиннадцать часов, когда объекта нет. На круглосуточной шкале (окно = сутки)
 * это ограничение бессмысленно и не применяется.
 */
export function dayBounds(min: number, s: Scale): { start: number; end: number } {
  const win = Math.max(1, s.dayEnd - s.dayStart)
  const day = Math.floor(min / win)
  return { start: day * win, end: (day + 1) * win }
}

/**
 * То же, но с оглядкой на СВОЁ окно строки: банкетный зал открывается в 14:00,
 * хотя сетка начинается в 10:00. Часы вне своего окна для строки — та же
 * «ночь», что и часы вне окна сетки: их не существует.
 */
export function rowBounds(min: number, s: Scale, rules?: RowRules): { start: number; end: number } {
  const win = Math.max(1, s.dayEnd - s.dayStart)
  const day = Math.floor(min / win)
  const open = Math.min(Math.max((rules?.openMin ?? s.dayStart) - s.dayStart, 0), win)
  const close = Math.min(Math.max((rules?.closeMin ?? s.dayEnd) - s.dayStart, 0), win)
  return { start: day * win + open, end: day * win + Math.max(open, close) }
}

/** закрывается ли объект на ночь: окно короче суток */
export const closesAtNight = (s: Scale): boolean => s.dayEnd - s.dayStart < 1440

/** живёт ли СТРОКА в пределах одного дня: окно сетки или своё окно короче суток */
export const confined = (s: Scale, rules?: RowRules): boolean =>
  closesAtNight(s) ||
  (rules?.closeMin ?? s.dayEnd) - (rules?.openMin ?? s.dayStart) < 1440

/** длительность отрезка в минутах по шкале */
export const lengthOf = (span: { from: Moment; to: Moment }, s: Scale): number =>
  toMinutes(span.to, s, 'to') - toMinutes(span.from, s, 'from')

/**
 * Ограничить КРАЙ соседями: докуда его вообще пускают.
 *
 * Переносу при отказе ищут другое место — это правильно, там метили примерно.
 * Ресайзу так делать нельзя: тянут за край намеренно, и «перекинуть полосу за
 * соседа» вместо «упереть в него» — это уже не та бронь, которую растягивали.
 * Поэтому край просто останавливается там, где начинается чужое (плюс зазор).
 *
 * Возвращает минуты по шкале; `null` — упёрлись так, что не осталось и шага.
 */
export function clampEdge(
  span: { id?: string; row?: string; from: Moment; to: Moment },
  edge: 'from' | 'to',
  wantMin: number,
  others: Array<{ id?: string; row?: string; from: Moment; to: Moment }>,
  s: Scale,
  gapMin = 0,
  rules?: RowRules,
): number | null {
  const begin = toMinutes(span.from, s, 'from')
  const end = toMinutes(span.to, s, 'to')
  const mates = others.filter((o) => o.id !== span.id && o.row === span.row)

  if (edge === 'to') {
    // Ночью объект закрыт — значит и тянуть за полночь нечего: правый край
    // упирается в конец СВОЕГО рабочего дня (у банкетного зала он свой)
    const nightWall = confined(s, rules) ? rowBounds(begin, s, rules).end : Infinity

    // Ближайший сосед СПРАВА — тот, кто начинается не раньше НАШЕГО НАЧАЛА.
    //
    // Отбирать по нашему концу нельзя: сосед, начавшийся внутри нас (данные
    // приходят и противоречивые — пересечения бывают), в потолок бы не попал,
    // и правый край проехал бы сквозь чужую бронь.
    let ceiling = Infinity
    for (const o of mates) {
      const oStart = toMinutes(o.from, s, 'from')
      if (oStart >= begin) ceiling = Math.min(ceiling, oStart - gapMin)
    }
    const at = Math.min(wantMin, ceiling, nightWall)
    return at - begin >= minLength(s, rules) ? at : null
  }

  // зеркально: сосед СЛЕВА — тот, кто кончается не позже нашего конца
  let floor = confined(s, rules) ? rowBounds(end - 1, s, rules).start : -Infinity
  for (const o of mates) {
    const oEnd = toMinutes(o.to, s, 'to')
    if (oEnd <= end) floor = Math.max(floor, oEnd + gapMin)
  }
  const at = Math.max(wantMin, floor, 0)
  return end - at >= minLength(s, rules) ? at : null
}

/**
 * Сдвинуть отрезок в новое начало, сохранив длительность.
 *
 * Если объект закрывается на ночь, отрезок ЦЕЛИКОМ остаётся в своих сутках:
 * иначе беседку можно перетащить так, что аренда повиснет на закрытые часы.
 * Прижимаем к концу дня, а не отменяем перенос: тащили осмысленно, просто
 * промахнулись на пару часов.
 */
export function moveTo(
  span: { from: Moment; to: Moment },
  startMin: number,
  s: Scale,
  rules?: RowRules,
): { from: Moment; to: Moment } {
  const len = lengthOf(span, s)
  let at = startMin
  if (confined(s, rules)) {
    const { start, end } = rowBounds(at, s, rules)
    at = Math.max(start, Math.min(at, end - len))
  }
  return { from: toMoment(at, s), to: toMoment(at + len, s, true) }
}

/**
 * Раскладка по «этажам»: пересекающиеся отрезки не лежат друг на друге.
 *
 * Считается ПО ШКАЛЕ, а не сравнением строк. Сравнение строк работало, пока
 * выезд был раньше заезда (12:00 против 16:00): дата без времени лексикографически
 * меньше любого времени тех же суток, и «выехал — заехал» сходилось само собой.
 * Но у зала или коворкинга наоборот — заезд в 8:00, выезд в 20:00, — и тогда
 * такие брони считались непересекающимися, хотя накладываются на полдня.
 */
export function stackFloors(
  spans: Array<{ id: string; row: string; from: Moment; to: Moment }>,
  s: Scale,
  // зазор бывает у КАЖДОЙ СТРОКИ свой (уборка бани — 30, пейнтбол — 60),
  // поэтому вместо числа можно передать функцию от строки
  gapMin: number | ((row: string) => number) = 0,
): Map<string, number> {
  const floors = new Map<string, number>()
  const byRow = new Map<string, Array<{ id: string; from: number; to: number }>>()
  const gapOf = typeof gapMin === 'function' ? gapMin : () => gapMin

  for (const sp of spans) {
    const list = byRow.get(sp.row) ?? []
    list.push({ id: sp.id, from: toMinutes(sp.from, s, 'from'), to: toMinutes(sp.to, s, 'to') })
    byRow.set(sp.row, list)
  }

  for (const [row, list] of byRow) {
    const gap = gapOf(row)
    // слева направо: первый этаж достаётся тому, кто начался раньше
    list.sort((a, b) => a.from - b.from)
    const busyUntil: Array<number> = []
    for (const sp of list) {
      let floor = busyUntil.findIndex((end) => end + gap <= sp.from)
      if (floor < 0) floor = busyUntil.length
      busyUntil[floor] = sp.to
      floors.set(sp.id, floor)
    }
  }
  return floors
}

/** сколько этажей понадобилось строке — по ним считается её высота */
export function floorsPerRow(
  spans: Array<{ id: string; row: string }>,
  floors: Map<string, number>,
): Map<string, number> {
  const out = new Map<string, number>()
  for (const sp of spans) {
    out.set(sp.row, Math.max(out.get(sp.row) ?? 1, (floors.get(sp.id) ?? 0) + 1))
  }
  return out
}

/**
 * Готовые шкалы под три случая из шапки файла. Не «удобные пресеты», а
 * напоминание, что настроек ровно четыре и они не перепутываются.
 */
export const SCALES = {
  /** сутки; заезд 16:00, выезд 12:00 */
  hotel: (first: string, days: number, colW = 34): Scale => ({
    first, days, colW, dayStart: 0, dayEnd: DAY, stepMin: DAY, checkIn: 16 * 60, checkOut: 12 * 60,
  }),
  /** почасовая, работа с 10:00 до полуночи */
  sauna: (first: string, days: number, colW = 34): Scale => ({
    first, days, colW, dayStart: 10 * 60, dayEnd: DAY, stepMin: 60,
  }),
  /** час; дневная аренда с 12:00 до 23:00 */
  gazebo: (first: string, days: number, colW = 34): Scale => ({
    first, days, colW, dayStart: 12 * 60, dayEnd: 23 * 60, stepMin: 60,
  }),
  /**
   * Час; сетка на ВСЕ площадки базы разом — КРУГЛОСУТОЧНАЯ: баню арендуют и
   * ночью, поэтому резать ночь на уровне сетки нельзя. У кого ночи нет —
   * беседка до 23:00, банкетный зал с 14:00 — тот закрывает её СВОИМ окном
   * (`RowRules` на строке), и закрытые часы видны штриховкой. Минимум и зазор
   * тоже у строк: баня — от двух часов и полчаса уборки, пейнтбол — от часа
   * и час перезарядки.
   */
  venues: (first: string, days: number, colW = 13): Scale => ({
    // колонка-час УЗКАЯ: сутки шириной ~310px, неделя влезает в экран.
    // Двигается всё полушагом в полчаса — сеанс с 14:30 не редкость
    first, days, colW, dayStart: 0, dayEnd: DAY, stepMin: 60, snapMin: 30,
  }),
} as const
