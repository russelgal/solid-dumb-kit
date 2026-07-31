import { describe, it, expect, afterEach, vi } from 'vitest'
import { suppressTextSelection, restoreTextSelection } from '../src/textSelection'

afterEach(() => {
  restoreTextSelection()
  vi.restoreAllMocks()
})

describe('suppressTextSelection', () => {
  it('ставит и стандартное свойство, и вебкитовское — Safari смотрит на второе', () => {
    suppressTextSelection()
    const s = document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }
    expect(s.userSelect).toBe('none')
    expect(s.webkitUserSelect).toBe('none')
  })

  it('снимает то, что успело выделиться до старта жеста', () => {
    const removeAllRanges = vi.fn()
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false, removeAllRanges,
    } as unknown as Selection)

    suppressTextSelection()
    expect(removeAllRanges).toHaveBeenCalled()
  })

  it('пустое выделение не трогает', () => {
    const removeAllRanges = vi.fn()
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: true, removeAllRanges,
    } as unknown as Selection)

    suppressTextSelection()
    expect(removeAllRanges).not.toHaveBeenCalled()
  })
})

describe('restoreTextSelection', () => {
  it('возвращает оба свойства', () => {
    suppressTextSelection()
    restoreTextSelection()
    const s = document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }
    expect(s.userSelect).toBe('')
    expect(s.webkitUserSelect).toBe('')
  })
})
