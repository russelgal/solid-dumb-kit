// DumbUserManager — выдать доступ, снять доступ, не выстрелить себе в ногу.
//
// Экран, который в каждом проекте пишут заново и одинаково: список сотрудников,
// форма «завести», роли, блокировка, пароль, сессии, удаление. Компонент не
// знает ни про какой бэкенд — здесь за него отвечает игрушечный «сервер» ниже:
// он держит список в сигнале, отвечает с задержкой и, как настоящий, отказывает
// в том, чего делать нельзя.
//
// Смотреть стоит на три вещи:
//
// 1. ПАРОЛЬ ПОКАЗЫВАЕТСЯ ОДИН РАЗ — зелёной плашкой после «Завести» или после
//    смены. Оставьте поле пароля пустым, и он сгенерируется читаемым.
// 2. ВЛАДЕЛЕЦ И ВЫ САМИ защищены: кнопки погашены, а в подсказке написано
//    почему. Отказ сервера (переключатель ниже) показывается его же текстом.
// 3. КОЛБЭКИ НЕОБЯЗАТЕЛЬНЫ: снимите «можно править» — и останется просто
//    список, без единой кнопки. Это не отдельный режим, а отсутствие пропсов.
import { createSignal } from 'solid-js'
import { DumbUserManager, type UserRow } from '@solid-dumb-kit/user-manager'
import { Bar, Check, Note, Code, Doc, Props } from '../_controls'
// Сниппеты доки живут отдельным файлом: их подсвечивает Shiki на сборке, и
// сюда приезжает уже готовая разметка (playground/snippets.ts).
import SNIP from './DumbUserManager.snippets'

const UM_PROPS = [
  { name: 'users', type: 'UserRow[]', about: 'Кого показывать. Данные тянет приложение — панель ничего не грузит сама.' },
  { name: 'roles', type: 'RoleOption[]', about: 'Словарь ролей. Пусто — роль показывается текстом, без выбора.' },
  { name: 'currentUserId', type: 'string', about: 'Кто смотрит: себе нельзя блокировку и удаление.' },
  { name: 'defaultRole', type: 'string', about: 'Роль по умолчанию в форме создания.' },
  { name: 'onCreate', type: '({ name, email, password, role }) => Promise', about: 'Не задан — формы «выдать доступ» нет.' },
  { name: 'onSetRole', type: '(userId, role) => Promise', about: 'Не задан — роль показывается текстом.' },
  { name: 'onSetPassword', type: '(userId, password) => Promise', about: 'Смена пароля администратором.' },
  { name: 'onBan / onUnban', type: '(userId, reason?) => Promise', about: 'Блокировка с причиной и разблокировка.' },
  { name: 'onRevokeSessions', type: '(userId) => Promise', about: 'Разлогинить везде.' },
  { name: 'onRemove', type: '(userId) => Promise', about: 'Удаление учётной записи.' },
  { name: 'formatDate', type: '(iso: string) => string', def: 'как пришло', about: 'Формат даты создания.' },
  { name: 'title / labels', type: 'string / UserManagerLabels', about: 'Заголовок и тексты кнопок — панель встраивается в чужой экран.' },
  { name: 'class', type: 'string', about: 'Отступы и ширину задаёт потребитель.' },
]

const ROLES = [
  { value: 'admin', label: 'Админ', hint: 'всё, включая пользователей' },
  { value: 'manager', label: 'Менеджер', hint: 'брони и клиенты' },
  { value: 'viewer', label: 'Наблюдатель', hint: 'только смотрит' },
]

const SEED: Array<UserRow> = [
  { id: 'u0', name: 'Ирина Соколова', email: 'irina@example.com', role: 'admin', banned: false, createdAt: '2025-11-02', isOwner: true, sessions: 2 },
  { id: 'u1', name: 'Пётр Гаврилов', email: 'petr@example.com', role: 'manager', banned: false, createdAt: '2026-01-17', sessions: 1 },
  { id: 'u2', name: 'Аня Ким', email: 'anya@example.com', role: 'manager', banned: false, createdAt: '2026-03-04', sessions: 0 },
  { id: 'u3', name: 'Сергей Дуб', email: 'sergey@example.com', role: 'viewer', banned: true, banReason: 'уволился, доступ приостановлен', createdAt: '2025-12-20', sessions: 0 },
]

/** «сеть»: без задержки не видно, что кнопки гаснут на время запроса */
const wait = (ms = 450) => new Promise<void>((done) => setTimeout(done, ms))

