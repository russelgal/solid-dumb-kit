// DumbGallery: плитки, режим просмотра, удаление, статусы заливки.
//
// Перестановку тащит `DumbSortableDnd` (нативный DnD — синтезировать его в
// happy-dom нечем и незачем, у движка свои тесты), очередь заливки живёт в
// `shared` и проверена там. Здесь — разметка галереи: что нарисовано, что
// показывает прогресс, что делает крестик и чего нет без `editable`.

import { describe, it, expect, afterEach, vi } from 'vitest'
import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { DumbGallery, type GalleryItem } from '../src'

let host: HTMLDivElement
let dispose: (() => void) | null = null

afterEach(() => {
  dispose?.()
  dispose = null
  host?.remove()
})

const START: Array<GalleryItem> = [
  { id: '1', url: 'a.jpg', name: 'Первая' },
  { id: '2', url: 'b.jpg', name: 'Вторая', status: 'uploading' },
  { id: '3', url: 'c.jpg', name: 'Третья', status: 'error', error: 'не влезла' },
]

type Props = Parameters<typeof DumbGallery>[0]

function mount(extra: Partial<Props> = {}) {
  const [items, setItems] = createSignal(START)
  host = document.createElement('div')
  document.body.appendChild(host)
  dispose = render(
    () => <DumbGallery items={items()} setItems={setItems} editable {...extra} />,
    host,
  )
  return { items, setItems }
}

const tiles = () => Array.from(host.querySelectorAll<HTMLElement>('.dumb-gallery-tile'))
const srcs = () => tiles().map((t) => t.querySelector('img')?.getAttribute('src'))

describe('плитки', () => {
  it('рисует по плитке на элемент, в порядке items', () => {
    mount()
    expect(tiles()).toHaveLength(3)
    expect(srcs()).toEqual(['a.jpg', 'b.jpg', 'c.jpg'])
  })

  it('показывает preview, пока он есть, и url — когда нет', () => {
    const [items] = createSignal([{ id: '1', url: 'real.jpg', preview: 'blob:local' }])
    host = document.createElement('div')
    document.body.appendChild(host)
    dispose = render(() => <DumbGallery items={items()} setItems={() => {}} />, host)

    // картинка видна сразу из objectURL, не дожидаясь заливки
    expect(host.querySelector('img')!.getAttribute('src')).toBe('blob:local')
  })

  it('статус выносит в data-status, ошибку — в подсказку', () => {
    mount()
    expect(tiles().map((t) => t.dataset.status)).toEqual(['local', 'uploading', 'error'])
    expect(tiles()[2].getAttribute('title')).toBe('не влезла')
  })

  it('полоса прогресса есть только у тех, кто ещё едет', () => {
    mount()
    expect(tiles()[0].querySelector('.dumb-gallery-bar')).toBeNull()
    expect(tiles()[1].querySelector('.dumb-gallery-bar')).not.toBeNull()
    expect(tiles()[2].querySelector('.dumb-gallery-bar')).toBeNull()
  })
})

describe('правка', () => {
  it('крестик убирает плитку', () => {
    const { items } = mount()

    tiles()[1].querySelector<HTMLButtonElement>('button[data-no-drag]')!.click()

    expect(items().map((i) => i.id)).toEqual(['1', '3'])
  })

  it('крестик не открывает просмотр: клик до плитки не доходит', () => {
    const onOpen = vi.fn()
    mount({ onOpen })

    tiles()[0].querySelector<HTMLButtonElement>('button[data-no-drag]')!.click()

    expect(onOpen).not.toHaveBeenCalled()
  })

  it('клик по плитке зовёт onOpen с элементом и его номером', () => {
    const onOpen = vi.fn()
    mount({ onOpen })

    tiles()[2].click()

    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: '3' }), 2)
  })

  it('без editable нет ни крестиков, ни кнопки выбора файлов', () => {
    mount({ editable: false })

    expect(host.querySelector('button[data-no-drag]')).toBeNull()
    expect(host.textContent).not.toContain('Выбрать файлы')
    // сами картинки при этом на месте — это режим просмотра, а не пустой экран
    expect(tiles()).toHaveLength(3)
  })
})

describe('своя плитка', () => {
  it('children рисует вместо стандартной и получает прогресс', () => {
    mount({
      children: (item, i, progress) => (
        <div class="my-tile" data-i={i()} data-progress={progress()}>
          {item.name}
        </div>
      ),
    })

    const mine = Array.from(host.querySelectorAll<HTMLElement>('.my-tile'))
    expect(mine).toHaveLength(3)
    expect(mine[0].textContent).toBe('Первая')
    expect(mine[0].dataset.i).toBe('0')
    expect(tiles()).toHaveLength(0)
  })
})
