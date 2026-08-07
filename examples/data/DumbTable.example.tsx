// DumbTable — bring-your-own-columns table on @tanstack/solid-table:
// click a header to sort, drag rows by the ⠿ handle, paginate.
import { createSignal, createMemo } from 'solid-js'
import { SelectionArea } from '@solid-dumb-kit/selection'
import { DumbTable, DumbPagination, type DumbColumn } from '@solid-dumb-kit/table'
import { fmtPrice, fmtNum } from '@solid-dumb-kit/utils'
import { Code, Doc, Props } from '../_controls'
// Сниппеты доки живут отдельным файлом: их подсвечивает Shiki на сборке, и
// сюда приезжает уже готовая разметка (playground/snippets.ts).
import SNIP from './DumbTable.snippets'

const TABLE_PROPS = [
  { name: 'rows', type: 'T[]', about: 'Строки. Таблица их не режет и не пагинирует — что дали, то и покажет.' },
  { name: 'columns', type: 'DumbColumn<T>[]', about: 'Описание колонок.' },
  { name: 'rowId', type: '(row, index) => string', def: 'индекс', about: 'Стабильный ключ строки — нужен перетаскиванию.' },
  { name: 'sort / order', type: "string / 'asc' | 'desc'", about: 'Активная сортировка. Вместе с onSort включает СЕРВЕРНЫЙ режим.' },
  {
    name: 'onSort',
    type: '(key, order) => void',
    about: 'Есть — сортирует сервер; нет — таблица сама. Третий клик сбрасывает и присылает (null, null).',
  },
  { name: 'noSortRemoval', type: 'boolean', def: 'false', about: 'Убрать третий клик-сброс: только asc ⇄ desc.' },
  {
    name: 'sortDescFirst',
    type: 'boolean',
    def: 'как у TanStack',
    about: 'Направление первого клика. По умолчанию текстовые колонки начинают с asc, числовые с desc.',
  },
  { name: 'onReorder', type: '(from, to) => void', about: 'Включает драг строк. Индексы — в текущем показанном порядке.' },
  {
    name: 'handle',
    type: 'JSX.Element | false',
    about: 'Содержимое ручки. false — ручки нет, строка тянется целиком; тогда задайте dragThreshold.',
  },
  { name: 'dragThreshold', type: 'number', def: '0', about: 'Сколько px пройти мышью до старта драга.' },
  { name: 'onRowClick', type: '(row, index) => void', about: 'Клик по строке. Колонки со stopClick его не пускают.' },
  { name: 'loading / empty', type: 'boolean / JSX.Element', about: 'Приглушить на время загрузки; что показать вместо пустой таблицы.' },
  {
    name: 'viewTransition',
    type: 'boolean',
    def: 'false',
    about: 'Анимировать смену сортировки. Имеет смысл в клиентском режиме; строкам нужен уникальный view-transition-name.',
  },
  { name: 'animate', type: 'boolean', def: 'системная настройка', about: 'Анимация драга строк; не при prefers-reduced-motion.' },
  { name: 'rowClass / rowStyle', type: '(row, index) => …', about: 'Класс и стиль на строку — например уникальный view-transition-name.' },
]

const COLUMN_PROPS = [
  { name: 'key', type: 'string', about: 'Ключ колонки: id для сортировки и путь к значению по умолчанию.' },
  { name: 'label', type: 'JSX.Element', about: 'Содержимое <th>.' },
  { name: 'sortable', type: 'boolean', def: 'false', about: 'Разрешить сортировку по колонке.' },
  { name: 'render', type: '(row, index) => JSX.Element', about: 'Содержимое <td>; по умолчанию — значение по key.' },
  { name: 'value', type: '(row) => unknown', about: 'Значение для сортировки, когда оно считается, а не лежит в поле.' },
  { name: 'align / width', type: "'left' | 'center' | 'right' / string", about: 'Выравнивание и ширина колонки.' },
  { name: 'class / headClass', type: 'string', about: 'Класс на <th> и <td> либо только на <th>.' },
  { name: 'stopClick', type: 'boolean', def: 'false', about: 'Не пускать клик по ячейке в onRowClick — для кнопок и полей внутри.' },
]

