// Смоук-тест витрины: каждый пример должен монтироваться без падения и что-то
// рисовать. Ловит опечатки в пропсах и рассинхрон примеров с API кита.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render } from 'solid-js/web'
import SelectionAreaExample from '../SelectionArea.example'
import DumbSortableExample from '../DumbSortable.example'
import ResizableGridExample from '../ResizableGrid.example'
import DumbTreeExample from '../DumbTree.example'
import DumbTableExample from '../DumbTable.example'
import DumbGridExample from '../DumbGrid.example'
import BoardExample from '../Board.example'
import DumbGridDndExample from '../DumbGridDnd.example'
import KanbanExample from '../Kanban.example'
import UtilsExample from '../utils.example'
import Odata1CExample from '../Odata1C.example'
import DumbSortableDndExample from '../DumbSortableDnd.example'
import CssOrderExample from '../CssOrder.example'
import RawDndExample from '../RawDnd.example'
import FlipBenchExample from '../FlipBench.example'
import OrderKanbanExample from '../OrderKanban.example'
import OrderBoardExample from '../OrderBoard.example'
import OrderTableExample from '../OrderTable.example'
import OrderTreeExample from '../OrderTree.example'

const mounted: Array<() => void> = []
afterEach(() => { mounted.splice(0).forEach((dispose) => dispose()) })

function mount(Comp: () => any) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  mounted.push(render(() => <Comp />, host))
  return host
}

const EXAMPLES = [
  ['SelectionArea', SelectionAreaExample],
  ['DumbSortable', DumbSortableExample],
  ['ResizableGrid', ResizableGridExample],
  ['DumbTree', DumbTreeExample],
  ['DumbTable', DumbTableExample],
  ['DumbGrid', DumbGridExample],
  ['Board', BoardExample],
  ['DumbGridDnd', DumbGridDndExample],
  ['DumbSortableDnd', DumbSortableDndExample],
  ['CssOrder', CssOrderExample],
  ['RawDnd', RawDndExample],
  ['FlipBench', FlipBenchExample],
  ['OrderKanban', OrderKanbanExample],
  ['OrderBoard', OrderBoardExample],
  ['OrderTable', OrderTableExample],
  ['OrderTree', OrderTreeExample],
  ['Kanban', KanbanExample],
  ['utils', UtilsExample],
  ['Odata1C', Odata1CExample],
] as const

describe('examples — монтируются и рендерят разметку', () => {
  for (const [name, Comp] of EXAMPLES) {
    it(name, () => {
      const host = mount(Comp)
      expect(host.querySelectorAll('*').length).toBeGreaterThan(5)
    })
  }
})

describe('SelectionArea.example — обе доски на месте', () => {
  it('рисует и прокручиваемую, и длинную без overflow', () => {
    const host = mount(SelectionAreaExample)
    const text = host.textContent ?? ''
    expect(text).toContain('Прокручиваемый контейнер')
    expect(text).toContain('Длинный грид без overflow')
    expect(host.querySelectorAll('.card').length).toBe(340)   // 100 + 240
  })

  it('кнопка удаления выключена, пока ничего не выделено', () => {
    const host = mount(SelectionAreaExample)
    const kill = Array.from(host.querySelectorAll('button')).filter(
      (b) => b.textContent?.includes('удалить выделенное'),
    )
    expect(kill.length).toBe(2)                    // по одной на доску
    expect(kill.every((b) => b.disabled)).toBe(true)
  })

  it('прокрутка висит на самом контейнере выделения, и только у первой доски', () => {
    const host = mount(SelectionAreaExample)
    const surfaces = host.querySelectorAll('.surface')
    expect(surfaces.length).toBe(2)
    expect(surfaces[0].classList.contains('surface-scroll')).toBe(true)
    expect(surfaces[1].classList.contains('surface-scroll')).toBe(false)
  })
})

