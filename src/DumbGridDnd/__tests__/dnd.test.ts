// Движок нативной сетки. Проверяем ровно то, что он решает: какая сетка приняла
// событие, перед каким соседом встанет блок и что уходит наружу.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createGridDndEngine, DND_MIME } from '../dndCore'

const el = () => {
  const node = document.createElement('div')
  document.body.appendChild(node)
  return node
}

/** happy-dom всегда отдаёт нулевой прямоугольник — подставляем свой */
function rect(node: HTMLElement, left: number, width = 100) {
  node.getBoundingClientRect = () => ({
    left, top: 0, width, height: 100, right: left + width, bottom: 100, x: left, y: 0,
    toJSON: () => ({}),
  }) as DOMRect
}

const dt = () => new DataTransfer()
const fire = (target: EventTarget, type: string, x = 0, transfer?: DataTransfer) => {
  const ev = new DragEvent(type, { bubbles: true, cancelable: true })
  // happy-dom не пробрасывает через конструктор ни dataTransfer, ни координаты
  if (transfer && !ev.dataTransfer) Object.defineProperty(ev, 'dataTransfer', { value: transfer })
  Object.defineProperty(ev, 'clientX', { value: x })
  Object.defineProperty(ev, 'clientY', { value: 50 })
  target.dispatchEvent(ev)
  return ev
}

afterEach(() => { document.body.innerHTML = '' })

/**
 * Две сетки. В A блоки a1 (0–100) и a2 (100–200), в B — b1 (400–500).
 * Порядок держит тест, как это делает потребитель.
 */
function setup(opts: { accepts?: (from: string) => boolean } = {}) {
  const onTransfer = vi.fn()
  const onReorderA = vi.fn()
  const engine = createGridDndEngine({ onTransfer })

  const boxA = el(); const boxB = el()
  const a1 = el(); const a2 = el(); const b1 = el()
  rect(a1, 0); rect(a2, 100); rect(b1, 400)

  const zoneA = engine.grid('a', { order: () => ['a1', 'a2'], onReorder: onReorderA })
  const zoneB = engine.grid('b', { order: () => ['b1'], accepts: opts.accepts })
  zoneA.attachContainer(boxA)
  zoneA.attach(a1, 'a1')
  zoneA.attach(a2, 'a2')
  zoneB.attachContainer(boxB)
  zoneB.attach(b1, 'b1')

  return { engine, onTransfer, onReorderA, boxA, boxB, a1, a2, b1 }
}

describe('createGridDndEngine — вне Solid', () => {
  it('блок становится перетаскиваемым, отписка это снимает', () => {
    const engine = createGridDndEngine()
    const zone = engine.grid('a', { order: () => ['x'] })
    const block = el()
    const off = zone.attach(block, 'x')

    expect(block.getAttribute('draggable')).toBe('true')
    expect(block.dataset.dndBlock).toBe('x')
    off()
    expect(block.getAttribute('draggable')).toBeNull()
    expect(block.dataset.dndBlock).toBeUndefined()
    engine.destroy()
  })

  it('до жеста состояние пустое', () => {
    const { engine } = setup()
    expect(engine.active()).toBeNull()
    expect(engine.over()).toBeNull()
    expect(engine.drop()).toBeNull()
    engine.destroy()
  })
})

describe('место вставки — по половине соседнего блока', () => {
  it('правее середины соседа — встаём за ним', () => {
    const { engine, onReorderA, a1, a2 } = setup()
    const transfer = dt()

    fire(a1, 'dragstart', 10, transfer)
    expect(engine.active()).toEqual({ grid: 'a', id: 'a1', w: 1, h: 1 })

    fire(a2, 'dragenter', 180, transfer)
    fire(a2, 'dragover', 180, transfer)          // a2: 100–200, центр 150
    expect(engine.drop()).toEqual({ grid: 'a', index: 1 })

    fire(a2, 'drop', 180, transfer)
    expect(onReorderA).toHaveBeenCalledWith(0, 1)
    engine.destroy()
  })

  it('левее середины соседа — встаём перед ним', () => {
    const { engine, onReorderA, a1, a2 } = setup()
    const transfer = dt()

    fire(a2, 'dragstart', 150, transfer)
    fire(a1, 'dragenter', 20, transfer)
    fire(a1, 'dragover', 20, transfer)           // a1: 0–100, центр 50
    expect(engine.drop()).toEqual({ grid: 'a', index: 0 })

    fire(a1, 'drop', 20, transfer)
    expect(onReorderA).toHaveBeenCalledWith(1, 0)
    engine.destroy()
  })

  it('пустое место сетки — это «в конец»', () => {
    const { engine, onReorderA, a1, boxA } = setup()
    const transfer = dt()

    fire(a1, 'dragstart', 10, transfer)
    fire(boxA, 'dragover', 500, transfer)        // мимо блоков
    expect(engine.drop()).toEqual({ grid: 'a', index: 1 })

    fire(boxA, 'drop', 500, transfer)
    expect(onReorderA).toHaveBeenCalledWith(0, 1)
    engine.destroy()
  })

  it('дроп на своё же место ничего не зовёт', () => {
    const { engine, onReorderA, onTransfer, a1 } = setup()
    const transfer = dt()

    fire(a1, 'dragstart', 10, transfer)
    fire(a1, 'dragenter', 20, transfer)
    fire(a1, 'dragover', 20, transfer)
    fire(a1, 'drop', 20, transfer)

    expect(onReorderA).not.toHaveBeenCalled()
    expect(onTransfer).not.toHaveBeenCalled()
    engine.destroy()
  })

})

