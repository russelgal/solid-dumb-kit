// Протяжка по дням календаря: нажал, повёл, отпустил — период встал.
//
// Два клика при этом должны остаться рабочими: на тачскрине протяжка спорит с
// прокруткой страницы, и привычка «клик — клик» никуда не денется. Оба
// сценария и проверяются рядом.
//
// Хиттест подменён: happy-dom раскладку не считает, а компонент спрашивает у
// браузера, какой день под курсором.

import { describe, it, expect, afterEach, vi } from 'vitest'
import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { DumbDateRange } from '../src/DumbDateRange'
import { addDays, today, type Day } from '../src/dateMath'

let host: HTMLDivElement
let dispose: (() => void) | null = null
const T: Day = today()

afterEach(() => {
  dispose?.()
  dispose = null
  host?.remove()
  vi.restoreAllMocks()
})

function mount(extra: { busy?: Array<{ from: Day; to: Day; title?: string }> } = {}) {
  const [value, setValue] = createSignal<{ from: Day; to: Day } | null>(null)
  const onChange = vi.fn((v: { from: Day; to: Day } | null) => setValue(v))
  const onReject = vi.fn()
  host = document.createElement('div')
  document.body.appendChild(host)
  dispose = render(
    () => (
      <DumbDateRange
        value={value}
        onChange={onChange}
        busy={() => extra.busy ?? []}
        months={2}
        onReject={onReject}
      />
    ),
    host,
  )
  return { value, onChange, onReject }
}

const dayCells = () => Array.from(host.querySelectorAll<HTMLElement>('[data-day]'))
const cell = (day: Day) => dayCells().find((c) => c.dataset.day === day)!

/** хиттест отвечает ячейкой по координате X: ячейки будто лежат в ряд по 10px */
function stubHit() {
  vi.spyOn(document, 'elementFromPoint').mockImplementation((x: number) => {
    const list = dayCells()
    return list[Math.max(0, Math.min(list.length - 1, Math.round(x / 10)))] ?? null
  })
}

/** координата X, по которой хиттест вернёт нужный день */
const xOf = (day: Day) => dayCells().findIndex((c) => c.dataset.day === day) * 10

const down = (el: HTMLElement, x: number) =>
  el.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: x, clientY: 0 }),
  )
const move = (x: number) =>
  window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: 0 }))
const up = () => window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))

describe('протяжка по дням', () => {
  it('нажал, повёл на три дня вперёд, отпустил — период встал', async () => {
    const { onChange } = mount()
    stubHit()
    const from = T
    const to = addDays(T, 3)

    down(cell(from), xOf(from))
    move(xOf(to))
    await frame()
    up()

    expect(onChange).toHaveBeenCalledWith({ from, to })
  })

  it('тянуть можно и назад: концы меняются местами сами', async () => {
    const { onChange } = mount()
    stubHit()
    const start = addDays(T, 5)
    const end = addDays(T, 2)

    down(cell(start), xOf(start))
    move(xOf(end))
    await frame()
    up()

    expect(onChange).toHaveBeenCalledWith({ from: end, to: start })
  })

  it('отпустил там же, где нажал, — это КЛИК: ждём второго, период не встал', async () => {
    const { onChange } = mount()
    stubHit()

    down(cell(T), xOf(T))
    await frame()
    up()

    expect(onChange).not.toHaveBeenCalled()

    // второй клик по другому дню закрывает период — старый сценарий цел
    cell(addDays(T, 2)).click()
    expect(onChange).toHaveBeenCalledWith({ from: T, to: addDays(T, 2) })
  })

  it('протяжка не идёт сквозь занятое, а прилипает к его границе', async () => {
    const busy = [{ from: addDays(T, 2), to: addDays(T, 3), title: 'Иванов' }]
    const { onChange } = mount({ busy })
    stubHit()

    down(cell(T), xOf(T))
    move(xOf(addDays(T, 5)))     // тянем далеко за чужую бронь
    await frame()
    up()

    // период закрылся последним свободным днём, а не отказом
    expect(onChange).toHaveBeenCalledWith({ from: T, to: addDays(T, 1) })
  })

  it('pointercancel бросает жест, ничего не выбрав', async () => {
    const { onChange } = mount()
    stubHit()

    down(cell(T), xOf(T))
    move(xOf(addDays(T, 3)))
    await frame()
    window.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }))
    up()

    expect(onChange).not.toHaveBeenCalled()
  })
})
