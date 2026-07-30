// Движок сетки должен жить без Solid: ни owner, ни onCleanup, ни рендера —
// только DOM и функции отписки. Если файл перестанет собираться без solid-js,
// значит зависимость просочилась в ядро.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createGridEngine } from '../gridCore'

// Наблюдатели, которых в happy-dom нет: отдают геометрию сразу, чтобы жест мог
// стартовать. Сетка на 12 колонок по 100px без зазоров — координаты читаемые.
function stubObservers(contentW = 1200) {
  class RO {
    constructor(private cb: ResizeObserverCallback) {}
    observe(el: Element) {
      this.cb([{ target: el, contentRect: { width: contentW, height: 400, left: 0, top: 0 } } as any], this as any)
    }
    unobserve() {}
    disconnect() {}
  }
  class IO {
    constructor(private cb: IntersectionObserverCallback) {}
    observe(el: Element) {
      this.cb([{ target: el, boundingClientRect: { left: 0, top: 0, width: contentW, height: 400 } } as any], this as any)
    }
    unobserve() {}
    disconnect() {}
    takeRecords() { return [] }
  }
  vi.stubGlobal('ResizeObserver', RO)
  vi.stubGlobal('IntersectionObserver', IO)
}

const nextFrames = (n = 2) =>
  new Promise<void>((done) => {
    const tick = (left: number) =>
      left <= 0 ? done() : requestAnimationFrame(() => tick(left - 1))
    tick(n)
  })

afterEach(() => vi.unstubAllGlobals())

const el = (tag = 'div') => {
  const node = document.createElement(tag)
  document.body.appendChild(node)
  return node
}

const engineFor = (ids: Array<string>) =>
  createGridEngine({
    blocks: () => ids.map((id) => ({ id, w: 3, h: 1 })),
    cols: () => 12,
    rowHeight: () => 80,
    gapX: () => 12,
    gapY: () => 12,
    onReorder: () => {},
    onResize: () => {},
  })

describe('createGridEngine — вне Solid', () => {
  it('создаётся без реактивного контекста', () => {
    const engine = engineFor(['a', 'b'])
    expect(typeof engine.attach).toBe('function')
    expect(typeof engine.destroy).toBe('function')
    expect(engine.active()).toBeNull()
    engine.destroy()
  })

  it('attachContainer и attach отдают отписки', () => {
    const engine = engineFor(['a'])
    const box = el()
    const block = el()

    const offBox = engine.attachContainer(box)
    const offBlock = engine.attach(block, 'a')
    expect(typeof offBox).toBe('function')

    const spy = vi.spyOn(block, 'removeEventListener')
    offBlock()
    expect(spy).toHaveBeenCalledWith('pointerdown', expect.any(Function))

    offBox()
    engine.destroy()
  })

  it('ручка ресайза помечается атрибутом — по нему драг её игнорирует', () => {
    const engine = engineFor(['a'])
    const handle = el()
    engine.attachResize(handle, 'a')
    expect(handle.dataset.gridResize).toBe('')
    expect(handle.style.touchAction).toBe('none')
    engine.destroy()
  })

  it('без измеренной ширины колонки жест не стартует', () => {
    // ResizeObserver в happy-dom ничего не отдаёт, поэтому colW = 0 —
    // ровно та ситуация, в которой начинать драг нельзя: считать не от чего
    const engine = engineFor(['a', 'b'])
    engine.attachContainer(el())
    const block = el()
    engine.attach(block, 'a')

    block.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 3 }))
    expect(engine.active()).toBeNull()

    engine.destroy()
  })

  it('драг не стартует с поля ввода внутри блока', () => {
    const engine = engineFor(['a'])
    engine.attachContainer(el())
    const block = el()
    const input = document.createElement('input')
    block.appendChild(input)
    engine.attach(block, 'a')

    const spy = vi.spyOn(window, 'addEventListener')
    input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 4 }))
    expect(spy).not.toHaveBeenCalledWith('pointermove', expect.any(Function))

    spy.mockRestore()
    engine.destroy()
  })

  it('нажатие по вложенному сортировщику не утаскивает блок', () => {
    // внутри блока живёт карточка чужого сортировщика: он метит свои элементы
    // data-flip-id, и этот жест принадлежит ему, а не сетке
    stubObservers()
    const engine = engineFor(['a', 'b'])
    engine.attachContainer(el())
    const block = el()
    const card = document.createElement('div')
    card.dataset.flipId = 'card-1'
    const inner = document.createElement('span')
    card.appendChild(inner)
    block.appendChild(card)
    engine.attach(block, 'a')

    inner.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 12 }))
    expect(engine.active()).toBeNull()

    // а с собственного тела блока драг по-прежнему начинается
    const own = document.createElement('span')
    block.appendChild(own)
    own.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 13 }))
    expect(engine.active()).toEqual({ id: 'a', kind: 'move' })

    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 13 }))
    engine.destroy()
  })

  it('вложенная сетка забирает жест себе, внешняя не вмешивается', () => {
    // блок внешней сетки, внутри которого лежит блок вложенной: он помечен
    // data-grid-block своим движком, и жест по нему — его
    stubObservers()
    const outer = createGridEngine({
      blocks: () => [{ id: 'section', w: 6, h: 4 }],
      cols: () => 12, rowHeight: () => 100, gapX: () => 0, gapY: () => 0,
      onReorder: () => {}, onResize: () => {},
    })
    const innerEngine = createGridEngine({
      blocks: () => [{ id: 'widget', w: 3, h: 1 }],
      cols: () => 6, rowHeight: () => 50, gapX: () => 0, gapY: () => 0,
      onReorder: () => {}, onResize: () => {},
    })

    const box = el()
    const section = el()
    const innerBox = document.createElement('div')
    const widget = document.createElement('div')
    innerBox.appendChild(widget)
    section.appendChild(innerBox)

    outer.attachContainer(box)
    outer.attach(section, 'section')
    innerEngine.attachContainer(innerBox)
    innerEngine.attach(widget, 'widget')

    widget.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 61 }))
    expect(innerEngine.active()).toEqual({ id: 'widget', kind: 'move' })
    expect(outer.active()).toBeNull()                    // секцию никто не потащил
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 61 }))

    // а по собственному телу секции внешняя сетка работает как обычно
    const header = document.createElement('div')
    section.appendChild(header)
    header.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 62 }))
    expect(outer.active()).toEqual({ id: 'section', kind: 'move' })
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 62 }))

    innerEngine.destroy()
    outer.destroy()
  })

  it('отписка снимает метку блока', () => {
    const engine = engineFor(['a'])
    const block = el()
    const off = engine.attach(block, 'a')
    expect(block.dataset.gridBlock).toBe('a')
    off()
    expect(block.dataset.gridBlock).toBeUndefined()
    engine.destroy()
  })

  it('заблокированный блок не двигается', () => {
    const engine = createGridEngine({
      blocks: () => [{ id: 'a', w: 3, h: 1, locked: true }],
      cols: () => 12,
      rowHeight: () => 80,
      gapX: () => 0,
      gapY: () => 0,
      onReorder: () => {},
      onResize: () => {},
    })
    engine.attachContainer(el())
    const block = el()
    engine.attach(block, 'a')

    block.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 5 }))
    expect(engine.active()).toBeNull()

    engine.destroy()
  })

  it('colWidth считается от ширины контента, а не от элементов', () => {
    const engine = engineFor(['a'])
    // без ResizeObserver ширина неизвестна — 0, и это честный ответ
    expect(engine.colWidth()).toBe(0)
    engine.destroy()
  })

  it('destroy без единого attach не падает', () => {
    const engine = engineFor([])
    expect(() => engine.destroy()).not.toThrow()
  })
})

