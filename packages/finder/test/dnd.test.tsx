// Перетаскивание в файндере: слушатели висят НА КОНТЕЙНЕРАХ, а перенос при этом
// работает — и в папку из списка, и в узел дерева, и в крошку.
//
// Почему это вообще проверяется тестом: Solid делегирует события сам, но по
// своему списку, и ни одного drag-события в нём нет. Обработчик в разметке
// плитки — это настоящий `addEventListener` на каждую, пять штук; на папке в
// полсотни файлов их набегало три сотни. Стоит кому-нибудь вернуть `onDragOver`
// на плитку — этот файл покраснеет.

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render } from 'solid-js/web'
import { DumbFinder } from '../src/DumbFinder'
import { createMemorySource } from '../src/sources'
import type { FinderSource } from '../src/finderTypes'

declare const settle: () => Promise<void>

let host: HTMLDivElement
let dispose: (() => void) | null = null

afterEach(() => {
  dispose?.()
  dispose = null
  host?.remove()
})

/**
 * Сколько слушателей события висит на элементе. Лезем во внутренности
 * happy-dom: снаружи их не спросить — `el.ondragover` он не отражает, а патч
 * `EventTarget.prototype.addEventListener` регистрации не ловит. Переименует
 * символ — тест упадёт этой строкой и скажет почему.
 */
const listenerCount = (el: Element, type: string) => {
  const sym = Object.getOwnPropertySymbols(el).find((s) => String(s) === 'Symbol(listeners)')
  if (!sym) throw new Error('happy-dom больше не хранит слушателей в Symbol(listeners)')
  const box = (el as unknown as Record<symbol, { bubbling: Map<string, Array<unknown>> }>)[sym]
  return box.bubbling.get(type)?.length ?? 0
}

const DRAG_EVENTS = ['dragstart', 'dragend', 'dragover', 'dragleave', 'drop'] as const

/** happy-dom не строит DataTransfer — подкладываем ровно то, чем пользуется код. */
const dragEvent = (type: string, carry?: Map<string, string>) => {
  const data = carry ?? new Map<string, string>()
  const dt = {
    setData: (t: string, v: string) => data.set(t, v),
    getData: (t: string) => data.get(t) ?? '',
    types: [...data.keys()],
    effectAllowed: 'none',
    dropEffect: 'none',
  }
  const ev = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(ev, 'dataTransfer', { value: dt })
  return { ev, dt, data }
}

async function mount(extra: Partial<Parameters<typeof DumbFinder>[0]> = {}) {
  const source: FinderSource = createMemorySource({
    latency: 0,
    seed: { 'сюда/.keep': 1, 'письмо.txt': 120, 'фото.jpg': 4096 },
  })
  const move = vi.fn(source.move!)
  host = document.createElement('div')
  document.body.appendChild(host)
  dispose = render(
    () => <DumbFinder source={{ ...source, move }} editable view="list" {...extra} />,
    host,
  )
  // источник отвечает промисом, пусть даже мгновенным
  await new Promise((r) => setTimeout(r, 0))
  await settle()
  return { move }
}

const items = () => Array.from(host.querySelectorAll<HTMLElement>('.dumb-finder-item'))
const itemFor = (key: string) => items().find((el) => el.dataset.key === key)!
const nodes = () => Array.from(host.querySelectorAll<HTMLElement>('.dumb-finder-node'))
const crumbs = () => Array.from(host.querySelectorAll<HTMLElement>('.dumb-finder-crumb'))
const box = (sel: string) => host.querySelector<HTMLElement>(sel)!

describe('слушатели drag — на контейнерах, а не на элементах', () => {
  it('плитки не носят ни одного из пяти drag-событий', async () => {
    await mount()

    expect(items().length).toBeGreaterThan(0)
    for (const el of items()) {
      for (const type of DRAG_EVENTS) expect([type, listenerCount(el, type)]).toEqual([type, 0])
    }
  })

  it('все пять висят на `.dumb-finder-items` по одному разу', async () => {
    await mount()

    for (const type of DRAG_EVENTS) {
      expect([type, listenerCount(box('.dumb-finder-items'), type)]).toEqual([type, 1])
    }
  })

  it('узлы дерева и крошки — тоже без своих слушателей', async () => {
    await mount({ sidebar: true })

    for (const el of [...nodes(), ...crumbs()]) {
      for (const type of DRAG_EVENTS) expect([type, listenerCount(el, type)]).toEqual([type, 0])
    }
    for (const type of ['dragover', 'dragleave', 'drop'] as const) {
      expect([type, listenerCount(box('.dumb-finder-crumbs'), type)]).toEqual([type, 1])
    }
  })

  it('число слушателей не растёт от числа плиток', async () => {
    const many: Record<string, number> = {}
    for (let i = 0; i < 40; i++) many[`файл-${i}.txt`] = 10
    await mount({ source: createMemorySource({ latency: 0, seed: many }) })

    expect(items()).toHaveLength(40)
    const total = DRAG_EVENTS.reduce(
      (n, type) => n + items().reduce((k, el) => k + listenerCount(el, type), 0),
      0,
    )
    expect(total).toBe(0)
  })
})

describe('перенос при этом работает', () => {
  it('тащим файл в папку — источник получает move', async () => {
    const { move } = await mount()

    const { data } = dragEvent('dragstart')
    itemFor('письмо.txt').dispatchEvent(dragEvent('dragstart', data).ev)
    expect(data.get('text/plain')).toBe('письмо.txt')

    itemFor('сюда/').dispatchEvent(dragEvent('drop', data).ev)
    await new Promise((r) => setTimeout(r, 0))
    await settle()

    expect(move).toHaveBeenCalledWith(['письмо.txt'], 'сюда/')
  })

  it('жест со значка внутри плитки считается жестом плитки: событие всплывает', async () => {
    const { move } = await mount()

    const { data } = dragEvent('dragstart')
    const inside = itemFor('письмо.txt').querySelector('*') ?? itemFor('письмо.txt')
    inside.dispatchEvent(dragEvent('dragstart', data).ev)

    itemFor('сюда/').dispatchEvent(dragEvent('drop', data).ev)
    await new Promise((r) => setTimeout(r, 0))
    await settle()

    expect(move).toHaveBeenCalledWith(['письмо.txt'], 'сюда/')
  })

  it('над папкой подсвечивается цель, над файлом — нет', async () => {
    await mount()

    const { data } = dragEvent('dragstart')
    itemFor('письмо.txt').dispatchEvent(dragEvent('dragstart', data).ev)

    itemFor('сюда/').dispatchEvent(dragEvent('dragover', data).ev)
    await settle()
    expect(itemFor('сюда/').dataset.drop).toBe('1')

    // файл целью не становится: событие уходит выше, «в текущую папку»
    itemFor('фото.jpg').dispatchEvent(dragEvent('dragover', data).ev)
    await settle()
    expect(itemFor('фото.jpg').dataset.drop).toBeUndefined()
  })

  it('бросок на узел дерева переносит туда же', async () => {
    const { move } = await mount({ sidebar: true })

    const node = nodes().find((n) => n.dataset.key === 'сюда/')
    expect(node, 'узел «сюда/» есть в дереве').toBeTruthy()

    const { data } = dragEvent('dragstart')
    itemFor('письмо.txt').dispatchEvent(dragEvent('dragstart', data).ev)
    node!.dispatchEvent(dragEvent('drop', data).ev)
    await new Promise((r) => setTimeout(r, 0))
    await settle()

    expect(move).toHaveBeenCalledWith(['письмо.txt'], 'сюда/')
  })
})
