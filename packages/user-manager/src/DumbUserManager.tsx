// Управление пользователями: выдать доступ, сменить роль, заблокировать,
// задать пароль, выкинуть из сессий, удалить.
//
// Компонент НЕ знает, кто там за ним — better-auth, свой эндпоинт или мок в
// тесте. Всё общение через колбэки, и каждый из них необязателен: не передал
// `onRemove` — кнопки «Удалить» просто нет. Так один и тот же экран годится и
// администратору, и тому, кому можно только посмотреть список.
//
// Что компонент решает сам, а не спрашивает:
//
// 1. ПАРОЛЬ ПОКАЗЫВАЕТСЯ ОДИН РАЗ. Заведение и смена пароля возвращают его в
//    зелёной плашке — второй раз достать неоткуда, так и написано. Пустое поле
//    пароля означает «сгенерируй сам» (см. `password.ts`).
// 2. ВЛАДЕЛЬЦА НЕ ТРОГАЕМ. `isOwner` гасит кнопки на клиенте — не как защиту
//    (она на сервере), а чтобы не предлагать заведомо отказное действие.
// 3. СЕБЯ НЕ БЛОКИРУЕМ И НЕ УДАЛЯЕМ. То же самое: сервер откажет, значит и
//    кнопка неактивна, с подсказкой почему.
// 4. УДАЛЕНИЕ В ДВА КЛИКА. Не `confirm()`: браузерное окно блокирует всё, а
//    вторая кнопка рядом со строкой и понятнее, и отменяется мимо-кликом.
//
// Ошибка от сервера показывается КАК ЕСТЬ: текст пишет тот, кто знает, что
// именно не сошлось, а придуманное «Что-то пошло не так» помогает только тем,
// кто и так догадался.
//
// ОФОРМЛЕНИЕ — daisyUI: btn, input, select, table, alert, badge. Своего CSS у
// пакета нет вовсе — это экран администратора, он живёт внутри приложения и
// обязан выглядеть его частью, а не гостем в чужой теме. Тему, скругления и
// цвета задаёт потребитель через свой daisyUI, менять здесь нечего.

import { For, Show, createSignal, type JSX } from 'solid-js'
import { suggestPassword } from './password'

export type UserRow = {
  id: string
  name: string
  email: string
  role: string
  banned: boolean
  banReason?: string | null
  createdAt: string
  /** владелец системы: любые действия над ним запрещены сервером */
  isOwner?: boolean
  /** число активных сессий; undefined — не считаем */
  sessions?: number
}

export type RoleOption = {
  value: string
  label: string
  /** одной строкой: что роль позволяет; собирается в подсказку под формой */
  hint?: string
}

/** Все тексты — снаружи. Дефолты русские, как и везде в ките. */
export type UserManagerLabels = {
  title?: string
  createTitle?: string
  name?: string
  email?: string
  password?: string
  /** подсказка у поля пароля: что будет, если оставить пустым */
  passwordEmpty?: string
  submit?: string

  colUser?: string
  colRole?: string
  colAccess?: string
  colCreated?: string
  colActions?: string

  you?: string
  owner?: string
  ownerHint?: string
  active?: string
  sessions?: string
  banned?: string

  setPassword?: string
  setPasswordHint?: string
  ownerPasswordHint?: string
  apply?: string
  cancel?: string

  ban?: string
  banHint?: string
  banSelfHint?: string
  banOwnerHint?: string
  unban?: string
  revoke?: string
  revokeHint?: string

  remove?: string
  removeHint?: string
  removeSelfHint?: string
  removeOwnerHint?: string
  removeConfirm?: string

  /** сорвалось, а сервер не сказал почему */
  failed?: string
  bannedOk?: string
  unbannedOk?: string
  revokedOk?: string
  removedOk?: string
  /** пароль нового сотрудника: показывается ровно один раз */
  createdOk?: (password: string) => string
  passwordSetOk?: (user: UserRow, password: string) => string
}

export type DumbUserManagerProps = {
  users: Array<UserRow>
  /** словарь ролей; пусто — роль показывается текстом, без выбора */
  roles?: Array<RoleOption>

  /** id текущего пользователя: себе нельзя блокировку и удаление */
  currentUserId?: string
  /** значение роли по умолчанию в форме создания */
  defaultRole?: string

  /** не задан — формы «выдать доступ» нет */
  onCreate?: (input: { name: string; email: string; password: string; role: string }) => Promise<void>
  /** не задан — роль показывается текстом */
  onSetRole?: (userId: string, role: string) => Promise<void>
  onSetPassword?: (userId: string, password: string) => Promise<void>
  onBan?: (userId: string, reason: string) => Promise<void>
  onUnban?: (userId: string) => Promise<void>
  onRevokeSessions?: (userId: string) => Promise<void>
  onRemove?: (userId: string) => Promise<void>

  /** форматирование даты создания; по умолчанию — как пришло */
  formatDate?: (iso: string) => string
  /** заголовок; пустая строка — без заголовка */
  title?: string
  labels?: UserManagerLabels

  /** дополнительные классы на корень: отступы и ширину задаёт потребитель */
  class?: string
}

