// Порядок строк: кто и в каком порядке виден после сортировки и фильтра.
//
// Виртуализатор рядом (`virtual.ts`) решает, КАКИЕ индексы рисовать; этот файл
// решает, ЧТО лежит под индексом. На тысяче строк вопрос не стоит — сортируй
// массив как угодно. На миллионе `array.sort` занимает главный поток на
// секунды, и всё это время страница не отвечает: не прокручивается, не
// перерисовывается, не реагирует на клики.
//
// Поэтому:
//
// - результат — `Uint32Array` НОМЕРОВ строк, а не переставленные данные. Сами
//   данные никто не двигает: 4 байта на строку против копирования объектов;
// - работа идёт в воркере, а данные туда уезжают один раз;
// - работа ПРЕРЫВАЕМА. Сортировка — своя, снизу вверх (bottom-up merge), с
//   сохранением состояния между порциями: встроенный `sort` остановить нельзя,
//   а пока он идёт, воркер не читает входящие сообщения и не может отменить
//   устаревший запрос. Набор в поле фильтра шлёт запрос на каждую букву —
//   без отмены к последней букве в очереди стоит десяток мёртвых сортировок.
//
// Почему не SharedArrayBuffer, как у fast-grid: он требует заголовков
// COOP/COEP на КАЖДОМ ответе сервера, иначе `crossOriginIsolated` ложно и
// конструктор бросает. Статикам вроде GitHub Pages их взять неоткуда, и
// примитив просто не завёлся бы. Обычный structured clone стоит одного
// копирования на загрузку данных, а результат едет обратно `transfer`ом, то
// есть без копии вовсе.
//
// Файл не зависит ни от Solid, ни от DOM: ни одного обращения к элементам.

/** Куда сортировать. */
export type SortDir = 'asc' | 'desc'

/**
 * Колонка данных. Числа лежат типизированным массивом (8 байт на строку,
 * клонируются в воркер за миллисекунды), текст — обычным массивом строк.
 */
export type RowColumn =
  | { kind: 'number'; values: Float64Array | number[] }
  | { kind: 'text'; values: string[] }

/** Что показывать и в каком порядке. Пустой запрос — исходный порядок. */
export type RowQuery = {
  sort?: { column: string; dir?: SortDir }
  filter?: {
    column: string
    /** подстрока; для числовой колонки ищется по её записи цифрами */
    contains?: string
    /** границы для числовой колонки, включительно */
    min?: number
    max?: number
  }
}

export type RowIndexResult = {
  /**
   * Номера строк в порядке показа. В режиме общей памяти это ОКНО в неё, а не
   * копия: держать его дольше следующего ответа нельзя — перезапишут.
   */
  order: Uint32Array
  /** сколько строк прошло фильтр */
  matched: number
  /** сколько всего строк было */
  total: number
  /** сколько это считалось, мс */
  ms: number
  /** запрос, к которому относится ответ */
  query: RowQuery
  /**
   * Работа ещё идёт, это промежуточный улов фильтра. Бывает только в режиме
   * общей памяти — ровно ради этого он и нужен: строки видно, пока фильтр
   * досматривает остальной миллион.
   */
  partial: boolean
}

export type RowIndexProgress = {
  phase: 'filter' | 'sort'
  /** доля выполненного, 0…1 */
  done: number
  /** сколько строк отобрано на этот момент */
  matched: number
}

export type RowIndexOptions = {
  /** готовый порядок */
  onResult: (result: RowIndexResult) => void
  /** долгая работа: сколько уже сделано. Зовётся не чаще ~15 раз в секунду */
  onProgress?: (progress: RowIndexProgress) => void
  /**
   * Сколько элементов обрабатывать за один заход, прежде чем уступить очереди
   * сообщений. Меньше — отзывчивее отмена, больше — меньше накладных расходов.
   */
  chunk?: number
  /**
   * Считать на главном потоке даже там, где воркер доступен. Нужно ровно для
   * двух вещей: тестов и наглядного «а вот так оно колом встаёт».
   */
  inline?: boolean
  /**
   * Общая память (`SharedArrayBuffer`) вместо пересылки копий. По умолчанию —
   * когда страница изолирована (`crossOriginIsolated`). Включать вручную имеет
   * смысл только для проверки: без изоляции конструктор бросит.
   */
  shared?: boolean
}

