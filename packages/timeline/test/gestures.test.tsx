// Жесты шахматки в DOM: драг, протяжка, отмены.
//
// Математика покрыта юнитами (`scale.test.ts`, `audit.test.ts`), а вот сама
// жестовая машинерия — слушатели на window, IO-снимок координат, гонки
// «жест кончился раньше снимка» — до этих тестов проверялась только руками.
// Здесь она гоняется в happy-dom с мокнутым IntersectionObserver.
//
// Мок IO двух сортов: СИНХРОННЫЙ (снимок приходит прямо в observe — обычный
// браузерный случай «жест дольше кадра») и АСИНХРОННЫЙ (снимок в микротаске —
// это гонка быстрого жеста, из-за которой у protяжки есть путь `upX`).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from 'solid-js/web'
import { DumbTimeline, type Span } from '../src'

/* ── моки наблюдателей: happy-dom их не даёт ────────────────────────────── */

type IoCb = (entries: Array<{ boundingClientRect: { left: number; top: number } }>) => void

/** канва «стоит в (0,0)» — как и отдаёт happy-dom из getBoundingClientRect */
const ENTRY = [{ boundingClientRect: { left: 0, top: 0 } }]

function mockIO(mode: 'sync' | 'micro') {
  ;(globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class {
    cb: IoCb
    constructor(cb: IoCb) {
      this.cb = cb
    }
    observe() {
      if (mode === 'sync') this.cb(ENTRY)
      else queueMicrotask(() => this.cb(ENTRY))
    }
    disconnect() {}
  }
}

beforeEach(() => {
  mockIO('sync')
  ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe() {}
    disconnect() {}
  }
})

/* ── события: happy-dom без PointerEvent, хватает MouseEvent с добавками ── */

function pev(type: string, o: { x?: number; y?: number; button?: number; primary?: boolean } = {}) {
  const e = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: o.x ?? 0,
    clientY: o.y ?? 0,
    button: o.button ?? 0,
  })
  Object.defineProperty(e, 'isPrimary', { value: o.primary ?? true })
  Object.defineProperty(e, 'pointerId', { value: 1 })
  return e
}

const esc = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

/* ── монтирование ───────────────────────────────────────────────────────── */

let host: HTMLDivElement
let dispose: (() => void) | null = null

afterEach(() => {
  dispose?.()
  dispose = null
  host?.remove()
})

type P = Partial<Parameters<typeof DumbTimeline>[0]>

function mount(extra: P) {
  host = document.createElement('div')
  document.body.appendChild(host)
  dispose = render(
    () => (
      <DumbTimeline
        rows={[{ id: '101', title: '101' }]}
        spans={[]}
        from="2026-06-01"
        days={30}
        colW={30}
        stepMin={1440}
        checkIn={16 * 60}
        checkOut={12 * 60}
        {...(extra as object)}
      />
    ),
    host,
  )
  return {
    span: () => host.querySelector<HTMLElement>('.dumb-tl-span')!,
    canvas: () => host.querySelector<HTMLElement>('.dumb-tl-canvas')!,
    pick: () => host.querySelector<HTMLElement>('.dumb-tl-pick'),
  }
}

const BOOKING: Span = { id: 'b1', row: '101', from: '2026-06-05', to: '2026-06-08' }

/* ── драг ───────────────────────────────────────────────────────────────── */

