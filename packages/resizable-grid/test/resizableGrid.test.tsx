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
  it('размеры переживают перемонтирование', async () => {
    mount({ storageKey: 'rg-persist' })
    drag(colHandles()[0], 90)
    const after = cols()

    dispose!()
    dispose = null
    host.remove()

    mount({ storageKey: 'rg-persist' })
    // сохранённое читается не в теле компонента, а следующей микрозадачей —
    // Solid 2 флашит обновления микротаском
    await settle()
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

describe('схлопывание жестом (collapseAt)', () => {
  const collapsible = () => [panel('left', { collapseAt: 150, collapsedContent: () => <span class="rail-icon">≡</span> }), panel('right')]
  const rail = () => host.querySelector<HTMLButtonElement>('.resizable-grid-rail')
  /** Ширина левой колонки в px: 894 px развёрнутой ширины делятся по `fr`. */
  const leftWidth = () => {
    const [left, , right] = cols().split(' ').map(parseFloat)
    return (left / (left + right)) * 894
  }

  it('тянут уже порога — панель сворачивается в полосу, ширина помнится', () => {
    mount({ cols: collapsible() })
    // 900 − ручка 6 = 894, левая — половина, 447 px; −320 → 127 px < 150.
    drag(colHandles()[0], -320)
    expect(rail()).not.toBeNull()
    expect(host.querySelector('.rail-icon')).not.toBeNull()
    expect(host.querySelector('.body-left')).toBeNull()
    expect(colHandles()).toHaveLength(0)
    expect(cols()).toBe('32px 1fr')
    expect(JSON.parse(localStorage.getItem('rg-test')!)).toMatchObject({ cols: [1, 1], collapsed: ['left'] })
  })

  it('щелчок по полосе возвращает прежнюю ширину', () => {
    mount({ cols: collapsible() })
    drag(colHandles()[0], -320)
    rail()!.click()
    expect(rail()).toBeNull()
    expect(host.querySelector('.body-left')).not.toBeNull()
    expect(cols()).toBe('1fr 6px 1fr')
  })

  it('пока тянут — панель плавно идёт за курсором, полоса появляется только на отпускании', () => {
    mount({ cols: collapsible() })
    const handle = colHandles()[0]
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }))
    // 447 − 340 = 107 px: уже порога, но кнопка ещё нажата — без рывка в полосу.
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: -240, clientY: 100 }))
    expect(rail()).toBeNull()
    expect(leftWidth()).toBeCloseTo(107, 0)
    // Потянули обратно, не отпуская, — просто растёт.
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 100 }))
    document.dispatchEvent(new MouseEvent('mouseup', {}))
    expect(rail()).toBeNull()
    expect(leftWidth()).toBeCloseTo(397, 0)
  })

  it('отпустили между порогом и min — панель встаёт на min', () => {
    mount({ cols: [panel('left', { min: 200, collapseAt: 120 }), panel('right')] })
    drag(colHandles()[0], -297) // 447 − 297 = 150 px
    expect(rail()).toBeNull()
    expect(leftWidth()).toBeCloseTo(200, 0)
  })

  it('без collapseAt ручка по-прежнему упирается в минимум', () => {
    mount()
    drag(colHandles()[0], -400)
    expect(rail()).toBeNull()
    expect(host.querySelector('.body-left')).not.toBeNull()
  })

  it('замер контейнера — один раз на жест, а не на каждое движение', () => {
    mount({ cols: collapsible() })
    rectCalls = 0
    const handle = colHandles()[0]
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }))
    for (const x of [80, 40, -100, -220, 0]) document.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: 100 }))
    document.dispatchEvent(new MouseEvent('mouseup', {}))
    expect(rectCalls).toBe(1)
  })
})

describe('потолок ширины (max)', () => {
  /** Доля левой колонки в пикселях: 894 px делятся по `fr`. */
  const leftPx = () => {
    const [left, , right] = cols().split(' ').map(parseFloat)
    return (left / (left + right)) * 894
  }

  it('дальше max ручка не тянет — колонка встаёт ровно на потолок', () => {
    mount({ cols: [panel('left', { max: 320 }), panel('right')] })
    drag(colHandles()[0], 300)
    expect(leftPx()).toBeCloseTo(320, 0)
  })

  it('у минимума ручка доезжает до границы, а не замирает', () => {
    mount({ cols: [panel('left', { min: 200 }), panel('right')] })
    drag(colHandles()[0], -400)
    expect(leftPx()).toBeCloseTo(200, 0)
  })
})