export type RowIndex = {
  /** загрузить данные; в воркер они уезжают копией — зовётся редко */
  setData: (data: { count: number; columns: Record<string, RowColumn> }) => void
  /** посчитать порядок; предыдущий незаконченный запрос отменяется */
  query: (q: RowQuery) => void
  /**
   * Бросить текущий расчёт и не ждать ответа. Нужно, когда запрос стал пустым:
   * гонять миллион строк ради порядка «как в данных» незачем, но и получить
   * потом ответ на позавчерашний запрос нельзя.
   */
  cancel: () => void
  /** считает ли отдельный поток (false — воркер не завёлся, работаем инлайном) */
  readonly threaded: boolean
  /** идёт ли обмен через общую память (иначе — копиями) */
  readonly shared: boolean
  destroy: () => void
}

/** Связь с ядром: одинаковая и для воркера, и для расчёта на главном потоке. */
type Channel = {
  send: (msg: unknown, transfer?: Transferable[]) => void
  onMessage: (cb: (msg: any) => void) => void
  close: () => void
  /** отдельный поток или тот же самый */
  worker: boolean
}

type KernelPort = {
  post: (msg: unknown, transfer?: Transferable[]) => void
  receive: (cb: (msg: any) => void) => void
}

/**
 * ЯДРО. Считает порядок строк порциями, между порциями уступая очереди
 * сообщений, — так отмена успевает сработать.
 *
 * Функция обязана быть САМОДОСТАТОЧНОЙ: её собственный исходник (`toString()`)
 * уезжает в воркер. Ни одной ссылки наружу — ни на импорт, ни на константу
 * модуля, ни на другую функцию файла, иначе в воркере будет `ReferenceError`.
 * По той же причине здесь нарочито простой JS: пусть сборщик минифицирует
 * имена, но не подставляет свои хелперы.
 */
