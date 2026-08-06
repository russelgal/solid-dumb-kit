// DumbContextMenu в DOM: открытие, пункты, подменю, клавиатура, жест.
//
// Математики у меню нет — вся его ценность в поведении: какая панель ловит
// стрелки, когда раскрывается ветка, что закрывает Esc. До этих тестов всё
// проверялось руками в браузере.
//
// happy-dom не знает Popover API и anchor positioning — компонент к этому
// готов сам (`showPopover?.()`, фолбэк по координатам), тестам хватает одной
// подпорки: `matches(':popover-open')` на неизвестном псевдоклассе кидает,
// подменяем на false. Что под курсором (`document.elementFromPoint`) в тестах
// жеста отвечает мок — happy-dom раскладку не считает.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from 'solid-js/web'
import { DumbContextMenu, type MenuItem } from '../src'

/* ── подпорка: happy-dom кидает на неизвестном псевдоклассе ─────────────── */

const origMatches = Element.prototype.matches
beforeEach(() => {
  Element.prototype.matches = function (sel: string) {
    if (sel.includes(':popover-open')) return false
    return origMatches.call(this, sel)
  }
})

/* ── монтирование ───────────────────────────────────────────────────────── */

let host: HTMLDivElement
let dispose: (() => void) | null = null

afterEach(() => {
  dispose?.()
  dispose = null
  host?.remove()
  Element.prototype.matches = origMatches
  vi.restoreAllMocks()
})

function mount(items: Array<MenuItem>, extra: { onToggle?: (open: boolean) => void } = {}) {
  host = document.createElement('div')
  document.body.appendChild(host)
  dispose = render(
    () => <DumbContextMenu items={() => items} target={() => host} onToggle={extra.onToggle} />,
    host,
  )
}

/** эффекты панелей показывают попover в микротаске — даём ей пройти */
const tick = () => new Promise((r) => setTimeout(r, 0))

const rightClick = (x = 100, y = 100) =>
  host.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: x, clientY: y }))

const key = (k: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k }))

/** кнопки одной панели, по глубине; текст — без стрелки ветки */
const panel = (depth: number) => document.querySelector(`.dumb-menu[data-depth="${depth}"]`)
const buttons = (depth = 0) =>
  Array.from(panel(depth)?.querySelectorAll<HTMLButtonElement>('.dumb-menu-item') ?? [])
const activeLabel = (depth = 0) =>
  panel(depth)?.querySelector('[data-active="1"] .dumb-menu-label')?.textContent ?? null

/* ── наборы пунктов ─────────────────────────────────────────────────────── */

const leaf = (label: string, run = () => {}): MenuItem => ({ label, run })

function nested(runs: Record<string, () => void> = {}) {
  const r = (n: string) => runs[n] ?? (() => {})
  return [
    leaf('Открыть', r('open')),
    {
      label: 'Ещё',
      items: [
        leaf('Внутренний', r('inner')),
        { label: 'Глубже', items: [leaf('Самый глубокий', r('deep'))] },
      ],
      run: r('branch'), // не должен вызываться никогда
    },
    { kind: 'separator' } as MenuItem,
    leaf('Удалить', r('remove')),
  ]
}

/* ── открытие и пункты ──────────────────────────────────────────────────── */

describe('открытие', () => {
  it('правый клик открывает меню, пункты на месте', async () => {
    mount(nested())
    expect(panel(0)).toBeNull()
    rightClick()
    await tick()
    expect(panel(0)).not.toBeNull()
    expect(buttons(0).map((b) => b.querySelector('.dumb-menu-label')?.textContent)).toEqual([
      'Открыть',
      'Ещё',
      'Удалить',
    ])
  })

  it('клик по обычному пункту выполняет его и закрывает меню', async () => {
    const open = vi.fn()
    const toggles: Array<boolean> = []
    mount(nested({ open }), { onToggle: (o) => toggles.push(o) })
    rightClick()
    await tick()
    buttons(0)[0].click()
    await tick()
    expect(open).toHaveBeenCalledTimes(1)
    expect(panel(0)).toBeNull()
    expect(toggles).toEqual([true, false])
  })

  it('pointerdown мимо панелей закрывает меню', async () => {
    mount(nested())
    rightClick()
    await tick()
    window.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    await tick()
    expect(panel(0)).toBeNull()
  })

  it('скролл закрывает меню: точка клика привязана к прежней раскладке', async () => {
    mount(nested())
    rightClick()
    await tick()
    window.dispatchEvent(new Event('scroll'))
    await tick()
    expect(panel(0)).toBeNull()
  })
})

/* ── подменю ────────────────────────────────────────────────────────────── */

