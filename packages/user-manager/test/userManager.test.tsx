// DumbUserManager: что показано, какие кнопки есть и когда они гаснут.
//
// Вся ценность экрана — в правилах «чего делать нельзя»: себя не заблокировать,
// владельца не тронуть, удалить только вторым кликом. Их и проверяем; за ними
// стоят колбэки, поэтому мок-колбэк заодно показывает, что именно уходит
// наружу.

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render } from 'solid-js/web'
import { DumbUserManager, suggestPassword, type UserRow } from '../src'

let host: HTMLDivElement
let dispose: (() => void) | null = null

afterEach(() => {
  dispose?.()
  dispose = null
  host?.remove()
})

const USERS: Array<UserRow> = [
  { id: 'u1', name: 'Аня', email: 'anya@x.ru', role: 'admin', banned: false, createdAt: '2026-01-01', sessions: 2 },
  { id: 'u2', name: 'Боря', email: 'borya@x.ru', role: 'staff', banned: true, createdAt: '2026-02-01', banReason: 'ушёл' },
  { id: 'u3', name: 'Влад', email: 'vlad@x.ru', role: 'admin', banned: false, createdAt: '2026-03-01', isOwner: true },
]

type Props = Parameters<typeof DumbUserManager>[0]

function mount(extra: Partial<Props> = {}) {
  host = document.createElement('div')
  document.body.appendChild(host)
  dispose = render(() => <DumbUserManager users={USERS} {...extra} />, host)
}

const rows = () => Array.from(host.querySelectorAll<HTMLElement>('.dumb-um-row'))
const rowOf = (name: string) =>
  rows().find((r) => r.querySelector('.dumb-um-name')?.textContent?.startsWith(name))!
const buttonsIn = (row: HTMLElement) =>
  Array.from(row.querySelectorAll<HTMLButtonElement>('.dumb-um-btn'))
const buttonBy = (row: HTMLElement, text: string) =>
  buttonsIn(row).find((b) => b.textContent?.trim() === text)
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('таблица', () => {
  it('показывает всех и их почту', () => {
    mount()
    expect(rows()).toHaveLength(3)
    expect(rowOf('Аня').textContent).toContain('anya@x.ru')
  })

  it('заблокированную строку метит фоном, а не выцветанием', () => {
    mount()
    expect(rowOf('Боря').dataset.banned).toBe('1')
    expect(rowOf('Аня').dataset.banned).toBeUndefined()
    // причина блокировки не выброшена: она в подсказке
    expect(rowOf('Боря').querySelector('.dumb-um-state')?.getAttribute('title')).toBe('ушёл')
  })

  it('без колбэков кнопок действий нет вовсе', () => {
    mount()
    expect(buttonsIn(rowOf('Аня'))).toHaveLength(0)
  })

  it('форма «выдать доступ» появляется только с onCreate', () => {
    mount()
    expect(host.querySelector('.dumb-um-form')).toBeNull()

    dispose!()
    host.remove()
    mount({ onCreate: async () => {} })
    expect(host.querySelector('.dumb-um-form')).not.toBeNull()
  })
})

describe('чего делать нельзя', () => {
  it('себя не заблокировать и не удалить', () => {
    mount({ currentUserId: 'u1', onBan: async () => {}, onRemove: async () => {} })
    const mine = rowOf('Аня')

    expect(buttonBy(mine, 'Заблокировать')!.disabled).toBe(true)
    expect(buttonBy(mine, 'Удалить')!.disabled).toBe(true)
  })

  it('владельца не трогаем ни одной кнопкой', () => {
    mount({
      onBan: async () => {},
      onRemove: async () => {},
      onSetPassword: async () => {},
      onRevokeSessions: async () => {},
    })
    const owner = rowOf('Влад')

    for (const b of buttonsIn(owner)) expect(b.disabled).toBe(true)
  })

  it('чужого — можно', () => {
    mount({
      currentUserId: 'u1',
      onBan: async () => {},
      // у заблокированного кнопка другая, и рисуется она по своему колбэку
      onUnban: async () => {},
      onRemove: async () => {},
    })
    const other = rowOf('Боря')

    // Боря заблокирован, поэтому у него «Разблокировать»
    expect(buttonBy(other, 'Разблокировать')!.disabled).toBe(false)
    expect(buttonBy(other, 'Удалить')!.disabled).toBe(false)
  })
})

describe('действия', () => {
  it('блокировка зовёт onBan и показывает ответ', async () => {
    const onBan = vi.fn(async () => {})
    mount({ onBan })

    buttonBy(rowOf('Аня'), 'Заблокировать')!.click()
    await tick()

    expect(onBan).toHaveBeenCalledWith('u1', '')
    expect(host.querySelector('.dumb-um-alert[data-kind="ok"]')?.textContent).toContain(
      'Доступ приостановлен',
    )
  })

  it('удаление требует второго клика', async () => {
    const onRemove = vi.fn(async () => {})
    mount({ onRemove })
    const row = rowOf('Боря')

    buttonBy(row, 'Удалить')!.click()
    expect(onRemove).not.toHaveBeenCalled()

    // первая кнопка сменилась подтверждением — вот его и нажимаем
    buttonBy(rowOf('Боря'), 'Точно удалить')!.click()
    await tick()
    expect(onRemove).toHaveBeenCalledWith('u2')
  })

  it('ошибку сервера показывает как есть', async () => {
    mount({ onBan: async () => { throw new Error('нет прав на этот домен') } })

    buttonBy(rowOf('Аня'), 'Заблокировать')!.click()
    await tick()

    expect(host.querySelector('.dumb-um-alert[data-kind="error"]')?.textContent).toContain(
      'нет прав на этот домен',
    )
  })

  it('смена пароля показывает его ровно один раз', async () => {
    const onSetPassword = vi.fn(async () => {})
    mount({ onSetPassword })

    buttonBy(rowOf('Аня'), 'Пароль')!.click()
    const form = rowOf('Аня').querySelector<HTMLFormElement>('.dumb-um-pw')!
    const input = form.querySelector<HTMLInputElement>('.dumb-um-input')!
    // поле уже заполнено предложенным паролем — его не придумывают руками
    expect(input.value.length).toBeGreaterThan(0)

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await tick()

    expect(onSetPassword).toHaveBeenCalledWith('u1', input.value)
    expect(host.querySelector('.dumb-um-alert[data-kind="ok"]')?.textContent).toContain(input.value)
  })
})

describe('suggestPassword', () => {
  it('даёт нужную длину и не берёт путающиеся символы', () => {
    // из каждой пары выброшен один: 8 и 2 остаются законно, а вот B и Z — нет
    for (let i = 0; i < 50; i++) {
      const pass = suggestPassword(12)
      expect(pass).toHaveLength(12)
      expect(pass).not.toMatch(/[0Oo1lIBZ]/)
    }
  })

  it('по умолчанию девять символов', () => {
    expect(suggestPassword()).toHaveLength(9)
  })
})
