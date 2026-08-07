// Сниппеты доки к примеру DumbContextMenu.
//
// Отдельный файл, потому что подсветка считается НА СБОРКЕ: плагин
// playground/snippets.ts выполняет этот модуль в Node, гонит каждую строку
// через Shiki и подменяет экспорт на { code, html }. Отсюда два требования: в
// файле только строки и ни одного импорта.
export default {
  install: 'pnpm add @solid-dumb-kit/context-menu',

  basic: [
    "import { DumbContextMenu } from '@solid-dumb-kit/context-menu'",
    '',
    'export default function Files() {',
    '  let area!: HTMLDivElement',
    '',
    '  return (',
    '    <div ref={area}>',
    '      {/* правый клик ловится внутри area; без target — по всему документу */}',
    '      <DumbContextMenu',
    '        target={() => area}',
    '        items={() => [',
    "          { label: 'Открыть', icon: 'icon-[solar--eye-bold]', run: open },",
    "          { label: 'Копировать', hint: '⌘C', run: copy },",
    "          { kind: 'separator' },",
    "          { label: 'Удалить', danger: true, disabled: !picked(), run: remove },",
    '        ]}',
    '      />',
    '    </div>',
    '  )',
    '}',
  ].join('\n'),

  dynamic: [
    '// пункты пересчитываются на КАЖДОЕ открытие, поэтому спокойно зависят',
    '// от выделения: подписи, доступность, сам набор',
    '<DumbContextMenu',
    '  target={() => area}',
    '  items={() => {',
    '    const n = picked().length',
    '    if (!n) return [{ label: "Выделить всё", run: selectAll }]',
    '    return [',
    '      { label: n === 1 ? "Переименовать" : `Переименовать ${n} шт.`, run: rename },',
    '      { kind: "separator" },',
    '      { label: `Удалить ${n}`, danger: true, run: removeAll },',
    '    ]',
    '  }}',
    '/>',
  ].join('\n'),

  nested: [
    '// пункт с items — ветка: раскрывает панель вбок и сам ничего не делает,',
    '// run у него не нужен и не вызывается. Вложенность любая.',
    'items={() => [',
    "  { label: 'Экспорт', icon: 'icon-[solar--download-bold]', items: [",
    "    { label: 'PNG', run: png },",
    "    { label: 'SVG', run: svg },",
    "    { label: 'Ещё…', items: [{ label: 'PDF', run: pdf }] },",
    '  ] },',
    "  { kind: 'separator' },",
    "  { label: 'Свойства', hint: '⌘I', run: info },",
    ']}',
  ].join('\n'),

  disabled: [
    '// по полю ввода меню лучше отдать браузеру: там своё, с «вставить»',
    '<DumbContextMenu',
    '  target={() => area}',
    '  disabled={() => editing()}',
    '  onToggle={(open) => setMenuOpen(open)}',
    '  items={items}',
    '/>',
  ].join('\n'),

  popover: [
    "import { DumbPopover } from '@solid-dumb-kit/context-menu'",
    '',
    '// карточка у точки: то же место в top layer и та же привязка якорем, но',
    '// содержимое произвольное. Модалка по центру рвёт связь с тем, что она',
    '// описывает, — карточка брони должна стоять рядом с бронью.',
    'const [at, setAt] = createSignal<{ x: number; y: number } | null>(null)',
    '',
    '<div onClick={(e) => setAt({ x: e.clientX, y: e.clientY })}>…</div>',
    '',
    '<DumbPopover',
    '  at={at}',
    '  onClose={() => setAt(null)}',
    '  title={<b>Бронь №1042</b>}',
    '  width="min(360px, 92vw)"',
    '  footer={<button class="btn btn-sm" onClick={() => setAt(null)}>Готово</button>}',
    '>',
    '  <p>Двухместный, с 14 по 21 июня.</p>',
    '</DumbPopover>',
  ].join('\n'),
}

/** язык там, где это не tsx */
export const langs = { install: 'sh' }
