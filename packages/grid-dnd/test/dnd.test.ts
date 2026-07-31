// Нативную сетку тестируем в двух слоях: решающую арифметику — напрямую
// (planDrop), а обвязку — смоуком. Сам жест воспроизвести нельзя: его ведёт
// браузер, и Pragmatic поверх него.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createGridDndEngine, planDrop } from '../src/dndCore'
import type { Metrics } from '@solid-dumb-kit/grid'

// 6 колонок по 100px без зазоров, строка 100px — координаты читаются глазами
const M: Metrics = { cols: 6, colW: 100, rowH: 100, gapX: 0, gapY: 0 }
const span = (id: string, w = 3, h = 1) => ({ id, w, h })

describe('planDrop — куда встанет блок', () => {
  const spans = [span('a'), span('b')]        // a: колонки 0–2, b: 3–5

  it('правее центра соседа — за ним', () => {
    const plan = planDrop({ spans, m: M, x: 470, y: 50, drag: { id: 'a', w: 3, h: 1, fromIndex: 0 } })
    expect(plan.index).toBe(1)
  })

  it('левее центра соседа — перед ним', () => {
    const plan = planDrop({ spans, m: M, x: 30, y: 50, drag: { id: 'b', w: 3, h: 1, fromIndex: 1 } })
    expect(plan.index).toBe(0)
  })

  it('ниже всех блоков — в конец', () => {
    const plan = planDrop({ spans, m: M, x: 50, y: 350, drag: { id: 'a', w: 3, h: 1, fromIndex: 0 } })
    expect(plan.index).toBe(1)
  })

  it('соседи разъезжаются ровно на разницу раскладок', () => {
    const plan = planDrop({ spans, m: M, x: 470, y: 50, drag: { id: 'a', w: 3, h: 1, fromIndex: 0 } })
    // a уходит за b, значит b сдвигается на его место — влево на 300px
    expect(plan.moves).toEqual([{ id: 'b', dx: -300, dy: 0 }])
  })

  it('на своём месте никто никуда не едет', () => {
    const plan = planDrop({ spans, m: M, x: 30, y: 50, drag: { id: 'a', w: 3, h: 1, fromIndex: 0 } })
    expect(plan.index).toBe(0)
    expect(plan.moves.every((m) => !m.dx && !m.dy)).toBe(true)
  })

  it('гость из чужой сетки раздвигает её и получает своё место', () => {
    // тащим блок в 6 колонок шириной: он не влезает рядом, значит уедет строкой
    const plan = planDrop({
      spans, m: M, x: 30, y: 50,
      drag: { id: 'guest', w: 6, h: 2, fromIndex: null },
    })
    expect(plan.index).toBe(0)
    expect(plan.rect).toEqual({ x: 0, y: 0, width: 600, height: 200 })
    // оба местных блока съезжают под гостя
    expect(plan.moves).toEqual([
      { id: 'a', dx: 0, dy: 200 },
      { id: 'b', dx: 0, dy: 200 },
    ])
  })

  it('гость шире сетки зажимается по её ширине', () => {
    const plan = planDrop({
      spans, m: M, x: 30, y: 50,
      drag: { id: 'guest', w: 99, h: 1, fromIndex: null },
    })
    expect(plan.rect?.width).toBe(600)
  })

  it('позиция считается от координат, а не от того, что под курсором', () => {
    // одна и та же точка даёт один и тот же ответ независимо от порядка вызовов
    const a = planDrop({ spans, m: M, x: 470, y: 50, drag: { id: 'a', w: 3, h: 1, fromIndex: 0 } })
    const b = planDrop({ spans, m: M, x: 470, y: 50, drag: { id: 'a', w: 3, h: 1, fromIndex: 0 } })
    expect(a.index).toBe(b.index)
    expect(a.moves).toEqual(b.moves)
  })
})

describe('createGridDndEngine — обвязка', () => {
  const el = () => {
    const node = document.createElement('div')
    document.body.appendChild(node)
    return node
  }

  afterEach(() => { document.body.innerHTML = '' })

  const zoneOpts = (order: Array<string>) => ({
    order: () => order,
    spanOf: () => ({ w: 3, h: 1 }),
    cols: () => 6, rowHeight: () => 100, gapX: () => 0, gapY: () => 0,
  })

  it('создаётся без реактивного контекста и пуст до жеста', () => {
    const engine = createGridDndEngine({})
    expect(engine.active()).toBeNull()
    expect(engine.over()).toBeNull()
    engine.destroy()
  })

  it('регистрирует контейнер и блоки, отписки чистят за собой', () => {
    const engine = createGridDndEngine({})
    const zone = engine.grid('a', zoneOpts(['x']))
    const box = el()
    const block = el()

    const offBox = zone.attachContainer(box)
    const offBlock = zone.attach(block, 'x')
    expect(block.dataset.dndBlock).toBe('x')

    offBlock()
    expect(block.dataset.dndBlock).toBeUndefined()
    offBox()
    engine.destroy()
  })

  it('повторная регистрация той же сетки обновляет опции, а не плодит зоны', () => {
    const engine = createGridDndEngine({})
    const first = engine.grid('a', zoneOpts(['x']))
    const second = engine.grid('a', zoneOpts(['x', 'y']))
    expect(typeof first.attach).toBe('function')
    expect(typeof second.attach).toBe('function')
    engine.destroy()
  })

  it('destroy без единой регистрации не падает', () => {
    const engine = createGridDndEngine({})
    expect(() => engine.destroy()).not.toThrow()
  })

  it('destroy снимает наблюдатель размера контейнера', () => {
    const disconnect = vi.fn()
    class RO {
      constructor(private cb: ResizeObserverCallback) {}
      observe() {}
      unobserve() {}
      disconnect() { disconnect() }
    }
    vi.stubGlobal('ResizeObserver', RO)

    const engine = createGridDndEngine({})
    const zone = engine.grid('a', zoneOpts(['x']))
    zone.attachContainer(el())
    engine.destroy()

    expect(disconnect).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
