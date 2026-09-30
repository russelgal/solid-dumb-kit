// DumbTree в DOM: раскрытие веток, ленивая подгрузка, фильтр, выбор.
//
// Дерево целиком про поведение разметки — своей математики у него нет, поэтому
// и тесты только тут. Персист раскрытых веток идёт через localStorage, который
// подкладывает `vitest.setup.ts`: happy-dom отдаёт его без getItem/setItem.

import { describe, it, expect, afterEach, vi } from 'vitest'
import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { DumbTree, type TreeNode } from '../src'

let host: HTMLDivElement
let dispose: (() => void) | null = null

afterEach(() => {
  dispose?.()
  dispose = null
  host?.remove()
  localStorage.clear()
})

const ROOTS: Array<TreeNode> = [
  {
    id: 'docs',
    label: 'Документы',
    children: [
      { id: 'docs/act', label: 'Акт' },
      { id: 'docs/bill', label: 'Счёт' },
    ],
  },
  { id: 'readme', label: 'readme.txt' },
]

function mount(props: Partial<Parameters<typeof DumbTree>[0]> = {}) {
  host = document.createElement('div')
  document.body.appendChild(host)
  dispose = render(() => <DumbTree roots={ROOTS} {...props} />, host)
}

const rows = () => Array.from(host.querySelectorAll<HTMLElement>('.dumb-tree-row'))
const labels = () =>
  rows().map((r) => r.querySelector('.dumb-tree-label')?.textContent ?? '')
const rowFor = (id: string) => rows().find((r) => r.dataset.id === id)
const twist = (id: string) => rowFor(id)?.querySelector<HTMLButtonElement>('.dumb-tree-twist')
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('раскрытие', () => {
  it('свёрнутое дерево показывает только корни', async () => {
    mount()
    expect(labels()).toEqual(['Документы', 'readme.txt'])
  })

  it('клик по стрелке раскрывает ветку и сворачивает обратно', async () => {
    mount()

    twist('docs')!.click()
    expect(labels()).toContain('Акт')
    expect(rowFor('docs')!.dataset.open).toBe('1')

    twist('docs')!.click()
    expect(labels()).not.toContain('Акт')
    expect(rowFor('docs')!.dataset.open).toBeUndefined()
  })

  it('у листа стрелки нет — только распорка на её месте', async () => {
    mount()
    expect(rowFor('readme')!.querySelector('button.dumb-tree-twist')).toBeNull()
    expect(rowFor('readme')!.querySelector('.dumb-tree-twist')).not.toBeNull()
  })

  it('раскрытое запоминается по storageKey', async () => {
    mount({ storageKey: 'tree-test' })
    twist('docs')!.click()
    dispose!()
    dispose = null
    host.remove()

    mount({ storageKey: 'tree-test' })
    expect(labels()).toContain('Акт')
  })
})

describe('подпись по строке', () => {
  it('renderLabel зовётся только для видимых строк, по мере раскрытия', async () => {
    const seen: string[] = []
    mount({
      renderLabel: (node: TreeNode) => {
        seen.push(node.id)
        return <a href={`#${node.id}`}>{node.label}</a>
      },
    })

    // Свёрнутая ветка своих подписей не строит вовсе.
    expect(seen.sort()).toEqual(['docs', 'readme'])
    expect(rowFor('readme')!.querySelector('a')!.getAttribute('href')).toBe('#readme')

    twist('docs')!.click()
    expect(seen).toContain('docs/act')
    expect(rowFor('docs/act')!.querySelector('a')!.textContent).toBe('Акт')
  })

  it('поиск идёт по тексту label, а не по разметке подписи', async () => {
    mount({
      renderLabel: (node: TreeNode) => <b>{node.label}</b>,
      query: () => 'счёт',
    })
    expect(labels()).toEqual(['Документы', 'Счёт'])
  })
})