/**
 * Дефолтные тексты. Вынесены за функцию, чтобы не пересобирались на каждый
 * рендер, и типизированы через `Required<UserManagerLabels>` — иначе ключ,
 * добавленный в тип и забытый здесь, всплыл бы у потребителя пустой строкой.
 */
const RU: Required<UserManagerLabels> = {
  title: 'Пользователи',
  createTitle: 'Выдать доступ',
  name: 'Имя',
  email: 'Почта',
  password: 'Пароль',
  passwordEmpty: 'Оставьте пустым — сгенерируем',
  submit: 'Завести',

  colUser: 'Сотрудник',
  colRole: 'Роль',
  colAccess: 'Доступ',
  colCreated: 'Заведён',
  colActions: 'Действия',

  you: 'это вы',
  owner: 'владелец',
  ownerHint: 'Владелец системы: защищён от изменений',
  active: 'активен',
  sessions: 'сессий',
  banned: 'заблокирован',

  setPassword: 'Пароль',
  setPasswordHint: 'Задать новый пароль',
  ownerPasswordHint: 'Пароль владельца меняется только им самим',
  apply: 'Задать',
  cancel: 'Отмена',

  ban: 'Заблокировать',
  banHint: 'Приостановить доступ',
  banSelfHint: 'Себя блокировать нельзя',
  banOwnerHint: 'Владельца системы блокировать нельзя',
  unban: 'Разблокировать',
  revoke: 'Выкинуть',
  revokeHint: 'Завершить все сессии — придётся войти заново',

  remove: 'Удалить',
  removeHint: 'Удалить пользователя',
  removeSelfHint: 'Себя удалить нельзя',
  removeOwnerHint: 'Владельца системы удалить нельзя',
  removeConfirm: 'Точно удалить',

  failed: 'Не получилось',
  bannedOk: 'Доступ приостановлен',
  unbannedOk: 'Доступ вернули',
  revokedOk: 'Сессии завершены',
  removedOk: 'Пользователь удалён',
  createdOk: (pass: string) =>
    'Доступ выдан. Пароль: ' + pass + ' — передайте человеку, второй раз он не покажется.',
  passwordSetOk: (user: UserRow, pass: string) =>
    'Новый пароль для ' + user.name + ': ' + pass,
}