describe('DumbTable.example — сортировка идёт по всему набору, а не по странице', () => {
  const skus = (host: HTMLElement) =>
    Array.from(host.querySelectorAll('tbody tr td:nth-child(2)')).map((td) => td.textContent)

  it('после сортировки на первой странице оказываются другие строки', () => {
    const host = mount(DumbTableExample)
    const before = skus(host)

    // «Цена» — третий заголовок (первый — колонка ручки)
    const priceTh = Array.from(host.querySelectorAll('th'))
      .find((th) => th.textContent?.includes('Цена'))!
    priceTh.click()

    const after = skus(host)
    expect(after).not.toEqual(before)     // сортировали бы страницу — состав бы совпал
    expect(after.length).toBe(before.length)
  })

  it('перемешивание снимает сортировку, иначе его не было бы видно', () => {
    const host = mount(DumbTableExample)
    const priceTh = Array.from(host.querySelectorAll('th'))
      .find((th) => th.textContent?.includes('Цена'))!
    priceTh.click()
    expect(priceTh.textContent).toMatch(/[▲▼]/)

    const shuffleBtn = Array.from(host.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'перемешать')!
    shuffleBtn.click()
    expect(priceTh.textContent).toContain('⇅')   // стрелка снова нейтральная
  })
})

describe('Odata1C.example — URL для 1С', () => {
  it('показывает оба варианта: закодированный и читаемый', () => {
    const host = mount(Odata1CExample)
    const outs = Array.from(host.querySelectorAll('.out')).map((el) => el.textContent ?? '')
    const encoded = outs.find((s) => s.includes('%D0'))          // кириллица в percent-encoding
    const readable = outs.find((s) => /[А-Яа-я]/.test(s))        // она же буквами

    expect(encoded).toBeTruthy()
    expect(readable).toBeTruthy()
    expect(encoded).not.toBe(readable)
  })

  it('оба варианта — про один и тот же адрес', () => {
    const host = mount(Odata1CExample)
    const outs = Array.from(host.querySelectorAll('.out')).map((el) => el.textContent ?? '')
    const encoded = outs.find((s) => s.includes('%D0'))!
    const readable = outs.find((s) => /[А-Яа-я]/.test(s))!
    expect(decodeURIComponent(encoded)).toBe(readable)
  })

  it('в закодированном пробелы — %20, а не плюс: 1С понимает только их', () => {
    const host = mount(Odata1CExample)
    const encoded = Array.from(host.querySelectorAll('.out'))
      .map((el) => el.textContent ?? '').find((s) => s.includes('%D0'))!
    expect(encoded).not.toContain('+')
  })
})

describe('Kanban.example — перемешивание', () => {
  it('кнопка есть и раскидывает карточки, сохраняя размеры колонок', () => {
    const host = mount(KanbanExample)
    const counts = () =>
      Array.from(host.querySelectorAll('section')).map((s) => s.querySelectorAll('article').length)

    const before = counts()
    const btn = Array.from(host.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'перемешать')!
    expect(btn).toBeTruthy()

    btn.click()
    expect(counts()).toEqual(before)                       // колонки той же длины
    expect(host.querySelectorAll('article').length).toBe(10)  // ни одна не потерялась
  })

  it('карточкам проставлено имя для View Transitions', () => {
    const host = mount(KanbanExample)
    const first = host.querySelector('article') as HTMLElement
    expect(first.style.getPropertyValue('view-transition-name')).toMatch(/^kanban-/)
  })
})

describe('DumbTree.example — дерево реально построилось', () => {
  it('рисует корневые категории и вложенных детей', () => {
    const host = mount(DumbTreeExample)
    const text = host.textContent ?? ''
    // корневые узлы дерева
    expect(text).toContain('Accommodation')
    expect(text).toContain('Events')
    // счётчики из rowExtra
    expect(text).toContain('42')
  })

  it('поле поиска и переключатель сортировки на месте', () => {
    const host = mount(DumbTreeExample)
    expect(host.querySelectorAll('input').length).toBeGreaterThanOrEqual(2) // поиск в дереве + фильтр в flat
    expect(host.textContent).toContain('Index')
    expect(host.textContent).toContain('Name')
  })

  it('flat-список отдаёт ручки перетаскивания', () => {
    const host = mount(DumbTreeExample)
    expect(host.querySelectorAll('[data-drag-handle]').length).toBeGreaterThan(0)
  })
})