describe('ленивая ветка', () => {
  it('корни тянутся через loadChildren, когда roots не заданы', async () => {
    const load = vi.fn(async (parent: string) =>
      parent === '' ? [{ id: 'a', label: 'Из сети', isFolder: true }] : [{ id: 'a/1', label: 'Внутри' }],
    )
    host = document.createElement('div')
    document.body.appendChild(host)
    dispose = render(() => <DumbTree loadChildren={load} />, host)

    await tick()
    expect(labels()).toEqual(['Из сети'])
    expect(load).toHaveBeenCalledWith('')
  })

  it('вложенное тянется только при первом раскрытии', async () => {
    const load = vi.fn(async (parent: string) =>
      parent === '' ? [{ id: 'a', label: 'Папка', isFolder: true }] : [{ id: 'a/1', label: 'Внутри' }],
    )
    host = document.createElement('div')
    document.body.appendChild(host)
    dispose = render(() => <DumbTree loadChildren={load} />, host)
    await tick()

    expect(load).toHaveBeenCalledTimes(1)     // только корни

    twist('a')!.click()
    await tick()
    expect(load).toHaveBeenCalledWith('a')
    expect(labels()).toContain('Внутри')
  })
})

describe('фильтр', () => {
  it('оставляет совпавшее и дорогу к нему, раскрывая ветки', async () => {
    const [q, setQ] = createSignal('')
    mount({ query: q })

    setQ('акт')
    await settle()
    // ветка показана, потому что совпал ребёнок, и раскрыта — иначе совпадение
    // осталось бы спрятанным
    expect(labels()).toContain('Документы')
    expect(labels()).toContain('Акт')
    expect(labels()).not.toContain('readme.txt')
    expect(labels()).not.toContain('Счёт')
  })

  it('свой матчер перебивает подстроку', async () => {
    const [q, setQ] = createSignal('')
    mount({ query: q, match: (n, query) => n.id.startsWith(query) })

    setQ('readme')
    await settle()
    expect(labels()).toEqual(['readme.txt'])
  })
})

describe('выбор', () => {
  it('зовёт onSelect и помечает выбранную строку', async () => {
    const onSelect = vi.fn()
    const [sel, setSel] = createSignal<string | null>(null)
    mount({ onSelect, selected: sel })

    rowFor('readme')!.click()
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'readme' }))

    setSel('readme')
    await settle()
    expect(rowFor('readme')!.getAttribute('aria-current')).toBe('true')
  })
})

