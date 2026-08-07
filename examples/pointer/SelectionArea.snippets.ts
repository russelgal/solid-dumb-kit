// Сниппеты доки к примеру SelectionArea.
//
// Отдельный файл, потому что подсветка считается НА СБОРКЕ: плагин
// playground/snippets.ts выполняет этот модуль в Node, гонит каждую строку
// через Shiki и подменяет экспорт на { code, html }. Отсюда два требования: в
// файле только строки и ни одного импорта.
export default {
  install: 'pnpm add @solid-dumb-kit/selection',

  basic: [
    "import { createSignal, For } from 'solid-js'",
    "import { SelectionArea } from '@solid-dumb-kit/selection'",
    '',
    'export default function Files() {',
    '  // выделение держит потребитель: это его состояние, а не внутренность кита',
    '  const [sel, setSel] = createSignal<Set<string>>(new Set())',
    '',
    '  return (',
    '    <SelectionArea',
    '      selectables=".card"',
    '      selected={sel}',
    '      onChange={setSel}',
    "      style={{ 'max-height': '60vh', 'overflow-y': 'auto' }}",
    '    >',
    '      <For each={files()}>',
    '        {(f) => (',
    '          // data-key — тот самый ключ, что придёт в Set',
    '          <div class="card" data-key={f.id} classList={{ on: sel().has(f.id) }}>',
    '            {f.name}',
    '          </div>',
    '        )}',
    '      </For>',
    '    </SelectionArea>',
    '  )',
    '}',
  ].join('\n'),

  intersect: [
    '// как считать попадание:',
    "//   'touch' — рамка коснулась элемента (по умолчанию, как в Finder)",
    "//   'cover' — элемент накрыт целиком",
    "//   'center' — рамка накрыла центр элемента",
    '<SelectionArea',
    '  selectables=".card"',
    '  selected={sel}',
    '  onChange={setSel}',
    '  intersect="center"',
    '  // сколько пикселей пройти, прежде чем появится рамка: клик остаётся кликом',
    '  threshold={10}',
    '  // свой ключ вместо data-key',
    '  keyAttr="data-id"',
    '/>',
  ].join('\n'),

  guard: [
    '// когда рамку начинать НЕ надо: тянут за ручку, кликнули по кнопке,',
    '// попали в поле ввода. Вернули false — жест не стартует.',
    '<SelectionArea',
    '  selectables=".card"',
    '  selected={sel}',
    '  onChange={setSel}',
    '  onBeforeStart={(ev) => {',
    '    const el = ev.target as HTMLElement',
    "    return !el.closest('button, input, [data-drag-handle]')",
    '  }}',
    '  // onChange зовётся в кадре, onStop — один раз в конце жеста:',
    '  // сюда вешают запрос на сервер или запись в localStorage',
    '  onStop={(next) => save([...next])}',
    '/>',
  ].join('\n'),

  engine: [
    "import { createSelectionArea } from '@solid-dumb-kit/selection'",
    '',
    '// Компонент — тонкая обёртка. Если разметка своя (виртуальный список,',
    '// чужой контейнер), берётся обёртка: она вешает отписки на onCleanup.',
    'const area = createSelectionArea({',
    '  container: () => root,',
    "  selectables: '.row',",
    '  selected: sel,',
    '  onChange: setSel,',
    '})',
    '',
    '// Совсем без Solid — движок: createSelectionEngine из того же пакета.',
    '// Он ничего не знает про фреймворк и возвращает destroy().',
  ].join('\n'),
}

/** язык там, где это не tsx */
export const langs = { install: 'sh' }
