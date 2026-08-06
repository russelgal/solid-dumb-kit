// DumbLightbox: листание, зум, закрытие.
//
// Проверяется то, что видно снаружи: какая картинка показана, что делает
// стрелка и колесо, чем закрывается. Зум — это ТОЛЬКО `transform` у `<img>`,
// поэтому и проверяется он строкой трансформа: заедет туда `width`, и тест
// покраснеет — как раз то, ради чего правило про transform и заведено.
//
// `new Image()` для предзагрузки соседей happy-dom переваривает, подпорок не
// нужно.

import { describe, it, expect, afterEach, vi } from 'vitest'
import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { DumbLightbox, type LightboxItem } from '../src'

let host: HTMLDivElement
let dispose: (() => void) | null = null

afterEach(() => {
  dispose?.()
  dispose = null
  host?.remove()
})

const ITEMS: Array<LightboxItem> = [
  { url: 'a.jpg', title: 'Первая' },
  { url: 'b.jpg', title: 'Вторая' },
  { url: 'c.jpg', title: 'Третья' },
]

function mount(start: number | null = 0) {
  const [index, setIndex] = createSignal<number | null>(start)
  const onIndexChange = vi.fn((i: number | null) => setIndex(i))
  host = document.createElement('div')
  document.body.appendChild(host)
  dispose = render(
    () => <DumbLightbox items={ITEMS} index={index} onIndexChange={onIndexChange} />,
    host,
  )
  return { index, setIndex, onIndexChange }
}

const dialog = () => document.querySelector<HTMLDialogElement>('.dumb-lightbox')!
const img = () => document.querySelector<HTMLImageElement>('.dumb-lightbox-img')
const stage = () => document.querySelector<HTMLElement>('.dumb-lightbox-stage')!
const key = (k: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k }))
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('показ', () => {
  it('закрытый лайтбокс картинки не держит', async () => {
    mount(null)
    await tick()
    expect(dialog().open).toBe(false)
    expect(img()).toBeNull()
  })

  it('открывает ту картинку, на которую указали', async () => {
    mount(1)
    await tick()
    expect(dialog().open).toBe(true)
    expect(img()!.getAttribute('src')).toBe('b.jpg')
    expect(img()!.getAttribute('alt')).toBe('Вторая')
  })
})

describe('листание', () => {
  it('стрелки водят по соседям', async () => {
    mount(0)
    await tick()

    key('ArrowRight')
    await tick()
    expect(img()!.getAttribute('src')).toBe('b.jpg')

    key('ArrowLeft')
    await tick()
    expect(img()!.getAttribute('src')).toBe('a.jpg')
  })

  it('с последней уходит на первую по кругу', async () => {
    mount(2)
    await tick()

    key('ArrowRight')
    await tick()
    expect(img()!.getAttribute('src')).toBe('a.jpg')
  })
})

describe('зум — только transform', () => {
  it('колесо увеличивает и уменьшает, размеры элемента не трогая', async () => {
    mount(0)
    await tick()
    const before = img()!.style.transform

    stage().dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }))
    await tick()
    const after = img()!.style.transform

    expect(after).not.toBe(before)
    expect(after).toContain('scale(')
    // ни ширины, ни высоты в инлайне: масштаб живёт в трансформе
    expect(img()!.style.width).toBe('')
    expect(img()!.style.height).toBe('')
  })

  it('ниже единицы не уменьшает', async () => {
    mount(0)
    await tick()

    for (let i = 0; i < 5; i++) {
      stage().dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }))
    }
    await tick()
    expect(img()!.style.transform).toContain('scale(1)')
  })

  it('клавиша 0 возвращает исходный масштаб', async () => {
    mount(0)
    await tick()
    stage().dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }))
    await tick()

    key('0')
    await tick()
    expect(img()!.style.transform).toBe('translate(0px, 0px) scale(1)')
  })
})

describe('закрытие', () => {
  it('клик по пустому месту сцены закрывает, по картинке — нет', async () => {
    const { onIndexChange } = mount(0)
    await tick()

    img()!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await tick()
    expect(onIndexChange).not.toHaveBeenCalled()

    stage().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await tick()
    expect(onIndexChange).toHaveBeenCalledWith(null)
  })
})