describe('перетаскивание', () => {
  /**
   * happy-dom не строит DataTransfer сам, а `dragstart` без него бессмыслен —
   * подкладываем минимальный: только то, чем пользуется компонент.
   */
  const dragEvent = () => {
    const data = new Map<string, string>()
    const dt = {
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? '',
      effectAllowed: 'none',
    }
    const ev = new Event('dragstart', { bubbles: true, cancelable: true })
    Object.defineProperty(ev, 'dataTransfer', { value: dt })
    return { ev, dt, data }
  }

  /**
   * Сколько слушателей события висит на элементе.
   *
   * Лезем во ВНУТРЕННОСТИ happy-dom (`Symbol(listeners)`), потому что снаружи
   * слушателей не спросить никак: `el.ondragstart` happy-dom не отражает
   * (всегда `undefined`), а патч `EventTarget.prototype.addEventListener`
   * ничего не ловит — регистрирует он их в обход прототипного метода.
   * Если happy-dom когда-нибудь переименует символ, тест упадёт этой строкой
   * и внятно скажет почему — а не начнёт молча считать нули и «проходить».
   */
  const listenerCount = (el: Element | Document, type: string) => {
    const sym = Object.getOwnPropertySymbols(el).find((s) => String(s) === 'Symbol(listeners)')
    if (!sym) throw new Error('happy-dom больше не хранит слушателей в Symbol(listeners)')
    const box = (el as unknown as Record<symbol, { bubbling: Map<string, Array<unknown>> }>)[sym]
    return box.bubbling.get(type)?.length ?? 0
  }

  it('слушатель dragstart ОДИН на дерево, а не по одному на строку', () => {
    // Двадцать строк, а слушатель обязан остаться один: `dragstart` Solid не
    // делегирует (в его списке только click, contextmenu, pointer* и прочие),
    // поэтому `onDragStart` в разметке строки означал бы двадцать настоящих
    // слушателей — по одному на каждую, и все, кроме сработавшего, впустую.
    const many: Array<TreeNode> = Array.from({ length: 20 }, (_, i) => ({
      id: `n${i}`,
      label: `Узел ${i}`,
    }))
    mount({ roots: many, getDragData: (node: TreeNode) => ({ id: node.id }) })

    expect(rows()).toHaveLength(20)
    expect(listenerCount(host.querySelector('.dumb-tree')!, 'dragstart')).toBe(1)
    for (const row of rows()) expect(listenerCount(row, 'dragstart')).toBe(0)
  })

  it('слушатель один и когда getDragData не передан вовсе', () => {
    // Раньше обработчик вешался безусловно и первым же делом выходил — то есть
    // дерево без перетаскивания платило ровно столько же, сколько с ним.
    mount()
    expect(listenerCount(host.querySelector('.dumb-tree')!, 'dragstart')).toBe(1)
    for (const row of rows()) expect(listenerCount(row, 'dragstart')).toBe(0)
  })

  it('тащим строку — в dataTransfer уезжает то, что дал getDragData', () => {
    mount({ getDragData: (n: TreeNode) => ({ kind: 'node', id: n.id }) })

    const { ev, dt, data } = dragEvent()
    rowFor('readme')!.dispatchEvent(ev)

    expect(JSON.parse(data.get('application/json')!)).toEqual({ kind: 'node', id: 'readme' })
    expect(dt.effectAllowed).toBe('copy')
  })

  it('жест со значка внутри строки работает так же: событие всплывает', () => {
    mount({ getDragData: (n: TreeNode) => ({ id: n.id }), icons: { leaf: 'i-leaf' } })

    const { ev, data } = dragEvent()
    rowFor('readme')!.querySelector('.dumb-tree-label')!.dispatchEvent(ev)

    expect(JSON.parse(data.get('application/json')!)).toEqual({ id: 'readme' })
  })

  it('без getDragData не уезжает ничего, и строки не перетаскиваемые', () => {
    mount()

    const { ev, data } = dragEvent()
    rowFor('readme')!.dispatchEvent(ev)

    expect(data.size).toBe(0)
    for (const row of rows()) expect(row.getAttribute('draggable')).toBe('false')
  })

  it('getDragData вернул null для узла — этот узел не тащится', () => {
    mount({ getDragData: (n: TreeNode) => (n.id === 'readme' ? null : { id: n.id }) })

    const { ev, data } = dragEvent()
    rowFor('readme')!.dispatchEvent(ev)

    expect(data.size).toBe(0)
    expect(rowFor('readme')!.getAttribute('draggable')).toBe('false')
    expect(rowFor('docs')!.getAttribute('draggable')).toBe('true')
  })

  it('узел подгруженной ветки тащится наравне с готовым', async () => {
    mount({
      roots: [{ id: 'lazy', label: 'Ленивая', isFolder: true }],
      loadChildren: async () => [{ id: 'lazy/one', label: 'Первый' }],
      getDragData: (n: TreeNode) => ({ id: n.id }),
    })

    twist('lazy')!.click()
    await tick()
    await settle()

    const { ev, data } = dragEvent()
    rowFor('lazy/one')!.dispatchEvent(ev)

    // Именно тут ломался бы поиск узла по `data-id` обходом `roots`:
    // подгруженного узла в `roots` нет вовсе.
    expect(JSON.parse(data.get('application/json')!)).toEqual({ id: 'lazy/one' })
  })
})