describe('подменю', () => {
  it('ветка помечена: стрелка, aria-haspopup, run не вызывается кликом', async () => {
    const branch = vi.fn()
    mount(nested({ branch }))
    rightClick()
    await tick()
    const b = buttons(0)[1]
    expect(b.dataset.sub).toBe('1')
    expect(b.getAttribute('aria-haspopup')).toBe('menu')
    expect(b.getAttribute('aria-expanded')).toBe('false')

    b.click()
    await tick()
    expect(branch).not.toHaveBeenCalled() // ветка не выполняется
    expect(panel(0)).not.toBeNull() //     и меню не закрылось
    expect(panel(1)).not.toBeNull() //     а подменю раскрылось
    expect(b.getAttribute('aria-expanded')).toBe('true')
  })

  it('наведение раскрывает ветку, наведение на обычный пункт — сворачивает', async () => {
    mount(nested())
    rightClick()
    await tick()
    const [openBtn, branchBtn] = buttons(0)
    branchBtn.dispatchEvent(new MouseEvent('mouseenter', { clientX: 120, clientY: 110 }))
    await tick()
    expect(panel(1)).not.toBeNull()
    openBtn.dispatchEvent(new MouseEvent('mouseenter', { clientX: 120, clientY: 90 }))
    await tick()
    expect(panel(1)).toBeNull()
  })

  it('вложенность рекурсивна: ветка внутри ветки открывает третью панель', async () => {
    const deep = vi.fn()
    mount(nested({ deep }))
    rightClick()
    await tick()
    buttons(0)[1].click()
    await tick()
    buttons(1)[1].click() // «Глубже»
    await tick()
    expect(panel(2)).not.toBeNull()
    buttons(2)[0].click() // «Самый глубокий»
    await tick()
    expect(deep).toHaveBeenCalledTimes(1)
    expect(panel(0)).toBeNull() // выполнение закрывает всё дерево
  })

  it('пункт подменю выполняется и закрывает всё меню целиком', async () => {
    const inner = vi.fn()
    mount(nested({ inner }))
    rightClick()
    await tick()
    buttons(0)[1].click()
    await tick()
    buttons(1)[0].click()
    await tick()
    expect(inner).toHaveBeenCalledTimes(1)
    expect(panel(1)).toBeNull()
    expect(panel(0)).toBeNull()
  })
})

/* ── клавиатура ─────────────────────────────────────────────────────────── */

describe('клавиатура', () => {
  it('стрелки ходят по кругу, разделители пропускаются', async () => {
    mount(nested())
    rightClick()
    await tick()
    key('ArrowDown')
    expect(activeLabel()).toBe('Открыть')
    key('ArrowDown')
    expect(activeLabel()).toBe('Ещё')
    // подсветка ветки с клавиатуры подменю НЕ раскрывает — стрелка идёт дальше,
    // мимо separator
    key('ArrowDown')
    expect(activeLabel()).toBe('Удалить')
    key('ArrowDown') // по кругу
    expect(activeLabel()).toBe('Открыть')
    key('ArrowUp')
    expect(activeLabel()).toBe('Удалить')
  })

  it('глухой пункт стрелками не подсвечивается', async () => {
    mount([leaf('А'), { label: 'Б', disabled: true, run: () => {} }, leaf('В')])
    rightClick()
    await tick()
    key('ArrowDown')
    key('ArrowDown')
    expect(activeLabel()).toBe('В') // Б пропущен
  })

  it('вправо — в ветку с подсветкой первого пункта, влево — назад', async () => {
    mount(nested())
    rightClick()
    await tick()
    key('ArrowDown')
    key('ArrowDown') // на «Ещё»
    await tick()
    key('ArrowRight')
    await tick()
    expect(panel(1)).not.toBeNull()
    expect(activeLabel(1)).toBe('Внутренний')
    key('ArrowLeft')
    await tick()
    expect(panel(1)).toBeNull()
    expect(panel(0)).not.toBeNull()
  })

  it('Enter на ветке раскрывает её, на пункте — выполняет и закрывает', async () => {
    const inner = vi.fn()
    mount(nested({ inner }))
    rightClick()
    await tick()
    key('ArrowDown')
    key('ArrowDown') // «Ещё»
    await tick()
    key('Enter')
    await tick()
    expect(panel(1)).not.toBeNull()
    expect(activeLabel(1)).toBe('Внутренний')
    key('Enter')
    await tick()
    expect(inner).toHaveBeenCalledTimes(1)
    expect(panel(0)).toBeNull()
  })

  it('Esc сворачивает по уровню: сначала подменю, со второго раза — всё', async () => {
    mount(nested())
    rightClick()
    await tick()
    buttons(0)[1].click()
    await tick()
    key('Escape')
    await tick()
    expect(panel(1)).toBeNull()
    expect(panel(0)).not.toBeNull()
    key('Escape')
    await tick()
    expect(panel(0)).toBeNull()
  })
})

/* ── жест press-drag-release ────────────────────────────────────────────── */

describe('жест', () => {
  const releaseAt = (x: number, y: number) =>
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: x, clientY: y }))

  it('повёл и отпустил на пункте — пункт сработал', async () => {
    const remove = vi.fn()
    mount(nested({ remove }))
    rightClick(100, 100)
    await tick()
    const target = buttons(0)[2] // «Удалить»
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(target)
    releaseAt(120, 160) // сдвиг больше порога — это ведение, не щелчок
    await tick()
    expect(remove).toHaveBeenCalledTimes(1)
    expect(panel(0)).toBeNull()
  })

  it('отпустил на ветке — меню остаётся: жест продолжается в подменю', async () => {
    mount(nested())
    rightClick(100, 100)
    await tick()
    const branchBtn = buttons(0)[1]
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(branchBtn)
    releaseAt(120, 130)
    await tick()
    expect(panel(0)).not.toBeNull()
  })

  it('щёлкнул и сразу отпустил — меню висит, как на Windows', async () => {
    mount(nested())
    rightClick(100, 100)
    await tick()
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(null)
    releaseAt(101, 101) // без ведения и быстрее порога удержания
    await tick()
    expect(panel(0)).not.toBeNull()
  })

  it('повёл и отпустил мимо пунктов — меню закрылось без выполнения', async () => {
    const runs = { open: vi.fn(), remove: vi.fn() }
    mount(nested(runs))
    rightClick(100, 100)
    await tick()
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(document.body)
    releaseAt(200, 200)
    await tick()
    expect(panel(0)).toBeNull()
    expect(runs.open).not.toHaveBeenCalled()
    expect(runs.remove).not.toHaveBeenCalled()
  })
})