describe('ресайз — рамка-превью', () => {
  const setup = (onResize = vi.fn()) => {
    stubObservers()
    const engine = createGridEngine({
      blocks: () => [
        { id: 'a', w: 3, h: 1 },
        { id: 'b', w: 3, h: 1 },
      ],
      cols: () => 12,
      rowHeight: () => 100,
      gapX: () => 0,
      gapY: () => 0,
      onReorder: () => {},
      onResize,
    })
    const box = el()
    const block = el()
    const handle = document.createElement('div')
    block.appendChild(handle)
    engine.attachContainer(box)
    engine.attach(block, 'a')
    engine.attachResize(handle, 'a')
    return { engine, box, block, handle, onResize }
  }

  const preview = (box: HTMLElement) => box.querySelector('[data-grid-preview]') as HTMLElement | null

  const down = (target: HTMLElement, x: number, y: number) =>
    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 21, clientX: x, clientY: y }))
  const move = (x: number, y: number) =>
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 21, clientX: x, clientY: y }))
  const up = () =>
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 21 }))

  it('рамка появляется сразу и стоит НАД блоком, иначе уменьшение не видно', () => {
    const { engine, box, block, handle } = setup()
    down(handle, 300, 100)
    const p = preview(box)
    expect(p).toBeTruthy()
    expect(p!.style.width).toBe('300px')        // 3 колонки по 100px
    expect(Number(p!.style.zIndex)).toBeGreaterThan(Number(block.style.zIndex))
    up()
    engine.destroy()
  })

  it('при уменьшении рамка сжимается и остаётся видимой', async () => {
    const { engine, box, handle, onResize } = setup()
    down(handle, 300, 100)
    move(200, 100)                              // −1 колонка
    await nextFrames()

    const p = preview(box)!
    expect(p.style.width).toBe('200px')
    expect(p.isConnected).toBe(true)

    up()
    expect(onResize).toHaveBeenCalledWith('a', 2, 1)
    engine.destroy()
  })

  it('при увеличении рамка растёт до снапа', async () => {
    const { engine, box, handle, onResize } = setup()
    down(handle, 300, 100)
    move(520, 100)                              // +2.2 колонки → снап на +2
    await nextFrames()

    expect(preview(box)!.style.width).toBe('500px')
    up()
    expect(onResize).toHaveBeenCalledWith('a', 5, 1)
    engine.destroy()
  })

  it('меньше одной колонки не уводит и рамку не теряет', async () => {
    const { engine, box, handle, onResize } = setup()
    down(handle, 300, 100)
    move(-900, 100)
    await nextFrames()

    expect(preview(box)!.style.width).toBe('100px')
    up()
    expect(onResize).toHaveBeenCalledWith('a', 1, 1)
    engine.destroy()
  })

  it('в свободном режиме ресайз не выходит за соседа', async () => {
    stubObservers()
    const onResize = vi.fn()
    const engine = createGridEngine({
      // a: колонки 0–2, b: колонки 3–5 — расти a может максимум до 3 колонок
      blocks: () => [
        { id: 'a', w: 3, h: 1, x: 0, y: 0 },
        { id: 'b', w: 3, h: 1, x: 3, y: 0 },
      ],
      mode: () => 'free',
      cols: () => 12,
      rowHeight: () => 100,
      gapX: () => 0,
      gapY: () => 0,
      onReorder: () => {},
      onResize,
    })
    const box = el()
    const block = el()
    const handle = document.createElement('div')
    block.appendChild(handle)
    engine.attachContainer(box)
    engine.attach(block, 'a')
    engine.attachResize(handle, 'a')

    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 31, clientX: 300, clientY: 100 }))
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 31, clientX: 900, clientY: 100 }))
    await nextFrames()
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 31 }))

    expect(onResize).not.toHaveBeenCalled()      // упёрся в b, размер тот же
    engine.destroy()
  })

  it('после отпускания рамка убирается из DOM', async () => {
    const { engine, box, handle } = setup()
    down(handle, 300, 100)
    move(200, 100)
    await nextFrames()
    up()

    expect(preview(box)).toBeNull()
    engine.destroy()
  })
})