describe('utils.example — хелперы посчитались вживую', () => {
  it('показывает отформатированные числа и slug', () => {
    const host = mount(UtilsExample)
    const text = host.textContent ?? ''
    expect(text).toContain('1 234,50 ₽')            // RubR2(1234.5)
    expect(text).toContain('plyazhnyj-otdyh-i-bassejny')      // genSlug(...)
  })

  it('строит imgproxy URL с подставленным бакетом', () => {
    const host = mount(UtilsExample)
    expect(host.textContent).toContain('https://img.example.com/insecure/rs:fill:800:0:0:0/')
  })
})

describe('Odata1C.example — витрина собирает настоящий URL', () => {
  it('показывает $format=nometadata и пробелы как %20', () => {
    const host = mount(Odata1CExample)
    const text = host.textContent ?? ''
    expect(text).toContain('%24format=application%2Fjson%3Bodata%3Dnometadata')
    // пробел внутри $filter — только %20: с «+» 1С молча вернёт выборку без отбора
    expect(text).toMatch(/%24filter=[^\s]*%20/)
  })

  it('на монтировании в сеть не ходит — запрос только по кнопке', () => {
    const host = mount(Odata1CExample)
    const run = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Выполнить'),
    )
    expect(run).toBeTruthy()
    expect(host.textContent).not.toContain('строк(и)')
  })
})

describe('DumbGrid.example — раскладка выставлена явно, а не авто-потоком', () => {
  // блоки-обёртки узнаём по inline grid-column: их ставит сам DumbGrid
  const blocks = (host: HTMLElement) =>
    Array.from(host.querySelectorAll<HTMLElement>('div')).filter((el) => el.style.gridColumn)

  it('первый блок занимает 6 колонок и 2 строки с первой позиции', () => {
    const host = mount(DumbGridExample)
    const first = blocks(host)[0]
    expect(first.style.gridColumn).toBe('1 / span 6')
    expect(first.style.gridRow).toBe('1 / span 2')
  })

  it('соседи встают за ним в той же строке, а не наползают', () => {
    const host = mount(DumbGridExample)
    const [, orders, refunds] = blocks(host)
    expect(orders.style.gridColumn).toBe('7 / span 3')
    expect(orders.style.gridRow).toBe('1 / span 1')
    expect(refunds.style.gridColumn).toBe('10 / span 3')
  })

  it('заблокированный блок не отдаёт ручку ресайза', () => {
    const host = mount(DumbGridExample)
    // 7 блоков в примере, один из них locked
    expect(blocks(host).length).toBe(7)
    expect(host.querySelectorAll('[data-grid-resize]').length).toBe(6)
  })

  it('снятие resizable убирает ручки у всех', () => {
    const host = mount(DumbGridExample)
    const toggle = Array.from(host.querySelectorAll<HTMLInputElement>('input[type=checkbox]'))
      .find((i) => i.parentElement?.textContent?.includes('resizable'))!
    toggle.click()
    expect(host.querySelectorAll('[data-grid-resize]').length).toBe(0)
  })
})