function rowIndexKernel(port: KernelPort): void {
  var count = 0
  var cols: any = {}
  /** отменённая задача узнаёт об этом по своему же флагу */
  var live: any = null
  /**
   * Общая память, когда страница изолирована (COOP/COEP). Порядок пишется
   * прямо сюда, и главный поток читает его БЕЗ пересылки: строки, прошедшие
   * фильтр, видно, пока фильтр ещё идёт.
   *
   * `ctrl`: [0] — версия (её растим, чтобы читатель понял, что данные новые),
   * [1] — сколько строк уже отобрано, [2] — фаза (0 фильтр, 1 сортировка,
   * 2 готово), [3] — номер запроса.
   */
  var shOrder: any = null
  var shCtrl: any = null

  // Уступить очереди сообщений. `setTimeout` в цикле упирается в клампинг
  // (4мс после пятого вложенного вызова) — на миллионе строк это лишние
  // секунды, поэтому канал.
  var chan = typeof MessageChannel === 'function' ? new MessageChannel() : null
  var queued: any = null
  if (chan) {
    chan.port1.onmessage = function () {
      var fn = queued
      queued = null
      if (fn) fn()
    }
  }
  function soon(fn: any) {
    if (chan) {
      queued = fn
      chan.port2.postMessage(0)
      return
    }
    setTimeout(fn, 0)
  }

  function now() {
    return typeof performance === 'object' && performance ? performance.now() : Date.now()
  }

  function valuesOf(name: string) {
    var c = name ? cols[name] : null
    return c ? c.values : null
  }

  /** Сравнение ДВУХ НОМЕРОВ строк по колонке; равные держат исходный порядок. */
  function comparer(sort: any) {
    var vals = valuesOf(sort.column)
    if (!vals) return null
    var sign = sort.dir === 'desc' ? -1 : 1
    return function (a: number, b: number) {
      var x = vals[a]
      var y = vals[b]
      if (x < y) return -sign
      if (x > y) return sign
      return a - b
    }
  }

  function matcher(filter: any) {
    var col = filter.column ? cols[filter.column] : null
    if (!col) return null
    var vals = col.values
    var text = col.kind === 'text'
    var needle = filter.contains == null ? '' : String(filter.contains).toLowerCase()
    var min = filter.min
    var max = filter.max
    if (!needle && min == null && max == null) return null
    return function (i: number) {
      var v = vals[i]
      if (min != null && !(v >= min)) return false
      if (max != null && !(v <= max)) return false
      if (!needle) return true
      var s = text ? v : '' + v
      return s.toLowerCase().indexOf(needle) !== -1
    }
  }

  function merge(src: any, dst: any, lo: number, mid: number, hi: number, cmp: any) {
    var a = lo
    var b = mid
    var k = lo
    while (a < mid && b < hi) {
      var x = src[a]
      var y = src[b]
      if (cmp(x, y) <= 0) {
        dst[k++] = x
        a++
      } else {
        dst[k++] = y
        b++
      }
    }
    while (a < mid) dst[k++] = src[a++]
    while (b < hi) dst[k++] = src[b++]
  }

  function run(msg: any) {
    var job = { dead: false }
    live = job
    var id = msg.id
    var budget = msg.chunk > 0 ? msg.chunk : 100000
    var started = now()
    var reported = started

    /** опубликовать в общей памяти то, что уже отобрано */
    function publish(len: number, phase: number) {
      if (!shCtrl) return
      Atomics.store(shCtrl, 1, len)
      Atomics.store(shCtrl, 2, phase)
      Atomics.store(shCtrl, 3, id)
      // версия ПОСЛЕДНЕЙ: читатель, увидевший новую версию, увидит и длину
      Atomics.add(shCtrl, 0, 1)
    }

    function tell(phase: string, done: number, len: number) {
      var t = now()
      if (t - reported < 60) return
      reported = t
      publish(len, phase === 'filter' ? 0 : 1)
      port.post({ type: 'progress', id: id, phase: phase, done: done, matched: len })
    }

    var keep = msg.filter ? matcher(msg.filter) : null
    var cmp = msg.sort ? comparer(msg.sort) : null

    // 1. Фильтр: собираем номера уцелевших строк. В общую память пишем прямо
    // на ходу — тем и ценна изоляция.
    var picked = shOrder ? shOrder : new Uint32Array(count)
    var m = 0
    var i = 0

    function filterStep() {
      if (job.dead) return
      var edge = i + budget
      if (edge > count) edge = count
      if (keep) {
        for (; i < edge; i++) if (keep(i)) picked[m++] = i
      } else {
        for (; i < edge; i++) picked[m++] = i
      }
      if (i < count) {
        tell('filter', i / count, m)
        soon(filterStep)
        return
      }
      if (!cmp || m < 2) {
        // копия по размеру улова: без общей памяти отдавать наружу буфер на
        // `count` строк, из которых заполнено три, — держать мусор до
        // следующего запроса
        finish(shOrder ? null : picked.slice(0, m), m)
        return
      }
      // Сортируем на СВОЁЙ копии, а не в общей памяти: слияние переставляет
      // элементы туда-сюда, и читатель увидел бы кашу вместо порядка.
      sortStart(picked.slice(0, m))
    }

    // 2. Сортировка: слияние снизу вверх, состояние живёт в замыкании, поэтому
    // работу можно бросить в любой порции и продолжить в следующей.
    function sortStart(order: any) {
      var n = order.length
      var buf = new Uint32Array(n)
      var src = order
      var dst = buf
      var width = 1
      var at = 0
      var passes = Math.ceil(Math.log(n) / Math.LN2)
      var pass = 0

      function sortStep() {
        if (job.dead) return
        var work = 0
        while (width < n) {
          while (at < n) {
            var mid = at + width
            if (mid > n) mid = n
            var hi = at + width * 2
            if (hi > n) hi = n
            merge(src, dst, at, mid, hi, cmp)
            work += hi - at
            at = hi
            if (work >= budget) {
              tell('sort', (pass + at / n) / passes, n)
              soon(sortStep)
              return
            }
          }
          var t = src
          src = dst
          dst = t
          at = 0
          width = width * 2
          pass++
        }
        if (shOrder) {
          // одно копирование готового порядка в общую память — дальше читатель
          // берёт его сам, без единого сообщения с данными
          shOrder.set(src.subarray(0, n), 0)
          finish(null, n)
          return
        }
        finish(src, n)
      }

      sortStep()
    }

    function finish(order: any, matched: number) {
      if (job.dead) return
      live = null
      publish(matched, 2)
      var msg = {
        type: 'result',
        id: id,
        order: order,
        matched: matched,
        total: count,
        ms: now() - started,
      }
      // без общей памяти порядок уезжает `transfer`ом (без копии), с общей —
      // не уезжает вовсе: он уже там
      port.post(msg, order ? [order.buffer] : [])
    }

    filterStep()
  }

  port.receive(function (msg: any) {
    if (!msg) return
    if (msg.type === 'data') {
      count = msg.count
      cols = msg.columns
      shOrder = msg.order ? new Uint32Array(msg.order) : null
      shCtrl = msg.ctrl ? new Int32Array(msg.ctrl) : null
      return
    }
    if (msg.type === 'query') {
      if (live) live.dead = true
      run(msg)
      return
    }
    if (msg.type === 'stop') {
      if (live) live.dead = true
      live = null
    }
  })
}

