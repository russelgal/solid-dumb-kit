// Сниппеты доки к примеру DumbDateRange.
//
// Отдельный файл, потому что подсветка считается НА СБОРКЕ: плагин
// playground/snippets.ts выполняет этот модуль в Node, гонит каждую строку
// через Shiki и подменяет экспорт на { code, html }. Отсюда два требования: в
// файле только строки и ни одного импорта.
export default {
  install: 'pnpm add @solid-dumb-kit/date-range',

  basic: [
    "import { createSignal } from 'solid-js'",
    "import { DumbDateRange, type Day } from '@solid-dumb-kit/date-range'",
    '',
    'export default function Booking() {',
    '  // день — обычная строка YYYY-MM-DD: её же кладут в базу и шлют на сервер,',
    '  // никакого Date с часовыми поясами',
    '  const [range, setRange] = createSignal<{ from: Day; to: Day } | null>(null)',
    '',
    '  return <DumbDateRange value={range} onChange={setRange} months={2} />',
    '}',
  ].join('\n'),

  busy: [
    '// Занятые отрезки: показываются перечёркнутыми и не дают выбрать период,',
    '// который через них перепрыгивает.',
    'const busy = () => [',
    "  { from: '2026-06-14', to: '2026-06-18', title: 'Занято' },",
    "  { from: '2026-07-01', to: '2026-07-03' },",
    ']',
    '',
    '<DumbDateRange',
    '  value={range}',
    '  onChange={setRange}',
    '  busy={busy}',
    '  // праздники и выходные: подсветить, но выбирать можно',
    '  marks={() => ({',
    "    '2026-06-12': { title: 'День России', class: 'text-error' },",
    '  })}',
    '  min={today()}',
    '  minNights={2}',
    '  maxNights={30}',
    "  onReject={(why) => toast.error(why)}",
    '/>',
  ].join('\n'),

  extra: [
    '// Цена или что угодно в углу дня — например, тариф на сутки',
    '<DumbDateRange',
    '  value={range}',
    '  onChange={setRange}',
    '  dayExtra={(day) => (',
    '    <span class="text-[10px]">{priceOf(day)} ₽</span>',
    '  )}',
    '/>',
    '',
    '// одна дата вместо периода: to === from',
    '<DumbDateRange value={day} onChange={setDay} single />',
  ].join('\n'),

  math: [
    '// Арифметика дат лежит рядом и выложена наружу: проверять занятость и',
    '// считать ночи приходится и вне календаря — на сервере, перед записью',
    '// в базу, в отчёте.',
    "import { addDays, daysBetween, overlaps, checkRange, today } from '@solid-dumb-kit/date-range'",
    '',
    'const nights = daysBetween(from, to)',
    'const tomorrow = addDays(today(), 1)',
    '',
    '// пересекается ли период с занятым отрезком',
    'if (overlaps({ from, to }, busySpan)) return',
    '',
    '// та же проверка, что делает календарь: { ok: true } либо причина отказа',
    'const res = checkRange({ from, to, busy: busy(), minNights: 2, min: today() })',
    'if (!res.ok) return toast.error(res.why)',
  ].join('\n'),
}

/** язык там, где это не tsx */
export const langs = { install: 'sh' }
