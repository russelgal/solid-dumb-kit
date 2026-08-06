// DumbToaster в DOM: что нарисовано, что делает нажатие, где крестик.
//
// Шине своя проверка (`toast.test.ts`), здесь только то, чего у неё нет: сама
// разметка и обработка кликов. Шина передаётся своя (`bus`), а не общая — иначе
// плашки из одного теста доживали бы до следующего.
//
// happy-dom не знает Popover API: `showPopover` компонент зовёт через `?.()`,
// так что подпорка не нужна вовсе.

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render } from 'solid-js/web'
import { DumbToaster, createToastBus, type ToastBus } from '../src'

let host: HTMLDivElement
let dispose: (() => void) | null = null

afterEach(() => {
  dispose?.()
  dispose = null
  host?.remove()
})

function mount(bus: ToastBus) {
  host = document.createElement('div')
  document.body.appendChild(host)
  dispose = render(() => <DumbToaster bus={bus} />, host)
}

const toasts = () => Array.from(host.querySelectorAll('.dumb-toast'))
const textOf = (i = 0) => toasts()[i]?.querySelector('.dumb-toast-text')?.textContent
const buttons = (i = 0) =>
  Array.from(toasts()[i]?.querySelectorAll<HTMLButtonElement>('button') ?? [])

describe('разметка', () => {
  it('рисует то, что положили в шину', () => {
    const bus = createToastBus()
    mount(bus)
    bus.success('Сохранено')

    expect(toasts()).toHaveLength(1)
    expect(textOf()).toBe('Сохранено')
    expect(toasts()[0].getAttribute('data-kind')).toBe('success')
  })

  it('ошибку помечает role=alert, остальное — role=status', () => {
    const bus = createToastBus()
    mount(bus)
    bus.error('Не залилось')
    bus.info('Идёт заливка')

    expect(toasts()[0].getAttribute('role')).toBe('alert')
    expect(toasts()[1].getAttribute('role')).toBe('status')
  })

  it('повтор показывает счётчиком, а не второй плашкой', () => {
    const bus = createToastBus()
    mount(bus)
    bus.error('Не залилось')
    bus.error('Не залилось')

    expect(toasts()).toHaveLength(1)
    expect(toasts()[0].querySelector('.dumb-toast-count')?.textContent).toBe('2')
  })

  it('больше max плашек разом не показывает', () => {
    const bus = createToastBus()
    host = document.createElement('div')
    document.body.appendChild(host)
    dispose = render(() => <DumbToaster bus={bus} max={2} />, host)

    bus.info('Раз', { ttl: 0 })
    bus.info('Два', { ttl: 0 })
    bus.info('Три', { ttl: 0 })

    expect(toasts()).toHaveLength(2)
  })
})

describe('кнопки', () => {
  it('нажатие зовёт действие и закрывает плашку', () => {
    const bus = createToastBus()
    mount(bus)
    const run = vi.fn()
    bus.ask('Удалить папку?', [{ label: 'Удалить', run }])

    buttons()[0].click()

    expect(run).toHaveBeenCalledOnce()
    expect(toasts()).toHaveLength(0)
  })

  it('keepOpen оставляет плашку висеть', () => {
    const bus = createToastBus()
    mount(bus)
    bus.ask('Повторить?', [{ label: 'Ещё раз', keepOpen: true }])

    buttons()[0].click()

    expect(toasts()).toHaveLength(1)
  })

  it('у вопроса крестика нет, у обычной плашки есть', () => {
    const bus = createToastBus()
    mount(bus)

    bus.ask('Удалить?', [{ label: 'Да' }])
    expect(toasts()[0].querySelector('.dumb-toast-close')).toBeNull()

    bus.info('Просто сообщение', { ttl: 0 })
    expect(toasts()[1].querySelector('.dumb-toast-close')).not.toBeNull()
  })

  it('крестик снимает плашку', () => {
    const bus = createToastBus()
    mount(bus)
    bus.info('Уйди', { ttl: 0 })

    toasts()[0].querySelector<HTMLButtonElement>('.dumb-toast-close')!.click()

    expect(toasts()).toHaveLength(0)
  })
})
