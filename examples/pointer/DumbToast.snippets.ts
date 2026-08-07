// Сниппеты доки к примеру DumbToast.
//
// Отдельный файл, потому что подсветка считается НА СБОРКЕ: плагин
// playground/snippets.ts выполняет этот модуль в Node, гонит каждую строку через Shiki
// и подменяет экспорт на { code, html }. Отсюда два требования: в файле только
// строки и ни одного импорта.
export default {
  install: 'pnpm add @solid-dumb-kit/toast',

  mount: [
    "import { DumbToaster, DumbToastCenter } from '@solid-dumb-kit/toast'",
    '',
    'export default function App() {',
    '  return (',
    '    <>',
    '      <Router />',
    '      {/* оба — один раз на приложение */}',
    '      <DumbToaster position="bottom-right" max={6} />',
    '      <DumbToastCenter />',
    '    </>',
    '  )',
    '}',
  ].join('\n'),

  say: [
    "import { toast } from '@solid-dumb-kit/toast'",
    '',
    "toast.success('Смета сохранена')",
    '',
    '// заголовок и значок — как в системных уведомлениях',
    "toast.error('Нет места в хранилище', {",
    "  title: 'Заливка',",
    "  icon: 'icon-[solar--cloud-upload-bold]',",
    '})',
    '',
    '// кнопка рядом с текстом; нажали — плашка уходит сама',
    "toast.info('Файл удалён', {",
    '  ttl: 8000,',
    "  action: { label: 'Вернуть', kind: 'primary', run: () => restore() },",
    '})',
  ].join('\n'),

  ask: [
    '// не блокирует вкладку и возвращает обещание',
    "const ok = await toast.confirm('Удалить бронь?', {",
    "  yes: 'Удалить',",
    "  no: 'Оставить',",
    '  danger: true,',
    "  at: 'pointer', // спросить у курсора, а не в углу экрана",
    '})',
    'if (ok) await api.remove(id)',
    '',
    '// несколько ответов — toast.ask',
    "toast.ask('Файл изменён на диске. Что делать?', [",
    "  { label: 'Перечитать', kind: 'primary', run: reload },",
    "  { label: 'Оставить моё', run: keep },",
    "  { label: 'Показать разницу', keepOpen: true, run: diff },",
    '])',
  ].join('\n'),

  modalAsk: [
    "import { DumbModalHost, modal } from '@solid-dumb-kit/modal'",
    '',
    '// один раз рядом с корнем — как тостер',
    '<DumbModalHost />',
    '',
    '// дальше вопрос зовётся откуда угодно',
    "const ok = await modal.confirm('Удалить бронь безвозвратно?', {",
    "  title: 'Удаление',",
    "  yes: 'Удалить',",
    '  danger: true,',
    '})',
    '',
    '// несколько кнопок: вернётся value нажатой',
    "const how = await modal.ask('Что сделать с файлом?', [",
    "  { label: 'Заменить', value: 'replace', kind: 'danger' },",
    "  { label: 'Оставить оба', value: 'both', kind: 'primary' },",
    "  { label: 'Пропустить', value: 'skip' },",
    '])',
    '',
    '// ответ обязателен — закрыть молча нельзя',
    "await modal.confirm('Договор будет расторгнут. Продолжить?', { dismissible: false })",
  ].join('\n'),

  history: [
    '<DumbToastCenter bell={false} />',
    '',
    '<button class="btn" onClick={() => toast.toggleHistory()}>',
    '  Уведомления',
    '  <Show when={toast.unread() > 0}>',
    '    <span class="badge badge-error badge-sm">{toast.unread()}</span>',
    '  </Show>',
    '</button>',
  ].join('\n'),

  custom: [
    '<DumbToaster>',
    '  {(t, dismiss) => (',
    '    <div class="dumb-toast card bg-base-100 p-3 shadow" data-kind={t.kind}>',
    '      <b>{t.title}</b>',
    '      <span>{t.text}</span>',
    '      <button class="btn btn-xs" onClick={dismiss}>',
    '        закрыть',
    '      </button>',
    '    </div>',
    '  )}',
    '</DumbToaster>',
  ].join('\n'),
}

/** язык там, где это не tsx */
export const langs = { install: "sh" }