/**
 * Воркер из строки, а не из отдельного файла: файл пришлось бы отдавать
 * потребителю рядом с бандлом и объяснять каждому сборщику, как его найти.
 * Исходник ядра берётся его же `toString()` — ровно поэтому ядро обязано быть
 * самодостаточным.
 */
function spawnWorker(): Channel | null {
  if (typeof Worker !== 'function' || typeof Blob !== 'function' || typeof URL === 'undefined') {
    return null
  }
  try {
    const src =
      'var kernel = ' +
      rowIndexKernel.toString() +
      ';\nkernel({ post: function (m, t) { self.postMessage(m, t || []) },' +
      ' receive: function (cb) { self.onmessage = function (e) { cb(e.data) } } });'
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))
    const worker = new Worker(url)
    return {
      worker: true,
      send: (msg, transfer) => worker.postMessage(msg, transfer ?? []),
      onMessage: (cb) => {
        worker.onmessage = (e) => cb(e.data)
      },
      close: () => {
        worker.terminate()
        // ссылку отпускаем здесь, а не сразу после конструктора: старые Safari
        // успевали освободить blob раньше, чем воркер его дочитывал
        URL.revokeObjectURL(url)
      },
    }
  } catch {
    // CSP без `worker-src blob:` — не повод падать, посчитаем на месте
    return null
  }
}

/** То же ядро, но на главном потоке: тесты, SSR и браузеры без воркеров. */
function spawnInline(): Channel {
  let toHost: (msg: any) => void = () => {}
  let toKernel: (msg: any) => void = () => {}
  rowIndexKernel({
    post: (msg) => toHost(msg),
    receive: (cb) => {
      toKernel = cb
    },
  })
  return {
    worker: false,
    send: (msg) => toKernel(msg),
    onMessage: (cb) => {
      toHost = cb
    },
    close: () => {
      toKernel({ type: 'stop' })
    },
  }
}

/**
 * Можно ли завести общую память. `SharedArrayBuffer` объявлен в браузере
 * всегда, но без изоляции страницы (COOP/COEP) конструктор бросает — проверять
 * надо именно `crossOriginIsolated`. На статике вроде GitHub Pages заголовков
 * взять неоткуда; там страница включает изоляцию сама, через service worker.
 */
