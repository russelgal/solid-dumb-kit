// Движок должен жить без Solid: ни owner, ни onCleanup, ни рендера —
// только DOM и функции отписки. Если этот файл перестанет собираться без
// solid-js, значит зависимость просочилась обратно в ядро.
import { describe, it, expect, vi } from 'vitest'
import { createSortableEngine } from '../sortableCore'
import { createSortableGroupEngine } from '../sortableGroup'

const row = (id: string) => {
  const el = document.createElement('div')
  el.dataset.id = id
  document.body.appendChild(el)
  return el
}

describe('createSortableEngine — вне Solid', () => {
  it('создаётся без реактивного контекста', () => {
    const engine = createSortableEngine({ order: () => ['a', 'b'], onEnd: () => {} })
    expect(typeof engine.attach).toBe('function')
    expect(typeof engine.destroy).toBe('function')
    engine.destroy()
  })

  it('attach возвращает отписку и регистрирует элемент', () => {
    const engine = createSortableEngine({ order: () => ['a'], onEnd: () => {} })
    const el = row('a')
    const off = engine.attach(el, 'a')

    expect(el.dataset.flipId).toBe('a')
    expect(typeof off).toBe('function')

    off()
    engine.destroy()
  })

  it('после отписки pointerdown больше не слушается', () => {
    const engine = createSortableEngine({ order: () => ['a'], onEnd: () => {} })
    const el = row('a')
    const spy = vi.spyOn(el, 'removeEventListener')

    engine.attach(el, 'a')()
    expect(spy).toHaveBeenCalledWith('pointerdown', expect.any(Function))

    engine.destroy()
  })

  it('без ручки драг не стартует с поля ввода', () => {
    const engine = createSortableEngine({ order: () => ['a'], onEnd: () => {} })
    const el = row('a')
    const input = document.createElement('input')
    el.appendChild(input)
    engine.attach(el, 'a')

    const spy = vi.spyOn(window, 'addEventListener')
    input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 7 }))
    // драг вешает свои pointermove/pointerup на window — их быть не должно
    expect(spy).not.toHaveBeenCalledWith('pointermove', expect.any(Function))

    spy.mockRestore()
    engine.destroy()
  })

  it('без ручки драг стартует с обычного места строки', () => {
    const engine = createSortableEngine({ order: () => ['a'], onEnd: () => {} })
    const el = row('a')
    const text = document.createElement('span')
    el.appendChild(text)
    engine.attach(el, 'a')

    const spy = vi.spyOn(window, 'addEventListener')
    text.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 8 }))
    expect(spy).toHaveBeenCalledWith('pointermove', expect.any(Function))

    spy.mockRestore()
    engine.destroy()
  })

  it('низкоуровневые attachRow/attachHandle тоже отдают отписку', () => {
    const engine = createSortableEngine({ order: () => ['a'], onEnd: () => {} })
    const cell = row('a')
    const handle = row('h')

    const offRow = engine.attachRow(cell, 'a')
    const offHandle = engine.attachHandle(handle, 'a')
    expect(cell.dataset.flipId).toBe('a')

    offRow()
    offHandle()
    engine.destroy()
  })

  it('destroy без единого attach не падает', () => {
    const engine = createSortableEngine({ order: () => [], onEnd: () => {} })
    expect(() => engine.destroy()).not.toThrow()
  })
})

describe('createSortableGroupEngine — вне Solid', () => {
  it('зоны регистрируются и отдают отписки', () => {
    const engine = createSortableGroupEngine({ onEnd: () => {} })
    const list = engine.list('todo', { order: () => ['a'] })

    const box = row('box')
    const card = row('a')
    const offBox = list.attachContainer(box)
    const offCard = list.attach(card, 'a')

    expect(engine.activeList()).toBeNull()
    expect(engine.draggingId()).toBeNull()

    offBox()
    offCard()
    engine.destroy()
  })
})
