// DumbTable — bring-your-own-columns table on @tanstack/solid-table:
// click a header to sort, drag rows by the ⠿ handle, paginate.
import { createSignal, createMemo } from 'solid-js'
import { DumbTable, DumbPagination, fmtPrice, fmtNum, type DumbColumn } from 'solid-dumb-kit'

type Product = {
  id: string
  vendor_code: string
  name: string
  brand: string
  price: number
  stock: number
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

  // пагинация снаружи таблицы: режем строки сами, таблица рисует что дали
  const pageRows = createMemo(() => {
    const from = (page() - 1) * pageSize()
    return rows().slice(from, from + pageSize())
  })

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
        137 rows, columns described as plain objects. Click a header to sort (that's TanStack under
        the hood), drag the ⠿ handle to reorder — the handle greys out while a sort is active,
        because the displayed order no longer matches the data order. The “заказать” column sets
        <code> stopClick</code>, so its button doesn't fire the row click.
      </p>

      <div style={{ 'margin-bottom': '10px', 'font-size': '13px', 'min-height': '20px' }}>
        {picked() ? <>row click → <b>{picked()!.name}</b> · {picked()!.vendor_code}</> : 'click a row →'}
      </div>

      <div style={{ border: '1px solid #e2e8f0', 'border-radius': '12px', overflow: 'hidden' }}>
        <DumbTable
          rows={pageRows()}
          columns={columns}
          rowId={(p) => p.id}
          onRowClick={(p) => setPicked(p)}
          headClass="dt-head"
          rowClass={(p) => (cart().has(p.id) ? 'dt-row dt-row-picked' : 'dt-row')}
          empty={<div style={{ padding: '24px', 'text-align': 'center', color: '#94a3b8' }}>Ничего не найдено</div>}
          onReorder={(from, to) => {
            // индексы приходят в порядке ТЕКУЩЕЙ страницы — переводим в глобальные
            const offset = (page() - 1) * pageSize()
            const next = rows().slice()
            next.splice(offset + to, 0, next.splice(offset + from, 1)[0])
            setRows(next)
          }}
        />
      </div>

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
      `}</style>
    </div>
  )
}
