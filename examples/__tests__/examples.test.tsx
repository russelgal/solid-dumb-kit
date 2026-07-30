// Смоук-тест витрины: каждый пример должен монтироваться без падения и что-то
// рисовать. Ловит опечатки в пропсах и рассинхрон примеров с API кита.
import { describe, it, expect, afterEach } from 'vitest'
import { render } from 'solid-js/web'
import SelectionAreaExample from '../SelectionArea.example'
import DumbSortableExample from '../DumbSortable.example'
import ResizableGridExample from '../ResizableGrid.example'
import DumbTreeExample from '../DumbTree.example'
import DumbTableExample from '../DumbTable.example'
import KanbanExample from '../Kanban.example'
import UtilsExample from '../utils.example'
import Odata1CExample from '../Odata1C.example'

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
