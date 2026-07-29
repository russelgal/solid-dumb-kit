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
  note?: string
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

// Перемешивание — дискретное изменение, то есть случай для View Transitions:
// браузер снимет «до», применит новое состояние и сам анимирует переезд строк.
// Драг так делать нельзя (снимок всей страницы на каждый кадр), а это — можно.
const withViewTransition = (fn: () => void) => {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  if (typeof doc.startViewTransition === 'function') doc.startViewTransition(fn)
  else fn()
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

  // Пагинация снаружи → и сортировка снаружи. Иначе таблица отсортировала бы
  // только те строки, что мы ей дали, то есть одну видимую страницу.
  const [sort, setSort] = createSignal<string | null>(null)
  const [order, setOrder] = createSignal<'asc' | 'desc' | null>(null)

  const sorted = createMemo(() => {
    const key = sort()
    const dir = order() === 'desc' ? -1 : 1
    if (!key || !order()) return rows()
    return [...rows()].sort((a, b) => {
      const x = a[key as keyof Product], y = b[key as keyof Product]
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir
      return String(x ?? '').localeCompare(String(y ?? ''), 'ru') * dir
    })
  })

  const pageRows = createMemo(() => {
    const from = (page() - 1) * pageSize()
    return sorted().slice(from, from + pageSize())
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

  // правка ячейки: обновляем строку в общем массиве
  const patch = (id: string, fields: Partial<Product>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...fields } : r)))

  const toggleCart = (p: Product) =>
    setCart((prev) => {
      const next = new Set(prev)
      next.has(p.id) ? next.delete(p.id) : next.add(p.id)
      return next
    })

  const columns: DumbColumn<Product>[] = [
    { key: 'vendor_code', label: 'Артикул', sortable: true, width: '130px',
      render: (p) => <code class="sku">{p.vendor_code}</code> },
    { key: 'name', label: 'Название', sortable: true,
      render: (p) => <span class="name">{p.name}</span> },
    { key: 'brand', label: 'Бренд', sortable: true, width: '140px' },
    { key: 'price', label: 'Цена', sortable: true, align: 'right', width: '120px',
      render: (p) => fmtPrice(p.price) },
    // редактируемая ячейка: драг за строку с неё не начнётся — движок
    // не перехватывает поля, кнопки и ссылки
    { key: 'stock', label: 'Остаток', sortable: true, align: 'right', width: '110px', stopClick: true,
      render: (p) => (
        <input
          class="cell-input num"
          classList={{ out: p.stock === 0, low: p.stock > 0 && p.stock < 30 }}
          type="number"
          min="0"
          value={p.stock}
          onInput={(e) => patch(p.id, { stock: Math.max(0, Number(e.currentTarget.value) || 0) })}
        />
      ) },
    { key: 'note', label: 'Заметка', width: '180px', stopClick: true,
      render: (p) => (
        <input
          class="cell-input"
          placeholder="—"
          value={p.note ?? ''}
          onInput={(e) => patch(p.id, { note: e.currentTarget.value })}
        />
      ) },
    // stopClick: клик по кнопке не должен всплывать в onRowClick
    { key: 'buy', label: '', align: 'right', width: '110px', stopClick: true,
      render: (p) => (
        <button class="btn btn-buy" classList={{ on: cart().has(p.id) }} onClick={() => toggleCart(p)}>
          {cart().has(p.id) ? '✓ в заказе' : 'заказать'}
        </button>
      ) },
  ]

  return (
    <div class="dt-example">
      <p class="intro">
        137 строк, колонки описаны обычными объектами. Клик по заголовку сортирует (под капотом
        TanStack), третий клик сбрасывает сортировку. Протяжка за <b>⠿</b> переставляет строку —
        ручка гаснет, пока активна сортировка, потому что показанный порядок уже не совпадает
        с порядком данных. Протяжка по самим строкам рисует рамку выделения: это{' '}
        <code>SelectionArea</code> поверх таблицы, строки она опознаёт по <code>data-key</code>,
        который таблица проставляет сама. Колонка «заказать» помечена <code>stopClick</code>,
        поэтому её кнопка не срабатывает как клик по строке. «Остаток» и «Заметка» —
        обычные <code>input</code>: печатать в них можно спокойно, драг с полей не стартует.
      </p>

      <div class="toolbar">
        <span>{picked() ? <>row click → <b>{picked()!.name}</b> · {picked()!.vendor_code}</> : 'click a row →'}</span>
        <span class="count">выделено рамкой: <b>{selected().size}</b></span>
        <button
          class="btn"
          onClick={() => withViewTransition(() => {
            // при активной сортировке перемешивание было бы не видно — снимаем её
            setSort(null); setOrder(null)
            setRows(shuffle(rows()))
            setPage(1)
          })}
        >
          перемешать
        </button>
        <button class="btn" onClick={() => setSelected(new Set())} disabled={!selected().size}>
          сбросить
        </button>
        <button class="btn btn-danger" onClick={removeSelected} disabled={!selected().size}>
          удалить выделенное
        </button>
      </div>

      <SelectionArea class="surface" selectables="tbody tr" selected={selected} onChange={setSelected}>
        <DumbTable
          rows={pageRows()}
          columns={columns}
          rowId={(p) => p.id}
          sort={sort() ?? undefined}
          order={order() ?? undefined}
          onSort={(key, dir) => withViewTransition(() => {
            setSort(key); setOrder(dir); setPage(1)
          })}
          onRowClick={(p) => setPicked(p)}
          headClass="head"
          rowClass={(p) =>
            ['row', cart().has(p.id) ? 'in-cart' : '', selected().has(p.id) ? 'selected' : '']
              .filter(Boolean).join(' ')
          }
          // имя на строку — чтобы браузер вёл КАЖДУЮ отдельно, а не делал
          // кроссфейд всей таблицы
          rowStyle={(p) => ({ 'view-transition-name': `row-${p.id}` })}
          empty={<div class="empty">Ничего не найдено</div>}
          onReorder={(from, to) => {
            // индексы приходят в порядке ТЕКУЩЕЙ страницы — переводим в глобальные.
            // Сортировка при этом заведомо снята: ручка гаснет, пока она активна.
            const offset = (page() - 1) * pageSize()
            const next = rows().slice()
            next.splice(offset + to, 0, next.splice(offset + from, 1)[0])
            setRows(next)
          }}
        />
      </SelectionArea>

      <div class="pager">
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
        .dt-example { padding: 16px; max-width: 1040px; margin: 0 auto; color: #0f172a }
        .dt-example .intro { margin: 0 0 12px; font-size: 13px; color: #64748b; max-width: 72ch }

        .toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 10px;
                   font-size: 13px; min-height: 20px; flex-wrap: wrap }
        .toolbar .count { margin-left: auto }

        .btn { padding: 3px 9px; border-radius: 6px; border: 1px solid #cbd5e1;
               background: #fff; color: inherit; font: inherit; font-size: 12px; cursor: pointer }
        .btn:disabled { color: #94a3b8; cursor: default }
        .btn-danger:not(:disabled) { border-color: #dc2626; background: #dc2626; color: #fff }
        .btn-buy.on { border-color: #16a34a; background: #16a34a; color: #fff }

        .surface { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden }
        .pager { margin-top: 12px }
        .empty { padding: 24px; text-align: center; color: #94a3b8 }

        .head th { background: #f8fafc; color: #475569; font-size: 12px; text-transform: uppercase;
                   letter-spacing: .03em; border-bottom: 1px solid #e2e8f0 }
        .row { border-bottom: 1px solid #f1f5f9 }
        .row:hover { background: #f8fafc }
        .row.in-cart { background: #f0fdf4 }
        .row.selected { background: #eff6ff; box-shadow: inset 2px 0 0 #3b82f6 }

        .sku { font-size: 12px }
        .name { font-weight: 500 }
        .cell-input { width: 100%; padding: 3px 6px; border-radius: 6px; box-sizing: border-box;
                      border: 1px solid transparent; background: transparent;
                      font: inherit; font-size: 13px; color: inherit }
        .cell-input:hover { border-color: #e2e8f0 }
        .cell-input:focus { border-color: #3b82f6; background: #fff; outline: none }
        .cell-input.num { text-align: right; font-variant-numeric: tabular-nums; color: #16a34a }
        .cell-input.low { color: #d97706 }
        .cell-input.out { color: #dc2626 }
      `}</style>
    </div>
  )
}