export function DumbUserManager(props: DumbUserManagerProps): JSX.Element {
  /** текст по ключу: сперва то, что дал потребитель, иначе русский дефолт */
  const t = <K extends keyof UserManagerLabels>(key: K): Required<UserManagerLabels>[K] =>
    (props.labels?.[key] ?? RU[key]) as Required<UserManagerLabels>[K]

  const [name, setName] = createSignal('')
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [role, setRole] = createSignal(props.defaultRole ?? props.roles?.[0]?.value ?? '')
  const [error, setError] = createSignal('')
  const [notice, setNotice] = createSignal('')
  /** ключ действия, которое сейчас идёт: по нему гасится ровно одна кнопка */
  const [busy, setBusy] = createSignal('')
  /** какая строка сейчас в режиме смены пароля */
  const [pwFor, setPwFor] = createSignal<string | null>(null)
  const [pwValue, setPwValue] = createSignal('')
  /** какая строка ждёт подтверждения удаления */
  const [confirmRemove, setConfirmRemove] = createSignal<string | null>(null)

  const roles = () => props.roles ?? []
  const fmt = (iso: string) => (props.formatDate ? props.formatDate(iso) : iso)
  const isSelf = (id: string) => id === props.currentUserId
  /** владельца не трогаем: сервер всё равно откажет, поэтому и кнопки гасим */
  const locked = (u: UserRow) => Boolean(u.isOwner)

  /** Общая обвязка: гасим кнопку, показываем ошибку сервера как есть */
  const run = async (key: string, fn: () => Promise<void>, ok?: string) => {
    setError('')
    setNotice('')
    setBusy(key)
    try {
      await fn()
      if (ok) setNotice(ok)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('failed'))
    } finally {
      setBusy('')
    }
  }

  const create = (e: SubmitEvent) => {
    e.preventDefault()
    const onCreate = props.onCreate
    if (!onCreate) return
    // пустое поле пароля читается как «придумай сам», а не как «пароль пустой»
    const pass = password() || suggestPassword()
    void run(
      'create',
      async () => {
        await onCreate({ name: name().trim(), email: email().trim(), password: pass, role: role() })
        setName('')
        setEmail('')
        setPassword('')
      },
      t('createdOk')(pass),
    )
  }

  const rolesHint = () =>
    roles()
      .map(r => r.label + ' — ' + (r.hint ?? ''))
      .filter(s => s.trim().length > 2)
      .join(' · ')

  return (
    <div class={'flex flex-col gap-4' + (props.class ? ' ' + props.class : '')}>
      <Show when={(props.title ?? t('title')) !== ''}>
        <h1 class="text-xl font-bold">{props.title ?? t('title')}</h1>
      </Show>

      <Show when={props.onCreate}>
        <div class="bg-base-100 rounded-box border-base-300 border p-4 shadow-sm">
          <h2 class="mb-3 font-semibold">{t('createTitle')}</h2>
          <form class="flex flex-wrap items-end gap-2" onSubmit={create}>
            <label class="input input-sm w-48">
              <span class="label">{t('name')}</span>
              <input value={name()} onInput={e => setName(e.currentTarget.value)} required />
            </label>
            <label class="input input-sm w-56">
              <span class="label">{t('email')}</span>
              <input
                type="email"
                autocomplete="off"
                value={email()}
                onInput={e => setEmail(e.currentTarget.value)}
                required
              />
            </label>
            <label class="input input-sm w-52" title={t('passwordEmpty')}>
              <span class="label">{t('password')}</span>
              <input
                type="text"
                autocomplete="off"
                placeholder={t('passwordEmpty')}
                value={password()}
                onInput={e => setPassword(e.currentTarget.value)}
              />
            </label>
            <Show when={roles().length > 0}>
              <select
                class="select select-sm w-44"
                value={role()}
                onChange={e => setRole(e.currentTarget.value)}
              >
                <For each={roles()}>{r => <option value={r.value}>{r.label}</option>}</For>
              </select>
            </Show>
            <button class="btn btn-sm btn-neutral" disabled={busy() === 'create'}>
              <Show when={busy() === 'create'} fallback={t('submit')}>
                <span class="loading loading-spinner loading-sm" />
              </Show>
            </button>
          </form>
          <Show when={rolesHint()}>
            {/* подсказку про роли читают, а не проглядывают: без приглушения */}
            <p class="text-base-content mt-2 text-xs">{rolesHint()}</p>
          </Show>
        </div>
      </Show>

      <Show when={error()}>
        <div role="alert" class="alert alert-error py-2 text-sm">
          {error()}
        </div>
      </Show>
      <Show when={notice()}>
        <div role="alert" class="alert alert-success py-2 text-sm">
          {notice()}
        </div>
      </Show>

      <div class="bg-base-100 rounded-box border-base-300 overflow-x-auto border shadow-sm">
        <table class="table">
          <thead>
            <tr>
              <th>{t('colUser')}</th>
              <th>{t('colRole')}</th>
              <th>{t('colAccess')}</th>
              <th>{t('colCreated')}</th>
              <th class="text-right">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            <For each={props.users}>
              {u => (
                // заблокированную строку помечаем фоном, а не прозрачностью:
                // выцветший текст в ките запрещён, а прочитать его всё равно надо
                <tr class={u.banned ? 'bg-base-200' : ''}>
                  <td>
                    <div class="font-medium">
                      {u.name}
                      <Show when={isSelf(u.id)}>
                        <span class="badge badge-ghost badge-sm ml-2">{t('you')}</span>
                      </Show>
                      <Show when={u.isOwner}>
                        <span class="badge badge-neutral badge-sm ml-2" title={t('ownerHint')}>
                          {t('owner')}
                        </span>
                      </Show>
                    </div>
                    <div class="text-base-content text-xs">{u.email}</div>
                  </td>

                  <td>
                    <Show
                      when={props.onSetRole && roles().length > 0}
                      fallback={roles().find(r => r.value === u.role)?.label ?? u.role}
                    >
                      <select
                        class="select select-sm w-36"
                        value={u.role}
                        disabled={busy() === 'role:' + u.id || locked(u)}
                        onChange={e =>
                          void run('role:' + u.id, () => props.onSetRole!(u.id, e.currentTarget.value))
                        }
                      >
                        <For each={roles()}>{r => <option value={r.value}>{r.label}</option>}</For>
                      </select>
                    </Show>
                  </td>

                  <td>
                    <Show
                      when={u.banned}
                      fallback={
                        <span class="text-success text-xs">
                          {t('active')}
                          <Show when={u.sessions !== undefined && u.sessions > 0}>
                            <span class="text-base-content">
                              {' · ' + t('sessions') + ': ' + u.sessions}
                            </span>
                          </Show>
                        </span>
                      }
                    >
                      <span class="text-error text-xs" title={u.banReason ?? ''}>
                        {t('banned')}
                      </span>
                    </Show>
                  </td>

                  <td class="text-base-content text-sm whitespace-nowrap">{fmt(u.createdAt)}</td>

                  <td>
                    <div class="flex flex-wrap justify-end gap-1">
                      <Show when={props.onSetPassword}>
                        <button
                          class="btn btn-sm btn-ghost"
                          disabled={locked(u)}
                          title={locked(u) ? t('ownerPasswordHint') : t('setPasswordHint')}
                          onClick={() => {
                            setPwFor(pwFor() === u.id ? null : u.id)
                            setPwValue(suggestPassword())
                          }}
                        >
                          {t('setPassword')}
                        </button>
                      </Show>

                      <Show when={u.banned ? props.onUnban : props.onBan}>
                        <Show
                          when={u.banned}
                          fallback={
                            <button
                              class="btn btn-sm btn-ghost"
                              disabled={isSelf(u.id) || locked(u) || busy() === 'ban:' + u.id}
                              title={
                                locked(u)
                                  ? t('banOwnerHint')
                                  : isSelf(u.id)
                                    ? t('banSelfHint')
                                    : t('banHint')
                              }
                              onClick={() =>
                                void run('ban:' + u.id, () => props.onBan!(u.id, ''), t('bannedOk'))
                              }
                            >
                              {t('ban')}
                            </button>
                          }
                        >
                          <button
                            class="btn btn-sm btn-ghost text-success"
                            disabled={busy() === 'unban:' + u.id}
                            onClick={() =>
                              void run('unban:' + u.id, () => props.onUnban!(u.id), t('unbannedOk'))
                            }
                          >
                            {t('unban')}
                          </button>
                        </Show>
                      </Show>

                      <Show when={props.onRevokeSessions}>
                        <button
                          class="btn btn-sm btn-ghost"
                          disabled={busy() === 'revoke:' + u.id || u.sessions === 0 || locked(u)}
                          title={t('revokeHint')}
                          onClick={() =>
                            void run(
                              'revoke:' + u.id,
                              () => props.onRevokeSessions!(u.id),
                              t('revokedOk'),
                            )
                          }
                        >
                          {t('revoke')}
                        </button>
                      </Show>

                      <Show when={props.onRemove}>
                        <Show
                          when={confirmRemove() === u.id}
                          fallback={
                            <button
                              class="btn btn-sm btn-ghost text-error"
                              disabled={isSelf(u.id) || locked(u)}
                              title={
                                locked(u)
                                  ? t('removeOwnerHint')
                                  : isSelf(u.id)
                                    ? t('removeSelfHint')
                                    : t('removeHint')
                              }
                              onClick={() => setConfirmRemove(u.id)}
                            >
                              {t('remove')}
                            </button>
                          }
                        >
                          <button
                            class="btn btn-sm btn-error"
                            disabled={busy() === 'remove:' + u.id}
                            onClick={() =>
                              void run(
                                'remove:' + u.id,
                                async () => {
                                  await props.onRemove!(u.id)
                                  setConfirmRemove(null)
                                },
                                t('removedOk'),
                              )
                            }
                          >
                            {t('removeConfirm')}
                          </button>
                          <button class="btn btn-sm btn-ghost" onClick={() => setConfirmRemove(null)}>
                            {t('cancel')}
                          </button>
                        </Show>
                      </Show>
                    </div>

                    <Show when={pwFor() === u.id}>
                      <form
                        class="mt-2 flex justify-end gap-1"
                        onSubmit={e => {
                          e.preventDefault()
                          const value = pwValue()
                          void run(
                            'pw:' + u.id,
                            async () => {
                              await props.onSetPassword!(u.id, value)
                              setPwFor(null)
                            },
                            t('passwordSetOk')(u, value),
                          )
                        }}
                      >
                        <input
                          class="input input-sm w-44"
                          value={pwValue()}
                          onInput={e => setPwValue(e.currentTarget.value)}
                          autocomplete="off"
                        />
                        <button class="btn btn-sm btn-neutral" disabled={busy() === 'pw:' + u.id}>
                          {t('apply')}
                        </button>
                        <button type="button" class="btn btn-sm btn-ghost" onClick={() => setPwFor(null)}>
                          {t('cancel')}
                        </button>
                      </form>
                    </Show>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  )
}
