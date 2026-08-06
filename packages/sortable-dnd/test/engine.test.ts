// Движок сортировки на нативном DnD — без Solid и без компонента.
//
// Файл заодно СТОРОЖИТ СЛОЙ: движок создаётся вне реактивного контекста, и
// импортируй он `solid-js`, тест бы упал ещё на создании. Тот же приём, что в
// `sortable/test/engine.test.ts` и `grid/test/engine.test.ts`.
//
// Проверяется главное решение этого движка: порядок меняется ПРЯМО В
// `dragover`, а не копится до `drop` — Chrome глотает и то и другое, и жест,
// доведённый до конца, оставался бы без результата.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSortDndEngine, type SortDndEngine } from '../src/sortDndCore'

let engine: SortDndEngine | null = null
const cleanups: Array<() => void> = []

// happy-dom не знает Web Animations: движок спрашивает `getAnimations()`, чтобы
// не переставлять цель, которая сама сейчас едет. Анимаций тут нет никогда.
const origGetAnimations = Element.prototype.getAnimations
beforeEach(() => {
  Element.prototype.getAnimations = () => []
})

afterEach(async () => {
  for (const off of cleanups.splice(0)) off()
  engine?.destroy()
  // Конец жеста движок подводит через таймер и кадр (признак отмены приходит
  // ПОСЛЕ dragend). Дадим им пройти в живом окружении: иначе они догонят тест
  // уже после того, как vitest снесёт happy-dom, и упадут на пустом месте.
  await new Promise((r) => setTimeout(r, 32))
  engine = null
  document.body.innerHTML = ''
  Element.prototype.getAnimations = origGetAnimations
})

/** список из id: контейнер, элементы и движок поверх живых данных */
function setup(ids: Array<string>, opts: Parameters<typeof createSortDndEngine>[0] extends never ? never : Partial<Parameters<typeof createSortDndEngine>[0]> = {}) {
  let order = [...ids]
  const onMove = vi.fn((from: number, to: number) => {
    const [moved] = order.splice(from, 1)
    order.splice(to, 0, moved)
  })
  const onEnd = vi.fn()
  const onActive = vi.fn()

  engine = createSortDndEngine({
    order: () => order,
    onMove,
    onEnd,
    onActive,
    animate: false,
    ...opts,
  })

  const container = document.createElement('div')
  document.body.appendChild(container)
  cleanups.push(engine.attachContainer(container))

  const els = new Map<string, HTMLElement>()
  for (const id of ids) {
    const el = document.createElement('div')
    el.textContent = id
    container.appendChild(el)
    els.set(id, el)
    cleanups.push(engine.attach(el, id))
  }

  return { get order() { return order }, onMove, onEnd, onActive, els, container }
}

/** событие драга с dataTransfer, которого happy-dom сам не кладёт */
function dragEvent(type: string, x: number, y: number): DragEvent {
  const ev = new Event(type, { bubbles: true, cancelable: true }) as DragEvent
  Object.defineProperties(ev, {
    clientX: { value: x },
    clientY: { value: y },
    dataTransfer: { value: { setData: () => {}, effectAllowed: '', dropEffect: '' } },
  })
  return ev
}

describe('слой', () => {
  it('движок создаётся вне реактивного контекста', () => {
    // сам факт, что setup не бросил, и есть проверка: Solid тут не при чём
    const list = setup(['a', 'b', 'c'])
    expect(list.order).toEqual(['a', 'b', 'c'])
    expect(engine!.active()).toBeNull()
  })
})

describe('перестановка', () => {
  it('порядок меняется прямо в dragover, не дожидаясь drop', () => {
    const list = setup(['a', 'b', 'c'])

    list.els.get('a')!.dispatchEvent(dragEvent('dragstart', 10, 10))
    list.els.get('c')!.dispatchEvent(dragEvent('dragover', 10, 90))

    // ни одного drop ещё не было, а порядок уже новый
    expect(list.onMove).toHaveBeenCalledWith(0, 2)
    expect(list.order).toEqual(['b', 'c', 'a'])
  })

  it('пока жест идёт, наружу торчит id того, кого тащат', () => {
    const list = setup(['a', 'b'])

    list.els.get('b')!.dispatchEvent(dragEvent('dragstart', 10, 10))
    expect(engine!.active()).toBe('b')
    expect(list.onActive).toHaveBeenCalledWith('b')

    list.els.get('b')!.dispatchEvent(dragEvent('dragend', 10, 10))
    expect(engine!.active()).toBeNull()
    expect(list.onActive).toHaveBeenLastCalledWith(null)
  })

  it('над самим собой ничего не переставляет', () => {
    const list = setup(['a', 'b', 'c'])

    list.els.get('b')!.dispatchEvent(dragEvent('dragstart', 10, 10))
    list.els.get('b')!.dispatchEvent(dragEvent('dragover', 10, 50))

    expect(list.onMove).not.toHaveBeenCalled()
  })

  it('неподвижный курсор пересчёта не вызывает', () => {
    const list = setup(['a', 'b', 'c'])

    list.els.get('a')!.dispatchEvent(dragEvent('dragstart', 10, 10))
    // ровно та же точка: браузер шлёт dragover и когда мышь стоит, а хиттест
    // идёт по едущей картинке — от этого порядок дёргался бы сам собой
    list.els.get('c')!.dispatchEvent(dragEvent('dragover', 10, 10))

    expect(list.onMove).not.toHaveBeenCalled()
  })

  it('без жеста dragover ничего не делает', () => {
    const list = setup(['a', 'b'])

    list.els.get('b')!.dispatchEvent(dragEvent('dragover', 10, 50))

    expect(list.onMove).not.toHaveBeenCalled()
  })
})

describe('disabled', () => {
  it('выключенный движок жест не начинает', () => {
    const list = setup(['a', 'b'], { disabled: () => true })

    list.els.get('a')!.dispatchEvent(dragEvent('dragstart', 10, 10))

    expect(engine!.active()).toBeNull()
    expect(list.onActive).not.toHaveBeenCalled()
  })
})

describe('уборка', () => {
  it('отписка элемента снимает с него слушатели', () => {
    const list = setup(['a', 'b'])
    // `attach` вернул отписку — её и зовёт onCleanup в Solid-обёртке
    cleanups.splice(0).forEach((off) => off())

    list.els.get('a')!.dispatchEvent(dragEvent('dragstart', 10, 10))

    expect(list.onActive).not.toHaveBeenCalled()
  })

  it('destroy посреди жеста доводит его до конца и забывает элементы', () => {
    const list = setup(['a', 'b', 'c'])
    list.els.get('a')!.dispatchEvent(dragEvent('dragstart', 10, 10))
    expect(engine!.active()).toBe('a')

    engine!.destroy()

    expect(engine!.active()).toBeNull()
    // реестр пуст: dragover больше не с чем сопоставлять
    list.els.get('c')!.dispatchEvent(dragEvent('dragover', 10, 90))
    expect(list.onMove).not.toHaveBeenCalled()
  })
})