export default function DumbUserManagerExample() {
  const [users, setUsers] = createSignal<Array<UserRow>>(SEED)
  const [editable, setEditable] = createSignal(true)
  /** сервер капризничает: показать, как выглядит его отказ */
  const [failing, setFailing] = createSignal(false)

  /** я — Пётр: на своей строке видно «это вы» и погашенные блокировку с удалением */
  const me = 'u1'

  const patch = (id: string, next: Partial<UserRow>) =>
    setUsers((list) => list.map((u) => (u.id === id ? { ...u, ...next } : u)))

  /** общая часть каждого «запроса»: задержка и, по желанию, отказ с текстом */
  const call = async (what: string) => {
    await wait()
    if (failing()) throw new Error(what + ': сервер отказал — недостаточно прав')
  }

  const edit = {
    onCreate: async (input: { name: string; email: string; password: string; role: string }) => {
      await call('Создание')
      if (users().some((u) => u.email === input.email)) {
        throw new Error('Такая почта уже заведена: ' + input.email)
      }
      setUsers((list) => [
        ...list,
        {
          id: 'u' + list.length + Math.floor(performance.now()),
          name: input.name,
          email: input.email,
          role: input.role,
          banned: false,
          createdAt: new Date().toISOString().slice(0, 10),
          sessions: 0,
        },
      ])
    },
    onSetRole: async (id: string, role: string) => {
      await call('Смена роли')
      patch(id, { role })
    },
    onSetPassword: async (id: string, _password: string) => {
      await call('Смена пароля')
      // сессии рвутся вместе с паролем — как у настоящего better-auth
      patch(id, { sessions: 0 })
    },
    onBan: async (id: string, reason: string) => {
      await call('Блокировка')
      patch(id, { banned: true, banReason: reason || 'без причины', sessions: 0 })
    },
    onUnban: async (id: string) => {
      await call('Разблокировка')
      patch(id, { banned: false, banReason: null })
    },
    onRevokeSessions: async (id: string) => {
      await call('Завершение сессий')
      patch(id, { sessions: 0 })
    },
    onRemove: async (id: string) => {
      await call('Удаление')
      setUsers((list) => list.filter((u) => u.id !== id))
    },
  }

  return (
    <div class="p-5 text-base-content">
      <h3 class="mb-1 text-lg font-semibold">DumbUserManager — доступ сотрудников</h3>
      <p class="mb-3 max-w-[92ch] text-sm text-base-content">
        Список, форма выдачи доступа, роли, блокировка, пароль, сессии, удаление в два клика.
        Компонент говорит с приложением только колбэками, поэтому одинаково садится и на
        better-auth, и на свой эндпоинт. Оформление — <b>daisyUI</b>: экран берёт тему приложения
        как есть, своего CSS у пакета нет.
      </p>

      <Bar>
        <Check checked={editable()} onChange={setEditable}>можно править</Check>
        <Check checked={failing()} onChange={setFailing}>сервер отказывает</Check>
      </Bar>

      <Note>
        Вы вошли как <b>Пётр Гаврилов</b>: на своей строке блокировка и удаление погашены. Ирина —
        владелец, её не тронуть вовсе. Пароль в форме можно не вводить — сгенерируется читаемый и
        покажется один раз.
      </Note>

      <div class="mt-4 max-w-[110ch]">
        <DumbUserManager
          users={users()}
          roles={ROLES}
          currentUserId={me}
          defaultRole="manager"
          formatDate={(iso) => new Date(iso).toLocaleDateString('ru-RU')}
          // колбэки передаются поимённо, а не спредом: снятый флаг должен
          // убирать кнопки на месте, а спред из тернарника читается хуже
          onCreate={editable() ? edit.onCreate : undefined}
          onSetRole={editable() ? edit.onSetRole : undefined}
          onSetPassword={editable() ? edit.onSetPassword : undefined}
          onBan={editable() ? edit.onBan : undefined}
          onUnban={editable() ? edit.onUnban : undefined}
          onRevokeSessions={editable() ? edit.onRevokeSessions : undefined}
          onRemove={editable() ? edit.onRemove : undefined}
        />
      </div>

      <hr class="my-6 border-base-300" />

      <h4 class="text-lg font-semibold">Как это подключить</h4>
      <p class="mt-1 max-w-[92ch] text-sm">
        Пакет ставится отдельно от остального кита — потребитель берёт только то, что взял.
      </p>
      <Code title="Установка" code={SNIP.install} />

      <Doc title="Список и роли">
        <p>
          Панель ничего не грузит и никуда не ходит: данные приходят пропом, действия уходят
          обработчиками. Поэтому она одинаково работает и с REST, и с GraphQL, и с чем угодно ещё —
          а <code>currentUserId</code> нужен ровно для одного: не дать заблокировать себя.
        </p>
      </Doc>
      <Code title="Пользователи" code={SNIP.basic} />

      <Doc title="Возможности — по обработчикам">
        <p>
          Кнопка появляется тогда и только тогда, когда задан её обработчик. Так панель не обещает
          того, чего приложение не умеет: нет <code>onRemove</code> — нет и удаления, и объяснять
          пользователю, почему кнопка не работает, не приходится.
        </p>
      </Doc>
      <Code title="Все действия" code={SNIP.actions} />

      <Doc title="Тексты и оформление">
        <p>
          Заголовок, подписи и формат даты задаются снаружи. Разметка — daisyUI, поэтому панель
          выглядит частью приложения, а не гостем: тема, размеры и цвета берутся из него.
        </p>
      </Doc>
      <Code title="Подписи и класс" code={SNIP.look} />

      <h4 class="mt-6 text-lg font-semibold">DumbUserManager</h4>
      <Props rows={UM_PROPS} />

    </div>
  )
}
