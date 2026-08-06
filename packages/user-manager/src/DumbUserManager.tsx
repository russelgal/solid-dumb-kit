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
// ОФОРМЛЕНИЕ — своё, инжектом, как у остальных пакетов кита. Раньше здесь стоял
// daisyUI (btn, input, select, table, alert, badge) с расчётом «экран живёт
// внутри приложения и обязан выглядеть его частью». Расчёт неверный: без
// daisyUI у потребителя тот же экран разваливается в голый HTML, а кит по
// правилу репы ни Tailwind, ни daisyUI не требует. Поэтому структурные стили —
// здесь, а вид настраивается двумя способами сразу:
//
//   1. CSS-переменные (--dumb-um-fg, --dumb-um-accent, --dumb-um-radius и
//      прочие) — перекрасить под тему, не трогая разметку;
//   2. проп `class` на корень плюс обычные селекторы по .dumb-um-* — если
//      захотелось положить сверху свой daisyUI, разметка этому не мешает:
//      таблица честная (thead/tbody), кнопки — button, поля — label > input.

import { For, Show, createSignal, type JSX } from 'solid-js'
import { injectStyle } from '@solid-dumb-kit/shared'
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

/**
 * Структурные стили. Цвета — переменными с контрастными фолбэками: вторичный
 * текст не светлее #475569 (7.5:1 к белому), потому что по правилу репы
 * приглушённое — это не выцветшее.
 */