describe('перенос между сетками', () => {
  it('дроп в чужой сетке отдаёт onTransfer', () => {
    const { engine, onTransfer, a1, b1 } = setup()
    const transfer = dt()

    fire(a1, 'dragstart', 10, transfer)
    fire(b1, 'dragenter', 480, transfer)
    fire(b1, 'dragover', 480, transfer)          // b1: 400–500, центр 450
    expect(engine.over()).toBe('b')
    fire(b1, 'drop', 480, transfer)

    expect(onTransfer).toHaveBeenCalledWith(
      { grid: 'a', id: 'a1', index: 0 },
      { grid: 'b', index: 1 },
    )
    engine.destroy()
  })

  it('и обратно — направление роли не играет', () => {
    const { engine, onTransfer, b1, a1 } = setup()
    const transfer = dt()

    fire(b1, 'dragstart', 420, transfer)
    fire(a1, 'dragenter', 20, transfer)
    fire(a1, 'dragover', 20, transfer)
    fire(a1, 'drop', 20, transfer)

    expect(onTransfer).toHaveBeenCalledWith(
      { grid: 'b', id: 'b1', index: 0 },
      { grid: 'a', index: 0 },
    )
    engine.destroy()
  })

  it('в пустую чужую сетку — в конец', () => {
    const { engine, onTransfer, a1, boxB } = setup()
    const transfer = dt()

    fire(a1, 'dragstart', 10, transfer)
    fire(boxB, 'dragover', 550, transfer)
    fire(boxB, 'drop', 550, transfer)

    expect(onTransfer).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }), { grid: 'b', index: 1 })
    engine.destroy()
  })

  it('непринимающая сетка не помечает dragover — браузер дропа не даст', () => {
    const { engine, onTransfer, a1, b1 } = setup({ accepts: (from) => from !== 'a' })
    const transfer = dt()

    fire(a1, 'dragstart', 10, transfer)
    const over = fire(b1, 'dragover', 480, transfer)
    expect(over.defaultPrevented).toBe(false)
    expect(engine.over()).toBe('a')

    fire(b1, 'drop', 480, transfer)
    expect(onTransfer).not.toHaveBeenCalled()
    engine.destroy()
  })

  it('принимающая — помечает, иначе дропа не будет вовсе', () => {
    const { engine, a1, b1 } = setup()
    const transfer = dt()
    fire(a1, 'dragstart', 10, transfer)
    expect(fire(b1, 'dragover', 480, transfer).defaultPrevented).toBe(true)
    engine.destroy()
  })
})

describe('старт и уборка', () => {
  it('блок объявлен в dataTransfer — его поймёт и чужой приёмник', () => {
    const { engine, a1 } = setup()
    const transfer = dt()
    fire(a1, 'dragstart', 10, transfer)

    expect(transfer.getData(DND_MIME)).toBe(JSON.stringify({ grid: 'a', id: 'a1' }))
    expect(transfer.getData('text/plain')).toBe('a1')
    expect(transfer.effectAllowed).toBe('move')
    engine.destroy()
  })

  it('выключенная сетка перенос не начинает', () => {
    const engine = createGridDndEngine({})
    const zone = engine.grid('a', { order: () => ['x'], disabled: () => true })
    const block = el()
    zone.attach(block, 'x')

    const ev = fire(block, 'dragstart', 10, dt())
    expect(ev.defaultPrevented).toBe(true)
    expect(engine.active()).toBeNull()
    engine.destroy()
  })

  it('вложенный блок забирает жест себе', () => {
    const { engine, a1 } = setup()
    const inner = document.createElement('div')
    inner.dataset.dndBlock = 'nested'
    a1.appendChild(inner)

    const ev = fire(inner, 'dragstart', 20, dt())
    expect(ev.defaultPrevented).toBe(true)
    expect(engine.active()).toBeNull()
    engine.destroy()
  })

  it('dragend прибирает состояние и метки', () => {
    const { engine, a1, a2 } = setup()
    const transfer = dt()

    fire(a1, 'dragstart', 10, transfer)
    fire(a2, 'dragenter', 180, transfer)
    fire(a2, 'dragover', 180, transfer)
    fire(a1, 'dragend', 0, transfer)

    expect(engine.active()).toBeNull()
    expect(engine.over()).toBeNull()
    expect(a1.style.opacity).toBe('')
    expect(engine.drop()).toBeNull()
    engine.destroy()
  })
})

describe('размер перетаскиваемого — по нему приёмник рисует место', () => {
  it('active отдаёт размер блока, а не только id', () => {
    const engine = createGridDndEngine({})
    const zone = engine.grid('a', {
      order: () => ['wide'],
      spanOf: () => ({ w: 6, h: 2 }),
    })
    const block = el()
    zone.attachContainer(el())
    zone.attach(block, 'wide')

    fire(block, 'dragstart', 10, dt())
    expect(engine.active()).toEqual({ grid: 'a', id: 'wide', w: 6, h: 2 })

    fire(block, 'dragend', 0, dt())
    expect(engine.active()).toBeNull()
    engine.destroy()
  })

  it('без spanOf размер считается единичным — раскладка не ломается', () => {
    const engine = createGridDndEngine({})
    const zone = engine.grid('a', { order: () => ['x'] })
    const block = el()
    zone.attach(block, 'x')

    fire(block, 'dragstart', 10, dt())
    expect(engine.active()).toEqual({ grid: 'a', id: 'x', w: 1, h: 1 })
    engine.destroy()
  })
})
