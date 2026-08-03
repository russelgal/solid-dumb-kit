// Бросок ПАПКИ, а не просто файлов.
//
// `dataTransfer.files` — плоский список: бросил папку, получил ничего (или, в
// зависимости от браузера, её саму как файл нулевого размера). Дерево лежит в
// другом месте — `dataTransfer.items[i].webkitGetAsEntry()`, нестандартном, но
// работающем везде, где вообще есть drag-and-drop.
//
// ГЛАВНАЯ ГРАБЛЯ, из-за которой это отдельная функция: `items` живут ТОЛЬКО
// пока идёт обработчик события. Один `await` — и коллекция пуста, а обход
// падает на пустом месте. Поэтому `webkitGetAsEntry()` для всех элементов
// вызывается СИНХРОННО, до первого ожидания, и уже потом дерево обходится
// сколько угодно долго.

/** файл вместе с путём внутри брошенной папки */
export type DroppedFile = {
  file: File
  /**
   * Путь относительно места броска: `фото/2026/море.jpg`. У файла, брошенного
   * поодиночке, — просто имя.
   */
  path: string
}

type FsEntry = {
  isFile: boolean
  isDirectory: boolean
  name: string
  fullPath: string
  file?: (ok: (f: File) => void, err: (e: unknown) => void) => void
  createReader?: () => {
    readEntries: (ok: (list: Array<FsEntry>) => void, err: (e: unknown) => void) => void
  }
}

type ItemWithEntry = DataTransferItem & { webkitGetAsEntry?: () => FsEntry | null }

/**
 * Разобрать брошенное в плоский список файлов с путями.
 *
 * Зовётся ПРЯМО в обработчике `drop`, без `await` перед ней:
 *
 * ```ts
 * onDrop={(ev) => {
 *   ev.preventDefault()
 *   readDropEntries(ev.dataTransfer).then((files) => …)
 * }}
 * ```
 *
 * Папок в браузере может не оказаться (Safari до 11.1, старый Firefox) — тогда
 * возвращаются обычные файлы, без путей. Это не ошибка, это меньше данных.
 */
export function readDropEntries(dt: DataTransfer | null): Promise<Array<DroppedFile>> {
  if (!dt) return Promise.resolve([])

  // СИНХРОННО: после первого await `dt.items` уже пуст
  const entries: Array<FsEntry> = []
  const plain: Array<File> = []
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind !== 'file') continue
    const entry = (item as ItemWithEntry).webkitGetAsEntry?.()
    if (entry) entries.push(entry)
    else {
      const f = item.getAsFile()
      if (f) plain.push(f)
    }
  }
  // браузер без FileSystem API — берём что дали
  if (!entries.length) {
    const files = plain.length ? plain : Array.from(dt.files ?? [])
    return Promise.resolve(files.map((file) => ({ file, path: file.name })))
  }

  return Promise.all(entries.map((e) => walk(e, ''))).then((lists) => lists.flat())
}

/** обойти запись: файл — отдать, папку — обойти всю */
async function walk(entry: FsEntry, prefix: string): Promise<Array<DroppedFile>> {
  if (entry.isFile) {
    const file = await new Promise<File | null>((ok) =>
      entry.file ? entry.file(ok, () => ok(null)) : ok(null),
    )
    // файл могли удалить между броском и чтением — молча пропускаем
    return file ? [{ file, path: `${prefix}${file.name}` }] : []
  }
  if (!entry.isDirectory || !entry.createReader) return []

  const reader = entry.createReader()
  const kids: Array<FsEntry> = []
  // ЧИТАЕМ ПОРЦИЯМИ, пока не отдаст пустую: `readEntries` возвращает не всё
  // содержимое, а очередную сотню, и на папке из тысячи файлов однократный
  // вызов молча теряет девятьсот
  for (;;) {
    const part = await new Promise<Array<FsEntry>>((ok) =>
      reader.readEntries(ok, () => ok([])),
    )
    if (!part.length) break
    kids.push(...part)
  }

  const inner = `${prefix}${entry.name}/`
  const lists = await Promise.all(kids.map((k) => walk(k, inner)))
  return lists.flat()
}

/** есть ли в брошенном хоть одна папка — чтобы предупредить, что будет долго */
export function hasDirectories(dt: DataTransfer | null): boolean {
  if (!dt) return false
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind !== 'file') continue
    if ((item as ItemWithEntry).webkitGetAsEntry?.()?.isDirectory) return true
  }
  return false
}
