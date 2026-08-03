import { describe, it, expect, vi } from 'vitest'
import { scrollOffsetFor } from '../src/virtual'
import { moveIndex, moveSelection, isMoveKey } from '../src/roving'
import { createUndoStack } from '../src/undo'
import { createInlineEdit } from '../src/inlineEdit'
import { shouldSplit } from '../src/multipart'

describe('виртуализация — куда прокручивать', () => {
  const base = { itemSize: 20, viewHeight: 100, scrollTop: 0 }

  it('к видимому не прокручивает вовсе', () => {
    expect(scrollOffsetFor({ ...base, index: 2 })).toBe(null)
  })

  it('до элемента выше окна — ставит его под верхний край', () => {
    expect(scrollOffsetFor({ ...base, index: 1, scrollTop: 200 })).toBe(20)
  })

  it('до элемента ниже окна — под нижний край', () => {
    // строка 10 занимает 200…220, окно высотой 100 → прокрутка до 120
    expect(scrollOffsetFor({ ...base, index: 10 })).toBe(120)
  })

  it('в сетке считает по рядам, а не по элементам', () => {
    // 4 колонки: элемент 9 — во втором ряду (40…60), окно его уже показывает
    expect(scrollOffsetFor({ ...base, index: 9, columns: 4 })).toBe(null)
    expect(scrollOffsetFor({ ...base, index: 40, columns: 4 })).toBe(120)
  })

  it('force прижимает даже видимый', () => {
    expect(scrollOffsetFor({ ...base, index: 2, force: true })).toBe(40)
  })
})

describe('клавиатура: куда уводит стрелка', () => {
  it('в списке вниз это +1, в сетке — +колонки', () => {
    expect(moveIndex('ArrowDown', { from: 0, count: 10 })).toBe(1)
    expect(moveIndex('ArrowDown', { from: 0, count: 10, columns: 4 })).toBe(4)
  })

  it('на краю ряда вправо переносит на следующий ряд', () => {
    expect(moveIndex('ArrowRight', { from: 3, count: 10, columns: 4 })).toBe(4)
  })

  it('за границы не выпускает', () => {
    expect(moveIndex('ArrowUp', { from: 0, count: 10, columns: 4 })).toBe(0)
    expect(moveIndex('ArrowDown', { from: 9, count: 10 })).toBe(9)
  })

  it('без курсора первая же стрелка ставит его на край', () => {
    expect(moveIndex('ArrowDown', { from: -1, count: 10 })).toBe(0)
    expect(moveIndex('ArrowUp', { from: -1, count: 10 })).toBe(9)
  })

  it('Home/End и страницы', () => {
    expect(moveIndex('Home', { from: 5, count: 10 })).toBe(0)
    expect(moveIndex('End', { from: 5, count: 10 })).toBe(9)
    expect(moveIndex('PageDown', { from: 0, count: 100, columns: 4, page: 5 })).toBe(20)
  })

  it('чужую клавишу не трогает', () => {
    expect(moveIndex('Enter', { from: 0, count: 10 })).toBe(null)
    expect(isMoveKey('Enter')).toBe(false)
    expect(isMoveKey('ArrowLeft')).toBe(true)
  })
})

describe('клавиатура: что становится выделено', () => {
  const keys = ['a', 'b', 'c', 'd', 'e']

  it('простая стрелка выделяет один', () => {
    const r = moveSelection({ keys, anchor: 0, next: 2, current: new Set(['a']), shift: false, ctrl: false })
    expect([...r.selected]).toEqual(['c'])
    expect(r.anchor).toBe(2)
  })

  it('Shift растягивает диапазон от якоря', () => {
    const r = moveSelection({ keys, anchor: 1, next: 3, current: new Set(['b']), shift: true, ctrl: false })
    expect([...r.selected]).toEqual(['b', 'c', 'd'])
  })

  it('якорь при растягивании НЕ уползает за курсором', () => {
    const first = moveSelection({ keys, anchor: 2, next: 4, current: new Set(), shift: true, ctrl: false })
    expect(first.anchor).toBe(2)
    // вернулись назад — диапазон снова стягивается к якорю
    const back = moveSelection({ keys, anchor: first.anchor, next: 1, current: first.selected, shift: true, ctrl: false })
    expect([...back.selected]).toEqual(['b', 'c'])
  })

  it('Ctrl двигает курсор, не трогая выделение', () => {
    const r = moveSelection({ keys, anchor: 0, next: 3, current: new Set(['a', 'b']), shift: false, ctrl: true })
    expect([...r.selected]).toEqual(['a', 'b'])
    expect(r.anchor).toBe(3)
  })
})