const STYLES = `
  .dumb-um { display: flex; flex-direction: column; gap: 16px; font-size: 14px;
             color: var(--dumb-um-fg, #0f172a) }
  .dumb-um-title { margin: 0; font-size: 20px; font-weight: 700 }
  .dumb-um-card { padding: 14px; background: var(--dumb-um-bg, #fff);
                  border: 1px solid var(--dumb-um-line, rgb(0 0 0 / .14));
                  border-radius: var(--dumb-um-radius, 10px) }
  .dumb-um-card-title { margin: 0 0 10px; font-size: 15px; font-weight: 600 }

  .dumb-um-form { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px }
  .dumb-um-field { display: flex; flex-direction: column; gap: 3px; font-size: 12px;
                   color: var(--dumb-um-dim, #475569) }
  .dumb-um-input, .dumb-um-select {
    font: inherit; font-size: 13px; padding: 5px 8px; color: var(--dumb-um-fg, #0f172a);
    background: var(--dumb-um-bg, #fff);
    border: 1px solid var(--dumb-um-line, rgb(0 0 0 / .28));
    border-radius: calc(var(--dumb-um-radius, 10px) - 4px) }
  .dumb-um-input:focus-visible, .dumb-um-select:focus-visible,
  .dumb-um-btn:focus-visible { outline: 2px solid var(--dumb-um-accent, #2563eb);
                               outline-offset: 1px }
  .dumb-um-hint { margin: 8px 0 0; font-size: 12px; color: var(--dumb-um-dim, #475569) }

  .dumb-um-btn { font: inherit; font-size: 13px; padding: 5px 10px; cursor: pointer;
                 white-space: nowrap; color: var(--dumb-um-fg, #0f172a);
                 background: none; border: 1px solid transparent;
                 border-radius: calc(var(--dumb-um-radius, 10px) - 4px) }
  .dumb-um-btn:hover:not([disabled]) { background: var(--dumb-um-hover, rgb(0 0 0 / .07)) }
  .dumb-um-btn[disabled] { cursor: default; color: var(--dumb-um-off, #64748b) }
  .dumb-um-btn[data-kind="primary"] { color: #fff; font-weight: 600;
                                      background: var(--dumb-um-primary, #1e293b) }
  .dumb-um-btn[data-kind="primary"]:hover:not([disabled]) {
    background: var(--dumb-um-primary-hover, #0f172a) }
  .dumb-um-btn[data-kind="danger"] { color: var(--dumb-um-bad, #b91c1c) }
  .dumb-um-btn[data-kind="danger-solid"] { color: #fff; font-weight: 600;
                                           background: var(--dumb-um-bad, #b91c1c) }
  .dumb-um-btn[data-kind="ok"] { color: var(--dumb-um-ok, #15803d) }

  /* крутилка вместо подписи, пока идёт запрос: кнопка не должна менять ширину */
  .dumb-um-spin { display: inline-block; width: 13px; height: 13px; vertical-align: -2px;
                  border: 2px solid currentColor; border-right-color: transparent;
                  border-radius: 50%; animation: dumb-um-spin .7s linear infinite }
  @keyframes dumb-um-spin { to { rotate: 1turn } }
  @media (prefers-reduced-motion: reduce) { .dumb-um-spin { animation: none } }

  .dumb-um-alert { padding: 8px 12px; font-size: 13px;
                   border-radius: var(--dumb-um-radius, 10px);
                   border: 1px solid currentColor }
  .dumb-um-alert[data-kind="error"] { color: var(--dumb-um-bad, #b91c1c);
                                      background: var(--dumb-um-bad-bg, rgb(185 28 28 / .08)) }
  .dumb-um-alert[data-kind="ok"] { color: var(--dumb-um-ok, #15803d);
                                   background: var(--dumb-um-ok-bg, rgb(21 128 61 / .08)) }

  .dumb-um-table-box { overflow-x: auto; background: var(--dumb-um-bg, #fff);
                       border: 1px solid var(--dumb-um-line, rgb(0 0 0 / .14));
                       border-radius: var(--dumb-um-radius, 10px) }
  .dumb-um-table { width: 100%; border-collapse: collapse }
  .dumb-um-table th, .dumb-um-table td { padding: 8px 12px; text-align: left;
                                         vertical-align: top;
                                         border-bottom: 1px solid var(--dumb-um-line, rgb(0 0 0 / .12)) }
  .dumb-um-table tr:last-child td { border-bottom: 0 }
  .dumb-um-table th { font-size: 12px; font-weight: 600;
                      color: var(--dumb-um-dim, #475569) }
  .dumb-um-table th:last-child, .dumb-um-actions { text-align: right }
  /* Заблокированную строку помечаем ФОНОМ, а не прозрачностью: выцветший текст
     в ките запрещён, а прочитать строку всё равно надо — за что и заблокировали */
  .dumb-um-row[data-banned="1"] { background: var(--dumb-um-row-off, rgb(0 0 0 / .05)) }

  .dumb-um-name { font-weight: 500 }
  .dumb-um-mail, .dumb-um-date { font-size: 12px; color: var(--dumb-um-dim, #475569) }
  .dumb-um-date { white-space: nowrap }
  .dumb-um-badge { margin-left: 6px; padding: 1px 6px; font-size: 11px; font-weight: 500;
                   border-radius: 999px; color: var(--dumb-um-fg, #0f172a);
                   background: var(--dumb-um-hover, rgb(0 0 0 / .09)) }
  .dumb-um-state { font-size: 12px }
  .dumb-um-state[data-banned="1"] { color: var(--dumb-um-bad, #b91c1c); font-weight: 600 }
  .dumb-um-state[data-banned="0"] { color: var(--dumb-um-ok, #15803d) }
  .dumb-um-sessions { color: var(--dumb-um-dim, #475569) }
  .dumb-um-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px }
  .dumb-um-pw { display: flex; justify-content: flex-end; gap: 4px; margin-top: 8px }
`

