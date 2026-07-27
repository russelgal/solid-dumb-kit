// Смоук-тест витрины: каждый пример должен монтироваться без падения и что-то
// рисовать. Ловит опечатки в пропсах и рассинхрон примеров с API кита.
import { describe, it, expect, afterEach } from 'vitest'
import { render } from 'solid-js/web'
import SelectionAreaExample from '../SelectionArea.example'
import DumbSortableExample from '../DumbSortable.example'
import ResizableGridExample from '../ResizableGrid.example'
import DumbTreeExample from '../DumbTree.example'
import DumbTableExample from '../DumbTable.example'
import UtilsExample from '../utils.example'

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
  ['utils', UtilsExample],
] as const

describe('examples — монтируются и рендерят разметку', () => {
  for (const [name, Comp] of EXAMPLES) {
    it(name, () => {
      const host = mount(Comp)
      expect(host.querySelectorAll('*').length).toBeGreaterThan(5)
    })
  }
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
