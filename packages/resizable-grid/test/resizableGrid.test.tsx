// ResizableGrid: раскладка, ручки, тяга мышью, персист.
//
// happy-dom раскладку не считает, а ширина контейнера компоненту нужна — один
// раз, на нажатие ручки. Поэтому `getBoundingClientRect` тут подменён: это не
// обход правила «никаких замеров», а его проверка — если замер переедет в
// mousemove, тест не заметит, зато заметит счётчик вызовов, который для того и
// заведён.

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render } from 'solid-js/web'
import { ResizableGrid, type GridPanel } from '../src'

let host: HTMLDivElement
let dispose: (() => void) | null = null
let rectCalls = 0

const origRect = Element.prototype.getBoundingClientRect
beforeEach(() => {
  rectCalls = 0
  Element.prototype.getBoundingClientRect = function () {
    rectCalls++
    return { width: 900, height: 600, top: 0, left: 0, right: 900, bottom: 600, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
  }
})

afterEach(() => {
  dispose?.()
  dispose = null
  host?.remove()
  Element.prototype.getBoundingClientRect = origRect
  localStorage.clear()
  vi.restoreAllMocks()
})

const panel = (id: string, extra: Partial<GridPanel> = {}): GridPanel => ({
  id,
  content: () => <div class={`body-${id}`}>{id}</div>,
  ...extra,
})

function mount(props: Partial<Parameters<typeof ResizableGrid>[0]> = {}) {
  host = document.createElement('div')
  document.body.appendChild(host)
  dispose = render(
    () => (
      <ResizableGrid
        storageKey={props.storageKey ?? 'rg-test'}
        cols={props.cols ?? [panel('left'), panel('right')]}
        {...props}
      />
    ),
    host,
  )
}

const grid = () => host.firstElementChild as HTMLElement
const firstRow = () => grid().firstElementChild as HTMLElement
const colHandles = () =>
  Array.from(host.querySelectorAll<HTMLElement>('.resizable-grid-handle-col'))
const rowHandle = () => host.querySelector<HTMLElement>('.resizable-grid-handle-row')
const cols = () => firstRow().style.gridTemplateColumns

/** протащить ручку на dx пикселей */
function drag(handle: HTMLElement, dx: number, dy = 0) {
  handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }))
  document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100 + dx, clientY: 100 + dy }))
  document.dispatchEvent(new MouseEvent('mouseup', {}))
}

describe('раскладка', () => {
  it('рисует панели и ручку между ними', () => {
    mount()
    expect(host.querySelector('.body-left')).not.toBeNull()
    expect(host.querySelector('.body-right')).not.toBeNull()
    expect(colHandles()).toHaveLength(1)
  })

  it('три колонки — две ручки', () => {
    mount({ cols: [panel('a'), panel('b'), panel('c')] })
    expect(colHandles()).toHaveLength(2)
  })

  it('второго ряда и его ручки нет, пока не заданы rows', () => {
    mount()
    expect(rowHandle()).toBeNull()

    dispose!()
    host.remove()
    mount({ rows: [panel('bottom')] })
    expect(rowHandle()).not.toBeNull()
    expect(host.querySelector('.body-bottom')).not.toBeNull()
  })

  it('начальные доли берутся из initial', () => {
    mount({ cols: [panel('a', { initial: 3 }), panel('b', { initial: 1 })] })
    expect(cols()).toBe('3fr 6px 1fr')
  })
})

describe('тяга мышью', () => {
  it('вправо — левая панель растёт, правая ужимается', () => {
    mount()
    const before = cols()

    drag(colHandles()[0], 90)

    const after = cols()
    expect(after).not.toBe(before)
    const [left, , right] = after.split(' ')
    expect(parseFloat(left)).toBeGreaterThan(1)
    expect(parseFloat(right)).toBeLessThan(1)
  })

  it('за минимум не пускает', () => {
    mount({ cols: [panel('a', { min: 400 }), panel('b', { min: 400 })] })

    drag(colHandles()[0], -400)   // тянем далеко влево, мимо минимума

    const [left] = cols().split(' ')
    // 400px от 900 — это 0.44fr при сумме 2fr; ниже опуститься не дали
    expect(parseFloat(left)).toBeGreaterThanOrEqual(0.88)
  })

  it('замер контейнера — один на жест, а не на каждое движение', () => {
    mount()
    rectCalls = 0

    const handle = colHandles()[0]
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }))
    for (let x = 101; x < 130; x++) {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: 100 }))
    }
    document.dispatchEvent(new MouseEvent('mouseup', {}))

    expect(rectCalls).toBe(1)
  })

  it('высота рядов тянется своей ручкой', () => {
    mount({ rows: [panel('bottom')] })
    const before = grid().style.gridTemplateRows

    drag(rowHandle()!, 0, 120)

    expect(grid().style.gridTemplateRows).not.toBe(before)
  })
})

describe('персист', () => {
  it('размеры переживают перемонтирование', () => {
    mount({ storageKey: 'rg-persist' })
    drag(colHandles()[0], 90)
    const after = cols()

    dispose!()
    dispose = null
    host.remove()

    mount({ storageKey: 'rg-persist' })
    expect(cols()).toBe(after)
  })

  it('чужой ключ чужие размеры не подхватывает', () => {
    mount({ storageKey: 'rg-a' })
    drag(colHandles()[0], 90)

    dispose!()
    dispose = null
    host.remove()

    mount({ storageKey: 'rg-b' })
    expect(cols()).toBe('1fr 6px 1fr')
  })
})