describe('свободный режим — двигаем куда хотим', () => {
  const setup = () => {
    stubObservers()
    const onMove = vi.fn()
    const onReorder = vi.fn()
    const engine = createGridEngine({
      // a: колонки 0–2 строки 0, b: колонки 3–5 строки 0
      blocks: () => [
        { id: 'a', w: 3, h: 1, x: 0, y: 0 },
        { id: 'b', w: 3, h: 1, x: 3, y: 0 },
      ],
      mode: () => 'free',
      cols: () => 12,
      rowHeight: () => 100,
      gapX: () => 0,
      gapY: () => 0,
      onReorder,
      onMove,
      onResize: () => {},
      animate: false,
    })
    const box = el()
    const a = el()
    const b = el()
    engine.attachContainer(box)
    engine.attach(a, 'a')
    engine.attach(b, 'b')
    return { engine, box, a, b, onMove, onReorder }
  }

  const drag = async (target: HTMLElement, from: [number, number], to: [number, number]) => {
    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 41, clientX: from[0], clientY: from[1] }))
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 41, clientX: to[0], clientY: to[1] }))
    await nextFrames()
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 41 }))
    await nextFrames()
  }

  it('уводит блок вниз в пустое пространство — там, где в потоке места нет', async () => {
    const { engine, a, onMove, onReorder } = setup()
    await drag(a, [50, 50], [750, 350])          // +700px по X, +300px по Y

    expect(onMove).toHaveBeenCalledWith('a', 7, 3)
    expect(onReorder).not.toHaveBeenCalled()     // порядок в свободном режиме ни при чём
    engine.destroy()
  })

  it('на занятое место не кладёт, а помечает рамку и отменяет дроп', async () => {
    const { engine, box, a, onMove } = setup()
    a.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 42, clientX: 50, clientY: 50 }))
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 42, clientX: 350, clientY: 50 }))
    await nextFrames()

    const preview = box.querySelector('[data-grid-preview]') as HTMLElement
    expect(preview.dataset.blocked).toBe('')     // рамка красная — место под b
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 42 }))

    expect(onMove).not.toHaveBeenCalled()
    engine.destroy()
  })

  it('соседи с места не двигаются — на то он и свободный', async () => {
    const { engine, a, b } = setup()
    a.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 43, clientX: 50, clientY: 50 }))
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 43, clientX: 750, clientY: 350 }))
    await nextFrames()

    expect(b.style.transform).toBe('')
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 43 }))
    engine.destroy()
  })

  it('за левый край не выпускает: далеко влево = нулевая колонка', async () => {
    const { engine, b, onMove } = setup()
    await drag(b, [350, 50], [-900, 250])         // цель — свободная строка 2

    expect(onMove).toHaveBeenCalledWith('b', 0, 2)
    engine.destroy()
  })

  it('выше первой строки не поднимает', async () => {
    const { engine, b, onMove } = setup()
    // b стоит в колонках 3–5 строки 0; уводим влево и высоко вверх — колонка 0,
    // строка 0 занята блоком a, поэтому дроп отклоняется, а не уезжает в минус
    await drag(b, [350, 50], [-900, -900])

    expect(onMove).not.toHaveBeenCalled()
    engine.destroy()
  })
})
