import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLocator } from '../src/index'

let asked: string[] = []
let destroy: (() => void) | null = null

beforeEach(() => {
  asked = []
  vi.stubGlobal('fetch', (url: string) => {
    asked.push(url)
    return Promise.resolve(new Response(''))
  })
})

afterEach(() => {
  destroy?.()
  destroy = null
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

/** Кнопка внутри размеченного узла: клик по ней ловит именно предок. */
function markup(loc = 'src/a.tsx:12:5') {
  document.body.innerHTML = `<div data-loc="${loc}"><button type="button">жми</button></div>`
  return document.querySelector('button')!
}

const click = (node: Element, init: MouseEventInit = {}) =>
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }))

describe('createLocator — alt-клик открывает исходник', () => {
  it('просит открыть место, взятое у ближайшего размеченного предка', () => {
    destroy = createLocator()
    click(markup(), { altKey: true })
    expect(asked).toEqual(['/__open-in-editor?file=src%2Fa.tsx%3A12%3A5'])
  })

  it('без alt не вмешивается вовсе', () => {
    destroy = createLocator()
    expect(click(markup(), {})).toBe(true)
    expect(asked).toEqual([])
  })

  it('съедает клик целиком: под курсором могло быть «удалить»', () => {
    destroy = createLocator()
    const button = markup()
    const pressed = vi.fn()
    button.addEventListener('click', pressed)

    expect(click(button, { altKey: true })).toBe(false)
    expect(pressed).not.toHaveBeenCalled()
  })

  it('молчит там, где разметки нет', () => {
    destroy = createLocator()
    document.body.innerHTML = '<div><button type="button">жми</button></div>'
    click(document.querySelector('button')!, { altKey: true })
    expect(asked).toEqual([])
  })

  it('слушает правую клавишу и свой атрибут', () => {
    document.body.innerHTML = '<b data-src="src/b.tsx:1:1">x</b>'
    destroy = createLocator({ key: 'metaKey', attribute: 'data-src' })

    click(document.querySelector('b')!, { altKey: true })
    expect(asked).toEqual([])

    click(document.querySelector('b')!, { metaKey: true })
    expect(asked).toEqual(['/__open-in-editor?file=src%2Fb.tsx%3A1%3A1'])
  })

  it('отписка снимает слушатель', () => {
    createLocator()()
    click(markup(), { altKey: true })
    expect(asked).toEqual([])
  })
})