describe('DumbGrid.example — режимы и разметка сетки', () => {
  const blocks = (host: HTMLElement) =>
    Array.from(host.querySelectorAll<HTMLElement>('div')).filter((el) => el.style.gridColumn)
  const pick = (host: HTMLElement, label: string) =>
    Array.from(host.querySelectorAll<HTMLSelectElement>('select'))
      .find((s) => s.parentElement?.textContent?.trim().startsWith(label))!
  const choose = (sel: HTMLSelectElement, value: string) => {
    sel.value = value
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  }

  it('подложка сетки есть и по умолчанию скрыта до жеста', () => {
    const host = mount(DumbGridExample)
    const lines = host.querySelector<HTMLElement>('[data-grid-lines]')!
    expect(lines).toBeTruthy()
    expect(lines.style.opacity).toBe('0')          // showGrid=\'drag\', жеста нет
  })

  it('«always» показывает сетку сразу, «never» убирает подложку совсем', () => {
    const host = mount(DumbGridExample)
    const grid = pick(host, 'grid lines')

    choose(grid, 'true')
    expect(host.querySelector<HTMLElement>('[data-grid-lines]')!.style.opacity).toBe('1')

    choose(grid, 'false')
    expect(host.querySelector('[data-grid-lines]')).toBeNull()
  })

  it('dense затыкает дырку: блок из следующей строки поднимается в первую', () => {
    const host = mount(DumbGridExample)
    const rowsOf = (h: HTMLElement) => blocks(h).map((el) => el.style.gridRow)

    const before = rowsOf(host)
    choose(pick(host, 'mode'), 'dense')
    const after = rowsOf(host)

    expect(after).not.toEqual(before)
    // в dense никто не оказывается ниже, чем был в flow
    const rowNum = (s: string) => Number(s.split(' / ')[0])
    after.forEach((r, i) => expect(rowNum(r)).toBeLessThanOrEqual(rowNum(before[i])))
  })

  it('free держит запас пустой строки под раскладкой — блоку есть куда уехать', () => {
    const host = mount(DumbGridExample)
    const ROW_H = 92, GAP = 12      // пропы примера
    // сколько строк реально занято по разметке блоков
    const usedRows = () =>
      Math.max(
        ...blocks(host).map((el) => {
          const [start, span] = el.style.gridRow.split(' / ')
          return Number(start) - 1 + Number(span.replace('span ', ''))
        }),
      )
    const minRows = () => {
      const box = host.querySelector<HTMLElement>('[data-grid-lines]')!.parentElement!
      return (parseFloat(box.style.minHeight) + GAP) / (ROW_H + GAP)
    }

    // в потоке пустоты под раскладкой не нужно — там некуда «между»
    expect(minRows()).toBeCloseTo(usedRows(), 5)

    choose(pick(host, 'mode'), 'free')
    expect(minRows()).toBeCloseTo(usedRows() + 2, 5)   // дефолтный запас free
  })
})

describe('DumbGrid.example — добавление и удаление блоков', () => {
  const blocks = (host: HTMLElement) =>
    Array.from(host.querySelectorAll<HTMLElement>('div')).filter((el) => el.style.gridColumn)
  const button = (host: HTMLElement, label: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === label)!

  it('кнопка ✕ есть у всех блоков, кроме помеченного removable: false', () => {
    const host = mount(DumbGridExample)
    expect(blocks(host).length).toBe(7)
    expect(host.querySelectorAll('[data-grid-remove]').length).toBe(6)
  })

  it('клик по ✕ убирает блок из сетки', () => {
    const host = mount(DumbGridExample)
    const before = blocks(host).length
    host.querySelector<HTMLButtonElement>('[data-grid-remove]')!.click()
    expect(blocks(host).length).toBe(before - 1)
  })

  it('кнопка добавления кладёт блок заданного пресета', () => {
    const host = mount(DumbGridExample)
    const before = blocks(host).length

    button(host, '+ full × 2').click()
    const added = blocks(host)
    expect(added.length).toBe(before + 1)

    const last = added[added.length - 1]
    expect(last.style.gridColumn).toBe('1 / span 12')   // full на 12 колонках
    expect(last.style.gridRow).toContain('span 2')
  })

  it('кнопка ✕ не начинает драг — она <button> с [data-no-drag]', () => {
    const host = mount(DumbGridExample)
    const kill = host.querySelector<HTMLButtonElement>('[data-grid-remove]')!
    expect(kill.dataset.noDrag).toBe('')
    expect(kill.tagName).toBe('BUTTON')
  })

  it('Reset возвращает исходный набор блоков', () => {
    const host = mount(DumbGridExample)
    button(host, '+ half').click()
    host.querySelector<HTMLButtonElement>('[data-grid-remove]')!.click()

    button(host, 'Reset layout').click()
    expect(blocks(host).length).toBe(7)
  })
})

