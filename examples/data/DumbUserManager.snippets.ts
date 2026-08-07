// Сниппеты доки к примеру DumbUserManager.
//
// Отдельный файл, потому что подсветка считается НА СБОРКЕ: плагин
// playground/snippets.ts выполняет этот модуль в Node, гонит каждую строку
// через Shiki и подменяет экспорт на { code, html }. Отсюда два требования: в
// файле только строки и ни одного импорта.
export default {
  install: 'pnpm add @solid-dumb-kit/user-manager',

  basic: [
    "import { DumbUserManager, type UserRow } from '@solid-dumb-kit/user-manager'",
    '',
    'const [users, setUsers] = createSignal<UserRow[]>([])',
    '',
    '<DumbUserManager',
    '  users={users()}',
    "  roles={[",
    "    { value: 'admin', label: 'Администратор' },",
    "    { value: 'manager', label: 'Менеджер' },",
    '  ]}',
    '  // себе нельзя блокировку и удаление — панель об этом знает',
    '  currentUserId={me().id}',
    '  onSetRole={(id, role) => api.setRole(id, role)}',
    '/>',
  ].join('\n'),

  actions: [
    '// Каждое действие включается своим обработчиком. Не задан — кнопки нет:',
    '// панель не показывает того, чего приложение не умеет.',
    '<DumbUserManager',
    '  users={users()}',
    '  roles={ROLES}',
    '  currentUserId={me().id}',
    '  defaultRole="manager"',
    '  onCreate={async ({ name, email, password, role }) => {',
    '    await api.invite({ name, email, password, role })',
    '    await reload()',
    '  }}',
    '  onSetPassword={(id, password) => api.setPassword(id, password)}',
    '  onBan={(id, reason) => api.ban(id, reason)}',
    '  onUnban={(id) => api.unban(id)}',
    '  onRevokeSessions={(id) => api.revoke(id)}',
    '  onRemove={(id) => api.remove(id)}',
    '/>',
  ].join('\n'),

  look: [
    '// Заголовок, тексты и формат даты — снаружи: панель встраивается в чужой',
    '// экран и не должна спорить с ним ни языком, ни оформлением.',
    '<DumbUserManager',
    '  users={users()}',
    '  title="Сотрудники"',
    "  formatDate={(iso) => new Intl.DateTimeFormat('ru').format(new Date(iso))}",
    '  labels={{ create: "Выдать доступ", ban: "Заблокировать" }}',
    '  class="max-w-4xl"',
    '/>',
  ].join('\n'),
}

/** язык там, где это не tsx */
export const langs = { install: 'sh' }
