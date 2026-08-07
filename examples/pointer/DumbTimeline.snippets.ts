// Сниппеты доки к примеру DumbTimeline.
//
// Отдельный файл, потому что подсветка считается НА СБОРКЕ: плагин
// playground/snippets.ts выполняет этот модуль в Node, гонит каждую строку
// через Shiki и подменяет экспорт на { code, html }. Отсюда два требования: в
// файле только строки и ни одного импорта.
export default {
  install: 'pnpm add @solid-dumb-kit/timeline',

  basic: [
    "import { DumbTimeline, SCALES } from '@solid-dumb-kit/timeline'",
    '',
    'const rows = [',
    "  { id: '101', title: 'Люкс 101' },",
    "  { id: '102', title: 'Стандарт 102' },",
    ']',
    '',
    'const spans = [',
    "  { id: 'b1', row: '101', from: '2026-06-14', to: '2026-06-18', title: 'Иванов' },",
    ']',
    '',
    '<DumbTimeline',
    '  rows={rows}',
    '  spans={spans}',
    '  // шкала целиком одним пропом: гостиница, 30 суток от start',
    '  scale={SCALES.hotel(start, 30)}',
    '  onChange={(next, prev, kind) => save(next, kind)}',
    '/>',
  ].join('\n'),

  scales: [
    '// Сутки — частный случай шкалы, отдельного «режима» нет. Всё задаётся',
    '// шагом сетки и рабочим окном дня.',
    '',
    '// гостиница: колонка = сутки, заезд 16:00, выезд 12:00',
    '<DumbTimeline rows={rooms} spans={books} scale={SCALES.hotel(start, 30)} />',
    '',
    '// баня: сетка почасовая (по ней читают время), сеанс продаётся по два часа,',
    '// после сеанса полчаса на уборку — время формально свободно, ставить нельзя',
    '<DumbTimeline',
    '  rows={halls}',
    '  spans={sessions}',
    '  stepMin={60}',
    '  snapMin={120}',
    '  gapMin={30}',
    '  dayStart={10 * 60}',
    '  dayEnd={24 * 60}',
    '/>',
  ].join('\n'),

  change: [
    '// Своего состояния у кита нет: позиция полосы ВСЕГДА считается из spans.',
    '// Не записал новые даты (сервер отказал) — полоса вернётся сама.',
    'const onChange = async (next, prev, kind) => {',
    '  const ok = await api.move(next)',
    '  if (!ok) return false // отменить: полоса встанет обратно',
    '  setSpans((all) => all.map((s) => (s.id === next.id ? next : s)))',
    '}',
    '',
    "// kind: 'move' | 'resize-from' | 'resize-to' — «перенесено» и «продлено»",
    '// для бизнеса разные события, и логировать их надо по-разному',
  ].join('\n'),

  create: [
    '// Клик по полосе — открыть карточку РЯДОМ с бронью: точка приходит вторым',
    '// аргументом, и модалка посреди шахматки не закрывает то, о чём говорит.',
    '<DumbTimeline',
    '  rows={rows}',
    '  spans={spans}',
    '  onOpen={(span, at) => setCard({ span, at })}',
    '  onEmptyClick={(at, row) => createAt(row, at)}',
    '  onRangeSelect={({ row, from, to, needsTime }) => {',
    '    // needsTime: строка почасовая, а сетка суточная — точное время из',
    '    // такого жеста не вытащить, его надо спросить, а не угадать',
    '    if (needsTime) return askTime({ row, from, to })',
    '    create({ row, from, to })',
    '  }}',
    '/>',
  ].join('\n'),

  look: [
    '// Сводка над сеткой — в системах бронирования на неё смотрят чаще, чем на',
    '// сами брони: сколько свободно, выручка за день.',
    '<DumbTimeline',
    '  rows={rows}',
    '  spans={spans}',
    '  summary={(at) => <b>{freeAt(at)}</b>}',
    '  summaryTitle="Свободно"',
    "  now={nowMoment()}   // 'YYYY-MM-DDTHH:mm' — вертикальная линия «сейчас»",
    "  dayClass={(at) => (isHoliday(at) ? 'bg-error/10' : undefined)}",
    '  colW={34}',
    '  rowH={34}',
    '  headW={200}',
    '/>',
  ].join('\n'),
}

/** язык там, где это не tsx */
export const langs = { install: 'sh' }
