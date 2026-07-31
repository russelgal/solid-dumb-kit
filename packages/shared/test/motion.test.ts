import { describe, it, expect, afterEach, vi } from 'vitest'
import { prefersReducedMotion, shouldAnimate } from '../src/motion'

const mockMedia = (reduce: boolean) => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: reduce && q.includes('prefers-reduced-motion'),
    media: q,
  }))
}

afterEach(() => vi.unstubAllGlobals())

describe('prefersReducedMotion', () => {
  it('читает системную настройку', () => {
    mockMedia(true)
    expect(prefersReducedMotion()).toBe(true)
    mockMedia(false)
    expect(prefersReducedMotion()).toBe(false)
  })

  it('без matchMedia (SSR) считаем, что ограничений нет', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(prefersReducedMotion()).toBe(false)
  })
})

describe('shouldAnimate', () => {
  it('по умолчанию анимируем', () => {
    mockMedia(false)
    expect(shouldAnimate(undefined)).toBe(true)
  })

  it('но не когда система просит меньше движения', () => {
    mockMedia(true)
    expect(shouldAnimate(undefined)).toBe(false)
  })

  it('явное false выключает всегда', () => {
    mockMedia(false)
    expect(shouldAnimate(false)).toBe(false)
  })

  it('явное true перебивает системную настройку — потребитель знает, что делает', () => {
    mockMedia(true)
    expect(shouldAnimate(true)).toBe(true)
  })
})
