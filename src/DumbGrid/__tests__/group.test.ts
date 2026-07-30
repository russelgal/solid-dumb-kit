// Группа сеток: блок переезжает из одной сетки в другую. Живой драг тестами не
// проверить, но всё, что решает исход — какая зона под указателем, куда блок
// встанет и что уйдёт в onTransfer, — проверяется на моках наблюдателей.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createGridGroupEngine } from '../gridGroup'

type Box = { left: number; top: number; width: number; height: number }

/**
 * Наблюдатели, которых нет в happy-dom. IntersectionObserver копит цели и
 * отдаёт их ОДНИМ колбэком на микротаске — как настоящий: движок снимает все
 * контейнеры разом и ждёт единственного вызова.
 */
function stubObservers(boxes: Map<Element, Box>, opts: { splitBatches?: boolean } = {}) {
  class RO {
    constructor(private cb: ResizeObserverCallback) {}
    observe(el: Element) {
      const b = boxes.get(el)
      this.cb([{ target: el, contentRect: { width: b?.width ?? 0, height: b?.height ?? 0, left: 0, top: 0 } } as any], this as any)
    }
    unobserve() {}
    disconnect() {}
  }
  class IO {
    private targets: Element[] = []
    private scheduled = false
    private dead = false
    constructor(private cb: IntersectionObserverCallback) {}
    private entry(t: Element) {
      return { target: t, boundingClientRect: boxes.get(t) ?? { left: 0, top: 0, width: 0, height: 0 } } as any
    }
    observe(el: Element) {
      this.targets.push(el)
      if (this.scheduled) return
      this.scheduled = true
      queueMicrotask(() => {
        if (this.dead) return
        // настоящий наблюдатель НЕ обязан присылать все цели одним батчем —
        // этот режим отдаёт их по одной, отдельными колбэками
        if (opts.splitBatches) {
          for (const t of this.targets) {
            if (this.dead) return
            this.cb([this.entry(t)], this as any)
          }
          return
        }
        this.cb(this.targets.map((t) => this.entry(t)), this as any)
      })
    }
    unobserve() {}
    disconnect() { this.dead = true }
    takeRecords() { return [] }
  }
  vi.stubGlobal('ResizeObserver', RO)
  vi.stubGlobal('IntersectionObserver', IO)
}

const nextFrames = (n = 3) =>
  new Promise<void>((done) => {
    const tick = (left: number) => (left <= 0 ? done() : requestAnimationFrame(() => tick(left - 1)))
    tick(n)
  })

const el = () => {
  const node = document.createElement('div')
  document.body.appendChild(node)
  return node
}

// Две сетки бок о бок: A занимает 0–600 по X, B — 600–1200. Обе по 6 колонок
// шириной 100px без зазоров, строка 100px — координаты читаются глазами.
function setup(opts: { accepts?: (from: string) => boolean; splitBatches?: boolean } = {}) {
  const boxA = el()
  const boxB = el()
  const boxes = new Map<Element, Box>([
    [boxA, { left: 0, top: 0, width: 600, height: 400 }],
    [boxB, { left: 600, top: 0, width: 600, height: 400 }],
  ])
  stubObservers(boxes, { splitBatches: opts.splitBatches })

  const onTransfer = vi.fn()
  const onReorderA = vi.fn()
  const group = createGridGroupEngine({ onTransfer, animate: false })

  const zoneA = group.grid('a', {
    blocks: () => [
      { id: 'a1', w: 3, h: 1 },
      { id: 'a2', w: 3, h: 1 },
    ],
    cols: () => 6, rowHeight: () => 100, gapX: () => 0, gapY: () => 0,
    onReorder: onReorderA,
  })
  const zoneB = group.grid('b', {
    blocks: () => [{ id: 'b1', w: 3, h: 1 }],
    cols: () => 6, rowHeight: () => 100, gapX: () => 0, gapY: () => 0,
    accepts: opts.accepts,
  })

  const a1 = el()
  const a2 = el()
  const b1 = el()
  zoneA.attachContainer(boxA)
  zoneA.attach(a1, 'a1')
  zoneA.attach(a2, 'a2')
  zoneB.attachContainer(boxB)
  zoneB.attach(b1, 'b1')

  return { group, onTransfer, onReorderA, a1, a2, b1, boxA, boxB }
}

const down = (target: HTMLElement, x: number, y: number) =>
  target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 51, clientX: x, clientY: y }))
const move = (x: number, y: number) =>
  window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 51, clientX: x, clientY: y }))
const up = () => window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 51 }))

afterEach(() => vi.unstubAllGlobals())

describe('createGridGroupEngine — вне Solid', () => {
  it('создаётся без реактивного контекста и отдаёт зоны', () => {
    const { group } = setup()
    expect(group.active()).toBeNull()
    expect(group.over()).toBeNull()
    group.destroy()
  })

  it('блоки помечены, отписки работают', () => {
    stubObservers(new Map())
    const group = createGridGroupEngine({})
    const zone = group.grid('a', {
      blocks: () => [{ id: 'x', w: 1, h: 1 }],
      cols: () => 6, rowHeight: () => 50, gapX: () => 0, gapY: () => 0,
    })
    const block = el()
    const off = zone.attach(block, 'x')
    expect(block.dataset.gridBlock).toBe('x')
    off()
    expect(block.dataset.gridBlock).toBeUndefined()
    group.destroy()
  })
})