describe('драг полосы', () => {
  it('перенос на две колонки отдаёт onChange со сдвинутыми датами', () => {
    const onChange = vi.fn()
    const ui = mount({ spans: [BOOKING], onChange })
    ui.span().dispatchEvent(pev('pointerdown', { x: 160, y: 10 }))
    window.dispatchEvent(pev('pointermove', { x: 160 + 2 * 30, y: 10 }))
    window.dispatchEvent(pev('pointerup', { x: 160 + 2 * 30, y: 10 }))
    expect(onChange).toHaveBeenCalledTimes(1)
    const [next, prev, kind] = onChange.mock.calls[0]
    expect(prev.from).toBe('2026-06-05')
    expect(next.from).toBe('2026-06-07T16:00')
    expect(next.to).toBe('2026-06-10T12:00')
    expect(kind).toBe('move')
  })

  it('пресет шкалы одним пропом `scale` даёт ту же геометрию', () => {
    const onChange = vi.fn()
    const ui = mount({
      spans: [BOOKING],
      onChange,
      // плоские пропсы выключены — вся шкала из пресета
      from: undefined,
      days: undefined,
      stepMin: undefined,
      checkIn: undefined,
      checkOut: undefined,
      colW: undefined,
      scale: {
        first: '2026-06-01', days: 30, colW: 30,
        dayStart: 0, dayEnd: 1440, stepMin: 1440,
        checkIn: 16 * 60, checkOut: 12 * 60,
      },
    })
    ui.span().dispatchEvent(pev('pointerdown', { x: 160, y: 10 }))
    window.dispatchEvent(pev('pointermove', { x: 160 + 2 * 30, y: 10 }))
    window.dispatchEvent(pev('pointerup', { x: 160 + 2 * 30, y: 10 }))
    expect(onChange.mock.calls[0][0].from).toBe('2026-06-07T16:00')
  })

  it('pointercancel бросает жест: ни onChange, ни залипшего draft', () => {
    const onChange = vi.fn()
    const ui = mount({ spans: [BOOKING], onChange })
    ui.span().dispatchEvent(pev('pointerdown', { x: 160, y: 10 }))
    window.dispatchEvent(pev('pointermove', { x: 220, y: 10 }))
    expect(ui.span().dataset.drag).toBe('1')
    window.dispatchEvent(pev('pointercancel'))
    expect(ui.span().dataset.drag).toBeUndefined()
    // запоздавший pointerup уже никому не адресован
    window.dispatchEvent(pev('pointerup', { x: 220, y: 10 }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('Escape отменяет драг', () => {
    const onChange = vi.fn()
    const ui = mount({ spans: [BOOKING], onChange })
    ui.span().dispatchEvent(pev('pointerdown', { x: 160, y: 10 }))
    window.dispatchEvent(pev('pointermove', { x: 220, y: 10 }))
    esc()
    window.dispatchEvent(pev('pointerup', { x: 220, y: 10 }))
    expect(onChange).not.toHaveBeenCalled()
    expect(ui.span().dataset.drag).toBeUndefined()
  })

  it('второй (не primary) палец жеста не начинает', () => {
    const onChange = vi.fn()
    const ui = mount({ spans: [BOOKING], onChange })
    ui.span().dispatchEvent(pev('pointerdown', { x: 160, y: 10, primary: false }))
    window.dispatchEvent(pev('pointermove', { x: 260, y: 10 }))
    window.dispatchEvent(pev('pointerup', { x: 260, y: 10 }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('быстрый клик при ЗАПОЗДАВШЕМ снимке не оставляет призрачный draft', async () => {
    mockIO('micro')
    const onChange = vi.fn()
    const ui = mount({ spans: [BOOKING], onChange })
    ui.span().dispatchEvent(pev('pointerdown', { x: 160, y: 10 }))
    window.dispatchEvent(pev('pointerup', { x: 160, y: 10 }))
    await Promise.resolve()               // IO-микротаск догоняет уже мёртвый жест
    expect(onChange).not.toHaveBeenCalled()
    expect(ui.span().dataset.drag).toBeUndefined()
  })

  it('размонтирование посреди драга снимает слушатели с window', () => {
    const onChange = vi.fn()
    const ui = mount({ spans: [BOOKING], onChange })
    ui.span().dispatchEvent(pev('pointerdown', { x: 160, y: 10 }))
    window.dispatchEvent(pev('pointermove', { x: 220, y: 10 }))
    dispose?.()
    dispose = null
    // после смерти компонента жест не должен ни упасть, ни сработать
    window.dispatchEvent(pev('pointermove', { x: 260, y: 10 }))
    window.dispatchEvent(pev('pointerup', { x: 260, y: 10 }))
    expect(onChange).not.toHaveBeenCalled()
    expect(document.body.style.userSelect).toBe('')   // подавление выделения снято
  })
})

/* ── протяжка по пустому месту ──────────────────────────────────────────── */

const HOURLY: P = {
  rows: [{ id: 'ban', title: 'Баня', unit: 'hour' as const, minMin: 120, gapMin: 30 }],
  spans: [],
  days: 3,
  colW: 10,
  stepMin: 60,
  dayStart: 0,
  dayEnd: 1440,
  checkIn: undefined,
  checkOut: undefined,
}

describe('протяжка по пустому месту', () => {
  it('влево — работает, и короткое выделение добивается до минимума строки', () => {
    const onRangeSelect = vi.fn()
    const ui = mount({ ...HOURLY, onRangeSelect })
    // 10:00 → 9:00 (влево на час при минимуме бани в два часа)
    ui.canvas().dispatchEvent(pev('pointerdown', { x: 100, y: 10 }))
    window.dispatchEvent(pev('pointermove', { x: 90, y: 10 }))
    window.dispatchEvent(pev('pointerup', { x: 90, y: 10 }))
    expect(onRangeSelect).toHaveBeenCalledTimes(1)
    const r = onRangeSelect.mock.calls[0][0]
    expect(r).toMatchObject({ row: 'ban', needsTime: false })
    expect(r.from).toBe('2026-06-01T09:00')
    expect(r.to).toBe('2026-06-01T11:00')     // час выделили — два продали
  })

  it('жест быстрее IO-снимка всё равно создаёт выделение (путь upX)', async () => {
    mockIO('micro')
    const onRangeSelect = vi.fn()
    const ui = mount({ ...HOURLY, onRangeSelect })
    ui.canvas().dispatchEvent(pev('pointerdown', { x: 100, y: 10 }))
    window.dispatchEvent(pev('pointermove', { x: 140, y: 10 }))
    window.dispatchEvent(pev('pointerup', { x: 140, y: 10 }))
    await Promise.resolve()
    expect(onRangeSelect).toHaveBeenCalledTimes(1)
    expect(onRangeSelect.mock.calls[0][0].from).toBe('2026-06-01T10:00')
  })

  it('Escape гасит рамку и не создаёт ничего', () => {
    const onRangeSelect = vi.fn()
    const ui = mount({ ...HOURLY, onRangeSelect })
    ui.canvas().dispatchEvent(pev('pointerdown', { x: 100, y: 10 }))
    window.dispatchEvent(pev('pointermove', { x: 160, y: 10 }))
    expect(ui.pick()).not.toBeNull()
    esc()
    expect(ui.pick()).toBeNull()
    window.dispatchEvent(pev('pointerup', { x: 160, y: 10 }))
    expect(onRangeSelect).not.toHaveBeenCalled()
  })

  it('отмена раньше запоздавшего снимка не воскрешает рамку', async () => {
    mockIO('micro')
    const onRangeSelect = vi.fn()
    const ui = mount({ ...HOURLY, onRangeSelect })
    ui.canvas().dispatchEvent(pev('pointerdown', { x: 100, y: 10 }))
    window.dispatchEvent(pev('pointercancel'))
    await Promise.resolve()
    expect(ui.pick()).toBeNull()
    expect(onRangeSelect).not.toHaveBeenCalled()
  })

  it('соседи с зазором обрезают выделение', () => {
    const onRangeSelect = vi.fn()
    const busy: Span = { id: 's1', row: 'ban', from: '2026-06-01T12:00', to: '2026-06-01T14:00' }
    const ui = mount({ ...HOURLY, spans: [busy], onRangeSelect })
    // тянем 9:00 → 13:00 сквозь сеанс: упрёмся в 12:00 минус полчаса уборки
    ui.canvas().dispatchEvent(pev('pointerdown', { x: 90, y: 10 }))
    window.dispatchEvent(pev('pointermove', { x: 130, y: 10 }))
    window.dispatchEvent(pev('pointerup', { x: 130, y: 10 }))
    expect(onRangeSelect).toHaveBeenCalledTimes(1)
    expect(onRangeSelect.mock.calls[0][0].to).toBe('2026-06-01T11:30')
  })
})
