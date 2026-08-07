// Сниппеты доки к примеру DumbTree.
//
// Отдельный файл, потому что подсветка считается НА СБОРКЕ: плагин
// playground/snippets.ts выполняет этот модуль в Node, гонит каждую строку
// через Shiki и подменяет экспорт на { code, html }. Отсюда два требования: в
// файле только строки и ни одного импорта.
export default {
  install: 'pnpm add @solid-dumb-kit/tree',

  basic: [
    "import { DumbTree, type TreeNode } from '@solid-dumb-kit/tree'",
    '',
    'const roots: TreeNode[] = [',
    '  {',
    "    id: 'docs',",
    "    label: 'Документы',",
    '    children: [',
    "      { id: 'act', label: 'Акт №14', badge: '2 МБ' },",
    "      { id: 'bill', label: 'Счёт', href: '/files/bill' },",
    '    ],',
    '  },',
    ']',
    '',
    '<DumbTree',
    '  roots={roots}',
    '  selected={picked}',
    '  onSelect={(node) => setPicked(node.id)}',
    '  // раскрытые ветки переживут перезагрузку',
    '  storageKey="sidebar-tree"',
    '/>',
  ].join('\n'),

  lazy: [
    '// Ветка тянется при первом раскрытии — дерево на десятки тысяч узлов не',
    '// нужно грузить целиком. Без roots первый запрос уйдёт с пустым id.',
    '<DumbTree',
    '  loadChildren={async (parentId) => {',
    '    const r = await fetch(`/api/tree?parent=${parentId}`)',
    '    return r.json()',
    '  }}',
    '  // сменился — раскрытые ветки перечитываются заново',
    '  refreshKey={() => version()}',
    '/>',
  ].join('\n'),

  search: [
    '// Фильтр показывает совпавшие узлы И дорогу к ним, иначе найденное висело',
    '// бы в воздухе. Пока поиск активен, перетаскивание выключено: показанный',
    '// порядок не совпадает с порядком данных.',
    '<DumbTree',
    '  roots={roots}',
    '  query={() => search()}',
    '  // свой матчер вместо подстроки: по коду, по транслиту, по чему угодно',
    '  match={(node, q) => node.label.toLowerCase().includes(q) || node.id === q}',
    '/>',
  ].join('\n'),

  look: [
    '// Размер задаётся ОДНИМ кеглем: высота строки — ровно 1lh, поэтому отступы,',
    '// стрелка и полосы едут следом сами.',
    '<DumbTree',
    '  roots={roots}',
    '  size="15px"',
    '  stripes={false}',
    '  icons={{',
    "    arrow: 'icon-[solar--alt-arrow-right-bold]', // одна на оба состояния",
    "    folder: 'icon-[solar--folder-bold]',",
    "    file: 'icon-[solar--file-bold]',",
    '  }}',
    '  renderAction={(node) => (',
    '    <button class="btn btn-ghost btn-xs" onClick={() => rename(node)}>',
    '      ⋯',
    '    </button>',
    '  )}',
    '  onContextMenu={(ev, node) => openMenu(ev, node)}',
    '/>',
  ].join('\n'),

  drag: [
    '// Узел можно утащить наружу — например, в таблицу или на карту. Что',
    '// вернули, то и уедет в dataTransfer нативного DnD.',
    '<DumbTree',
    '  roots={roots}',
    "  getDragData={(node) => ({ type: 'node', id: node.id, label: node.label })}",
    '/>',
    '',
    '// на приёмнике',
    'onDrop={(e) => {',
    "  const raw = e.dataTransfer?.getData('application/json')",
    '  if (raw) attach(JSON.parse(raw))',
    '}}',
  ].join('\n'),
}

/** язык там, где это не tsx */
export const langs = { install: 'sh' }
