// Движок нативной сетки: живой перенос тестами не проверить, но всё, что решает
// исход — какая сетка приняла dragover, куда встанет блок и что уйдёт наружу, —
// проверяется настоящими DragEvent с DataTransfer.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createGridDndEngine, DND_MIME } from '../dndCore'

type Box = { left: number; top: number; width: number; height: number }

/** ResizeObserver в happy-dom отсутствует: подкладываем ширину контента зон */
function stubRO(boxes: Map<Element, Box>) {
  class RO {
    constructor(private cb: ResizeObserverCallback) {}
    observe(el: Element) {
      const b = boxes.get(el)
      this.cb([{ target: el, contentRect: { width: b?.width ?? 0, height: b?.height ?? 0, left: 0, top: 0 } } as any], this as any)
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', RO)
}

/** getBoundingClientRect happy-dom всегда нулевой — подставляем свой */
function stubRect(el: HTMLElement, box: Box) {
  el.getBoundingClientRect = () => ({
    left: box.left, top: box.top, width: box.width, height: box.height,
    right: box.left + box.width, bottom: box.top + box.height, x: box.left, y: box.top,
    toJSON: () => ({}),
  }) as DOMRect
}

const el = () => {
  const node = document.createElement('div')
  document.body.appendChild(node)
  return node
}

const dt = () => new DataTransfer()
const fire = (
  target: EventTarget,
  type: string,
  at: { clientX?: number; clientY?: number } = {},
  transfer?: DataTransfer,
) => {
  const ev = new DragEvent(type, { bubbles: true, cancelable: true })
  // happy-dom не пробрасывает через конструктор ни dataTransfer, ни координаты
  if (transfer && !ev.dataTransfer) Object.defineProperty(ev, 'dataTransfer', { value: transfer })
  Object.defineProperty(ev, 'clientX', { value: at.clientX ?? 0 })
  Object.defineProperty(ev, 'clientY', { value: at.clientY ?? 0 })
  target.dispatchEvent(ev)
  return ev
}

afterEach(() => vi.unstubAllGlobals())

// Две сетки бок о бок: A занимает 0–600 по X, B — 600–1200.
// По 6 колонок шириной 100px без зазоров, строка 100px.
function setup(opts: { accepts?: (from: string) => boolean; mode?: 'flow' | 'free' } = {}) {
  const boxA = el()
  const boxB = el()
  const boxes = new Map<Element, Box>([
    [boxA, { left: 0, top: 0, width: 600, height: 400 }],
    [boxB, { left: 600, top: 0, width: 600, height: 400 }],
  ])
  stubRO(boxes)
  stubRect(boxA, boxes.get(boxA)!)
  stubRect(boxB, boxes.get(boxB)!)

  const onTransfer = vi.fn()
  const onReorderA = vi.fn()
  const onMoveA = vi.fn()
  const onResizeA = vi.fn()
  const engine = createGridDndEngine({ onTransfer, animate: false })

  const zoneA = engine.grid('a', {
    blocks: () => [
      { id: 'a1', w: 3, h: 1, x: 0, y: 0 },
      { id: 'a2', w: 3, h: 1, x: 3, y: 0 },
    ],
    mode: () => opts.mode ?? 'flow',
    cols: () => 6, rowHeight: () => 100, gapX: () => 0, gapY: () => 0,
    onReorder: onReorderA, onMove: onMoveA, onResize: onResizeA,
  })
  const zoneB = engine.grid('b', {
    blocks: () => [{ id: 'b1', w: 3, h: 1, x: 0, y: 0 }],
    mode: () => opts.mode ?? 'flow',
    cols: () => 6, rowHeight: () => 100, gapX: () => 0, gapY: () => 0,
    accepts: opts.accepts,
  })

  const a1 = el(); const a2 = el(); const b1 = el()
  zoneA.attachContainer(boxA)
  zoneA.attach(a1, 'a1')
  zoneA.attach(a2, 'a2')
  zoneB.attachContainer(boxB)
  zoneB.attach(b1, 'b1')

  return { engine, onTransfer, onReorderA, onMoveA, onResizeA, a1, a2, b1, boxA, boxB, zoneA }
}

describe('createGridDndEngine — вне Solid', () => {
  it('создаётся без реактивного контекста', () => {
    const { engine } = setup()
    expect(engine.active()).toBeNull()
    expect(engine.over()).toBeNull()
    engine.destroy()
  })

  it('блоки становятся нативно перетаскиваемыми, отписка это снимает', () => {
    const { engine, zoneA, a1 } = setup()
    expect(a1.getAttribute('draggable')).toBe('true')
    expect(a1.dataset.gridBlock).toBe('a1')

    const block = el()
    const off = zoneA.attach(block, 'tmp')
    off()
    expect(block.getAttribute('draggable')).toBeNull()
    expect(block.dataset.gridBlock).toBeUndefined()
    engine.destroy()
  })

  it('ручка ресайза сама не перетаскивается', () => {
    const { engine, zoneA } = setup()
    const handle = el()
    zoneA.attachResize(handle, 'a1')
    expect(handle.getAttribute('draggable')).toBe('false')
    expect(handle.dataset.gridResize).toBe('')
    engine.destroy()
  })
})

describe('перенос между сетками — зону выбирает браузер', () => {
  it('dragover в чужой сетке, дроп отдаёт onTransfer', () => {
    const { engine, onTransfer, a1, boxB } = setup()
    const transfer = dt()

    fire(a1, 'dragstart', { clientX: 50, clientY: 50 }, transfer)
    expect(engine.active()).toEqual({ grid: 'a', id: 'a1', kind: 'move' })

    fire(boxB, 'dragover', { clientX: 950, clientY: 50 }, transfer)
    expect(engine.over()).toBe('b')
    fire(boxB, 'drop', { clientX: 950, clientY: 50 }, transfer)

    expect(onTransfer).toHaveBeenCalledWith(
      { grid: 'a', id: 'a1', index: 0 },
      expect.objectContaining({ grid: 'b', index: 1 }),
    )
    engine.destroy()
  })

  it('и обратно — направление больше ничего не решает', () => {
    const { engine, onTransfer, b1, boxA } = setup()
    const transfer = dt()

    fire(b1, 'dragstart', { clientX: 650, clientY: 50 }, transfer)
    fire(boxA, 'dragover', { clientX: 50, clientY: 50 }, transfer)
    fire(boxA, 'drop', { clientX: 50, clientY: 50 }, transfer)

    expect(onTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ grid: 'b', id: 'b1' }),
      expect.objectContaining({ grid: 'a', index: 0 }),
    )
    engine.destroy()
  })

  it('сортировка внутри своей сетки идёт тем же dragover', () => {
    const { engine, onReorderA, onTransfer, a1, boxA } = setup()
    const transfer = dt()

    fire(a1, 'dragstart', { clientX: 50, clientY: 50 }, transfer)
    fire(boxA, 'dragover', { clientX: 470, clientY: 50 }, transfer)   // правее центра a2
    fire(boxA, 'drop', { clientX: 470, clientY: 50 }, transfer)

    expect(onTransfer).not.toHaveBeenCalled()
    expect(onReorderA).toHaveBeenCalledWith(0, 1)
    engine.destroy()
  })

  it('в свободном режиме дроп кладёт блок в ячейку под курсором', () => {
    const { engine, onMoveA, a1, boxA } = setup({ mode: 'free' })
    const transfer = dt()

    fire(a1, 'dragstart', { clientX: 50, clientY: 50 }, transfer)
    fire(boxA, 'dragover', { clientX: 200, clientY: 250 }, transfer)
    fire(boxA, 'drop', { clientX: 200, clientY: 250 }, transfer)

    expect(onMoveA).toHaveBeenCalledWith('a1', expect.any(Number), 2)
    engine.destroy()
  })

  it('непринимающая сетка не помечает dragover — браузер дропа не даст', () => {
    const { engine, onTransfer, a1, boxB } = setup({ accepts: (from) => from !== 'a' })
    const transfer = dt()

    fire(a1, 'dragstart', { clientX: 50, clientY: 50 }, transfer)
    const over = fire(boxB, 'dragover', { clientX: 950, clientY: 50 }, transfer)
    expect(over.defaultPrevented).toBe(false)
    expect(engine.over()).toBe('a')

    fire(boxB, 'drop', { clientX: 950, clientY: 50 }, transfer)
    expect(onTransfer).not.toHaveBeenCalled()
    engine.destroy()
  })

  it('принимающая — помечает, иначе дропа не будет вовсе', () => {
    const { engine, a1, boxB } = setup()
    const transfer = dt()
    fire(a1, 'dragstart', { clientX: 50, clientY: 50 }, transfer)
    expect(fire(boxB, 'dragover', { clientX: 950, clientY: 50 }, transfer).defaultPrevented).toBe(true)
    engine.destroy()
  })

  it('рамка будущего места переезжает в целевую сетку', () => {
    const { engine, a1, boxA, boxB } = setup()
    const transfer = dt()

    fire(a1, 'dragstart', { clientX: 50, clientY: 50 }, transfer)
    fire(boxA, 'dragover', { clientX: 470, clientY: 50 }, transfer)
    expect(boxA.querySelector('[data-grid-preview]')).toBeTruthy()

    fire(boxB, 'dragover', { clientX: 950, clientY: 50 }, transfer)
    expect(boxA.querySelector('[data-grid-preview]')).toBeNull()
    expect(boxB.querySelector('[data-grid-preview]')).toBeTruthy()
    engine.destroy()
  })

  it('dragend прибирает за собой', () => {
    const { engine, a1, boxB } = setup()
    const transfer = dt()

    fire(a1, 'dragstart', { clientX: 50, clientY: 50 }, transfer)
    fire(boxB, 'dragover', { clientX: 950, clientY: 50 }, transfer)
    fire(a1, 'dragend', {}, transfer)

    expect(engine.active()).toBeNull()
    expect(engine.over()).toBeNull()
    expect(boxB.querySelector('[data-grid-preview]')).toBeNull()
    expect(a1.style.opacity).toBe('')
    engine.destroy()
  })

  it('блок объявлен в dataTransfer — его поймёт и чужой приёмник', () => {
    const { engine, a1 } = setup()
    const transfer = dt()
    fire(a1, 'dragstart', { clientX: 50, clientY: 50 }, transfer)

    expect(transfer.getData(DND_MIME)).toBe(JSON.stringify({ grid: 'a', id: 'a1' }))
    expect(transfer.getData('text/plain')).toBe('a1')
    expect(transfer.effectAllowed).toBe('move')
    engine.destroy()
  })

  it('заблокированный блок перенос не начинает', () => {
    stubRO(new Map())
    const engine = createGridDndEngine({})
    const box = el()
    stubRect(box, { left: 0, top: 0, width: 600, height: 400 })
    const zone = engine.grid('a', {
      blocks: () => [{ id: 'x', w: 3, h: 1, locked: true }],
      cols: () => 6, rowHeight: () => 100, gapX: () => 0, gapY: () => 0,
    })
    const block = el()
    zone.attachContainer(box)
    zone.attach(block, 'x')

    const ev = fire(block, 'dragstart', { clientX: 10, clientY: 10 }, dt())
    expect(ev.defaultPrevented).toBe(true)      // отменённый dragstart = переноса нет
    expect(engine.active()).toBeNull()
    engine.destroy()
  })

  it('вложенная сетка забирает жест себе', () => {
    const { engine, a1 } = setup()
    const inner = document.createElement('div')
    inner.dataset.gridBlock = 'nested'
    a1.appendChild(inner)

    const ev = fire(inner, 'dragstart', { clientX: 20, clientY: 20 }, dt())
    expect(ev.defaultPrevented).toBe(true)
    expect(engine.active()).toBeNull()
    engine.destroy()
  })
})