export function DumbUserManager(props: DumbUserManagerProps): JSX.Element {
  injectStyle('user-manager', STYLES)

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
    <div class={'dumb-um' + (props.class ? ' ' + props.class : '')}>
      <Show when={(props.title ?? t('title')) !== ''}>
        <h1 class="dumb-um-title">{props.title ?? t('title')}</h1>
      </Show>

      <Show when={props.onCreate}>
        <div class="dumb-um-card">
          <h2 class="dumb-um-card-title">{t('createTitle')}</h2>
          <form class="dumb-um-form" onSubmit={create}>
            <label class="dumb-um-field">
              {t('name')}
              <input
                class="dumb-um-input"
                style={{ width: '11rem' }}
                value={name()}
                onInput={e => setName(e.currentTarget.value)}
                required
              />
            </label>
            <label class="dumb-um-field">
              {t('email')}
              <input
                class="dumb-um-input"
                style={{ width: '13rem' }}
                type="email"
                autocomplete="off"
                value={email()}
                onInput={e => setEmail(e.currentTarget.value)}
                required
              />
            </label>
            <label class="dumb-um-field" title={t('passwordEmpty')}>
              {t('password')}
              <input
                class="dumb-um-input"
                style={{ width: '12rem' }}
                type="text"
                autocomplete="off"
                placeholder={t('passwordEmpty')}
                value={password()}
                onInput={e => setPassword(e.currentTarget.value)}
              />
            </label>
            <Show when={roles().length > 0}>
              <select
                class="dumb-um-select"
                style={{ width: '10rem' }}
                value={role()}
                onChange={e => setRole(e.currentTarget.value)}
              >
                <For each={roles()}>{r => <option value={r.value}>{r.label}</option>}</For>
              </select>
            </Show>
            <button class="dumb-um-btn" data-kind="primary" disabled={busy() === 'create'}>
              <Show when={busy() === 'create'} fallback={t('submit')}>
                <span class="dumb-um-spin" />
              </Show>
            </button>
          </form>
          <Show when={rolesHint()}>
            {/* подсказку про роли читают, а не проглядывают: без приглушения */}
            <p class="dumb-um-hint">{rolesHint()}</p>
          </Show>
        </div>
      </Show>

      <Show when={error()}>
        <div role="alert" class="dumb-um-alert" data-kind="error">
          {error()}
        </div>
      </Show>
      <Show when={notice()}>
        <div role="alert" class="dumb-um-alert" data-kind="ok">
          {notice()}
        </div>
      </Show>

      <div class="dumb-um-table-box">
        <table class="dumb-um-table">
          <thead>
            <tr>
              <th>{t('colUser')}</th>
              <th>{t('colRole')}</th>
              <th>{t('colAccess')}</th>
              <th>{t('colCreated')}</th>
              <th>{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            <For each={props.users}>
              {u => (
                <tr class="dumb-um-row" data-banned={u.banned ? '1' : undefined}>
                  <td>
                    <div class="dumb-um-name">
                      {u.name}
                      <Show when={isSelf(u.id)}>
                        <span class="dumb-um-badge">{t('you')}</span>
                      </Show>
                      <Show when={u.isOwner}>
                        <span class="dumb-um-badge" title={t('ownerHint')}>
                          {t('owner')}
                        </span>
                      </Show>
                    </div>
                    <div class="dumb-um-mail">{u.email}</div>
                  </td>

                  <td>
                    <Show
                      when={props.onSetRole && roles().length > 0}
                      fallback={roles().find(r => r.value === u.role)?.label ?? u.role}
                    >
                      <select
                        class="dumb-um-select"
                        style={{ width: '9rem' }}
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
                        <span class="dumb-um-state" data-banned="0">
                          {t('active')}
                          <Show when={u.sessions !== undefined && u.sessions > 0}>
                            <span class="dumb-um-sessions">
                              {' · ' + t('sessions') + ': ' + u.sessions}
                            </span>
                          </Show>
                        </span>
                      }
                    >
                      <span class="dumb-um-state" data-banned="1" title={u.banReason ?? ''}>
                        {t('banned')}
                      </span>
                    </Show>
                  </td>

                  <td class="dumb-um-date">{fmt(u.createdAt)}</td>

                  <td>
                    <div class="dumb-um-actions">
                      <Show when={props.onSetPassword}>
                        <button
                          class="dumb-um-btn"
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
                              class="dumb-um-btn"
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
                            class="dumb-um-btn"
                            data-kind="ok"
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
                          class="dumb-um-btn"
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
                              class="dumb-um-btn"
                              data-kind="danger"
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
                            class="dumb-um-btn"
                            data-kind="danger-solid"
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
                          <button class="dumb-um-btn" onClick={() => setConfirmRemove(null)}>
                            {t('cancel')}
                          </button>
                        </Show>
                      </Show>
                    </div>

                    <Show when={pwFor() === u.id}>
                      <form
                        class="dumb-um-pw"
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
                          class="dumb-um-input"
                          style={{ width: '11rem' }}
                          value={pwValue()}
                          onInput={e => setPwValue(e.currentTarget.value)}
                          autocomplete="off"
                        />
                        <button
                          class="dumb-um-btn"
                          data-kind="primary"
                          disabled={busy() === 'pw:' + u.id}
                        >
                          {t('apply')}
                        </button>
                        <button type="button" class="dumb-um-btn" onClick={() => setPwFor(null)}>
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
