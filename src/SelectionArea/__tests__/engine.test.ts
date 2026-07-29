// То же для выделения: движок обязан работать вне Solid.
import { describe, it, expect, vi } from 'vitest'
import { createSelectionEngine } from '../selectionCore'

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

  it('destroy без жеста не падает', () => {
    const el = host()
    const engine = createSelectionEngine(opts(el))
    expect(() => engine.destroy()).not.toThrow()
  })
})
