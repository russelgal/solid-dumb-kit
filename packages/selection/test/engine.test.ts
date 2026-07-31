// То же для выделения: движок обязан работать вне Solid.
import { describe, it, expect, vi } from 'vitest'
import { createSelectionEngine } from '../src/selectionCore'

const host = () => {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

describe('createSelectionEngine — вне Solid', () => {
  const opts = (el: HTMLElement) => ({
    container: () => el,
    selectables: '.card',
    current: () => new Set<string>(),
    onChange: () => {},
  })

  it('создаётся без реактивного контекста', () => {
    const el = host()
    const engine = createSelectionEngine(opts(el))
    expect(typeof engine.attach).toBe('function')
    engine.destroy()
  })

  it('attach возвращает отписку, снимающую слушатель', () => {
    const el = host()
    const engine = createSelectionEngine(opts(el))
    const spy = vi.spyOn(el, 'removeEventListener')

    const off = engine.attach(el)
    expect(typeof off).toBe('function')

    off()
    expect(spy).toHaveBeenCalledWith('pointerdown', expect.any(Function))
    engine.destroy()
  })

  it('жест не стартует с ручки перетаскивания', () => {
    const el = host()
    const handle = document.createElement('span')
    handle.setAttribute('data-drag-handle', '')
    el.appendChild(handle)

    const engine = createSelectionEngine(opts(el))
    engine.attach(el)

    const before = el.childElementCount
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1 }))
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 500, clientY: 500 }))

    expect(el.childElementCount).toBe(before)   // рамка не создалась
    engine.destroy()
  })

  it('обычная протяжка жест начинает', () => {
    const el = host()
    const card = document.createElement('div')
    el.appendChild(card)

    const engine = createSelectionEngine(opts(el))
    engine.attach(el)

    const before = el.childElementCount
    card.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 2 }))
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 2, clientX: 500, clientY: 500 }))

    expect(el.childElementCount).toBe(before + 1)   // появилась рамка
    engine.destroy()
  })

  it('destroy без жеста не падает', () => {
    const el = host()
    const engine = createSelectionEngine(opts(el))
    expect(() => engine.destroy()).not.toThrow()
  })
})