describe('DumbGrid.example — режим просмотра', () => {
  const blocks = (host: HTMLElement) =>
    Array.from(host.querySelectorAll<HTMLElement>('div')).filter((el) => el.style.gridColumn)
  const editToggle = (host: HTMLElement) =>
    Array.from(host.querySelectorAll<HTMLInputElement>('input[type=checkbox]'))
      .find((i) => i.parentElement?.textContent?.includes('edit mode'))!

  it('выключенное редактирование убирает ручки, кнопки и разметку сетки', () => {
    const host = mount(DumbGridExample)
    expect(host.querySelectorAll('[data-grid-resize]').length).toBeGreaterThan(0)

    editToggle(host).click()

    expect(host.querySelectorAll('[data-grid-resize]').length).toBe(0)
    expect(host.querySelectorAll('[data-grid-remove]').length).toBe(0)
    expect(host.querySelector('[data-grid-lines]')).toBeNull()
  })

  it('сами блоки остаются на своих местах — это та же сетка', () => {
    const host = mount(DumbGridExample)
    const before = blocks(host).map((el) => [el.style.gridColumn, el.style.gridRow])

    editToggle(host).click()
    expect(blocks(host).map((el) => [el.style.gridColumn, el.style.gridRow])).toEqual(before)
  })

  it('кит не навешивает на блоки ни курсора-хватайки, ни touch-action', () => {
    const host = mount(DumbGridExample)
    editToggle(host).click()

    for (const el of blocks(host)) {
      expect(el.style.cursor).not.toBe('grab')   // 'default' здесь от blockStyle примера
      expect(el.style.touchAction).toBe('')
    }
  })

  it('нажатие на блок не начинает драг: обработчиков просто нет', () => {
    const host = mount(DumbGridExample)
    editToggle(host).click()

    const spy = vi.spyOn(window, 'addEventListener')
    blocks(host)[0].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 77 }))
    expect(spy).not.toHaveBeenCalledWith('pointermove', expect.any(Function))
    spy.mockRestore()
  })

  it('включение редактирования возвращает контролы', () => {
    const host = mount(DumbGridExample)
    editToggle(host).click()
    editToggle(host).click()

    expect(host.querySelectorAll('[data-grid-resize]').length).toBeGreaterThan(0)
    expect(host.querySelector('[data-grid-lines]')).toBeTruthy()
  })
})

describe('Board.example — вложенные сетки', () => {
  const blocks = (host: HTMLElement) =>
    Array.from(host.querySelectorAll<HTMLElement>('div')).filter((el) => el.style.gridColumn)
  const editToggle = (host: HTMLElement) =>
    Array.from(host.querySelectorAll<HTMLInputElement>('input[type=checkbox]'))
      .find((i) => i.parentElement?.textContent?.includes('edit mode'))!
  const button = (host: HTMLElement, label: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === label)!

  it('блоки внешней сетки содержат сетки со своими блоками', () => {
    const host = mount(BoardExample)
    const sections = Array.from(host.querySelectorAll<HTMLElement>('.section'))
    expect(sections.length).toBe(2)

    // 2 секции снаружи + 7 виджетов внутри
    expect(blocks(host).length).toBe(9)
    for (const w of Array.from(host.querySelectorAll<HTMLElement>('.widget'))) {
      expect(sections.some((sec) => sec.contains(w))).toBe(true)
    }
  })

  it('у вложенной сетки свои колонки: виджет занимает 3 из 6, секция 6 из 12', () => {
    const host = mount(BoardExample)
    const outer = blocks(host).filter((el) => el.querySelector('.section'))
    const innerBlocks = blocks(host).filter((el) => el.querySelector('.widget'))

    expect(outer[0].style.gridColumn).toBe('1 / span 6')
    expect(innerBlocks.some((el) => el.style.gridColumn.endsWith('span 3'))).toBe(true)
  })

  it('блоки помечены data-grid-block — по ней внешняя сетка пропускает чужой жест', () => {
    const host = mount(BoardExample)
    const marked = Array.from(host.querySelectorAll('[data-grid-block]'))
    expect(marked.length).toBe(9)

    // вложенный блок лежит внутри внешнего, и это разные блоки
    const widget = host.querySelector<HTMLElement>('.widget')!.closest('[data-grid-block]')!
    const section = widget.parentElement!.closest('[data-grid-block]')
    expect(section).toBeTruthy()
    expect(section).not.toBe(widget)
  })

  it('нажатие по вложенному блоку не начинает драг секции', () => {
    const host = mount(BoardExample)
    const spy = vi.spyOn(window, 'addEventListener')

    host.querySelector<HTMLElement>('.widget')!
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 93 }))

    expect(spy).not.toHaveBeenCalledWith('pointermove', expect.any(Function))
    spy.mockRestore()
  })

  it('виджет добавляется в свою секцию, а не в соседнюю', () => {
    const host = mount(BoardExample)
    const counts = () =>
      Array.from(host.querySelectorAll<HTMLElement>('.section')).map((s) => s.querySelectorAll('.widget').length)

    const before = counts()
    Array.from(host.querySelectorAll<HTMLButtonElement>('.add'))[0].click()

    expect(counts()).toEqual([before[0] + 1, before[1]])
  })

  it('секция добавляется и удаляется вместе со своими виджетами', () => {
    const host = mount(BoardExample)
    button(host, '+ секция').click()
    expect(host.querySelectorAll('.section').length).toBe(3)

    // ✕ секции — кнопка удаления внешнего блока (у виджетов свои, внутри)
    const outerKill = Array.from(host.querySelectorAll<HTMLElement>('[data-grid-remove]'))
      .filter((b) => b.closest('[data-grid-block]')?.querySelector('.section'))
    outerKill[0].click()

    expect(host.querySelectorAll('.section').length).toBe(2)
  })

  it('edit mode гасит оба уровня разом', () => {
    const host = mount(BoardExample)
    expect(host.querySelectorAll('[data-grid-resize]').length).toBe(9)

    editToggle(host).click()
    expect(host.querySelectorAll('[data-grid-resize]').length).toBe(0)
    expect(host.querySelectorAll('.widget').length).toBe(7)   // содержимое на месте
  })
})