const PAGINATION_PROPS = [
  { name: 'page / total / pageSize', type: 'number', about: 'Текущая страница, всего строк, размер страницы.' },
  { name: 'onPageChange', type: '(page: number) => void', about: 'Переключили страницу.' },
  { name: 'pageSizes / onPageSizeChange', type: 'number[] / (size) => void', about: 'Переключатель размера страницы.' },
  { name: 'summary', type: '({ page, pages, total }) => string', about: 'Подпись слева; по умолчанию «total · page/pages».' },
]

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

// 1000 строк: пагинация режет их до страницы, поэтому в DOM всё равно 20
const DATA: Product[] = Array.from({ length: 1000 }, (_, i) => ({
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
      render: (p) => <code class="text-xs">{p.vendor_code}</code> },
    { key: 'name', label: 'Название', sortable: true,
      render: (p) => <span class="font-medium">{p.name}</span> },
    { key: 'brand', label: 'Бренд', sortable: true, width: '140px' },
    { key: 'price', label: 'Цена', sortable: true, align: 'right', width: '120px',
      render: (p) => fmtPrice(p.price) },
    // редактируемая ячейка: драг за строку с неё не начнётся — движок
    // не перехватывает поля, кнопки и ссылки
    { key: 'stock', label: 'Остаток', sortable: true, align: 'right', width: '110px', stopClick: true,
      render: (p) => (
        <input
          class="w-full box-border rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-right text-[13px] tabular-nums hover:border-base-300 focus:border-primary focus:bg-base-100 focus:outline-none"
          classList={{
            'text-error': p.stock === 0,
            'text-warning': p.stock > 0 && p.stock < 30,
            'text-success': p.stock >= 30,
          }}
          type="number"
          min="0"
          value={p.stock}
          onInput={(e) => patch(p.id, { stock: Math.max(0, Number(e.currentTarget.value) || 0) })}
        />
      ) },
    { key: 'note', label: 'Заметка', width: '180px', stopClick: true,
      render: (p) => (
        <input
          class="w-full box-border rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-[13px] hover:border-base-300 focus:border-primary focus:bg-base-100 focus:outline-none"
          placeholder="—"
          value={p.note ?? ''}
          onInput={(e) => patch(p.id, { note: e.currentTarget.value })}
        />
      ) },
    // stopClick: клик по кнопке не должен всплывать в onRowClick
    { key: 'buy', label: '', align: 'right', width: '110px', stopClick: true,
      render: (p) => (
        <button class="btn btn-xs" classList={{ 'btn-success': cart().has(p.id) }} onClick={() => toggleCart(p)}>
          {cart().has(p.id) ? '✓ в заказе' : 'заказать'}
        </button>
      ) },
  ]

  return (
    <div class="p-5 text-base-content">
      <p class="mb-3 text-[13px] text-base-content">
        1000 строк, колонки описаны обычными объектами. Клик по заголовку сортирует (под капотом
        TanStack), третий клик сбрасывает сортировку. Протяжка за <b>⠿</b> переставляет строку —
        ручка гаснет, пока активна сортировка, потому что показанный порядок уже не совпадает
        с порядком данных. Протяжка по самим строкам рисует рамку выделения: это{' '}
        <code>SelectionArea</code> поверх таблицы, строки она опознаёт по <code>data-key</code>,
        который таблица проставляет сама. Колонка «заказать» помечена <code>stopClick</code>,
        поэтому её кнопка не срабатывает как клик по строке. «Остаток» и «Заметка» —
        обычные <code>input</code>: печатать в них можно спокойно, драг с полей не стартует.
      </p>

      <div class="mb-2.5 flex min-h-5 flex-wrap items-center gap-3 text-[13px]">
        <span>{picked() ? <>row click → <b>{picked()!.name}</b> · {picked()!.vendor_code}</> : 'click a row →'}</span>
        <span class="ml-auto">выделено рамкой: <b>{selected().size}</b></span>
        <button
          class="btn btn-xs"
          onClick={() => withViewTransition(() => {
            // при активной сортировке перемешивание было бы не видно — снимаем её
            setSort(null); setOrder(null)
            setRows(shuffle(rows()))
            setPage(1)
          })}
        >
          перемешать
        </button>
        <button class="btn btn-xs" onClick={() => setSelected(new Set())} disabled={!selected().size}>
          сбросить
        </button>
        <button class="btn btn-xs btn-error" onClick={removeSelected} disabled={!selected().size}>
          удалить выделенное
        </button>
      </div>

      <SelectionArea class="overflow-hidden rounded-xl border border-base-300" selectables="tbody tr" selected={selected} onChange={setSelected}>
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
          headClass="[&_th]:border-b [&_th]:border-base-300 [&_th]:bg-base-200 [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-base-content"
          rowClass={(p) =>
            [
              'border-b border-base-200 hover:bg-base-200',
              cart().has(p.id) ? 'bg-success/15' : '',
              selected().has(p.id) ? 'bg-primary/15 shadow-[inset_2px_0_0_var(--color-primary)]' : '',
            ]
              .filter(Boolean).join(' ')
          }
          // имя на строку — чтобы браузер вёл КАЖДУЮ отдельно, а не делал
          // кроссфейд всей таблицы
          rowStyle={(p) => ({ 'view-transition-name': `row-${p.id}` })}
          empty={<div class="p-6 text-center text-base-content">Ничего не найдено</div>}
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

      <div class="mt-3">
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


      <hr class="my-6 border-base-300" />

      <h4 class="text-lg font-semibold">Как это подключить</h4>
      <p class="mt-1 max-w-[92ch] text-sm">
        Пакет ставится отдельно от остального кита — потребитель берёт только то, что взял.
      </p>
      <Code title="Установка" code={SNIP.install} />

      <Doc title="Колонки">
        <p>
          Колонка — это ключ, заголовок и, если нужно, своя отрисовка ячейки. Модель строк и
          сортировку держит TanStack Table: своего мы не пишем принципиально — это ровно та задача,
          где чужая проверенная библиотека лучше собственной.
        </p>
      </Doc>
      <Code title="Таблица" code={SNIP.basic} />

      <Doc title="Кто сортирует">
        <p>
          Наличие <code>onSort</code> и есть переключатель режима: нет — таблица сортирует сама,
          есть — она только рисует стрелку, а данные приходят от вас. Третий клик по заголовку
          сбрасывает сортировку и присылает <code>(null, null)</code>.
        </p>
      </Doc>
      <Code title="Клиент и сервер" code={SNIP.sort} />

      <Doc title="Перетаскивание строк">
        <p>
          Индексы приходят в ТЕКУЩЕМ показанном порядке, поэтому при пагинации к ним прибавляется
          смещение страницы. Пока активна сортировка, драг выключается сам: <code>from → to</code>{' '}
          описывают показанный порядок, а он при сортировке не совпадает с порядком данных.
        </p>
      </Doc>
      <Code title="Ручка и порядок" code={SNIP.drag} />

      <Doc title="Пагинация — отдельно">
        <p>
          Таблица не режет строки: это решение потребителя — страница, бесконечная прокрутка или
          вообще всё сразу. <code>DumbPagination</code> лишь рисует пагинатор и говорит, куда
          переключились.
        </p>
      </Doc>
      <Code title="Страницы" code={SNIP.pagination} />

      <Doc title="Грабли TanStack">
        <p>
          Самая частая: колонке нужен доступ к значению. Без него TanStack считает её
          display-колонкой, <code>getCanSort()</code> всегда <code>false</code>, и сортировка молча
          выключается — даже с <code>sortable: true</code>.
        </p>
      </Doc>
      <Code title="Что ломается чаще всего" code={SNIP.gotcha} />

      <h4 class="mt-6 text-lg font-semibold">DumbTable</h4>
      <Props rows={TABLE_PROPS} />

      <h4 class="mt-6 text-lg font-semibold">DumbColumn</h4>
      <Props rows={COLUMN_PROPS} />

      <h4 class="mt-6 text-lg font-semibold">DumbPagination</h4>
      <Props rows={PAGINATION_PROPS} />

    </div>
  )
}
