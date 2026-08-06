// DumbModal: открытие и закрытие нативного <dialog>.
//
// Ловушку фокуса, top layer и Esc делает браузер, проверять их незачем — здесь
// то, что дописано руками: возврат фокуса, клик по подложке, защита от
// закрытия с несохранённым.
//
// happy-dom знает `<dialog>`, но `showModal()` у него не заводит настоящий top
// layer — атрибут `open` он всё же ставит, и этого хватает. Клик по подложке
// приходит на сам `<dialog>` (у `::backdrop` своей цели нет), поэтому в тесте
// он и изображается кликом в элемент диалога.

import { describe, it, expect, afterEach, vi } from 'vitest'
import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { DumbModal } from '../src'

let host: HTMLDivElement
let dispose: (() => void) | null = null

afterEach(() => {
  dispose?.()
  dispose = null
  host?.remove()
})

type Extra = {
  onBeforeClose?: () => boolean | Promise<boolean>
  keepOnBackdrop?: boolean
  title?: string
}

function mount(extra: Extra = {}) {
  const [open, setOpen] = createSignal(false)
  const onClose = vi.fn(() => setOpen(false))
  host = document.createElement('div')
  document.body.appendChild(host)
  dispose = render(
    () => (
      <DumbModal open={open} onClose={onClose} title={extra.title} {...extra}>
        <p>тело окна</p>
      </DumbModal>
    ),
    host,
  )
  return { open, setOpen, onClose }
}

const dialog = () => document.querySelector('dialog')
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('открытие', () => {
  it('пока закрыто — тег есть, но не открыт', () => {
    mount()
    // <dialog> в разметке стоит всегда: открытость — это его атрибут `open`,
    // который ставит showModal(), а не отдельная ветка рендера
    expect(dialog()).not.toBeNull()
    expect(dialog()!.open).toBe(false)
  })

  it('открывается по сигналу и показывает содержимое', async () => {
    const { setOpen } = mount({ title: 'Бронь' })
    setOpen(true)
    await tick()

    expect(dialog()!.open).toBe(true)
    expect(dialog()!.textContent).toContain('тело окна')
    expect(dialog()!.textContent).toContain('Бронь')
  })
})

describe('закрытие', () => {
  it('клик по подложке закрывает', async () => {
    const { setOpen, onClose } = mount()
    setOpen(true)
    await tick()

    // событие с целью на самом <dialog> — это и есть клик мимо окна
    dialog()!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await tick()

    expect(onClose).toHaveBeenCalled()
  })

  it('keepOnBackdrop оставляет окно открытым', async () => {
    const { setOpen, onClose } = mount({ keepOnBackdrop: true })
    setOpen(true)
    await tick()

    dialog()!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await tick()

    expect(onClose).not.toHaveBeenCalled()
  })

  it('клик внутри окна не закрывает', async () => {
    const { setOpen, onClose } = mount()
    setOpen(true)
    await tick()

    dialog()!.querySelector('p')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await tick()

    expect(onClose).not.toHaveBeenCalled()
  })

  it('onBeforeClose с false держит окно: несохранённое не пропадает', async () => {
    const guard = vi.fn(() => false)
    const { setOpen, onClose } = mount({ onBeforeClose: guard })
    setOpen(true)
    await tick()

    dialog()!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await tick()

    expect(guard).toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('onBeforeClose умеет отвечать промисом', async () => {
    const { setOpen, onClose } = mount({ onBeforeClose: async () => true })
    setOpen(true)
    await tick()

    dialog()!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await tick()

    expect(onClose).toHaveBeenCalled()
  })
})

describe('фокус', () => {
  it('возвращается туда, откуда открывали', async () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()

    const { setOpen } = mount()
    setOpen(true)
    await tick()

    // Фокус на время открытия уводит сам браузер, и в happy-dom этого не
    // происходит — проверяем то, что дописано руками: после закрытия он
    // возвращается на кнопку, с которой пришли, а не остаётся в никуде.
    const elsewhere = document.createElement('input')
    document.body.appendChild(elsewhere)
    elsewhere.focus()
    expect(document.activeElement).toBe(elsewhere)

    setOpen(false)
    await tick()
    expect(document.activeElement).toBe(opener)

    opener.remove()
    elsewhere.remove()
  })
})
