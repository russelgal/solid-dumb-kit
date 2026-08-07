// Сниппеты доки к примеру «Дашборд на DumbBoard».
//
// Отдельный файл, потому что подсветка считается НА СБОРКЕ: плагин
// playground/snippets.ts выполняет этот модуль в Node, гонит каждую строку
// через Shiki и подменяет экспорт на { code, html }. Отсюда два требования: в
// файле только строки и ни одного импорта.
export default {
  even: [
    '// Карточки одной высоты — это не режим доски, а одно и то же число из',
    '// blockRows. Движок тот же, ничего специального в ките для этого нет.',
    'const [rows, setRows] = createSignal(2)',
    '',
    '<DumbBoard',
    '  sections={sections()}',
    '  setSections={setSections}',
    '  id={(c) => c.id}',
    '  blockRows={() => rows()}                 // высота общая на всю доску',
    '  blockSpan={(c) => c.w ?? 1}              // разной остаётся ширина',
    '  onBlockResize={(_, size) => setRows(size.h)} // тянут одну — меняются все',
    '>',
    '  {(card) => <Stat data={card} />}',
    '</DumbBoard>',
  ].join('\n'),

  ragged: [
    '// Для сравнения — рваная раскладка соседней вкладки: высота у каждого своя,',
    '// и строки перестают быть ровными.',
    '<DumbBoard',
    '  sections={sections()}',
    '  setSections={setSections}',
    '  id={(c) => c.id}',
    '  blockRows={(c) => c.rows ?? 1}',
    '  blockLimits={(c) => ({ minW: 1, maxW: 3, minH: 1, maxH: 4 })}',
    '  onBlockResize={(c, size) => setCardSize(c.id, size)}',
    '/>',
  ].join('\n'),
}
