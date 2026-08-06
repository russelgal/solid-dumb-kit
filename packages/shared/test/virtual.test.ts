// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { createVirtualizer, scrollOffsetFor, MAX_SCROLL_HEIGHT, type VirtualRange } from '../src/virtual'

const ROW = 28
const VIEW = 600

function scroller() {
  const el = document.createElement('div')
  Object.defineProperty(el, 'clientHeight', { value: VIEW, configurable: true })
  document.body.append(el)
  return el
}

function make(count: number) {
  const el = scroller()
  let last: VirtualRange = { start: 0, end: 0, offset: 0, total: 0 }
  const v = createVirtualizer({
    count: () => count,
    itemSize: () => ROW,
    scroller: () => el,
    overscan: 3,
    onChange: (r) => (last = r),
  })
  const go = (top: number) => {
    el.scrollTop = top
    v.refresh()
    return last
  }
  return { el, v, go, get last() { return last } }
}

describe('createVirtualizer: потолок высоты', () => {
  it('короткий список живёт по старым правилам: offset кратен строке', () => {
    const { go } = make(10_000)
    const r = go(28 * 100)
    expect(r.total).toBe(10_000 * ROW)
    expect(r.start).toBe(97) // 100 минус overscan
    expect(r.offset).toBe(97 * ROW)
  })

  it('миллион строк: распорка зажата потолком', () => {
    const { last } = make(1_000_000)
    expect(1_000_000 * ROW).toBeGreaterThan(MAX_SCROLL_HEIGHT)
    expect(last.total).toBe(MAX_SCROLL_HEIGHT)
  })

  it('в самом низу видно последние строки', () => {
    const { go } = make(1_000_000)
    const r = go(MAX_SCROLL_HEIGHT - VIEW)
    expect(r.end).toBe(1_000_000)
    // нарисованное окно накрывает видимую область целиком
    expect(r.offset).toBeLessThanOrEqual(MAX_SCROLL_HEIGHT - VIEW)
    expect(r.offset + (r.end - r.start) * ROW).toBeGreaterThanOrEqual(MAX_SCROLL_HEIGHT)
  })

  it('в середине окно стоит под видимой областью', () => {
    const { go } = make(1_000_000)
    const top = Math.floor((MAX_SCROLL_HEIGHT - VIEW) / 2)
    const r = go(top)
    // верх окна не ниже верха экрана, низ окна не выше низа экрана
    expect(r.offset).toBeLessThanOrEqual(top)
    expect(r.offset + (r.end - r.start) * ROW).toBeGreaterThanOrEqual(top + VIEW)
    // и это действительно середина данных
    expect(r.start).toBeGreaterThan(490_000)
    expect(r.start).toBeLessThan(510_000)
  })

  it('прокрутка к строке считается в координатах полосы', () => {
    const at = scrollOffsetFor({
      index: 999_999,
      itemSize: ROW,
      viewHeight: VIEW,
      scrollTop: 0,
      force: true,
      count: 1_000_000,
    })
    expect(at).not.toBeNull()
    expect(at as number).toBeLessThanOrEqual(MAX_SCROLL_HEIGHT)
    expect(at as number).toBeGreaterThan(MAX_SCROLL_HEIGHT * 0.9)
  })

  it('поштучные высоты: окно накрывает видимую часть', () => {
    // строки в шахматке разной высоты: этажей у всех по-разному
    const heights = Array.from({ length: 500 }, (_, i) => 34 * (1 + (i % 3)))
    const el = scroller()
    let last: VirtualRange = { start: 0, end: 0, offset: 0, total: 0 }
    const v = createVirtualizer({
      count: () => heights.length,
      itemSize: () => 34,
      itemSizes: () => heights,
      scroller: () => el,
      overscan: 2,
      onChange: (r) => (last = r),
    })
    const sum = heights.reduce((a, b) => a + b, 0)
    expect(last.total).toBe(sum)

    const top = 5000
    el.scrollTop = top
    v.refresh()
    // верх окна не ниже верха экрана, низ окна не выше низа экрана
    const drawn = heights.slice(last.start, last.end).reduce((a, b) => a + b, 0)
    expect(last.offset).toBeLessThanOrEqual(top)
    expect(last.offset + drawn).toBeGreaterThanOrEqual(top + VIEW)
    // и окно не разрослось на весь список
    expect(last.end - last.start).toBeLessThan(40)
    v.destroy()
  })

  it('ось X: считается по scrollLeft и ширине', () => {
    const el = document.createElement('div')
    Object.defineProperty(el, 'clientWidth', { value: 800, configurable: true })
    document.body.append(el)
    let last: VirtualRange = { start: 0, end: 0, offset: 0, total: 0 }
    const v = createVirtualizer({
      count: () => 5000,
      itemSize: () => 40,
      axis: 'x',
      scroller: () => el,
      overscan: 2,
      onChange: (r) => (last = r),
    })
    expect(last.total).toBe(5000 * 40)
    el.scrollLeft = 40 * 100
    v.refresh()
    expect(last.start).toBe(98) // 100 минус overscan
    expect(last.offset).toBe(98 * 40)
    expect(last.end).toBeGreaterThanOrEqual(100 + 800 / 40)
    v.destroy()
  })

  it('lead: липкая колонка перед рядами не сдвигает окно', () => {
    const el = document.createElement('div')
    Object.defineProperty(el, 'clientWidth', { value: 800, configurable: true })
    document.body.append(el)
    let last: VirtualRange = { start: 0, end: 0, offset: 0, total: 0 }
    const v = createVirtualizer({
      count: () => 5000,
      itemSize: () => 40,
      axis: 'x',
      lead: () => 200, // ширина липкой колонки названий
      scroller: () => el,
      overscan: 0,
      onChange: (r) => (last = r),
    })
    // прокрутили ровно на липкую колонку — сетка ещё не сдвинулась
    el.scrollLeft = 200
    v.refresh()
    expect(last.start).toBe(0)
    // а вот дальше уже считается от первой колонки сетки
    el.scrollLeft = 200 + 40 * 10
    v.refresh()
    expect(last.start).toBe(10)
    v.destroy()
  })

  it('без потолка прокрутка к строке считается как раньше', () => {
    expect(scrollOffsetFor({ index: 100, itemSize: ROW, viewHeight: VIEW, scrollTop: 0, force: true }))
      .toBe(100 * ROW)
    expect(scrollOffsetFor({ index: 5, itemSize: ROW, viewHeight: VIEW, scrollTop: 0 })).toBeNull()
  })
})