describe('перенос блока между сетками', () => {
  it('дроп над чужой сеткой отдаёт onTransfer с местом вставки', async () => {
    const { group, onTransfer, a1 } = setup()

    down(a1, 50, 50)
    await nextFrames()
    move(950, 50)            // правее центра b1 (600–900) → встать за ним
    await nextFrames()
    expect(group.over()).toBe('b')
    up()

    expect(onTransfer).toHaveBeenCalledWith(
      { grid: 'a', id: 'a1', index: 0 },
      expect.objectContaining({ grid: 'b', index: 1 }),
    )
    group.destroy()
  })

  it('слева от чужого блока — вставка перед ним', async () => {
    const { group, onTransfer, a1 } = setup()

    down(a1, 50, 50)
    await nextFrames()
    move(640, 50)            // левее центра b1
    await nextFrames()
    up()

    expect(onTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1' }),
      expect.objectContaining({ grid: 'b', index: 0 }),
    )
    group.destroy()
  })

  it('дроп в своей сетке переносом не считается — это перестановка', async () => {
    const { group, onTransfer, onReorderA, a1 } = setup()

    down(a1, 50, 50)
    await nextFrames()
    move(470, 50)            // правее центра a2 (300–600, центр 450)
    await nextFrames()
    up()

    expect(onTransfer).not.toHaveBeenCalled()
    expect(onReorderA).toHaveBeenCalledWith(0, 1)
    group.destroy()
  })

  it('сетка, которая не принимает, остаётся в стороне', async () => {
    const { group, onTransfer, a1 } = setup({ accepts: (from) => from !== 'a' })

    down(a1, 50, 50)
    await nextFrames()
    move(950, 50)
    await nextFrames()
    expect(group.over()).toBe('a')       // указатель над b, но она не принимает
    up()

    expect(onTransfer).not.toHaveBeenCalled()
    group.destroy()
  })

  it('Esc отменяет перенос', async () => {
    const { group, onTransfer, a1 } = setup()

    down(a1, 50, 50)
    await nextFrames()
    move(950, 50)
    await nextFrames()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    up()

    expect(onTransfer).not.toHaveBeenCalled()
    expect(group.active()).toBeNull()
    group.destroy()
  })

  it('за курсором летит клон, а оригинал держит место', async () => {
    const { group, a1 } = setup()

    down(a1, 50, 50)
    await nextFrames()
    const ghost = document.querySelector('[data-dumb-grid-ghost]') as HTMLElement
    expect(ghost).toBeTruthy()
    expect(ghost.style.position).toBe('fixed')
    expect(a1.style.opacity).toBe('0.4')        // оригинал на месте, приглушён

    move(950, 120)
    await nextFrames()
    expect(ghost.style.transform).toBe('translate(900px,70px)')

    up()
    expect(document.querySelector('[data-dumb-grid-ghost]')).toBeNull()
    expect(a1.style.opacity).toBe('')
    group.destroy()
  })

  it('рамка будущего места живёт в целевой сетке', async () => {
    const { group, a1, boxA, boxB } = setup()

    down(a1, 50, 50)
    await nextFrames()
    expect(boxA.querySelector('[data-grid-preview]')).toBeTruthy()

    move(950, 50)
    await nextFrames()
    expect(boxA.querySelector('[data-grid-preview]')).toBeNull()
    expect(boxB.querySelector('[data-grid-preview]')).toBeTruthy()

    up()
    group.destroy()
  })
})

describe('перенос работает в обе стороны', () => {
  // Регрессия: снимок отписывался после ПЕРВОГО колбэка наблюдателя, из-за чего
  // второй контейнер терял прямоугольник и получал запасной размер «во весь
  // экран». Такая зона накрывала соседей и забирала любой хиттест: в неё блок
  // прилетал, а из неё не выносился.
  for (const splitBatches of [false, true]) {
    const label = splitBatches ? 'наблюдатель отдаёт цели по одной' : 'наблюдатель отдаёт цели батчем'

    it(`слева направо — ${label}`, async () => {
      const { group, onTransfer, a1 } = setup({ splitBatches })
      down(a1, 50, 50)
      await nextFrames()
      move(950, 50)
      await nextFrames()
      up()

      expect(onTransfer).toHaveBeenCalledWith(
        expect.objectContaining({ grid: 'a', id: 'a1' }),
        expect.objectContaining({ grid: 'b' }),
      )
      group.destroy()
    })

    it(`справа налево — ${label}`, async () => {
      const { group, onTransfer, b1 } = setup({ splitBatches })
      down(b1, 650, 50)
      await nextFrames()
      move(50, 50)
      await nextFrames()
      up()

      expect(onTransfer).toHaveBeenCalledWith(
        expect.objectContaining({ grid: 'b', id: 'b1' }),
        expect.objectContaining({ grid: 'a' }),
      )
      group.destroy()
    })
  }

  it('зона без известного прямоугольника не перехватывает дропы', async () => {
    // контейнер b наблюдателю не известен — он не должен претендовать на весь экран
    const boxA = el()
    const boxB = el()
    stubObservers(new Map([[boxA, { left: 0, top: 0, width: 600, height: 400 }]]))

    const onTransfer = vi.fn()
    const group = createGridGroupEngine({ onTransfer })
    const zoneA = group.grid('a', {
      blocks: () => [{ id: 'a1', w: 3, h: 1 }],
      cols: () => 6, rowHeight: () => 100, gapX: () => 0, gapY: () => 0,
    })
    const zoneB = group.grid('b', {
      blocks: () => [],
      cols: () => 6, rowHeight: () => 100, gapX: () => 0, gapY: () => 0,
    })
    const a1 = el()
    zoneA.attachContainer(boxA)
    zoneA.attach(a1, 'a1')
    zoneB.attachContainer(boxB)

    down(a1, 50, 50)
    await nextFrames()
    move(950, 50)                       // мимо всех известных зон
    await nextFrames()
    expect(group.over()).toBe('a')      // держим прошлую, а не «зону во весь экран»
    up()

    expect(onTransfer).not.toHaveBeenCalled()
    group.destroy()
  })
})