describe('DumbGridDnd.example — нативная сетка', () => {
  const blocks = (host: HTMLElement) =>
    Array.from(host.querySelectorAll<HTMLElement>('div')).filter((el) => el.style.gridColumn)

  it('две доски, блоки нативно перетаскиваемые', () => {
    const host = mount(DumbGridDndExample)
    expect(host.querySelectorAll('.board').length).toBe(2)
    expect(blocks(host).length).toBe(6)
    expect(host.querySelectorAll('[data-dnd-block][draggable="true"]').length).toBe(6)
  })

  it('раскладка считается нами: широкий блок занимает 6 колонок из 6', () => {
    const host = mount(DumbGridDndExample)
    const first = blocks(host)[0]
    expect(first.style.gridColumn).toBe('1 / span 6')
    expect(first.style.gridRow).toBe('1 / span 2')
  })

  it('указательная витрина рядом не изменилась — там нет ни draggable, ни dnd-блоков', () => {
    const host = mount(DumbGridExample)
    expect(host.querySelectorAll('[draggable="true"]').length).toBe(0)
    expect(host.querySelectorAll('[data-dnd-block]').length).toBe(0)
  })
})

describe('DumbGridDnd.example — нативная сетка', () => {
  const cells = (host: HTMLElement) =>
    Array.from(host.querySelectorAll<HTMLElement>('[data-dnd-block]'))

  it('две доски, блоки зарегистрированы в движке', () => {
    const host = mount(DumbGridDndExample)
    expect(host.querySelectorAll('.board').length).toBe(2)
    expect(cells(host).length).toBe(6)
  })

  it('раскладку считаем мы: широкий блок занимает 6 колонок из 6', () => {
    const host = mount(DumbGridDndExample)
    const first = cells(host)[0]
    expect(first.style.gridColumn).toBe('1 / span 6')
    expect(first.style.gridRow).toBe('1 / span 2')
  })

  it('до жеста ни контура, ни сдвигов', () => {
    const host = mount(DumbGridDndExample)
    expect(host.querySelector('[data-dnd-ghost]')).toBeNull()
    expect(cells(host).every((c) => !c.style.transform)).toBe(true)
  })

  it('указательная витрина рядом не изменилась', () => {
    const host = mount(DumbGridExample)
    expect(host.querySelectorAll('[data-dnd-block]').length).toBe(0)
    expect(host.querySelectorAll('[data-grid-block]').length).toBe(7)
  })
})
