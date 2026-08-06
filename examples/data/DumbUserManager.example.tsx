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
import { Bar, Check, Note } from '../_controls'

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
    </div>
  )
}
