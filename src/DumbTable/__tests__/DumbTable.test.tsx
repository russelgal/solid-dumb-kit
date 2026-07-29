// DumbTable: колонки, сортировка (клиентская и серверная), пагинация, ручки драга.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render } from 'solid-js/web'
import { createSignal } from 'solid-js'
import { DumbTable, type DumbColumn } from '../DumbTable'
import { DumbPagination, buildPageNumbers } from '../DumbPagination'

type Row = { id: string; name: string; price: number }

const ROWS: Row[] = [
  { id: 'b', name: 'Бета', price: 30 },
  { id: 'a', name: 'Альфа', price: 10 },
  { id: 'c', name: 'Гамма', price: 20 },
]

const COLS: DumbColumn<Row>[] = [
  { key: 'name', label: 'Название', sortable: true },
  { key: 'price', label: 'Цена', sortable: true, align: 'right' },
  { key: 'act', label: '', stopClick: true, render: () => <button>купить</button> },
]

const disposers: Array<() => void> = []
afterEach(() => { disposers.splice(0).forEach((d) => d()) })

function mount(comp: () => any) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  disposers.push(render(comp, host))
  return host
}

const bodyTexts = (host: HTMLElement, cell = 0) =>
  Array.from(host.querySelectorAll('tbody tr')).map(
    (tr) => tr.querySelectorAll('td')[cell]?.textContent?.trim() ?? '',
  )

describe('DumbTable — колонки', () => {
  it('рисует заголовки и строки в порядке данных', () => {
    const host = mount(() => <DumbTable rows={ROWS} columns={COLS} rowId={(r) => r.id} />)
    expect(Array.from(host.querySelectorAll('th')).map((th) => th.textContent?.replace(/[▲▼⇅]/g, '').trim()))
      .toEqual(['Название', 'Цена', ''])
    expect(bodyTexts(host)).toEqual(['Бета', 'Альфа', 'Гамма'])
  })

  it('значение по умолчанию берётся по key, render перебивает', () => {
    const host = mount(() => <DumbTable rows={ROWS} columns={COLS} rowId={(r) => r.id} />)
    expect(bodyTexts(host, 1)).toEqual(['30', '10', '20'])   // без render — сырое значение
    expect(bodyTexts(host, 2)).toEqual(['купить', 'купить', 'купить'])
  })

  it('align и width уезжают в стиль ячейки', () => {
    const host = mount(() => <DumbTable rows={ROWS} columns={COLS} rowId={(r) => r.id} />)
    const priceCell = host.querySelector('tbody tr td:nth-child(2)') as HTMLElement
    expect(priceCell.style.textAlign).toBe('right')
  })

  it('строки получают data-key — по нему их находит SelectionArea', () => {
    const host = mount(() => <DumbTable rows={ROWS} columns={COLS} rowId={(r) => r.id} />)
    expect(Array.from(host.querySelectorAll('tbody tr')).map((tr) => tr.getAttribute('data-key')))
      .toEqual(['b', 'a', 'c'])
  })

  it('показывает empty, когда строк нет', () => {
    const host = mount(() => <DumbTable rows={[]} columns={COLS} empty={<p>пусто</p>} />)
    expect(host.textContent).toContain('пусто')
    expect(host.querySelector('table')).toBeNull()
  })
})

describe('DumbTable — клиентская сортировка', () => {
  it('текстовая колонка начинает с asc, второй клик разворачивает', () => {
    const host = mount(() => <DumbTable rows={ROWS} columns={COLS} rowId={(r) => r.id} />)
    const nameTh = host.querySelectorAll('th')[0] as HTMLElement

    nameTh.click()
    expect(bodyTexts(host)).toEqual(['Альфа', 'Бета', 'Гамма'])

    nameTh.click()
    expect(bodyTexts(host)).toEqual(['Гамма', 'Бета', 'Альфа'])
  })

  it('числовая колонка по умолчанию начинает с desc (поведение TanStack)', () => {
    const host = mount(() => <DumbTable rows={ROWS} columns={COLS} rowId={(r) => r.id} />)
    ;(host.querySelectorAll('th')[1] as HTMLElement).click()
    expect(bodyTexts(host)).toEqual(['Бета', 'Гамма', 'Альфа'])   // 30, 20, 10
  })

  it('sortDescFirst={false} заставляет числовую колонку начинать с asc', () => {
    const host = mount(() => <DumbTable rows={ROWS} columns={COLS} rowId={(r) => r.id} sortDescFirst={false} />)
    ;(host.querySelectorAll('th')[1] as HTMLElement).click()
    expect(bodyTexts(host)).toEqual(['Альфа', 'Гамма', 'Бета'])   // 10, 20, 30
  })

  it('третий клик сбрасывает сортировку к исходному порядку', () => {
    const host = mount(() => <DumbTable rows={ROWS} columns={COLS} rowId={(r) => r.id} />)
    const nameTh = host.querySelectorAll('th')[0] as HTMLElement

    nameTh.click()                                                 // asc
    expect(bodyTexts(host)).toEqual(['Альфа', 'Бета', 'Гамма'])
    nameTh.click()                                                 // desc
    expect(bodyTexts(host)).toEqual(['Гамма', 'Бета', 'Альфа'])
    nameTh.click()                                                 // сброс
    expect(bodyTexts(host)).toEqual(['Бета', 'Альфа', 'Гамма'])     // исходный порядок данных
    expect(host.querySelectorAll('th')[0].textContent).toContain('⇅')
  })

  it('noSortRemoval оставляет только asc ⇄ desc', () => {
    const host = mount(() => <DumbTable rows={ROWS} columns={COLS} rowId={(r) => r.id} noSortRemoval />)
    const nameTh = host.querySelectorAll('th')[0] as HTMLElement
    nameTh.click(); nameTh.click(); nameTh.click()
    expect(bodyTexts(host)).toEqual(['Альфа', 'Бета', 'Гамма'])     // снова asc, а не сброс
  })

  it('несортируемая колонка не реагирует на клик', () => {
    const host = mount(() => <DumbTable rows={ROWS} columns={COLS} rowId={(r) => r.id} />)
    ;(host.querySelectorAll('th')[2] as HTMLElement).click()
    expect(bodyTexts(host)).toEqual(['Бета', 'Альфа', 'Гамма'])
  })
})

