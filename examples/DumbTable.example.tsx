// DumbTable — bring-your-own-columns table on @tanstack/solid-table:
// click a header to sort, drag rows by the ⠿ handle, paginate.
import { createSignal, createMemo } from 'solid-js'
import { DumbTable, DumbPagination, SelectionArea, fmtPrice, fmtNum, type DumbColumn } from 'solid-dumb-kit'

type Product = {
  id: string
  vendor_code: string
  name: string
  brand: string
  price: number
  stock: number
}


// перемешивание Фишера–Йетса: копия, не мутируем исходный массив
function shuffle<T>(list: Array<T>): Array<T> {
  const out = list.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const BRANDS = ['Attache', 'Erich Krause', 'Berlingo', 'Comix', 'Deli']
const NAMES = ['Ручка шариковая', 'Карандаш', 'Тетрадь 48л', 'Папка-регистратор', 'Степлер', 'Клей-карандаш']

const DATA: Product[] = Array.from({ length: 137 }, (_, i) => ({
  id: `p${i}`,
  vendor_code: `ART-${String(1000 + i * 7).padStart(5, '0')}`,
  name: `${NAMES[i % NAMES.length]} №${i + 1}`,
  brand: BRANDS[i % BRANDS.length],
  price: Math.round((12 + ((i * 37) % 900)) * 100) / 100,
  stock: (i * 13) % 240,
}))

export default function DumbTableExample() {
  const [rows, setRows] = createSignal<Product[]>(DATA)
  const [page, setPage] = createSignal(1)
  const [pageSize, setPageSize] = createSignal(20)
  const [picked, setPicked] = createSignal<Product | null>(null)
  const [cart, setCart] = createSignal<Set<string>>(new Set())
  // выделение строк рамкой: таблица проставляет строкам data-key, так что
  // SelectionArea опознаёт их сама
  const [selected, setSelected] = createSignal<Set<string>>(new Set())

  // пагинация снаружи таблицы: режем строки сами, таблица рисует что дали
  const pageRows = createMemo(() => {
    const from = (page() - 1) * pageSize()
    return rows().slice(from, from + pageSize())
  })

  // удалить выделенное: чистим и выделение, и заказ, и не оставляем пустую страницу
  const removeSelected = () => {
    const kill = selected()
    if (!kill.size) return
    const next = rows().filter((r) => !kill.has(r.id))
    setRows(next)
    setSelected(new Set())
    setCart((prev) => new Set([...prev].filter((id) => !kill.has(id))))
    if (picked() && kill.has(picked()!.id)) setPicked(null)
    const pages = Math.max(1, Math.ceil(next.length / pageSize()))
    if (page() > pages) setPage(pages)
  }

  const toggleCart = (p: Product) =>
    setCart((prev) => {
      const next = new Set(prev)
      next.has(p.id) ? next.delete(p.id) : next.add(p.id)
      return next
    })

  const columns: DumbColumn<Product>[] = [
    { key: 'vendor_code', label: 'Артикул', sortable: true, width: '130px',
      render: (p) => <code style={{ 'font-size': '12px' }}>{p.vendor_code}</code> },
    { key: 'name', label: 'Название', sortable: true,
      render: (p) => <span style={{ 'font-weight': '500' }}>{p.name}</span> },
    { key: 'brand', label: 'Бренд', sortable: true, width: '140px' },
    { key: 'price', label: 'Цена', sortable: true, align: 'right', width: '120px',
      render: (p) => fmtPrice(p.price) },
    { key: 'stock', label: 'Остаток', sortable: true, align: 'right', width: '100px',
      render: (p) => (
        <span style={{ color: p.stock === 0 ? '#dc2626' : p.stock < 30 ? '#d97706' : '#16a34a' }}>
          {fmtNum(p.stock)}
        </span>
      ) },
    // stopClick: клик по кнопке не должен всплывать в onRowClick
    { key: 'buy', label: '', align: 'right', width: '110px', stopClick: true,
      render: (p) => (
        <button
          onClick={() => toggleCart(p)}
          style={{ padding: '3px 10px', 'border-radius': '6px', cursor: 'pointer', font: 'inherit',
                   'font-size': '12px',
                   border: '1px solid ' + (cart().has(p.id) ? '#16a34a' : '#cbd5e1'),
                   background: cart().has(p.id) ? '#16a34a' : '#fff',
                   color: cart().has(p.id) ? '#fff' : '#0f172a' }}
        >
          {cart().has(p.id) ? '✓ в заказе' : 'заказать'}
        </button>
      ) },
  ]

  return (
    <div style={{ padding: '16px', 'max-width': '1040px', margin: '0 auto', color: '#0f172a' }}>
      <p style={{ margin: '0 0 12px', 'font-size': '13px', color: '#64748b', 'max-width': '72ch' }}>
        137 строк, колонки описаны обычными объектами. Клик по заголовку сортирует (под капотом
        TanStack), третий клик сбрасывает сортировку. Протяжка за <b>⠿</b> переставляет строку —
        ручка гаснет, пока активна сортировка, потому что показанный порядок уже не совпадает
        с порядком данных. Протяжка по самим строкам рисует рамку выделения: это{' '}
        <code>SelectionArea</code> поверх таблицы, строки она опознаёт по <code>data-key</code>,
        который таблица проставляет сама. Колонка «заказать» помечена <code>stopClick</code>,
        поэтому её кнопка не срабатывает как клик по строке.
      </p>

      <div style={{ display: 'flex', 'align-items': 'center', gap: '12px', 'margin-bottom': '10px',
                    'font-size': '13px', 'min-height': '20px', 'flex-wrap': 'wrap' }}>
        <span>{picked() ? <>row click → <b>{picked()!.name}</b> · {picked()!.vendor_code}</> : 'click a row →'}</span>
        <span style={{ 'margin-left': 'auto' }}>
          выделено рамкой: <b>{selected().size}</b>
        </span>
        <button
          onClick={() => { setRows(shuffle(rows())); setPage(1) }}
          style={{ padding: '3px 9px', 'border-radius': '6px', border: '1px solid #cbd5e1',
                   background: '#fff', cursor: 'pointer', font: 'inherit', 'font-size': '12px' }}
        >
          перемешать
        </button>
        <button
          onClick={() => setSelected(new Set())}
          disabled={!selected().size}
          style={{ padding: '3px 9px', 'border-radius': '6px', border: '1px solid #cbd5e1',
                   background: '#fff', cursor: 'pointer', font: 'inherit', 'font-size': '12px' }}
        >
          сбросить
        </button>
        <button
          onClick={removeSelected}
          disabled={!selected().size}
          style={{ padding: '3px 9px', 'border-radius': '6px', cursor: 'pointer', font: 'inherit',
                   'font-size': '12px',
                   border: '1px solid ' + (selected().size ? '#dc2626' : '#cbd5e1'),
                   background: selected().size ? '#dc2626' : '#fff',
                   color: selected().size ? '#fff' : '#94a3b8' }}
        >
          удалить выделенное
        </button>
      </div>

      <SelectionArea
        selectables="tbody tr"
        selected={selected}
        onChange={setSelected}
        style={{ border: '1px solid #e2e8f0', 'border-radius': '12px', overflow: 'hidden' }}
      >
        <DumbTable
          rows={pageRows()}
          columns={columns}
          rowId={(p) => p.id}
          onRowClick={(p) => setPicked(p)}
          headClass="dt-head"
          rowClass={(p) =>
            [
              'dt-row',
              cart().has(p.id) ? 'dt-row-picked' : '',
              selected().has(p.id) ? 'dt-row-selected' : '',
            ].filter(Boolean).join(' ')
          }
          empty={<div style={{ padding: '24px', 'text-align': 'center', color: '#94a3b8' }}>Ничего не найдено</div>}
          onReorder={(from, to) => {
            // индексы приходят в порядке ТЕКУЩЕЙ страницы — переводим в глобальные
            const offset = (page() - 1) * pageSize()
            const next = rows().slice()
            next.splice(offset + to, 0, next.splice(offset + from, 1)[0])
            setRows(next)
          }}
        />
      </SelectionArea>

      <div style={{ 'margin-top': '12px' }}>
        <DumbPagination
          page={page()}
          total={rows().length}
          pageSize={pageSize()}
          pageSizes={[10, 20, 50]}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
          summary={({ page, pages, total }) => `${total} товаров · страница ${page} из ${pages}`}
        />
      </div>

      <style>{`
        .dt-head th{background:#f8fafc;color:#475569;font-size:12px;text-transform:uppercase;letter-spacing:.03em;
                    border-bottom:1px solid #e2e8f0}
        .dt-row{border-bottom:1px solid #f1f5f9}
        .dt-row:hover{background:#f8fafc}
        .dt-row-picked{background:#f0fdf4}
        .dt-row-selected{background:#eff6ff;box-shadow:inset 2px 0 0 #3b82f6}
      `}</style>
    </div>
  )
}
