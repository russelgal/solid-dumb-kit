// Протяжка по ленте слотов: нажал, повёл, отпустил — период встал.
//
// Что под курсором, компонент спрашивает у браузера (`elementFromPoint`), а
// happy-dom раскладку не считает — поэтому хиттест подменён: он отвечает по
// координате X, будто слоты лежат в ряд по 10 пикселей.

import { describe, it, expect, afterEach, vi } from 'vitest'
import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { DumbDateTimeRange } from '../src/DumbDateTimeRange'
import { today, type Day } from '../src/dateMath'
import type { BusyMoment, Moment } from '../src/timeMath'

let host: HTMLDivElement
let dispose: (() => void) | null = null
const T: Day = today()

afterEach(() => {
  dispose?.()
  dispose = null
  host?.remove()
  vi.restoreAllMocks()
})

function mount(extra: { busy?: Array<BusyMoment>; step?: number } = {}) {
  const [value, setValue] = createSignal<{ from: Moment; to: Moment } | null>(null)
  const onChange = vi.fn((v: { from: Moment; to: Moment } | null) => setValue(v))
  const onReject = vi.fn()
  host = document.createElement('div')
  document.body.appendChild(host)
  dispose = render(
    () => (
      <DumbDateTimeRange
        value={value}
        onChange={onChange}
        busy={() => extra.busy ?? []}
        step={extra.step ?? 60}
        openMin={9 * 60}
        closeMin={18 * 60}
        onReject={onReject}
      />
    ),
    host,
  )
  return { value, onChange, onReject }
}

const slots = () => Array.from(host.querySelectorAll<HTMLElement>('[data-slot]'))
const slotFor = (time: string) => slots().find((s) => s.dataset.slot === time)!
const dayButton = (day: Day) =>
  Array.from(host.querySelectorAll<HTMLButtonElement>('.dumb-cal-day')).find(
    (b) => b.textContent?.trim().startsWith(String(Number(day.slice(8, 10)))),
  )!

/** выбрать ОДИН день: календарь берёт период двумя кликами по одной дате */
function pickOneDay(day: Day) {
  dayButton(day).click()
  dayButton(day).click()
}

/** хиттест отвечает тем слотом, чей индекс соответствует координате */
function stubHit() {
  vi.spyOn(document, 'elementFromPoint').mockImplementation((x: number) => {
    const list = slots()
    return list[Math.max(0, Math.min(list.length - 1, Math.round(x / 10)))] ?? null
  })
}

const down = (el: HTMLElement, x: number) =>
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: x, clientY: 0 }))
const move = (el: HTMLElement, x: number) =>
  el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: 0 }))
const up = async () => {
  window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  // commit уходит в микрозадачу: без неё период ещё не отдан наружу
  await Promise.resolve()
  await Promise.resolve()
}
const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))

describe('лента слотов появляется на одном дне', () => {
  it('до выбора дня слотов нет', () => {
    mount()
    expect(slots()).toHaveLength(0)
  })

  it('после выбора одного дня — одна лента', () => {
    mount()
    pickOneDay(T)
    // окно 09:00–18:00 шагом час: девять слотов, и ровно один набор
    expect(slots().map((s) => s.dataset.slot)).toEqual([
      '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
    ])
  })
})

describe('протяжка', () => {
  it('нажал, повёл, отпустил — период встал', async () => {
    const { onChange } = mount()
    pickOneDay(T)
    stubHit()

    const box = slotFor('09:00').parentElement as HTMLElement
    down(slotFor('09:00'), 0)
    move(box, 20)               // третий слот — 11:00
    await frame()
    await up()

    expect(onChange).toHaveBeenCalled()
    const v = onChange.mock.calls.at(-1)![0]!
    expect(v.from).toEqual({ day: T, time: '09:00' })
    // конец периода — КОНЕЦ последнего задетого слота, а не его начало
    expect(v.to).toEqual({ day: T, time: '12:00' })
  })

  it('обвели один слот — получили один шаг, а не нулевую длительность', async () => {
    const { onChange } = mount()
    pickOneDay(T)
    stubHit()

    down(slotFor('09:00'), 0)
    await frame()
    await up()

    const v = onChange.mock.calls.at(-1)![0]!
    expect(v.from.time).toBe('09:00')
    expect(v.to.time).toBe('10:00')
  })

  it('протяжка упирается в занятое, а не идёт сквозь', async () => {
    const busy: Array<BusyMoment> = [
      { from: { day: T, time: '12:00' }, to: { day: T, time: '14:00' }, title: 'Планёрка' },
    ]
    const { onChange } = mount({ busy })
    pickOneDay(T)
    stubHit()

    const box = slotFor('09:00').parentElement as HTMLElement
    down(slotFor('09:00'), 0)
    move(box, 70)               // тянем на 16:00, сквозь занятое 12:00–14:00
    await frame()
    await up()

    const v = onChange.mock.calls.at(-1)![0]!
    // упёрлись в начало занятого: конец периода — 12:00, дальше нельзя
    expect(v.to).toEqual({ day: T, time: '12:00' })
  })
})

describe('оверлей с часами', () => {
  it('показывает время обоих краёв и правит его, не сходя с календаря', async () => {
    const { onChange } = mount()
    pickOneDay(T)
    stubHit()

    down(slotFor('09:00'), 0)
    await frame()
    await up()

    // время заезда попало и в ячейку календаря, и в оверлей
    const edges = Array.from(host.querySelectorAll('.dumb-dt-edge')).map((e) => e.textContent)
    expect(edges).toContain('09:00')

    const overlay = host.querySelector('.dumb-dt-overlay')!
    expect(overlay).not.toBeNull()
    const selects = Array.from(overlay.querySelectorAll<HTMLSelectElement>('select'))
    expect(selects.length).toBeGreaterThanOrEqual(2)

    // Правим час ВЫЕЗДА прямо в оверлее: сдвигать заезд вперёд смысла нет —
    // он перескочит выезд, и компонент справедливо откажет.
    selects[1].value = '14'
    selects[1].dispatchEvent(new Event('change', { bubbles: true }))
    await Promise.resolve()
    await Promise.resolve()

    const last = onChange.mock.calls.at(-1)![0]!
    expect(last.from.time).toBe('09:00')
    expect(last.to.time).toBe('14:00')
  })

  it('под оверлей отведено место: последняя неделя не накрыта', () => {
    mount()
    pickOneDay(T)
    expect(host.querySelector('.dumb-dt-wrap')!.getAttribute('data-overlay')).toBe('1')
  })
})