function sharedMemoryAvailable(): boolean {
  return (
    typeof SharedArrayBuffer === 'function' &&
    (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated === true
  )
}

/** Числовая колонка в общей памяти: воркер увидит её без копирования. */
function toShared(column: RowColumn): RowColumn {
  if (column.kind !== 'number') return column
  const values = column.values
  if (values instanceof Float64Array && values.buffer instanceof SharedArrayBuffer) return column
  const copy = new Float64Array(new SharedArrayBuffer(values.length * 8))
  copy.set(values as ArrayLike<number>)
  return { kind: 'number', values: copy }
}

export function createRowIndex(opts: RowIndexOptions): RowIndex {
  const channel = (opts.inline ? null : spawnWorker()) ?? spawnInline()
  // общая память нужна не сама по себе, а вместе с воркером: считать в том же
  // потоке и «делиться» с самим собой смысла нет
  const shared = channel.worker && (opts.shared ?? sharedMemoryAvailable())
  let seq = 0
  /** запрос, ответ на который ещё ждём: всё, что старше, — мусор */
  let awaiting = 0
  let pending: RowQuery = {}
  let dead = false
  let total = 0
  /** окно в общую память: порядок и четыре числа состояния */
  let view: Uint32Array | null = null
  let ctrl: Int32Array | null = null
  /** версия, на которой читатель остановился в прошлый раз */
  let seen = -1

  /** Отдать наружу то, что лежит в общей памяти прямо сейчас. */
  function readShared(partial: boolean, ms: number) {
    if (!view || !ctrl) return
    const version = Atomics.load(ctrl, 0)
    if (partial && version === seen) return
    seen = version
    if (Atomics.load(ctrl, 3) !== awaiting) return
    const matched = Atomics.load(ctrl, 1)
    opts.onResult({
      // `subarray` — окно в ту же память, без копии
      order: view.subarray(0, matched),
      matched,
      total,
      ms,
      query: pending,
      partial,
    })
  }

  channel.onMessage((msg) => {
    if (dead || !msg || msg.id !== awaiting) return
    if (msg.type === 'progress') {
      opts.onProgress?.({ phase: msg.phase, done: msg.done, matched: msg.matched })
      // строки, прошедшие фильтр, показываем ДО конца работы; во время
      // сортировки показывать нечего — там порядок ещё не порядок
      if (shared && msg.phase === 'filter') readShared(true, 0)
      return
    }
    if (msg.type === 'result') {
      if (shared) {
        readShared(false, msg.ms)
        return
      }
      opts.onResult({
        order: msg.order,
        matched: msg.matched,
        total: msg.total,
        ms: msg.ms,
        query: pending,
        partial: false,
      })
    }
  })

  return {
    threaded: channel.worker,
    shared,
    setData: (data) => {
      if (dead) return
      total = data.count
      seen = -1
      const columns: Record<string, RowColumn> = {}
      for (const name in data.columns) {
        columns[name] = shared ? toShared(data.columns[name]) : data.columns[name]
      }
      if (shared) {
        view = new Uint32Array(new SharedArrayBuffer(Math.max(1, data.count) * 4))
        ctrl = new Int32Array(new SharedArrayBuffer(4 * 4))
      } else {
        view = null
        ctrl = null
      }
      channel.send({
        type: 'data',
        count: data.count,
        columns,
        order: view ? view.buffer : null,
        ctrl: ctrl ? ctrl.buffer : null,
      })
    },
    query: (q) => {
      if (dead) return
      pending = q
      awaiting = ++seq
      seen = -1
      channel.send({
        type: 'query',
        id: awaiting,
        sort: q.sort,
        filter: q.filter,
        chunk: opts.chunk,
      })
    },
    cancel: () => {
      if (dead) return
      // номер запроса растим и здесь: ответ на брошенный расчёт, если он всё же
      // успел уехать, отсеется по несовпадению номера
      awaiting = ++seq
      seen = -1
      channel.send({ type: 'stop' })
    },
    destroy: () => {
      dead = true
      channel.close()
    },
  }
}