describe('DumbTable — серверная сортировка', () => {
  it('onSort получает ключ и направление, порядок строк не трогается', () => {
    const onSort = vi.fn()
    const host = mount(() => (
      <DumbTable rows={ROWS} columns={COLS} rowId={(r) => r.id} sort="name" order="asc" onSort={onSort} />
    ))

    // клик по уже активной колонке разворачивает направление
    ;(host.querySelectorAll('th')[0] as HTMLElement).click()
    expect(onSort).toHaveBeenCalledWith('name', 'desc')
    // сервер сам вернёт данные — таблица оставляет порядок как есть
    expect(bodyTexts(host)).toEqual(['Бета', 'Альфа', 'Гамма'])
  })

  it('третий клик отдаёт (null, null) — сервер возвращает порядок по умолчанию', () => {
    const onSort = vi.fn()
    const [sort, setSort] = createSignal<string | undefined>('name')
    const [order, setOrder] = createSignal<'asc' | 'desc'>('asc')
    const host = mount(() => (
      <DumbTable rows={ROWS} columns={COLS} rowId={(r) => r.id}
                 sort={sort()} order={order()}
                 onSort={(k, o) => { onSort(k, o); setSort(k ?? undefined); if (o) setOrder(o) }} />
    ))
    const nameTh = () => host.querySelectorAll('th')[0] as HTMLElement

    nameTh().click()                       // asc → desc
    expect(onSort).toHaveBeenLastCalledWith('name', 'desc')
    nameTh().click()                       // desc → сброс
    expect(onSort).toHaveBeenLastCalledWith(null, null)
  })

  it('клик по другой колонке переключает сортировку на неё', () => {
    const onSort = vi.fn()
    const host = mount(() => (
      <DumbTable rows={ROWS} columns={COLS} rowId={(r) => r.id} sort="name" order="asc"
                 onSort={onSort} sortDescFirst={false} />
    ))
    ;(host.querySelectorAll('th')[1] as HTMLElement).click()
    expect(onSort).toHaveBeenCalledWith('price', 'asc')
  })

  it('внешнее состояние сортировки отражается стрелкой', () => {
    const host = mount(() => (
      <DumbTable rows={ROWS} columns={COLS} sort="price" order="desc" onSort={() => {}} />
    ))
    expect(host.querySelectorAll('th')[1].textContent).toContain('▼')
  })
})

describe('DumbTable — перетаскивание строк', () => {
  it('без onReorder ручек нет', () => {
    const host = mount(() => <DumbTable rows={ROWS} columns={COLS} rowId={(r) => r.id} />)
    expect(host.querySelectorAll('[data-drag-handle]').length).toBe(0)
  })

  it('с onReorder ручка есть у каждой строки', () => {
    const host = mount(() => (
      <DumbTable rows={ROWS} columns={COLS} rowId={(r) => r.id} onReorder={() => {}} />
    ))
    expect(host.querySelectorAll('[data-drag-handle]').length).toBe(3)
  })

  it('пока активна сортировка, ручка выключена', () => {
    const [sort, setSort] = createSignal<string | undefined>(undefined)
    const host = mount(() => (
      <DumbTable rows={ROWS} columns={COLS} rowId={(r) => r.id} onReorder={() => {}}
                 sort={sort()} order="asc" onSort={(k) => setSort(k)} />
    ))
    const handle = () => host.querySelector('[data-drag-handle]') as HTMLElement
    expect(handle().style.cursor).toBe('grab')

    // th[0] — колонка ручки, заголовки колонок сдвинуты на единицу
    ;(host.querySelectorAll('th')[1] as HTMLElement).click()   // включили сортировку
    expect(handle().style.cursor).toBe('not-allowed')
  })
})

describe('DumbPagination', () => {
  it('схлопывает длинные диапазоны в «…»', () => {
    expect(buildPageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5])
    const long = buildPageNumbers(20, 42)
    expect(long[0]).toBe(1)
    expect(long[long.length - 1]).toBe(42)
    expect(long).toContain('…')
    expect(long).toContain(20)
  })

  it('листает и не уходит за границы', () => {
    const [page, setPage] = createSignal(1)
    const host = mount(() => (
      <DumbPagination page={page()} total={100} pageSize={10} onPageChange={setPage} />
    ))
    const prev = host.querySelector('button') as HTMLButtonElement
    expect(prev.disabled).toBe(true)      // на первой странице «назад» выключен

    const btn3 = Array.from(host.querySelectorAll('button')).find((b) => b.textContent === '3')!
    btn3.click()
    expect(page()).toBe(3)
  })
})