describe('отмена действия', () => {
  it('откатывает последний шаг и переносит его в повтор', async () => {
    const undo = vi.fn().mockResolvedValue(undefined)
    const redo = vi.fn().mockResolvedValue(undefined)
    const s = createUndoStack()
    s.push({ label: 'перенос', undo, redo })

    expect(s.canUndo()).toBe(true)
    await s.undo()
    expect(undo).toHaveBeenCalledOnce()
    expect(s.canUndo()).toBe(false)
    expect(s.canRedo()).toBe(true)

    await s.redo()
    expect(redo).toHaveBeenCalledOnce()
    expect(s.canUndo()).toBe(true)
  })

  it('шаг без отмены не отменяется и не врёт кнопкой', async () => {
    const s = createUndoStack()
    s.push({ label: 'удаление', undo: null })
    expect(s.canUndo()).toBe(false)
    expect(s.peekUndo()).toBe(null)
    await s.undo()   // не падает
  })

  it('новое действие обесценивает отменённое', async () => {
    const s = createUndoStack()
    s.push({ label: 'раз', undo: async () => {}, redo: async () => {} })
    await s.undo()
    expect(s.canRedo()).toBe(true)
    s.push({ label: 'два', undo: async () => {} })
    expect(s.canRedo()).toBe(false)
  })

  it('сорвавшаяся отмена оставляет шаг в стеке', async () => {
    const onError = vi.fn()
    const s = createUndoStack({ onError })
    s.push({ label: 'перенос', undo: () => Promise.reject(new Error('нет сети')) })
    await s.undo()
    expect(onError).toHaveBeenCalledOnce()
    expect(s.canUndo()).toBe(true)
  })

  it('помнит не больше предела', () => {
    const s = createUndoStack({ limit: 2 })
    for (const n of ['a', 'b', 'c']) s.push({ label: n, undo: async () => {} })
    expect(s.peekUndo()?.label).toBe('c')
    s.clear()
    expect(s.canUndo()).toBe(false)
  })
})

describe('правка на месте', () => {
  it('сохраняет изменённое', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const e = createInlineEdit({ save })
    e.start('id1', 'старое')
    e.input('новое')
    expect(await e.commit()).toBe(true)
    expect(save).toHaveBeenCalledWith('id1', 'новое')
    expect(e.editing()).toBe(null)
  })

  it('пустое и неизменённое — это отмена, а не сохранение', async () => {
    const save = vi.fn()
    const e = createInlineEdit({ save })
    e.start('id1', 'имя')
    expect(await e.commit()).toBe(false)      // не менялось
    e.start('id1', 'имя')
    e.input('   ')
    expect(await e.commit()).toBe(false)      // пусто
    expect(save).not.toHaveBeenCalled()
  })

  it('ошибка не съедает набранное', async () => {
    const e = createInlineEdit({ save: () => Promise.reject(new Error('занято')) })
    e.start('id1', 'старое')
    e.input('новое')
    expect(await e.commit()).toBe(false)
    expect(e.editing()).toBe('id1')
    expect(e.value()).toBe('новое')
    expect(e.error()).toBe('занято')
  })

  it('чистит введённое своим правилом', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const e = createInlineEdit({ save, clean: (v) => v.trim().replace(/\//g, '') })
    e.start('id1', 'имя')
    e.input('  до/бавка  ')
    await e.commit()
    expect(save).toHaveBeenCalledWith('id1', 'добавка')
  })
})

describe('заливка частями', () => {
  it('мелкий файл резать не надо', () => {
    const small = new File([new Uint8Array(10)], 'a.txt')
    expect(shouldSplit(small)).toBe(false)
    expect(shouldSplit(small, 5)).toBe(true)
  })
})
