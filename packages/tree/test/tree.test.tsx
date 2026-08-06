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
  it('свёрнутое дерево показывает только корни', () => {
    mount()
    expect(labels()).toEqual(['Документы', 'readme.txt'])
  })

  it('клик по стрелке раскрывает ветку и сворачивает обратно', () => {
    mount()

    twist('docs')!.click()
    expect(labels()).toContain('Акт')
    expect(rowFor('docs')!.dataset.open).toBe('1')

    twist('docs')!.click()
    expect(labels()).not.toContain('Акт')
    expect(rowFor('docs')!.dataset.open).toBeUndefined()
  })

  it('у листа стрелки нет — только распорка на её месте', () => {
    mount()
    expect(rowFor('readme')!.querySelector('button.dumb-tree-twist')).toBeNull()
    expect(rowFor('readme')!.querySelector('.dumb-tree-twist')).not.toBeNull()
  })

  it('раскрытое запоминается по storageKey', () => {
    mount({ storageKey: 'tree-test' })
    twist('docs')!.click()
    dispose!()
    dispose = null
    host.remove()

    mount({ storageKey: 'tree-test' })
    expect(labels()).toContain('Акт')
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
  it('оставляет совпавшее и дорогу к нему, раскрывая ветки', () => {
    const [q, setQ] = createSignal('')
    mount({ query: q })

    setQ('акт')
    // ветка показана, потому что совпал ребёнок, и раскрыта — иначе совпадение
    // осталось бы спрятанным
    expect(labels()).toContain('Документы')
    expect(labels()).toContain('Акт')
    expect(labels()).not.toContain('readme.txt')
    expect(labels()).not.toContain('Счёт')
  })

  it('свой матчер перебивает подстроку', () => {
    const [q, setQ] = createSignal('')
    mount({ query: q, match: (n, query) => n.id.startsWith(query) })

    setQ('readme')
    expect(labels()).toEqual(['readme.txt'])
  })
})

describe('выбор', () => {
  it('зовёт onSelect и помечает выбранную строку', () => {
    const onSelect = vi.fn()
    const [sel, setSel] = createSignal<string | null>(null)
    mount({ onSelect, selected: sel })

    rowFor('readme')!.click()
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'readme' }))

    setSel('readme')
    expect(rowFor('readme')!.getAttribute('aria-current')).toBe('true')
  })
})
