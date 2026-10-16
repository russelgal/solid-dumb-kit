// Крайние месяцы по краям периода (`spread`): длинный период виден целиком —
// слева месяц начала, справа месяц конца, края листаются порознь.

import { describe, it, expect, afterEach } from 'vitest'
import { flush } from 'solid-js'
import { render } from 'solid-js/web'
import { DumbDateRange } from '../src/DumbDateRange'
import type { Day } from '../src/dateMath'

let host: HTMLDivElement
let dispose: (() => void) | null = null

afterEach(() => {
  dispose?.()
  dispose = null
  host?.remove()
})

function mount(value: { from: Day; to: Day } | null, spread = true, months = 2) {
  host = document.createElement('div')
  document.body.appendChild(host)
  dispose = render(() => <DumbDateRange value={() => value} onChange={() => {}} months={months} spread={spread} />, host)
}

const titles = () => Array.from(host.querySelectorAll('.dumb-cal-title')).map((el) => el.textContent?.trim())
const nav = (panel: number, dir: 'back' | 'fwd') =>
  host.querySelectorAll('.dumb-cal-month')[panel]!.querySelector<HTMLButtonElement>(`[data-nav="${dir}"]`)

describe('DumbDateRange spread', () => {
  it('слева месяц начала, справа месяц конца', () => {
    mount({ from: '2026-01-01', to: '2026-10-16' })
    expect(titles()).toEqual(['январь 2026', 'октябрь 2026'])
  })

  it('период в одном месяце — справа следующий, как подряд', () => {
    mount({ from: '2026-10-01', to: '2026-10-31' })
    expect(titles()).toEqual(['октябрь 2026', 'ноябрь 2026'])
  })

  it('без spread — подряд от начала, как было', () => {
    mount({ from: '2026-01-01', to: '2026-10-16' }, false)
    expect(titles()).toEqual(['январь 2026', 'февраль 2026'])
  })

  it('края листаются порознь и не заходят друг за друга', () => {
    mount({ from: '2026-08-01', to: '2026-10-16' })
    nav(1, 'back')!.click()
    flush()
    expect(titles()).toEqual(['август 2026', 'сентябрь 2026'])
    // сошлись — ни первый вперёд, ни последний назад
    expect(nav(0, 'fwd')!.disabled).toBe(true)
    expect(nav(1, 'back')!.disabled).toBe(true)
    nav(1, 'fwd')!.click()
    flush()
    nav(0, 'back')!.click()
    flush()
    expect(titles()).toEqual(['июль 2026', 'октябрь 2026'])
  })

  it('средние месяцы идут подряд от начала', () => {
    mount({ from: '2026-01-01', to: '2026-10-16' }, true, 3)
    expect(titles()).toEqual(['январь 2026', 'февраль 2026', 'октябрь 2026'])
  })
})
