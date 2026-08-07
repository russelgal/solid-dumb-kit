// Сниппеты доки к примеру DumbDateTimeRange.
//
// Отдельный файл, потому что подсветка считается НА СБОРКЕ: плагин
// playground/snippets.ts выполняет этот модуль в Node, гонит каждую строку
// через Shiki и подменяет экспорт на { code, html }. Отсюда два требования: в
// файле только строки и ни одного импорта.
export default {
  install: 'pnpm add @solid-dumb-kit/date-range',

  basic: [
    "import { createSignal } from 'solid-js'",
    "import { DumbDateTimeRange, type Moment } from '@solid-dumb-kit/date-range'",
    '',
    'export default function Visit() {',
    '  // момент — это день и время строками: { day: "2026-06-14", time: "14:00" }',
    '  const [range, setRange] = createSignal<{ from: Moment; to: Moment } | null>(null)',
    '',
    '  return (',
    '    <DumbDateTimeRange',
    '      value={range}',
    '      onChange={setRange}',
    '      step={30}          // шаг слотов, минуты',
    '      openMin={9 * 60}   // рабочее окно: с 09:00',
    '      closeMin={21 * 60} // по 21:00',
    '    />',
    '  )',
    '}',
  ].join('\n'),

  busy: [
    '// Занятость с точностью до минуты. Конец НЕ включается: запись 14:00–15:00',
    '// не мешает следующей начаться ровно в 15:00.',
    'const busy = () => [',
    '  {',
    "    from: { day: '2026-06-14', time: '10:00' },",
    "    to: { day: '2026-06-14', time: '11:30' },",
    "    title: 'Иванов',",
    '  },',
    ']',
    '',
    '<DumbDateTimeRange',
    '  value={range}',
    '  onChange={setRange}',
    '  busy={busy}',
    '  minMinutes={60}',
    '  maxMinutes={8 * 60}',
    '  onReject={(why) => toast.error(why)}',
    '/>',
  ].join('\n'),

  modes: [
    "// mode='slots' (по умолчанию) — лента слотов: период тянется нажатием и",
    '// протяжкой, занятое видно сразу, свободное окно окидываешь глазами.',
    '<DumbDateTimeRange value={range} onChange={setRange} mode="slots" step={30} />',
    '',
    "// mode='select' — часы и минуты списками. Для мелкого шага, тесной формы",
    '// и телефона, где <select> даёт родное колесо.',
    '<DumbDateTimeRange value={range} onChange={setRange} mode="select" step={5} />',
    '',
    '// то же поле само по себе, без календаря',
    '<DumbTimeSelect',
    '  value={time}',
    '  onChange={setTime}',
    '  day={day()}',
    '  busy={busy}',
    '  label="Начало"',
    '/>',
  ].join('\n'),

  math: [
    '// Время — та же чистая арифметика, что и даты, и она нужна вне виджета:',
    '// посчитать занятость на сервере, нарезать свои слоты, проверить период',
    '// перед записью в базу.',
    "import { toMin, minutesBetween, fmtLength, overlapsMoment, checkMomentRange, slotsOfDay } from '@solid-dumb-kit/date-range'",
    '',
    "toMin('14:30')                       // 870",
    'minutesBetween(from, to)             // длительность в минутах',
    "fmtLength(90)                        // '1 ч 30 мин'",
    '',
    '// пересекается ли выбранное с занятым',
    'if (busy().some((b) => overlapsMoment({ from, to }, b))) return',
    '',
    '// та же проверка, что делает виджет',
    'const res = checkMomentRange({ from, to, busy: busy(), minMinutes: 60 })',
    'if (!res.ok) return toast.error(res.why)',
  ].join('\n'),
}

/** язык там, где это не tsx */
export const langs = { install: 'sh' }
