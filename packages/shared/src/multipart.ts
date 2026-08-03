// Заливка большого файла ЧАСТЯМИ.
//
// Файл на гигабайт одним PUT — лотерея: оборвалась сеть на девяносто пятом
// проценте, и всё начинается сначала. S3 умеет иначе: файл режется на куски,
// каждый кусок кладётся отдельным запросом по своей подписанной ссылке, в
// конце сервер собирает их в объект.
//
// Что это даёт: обрыв стоит одного куска, а не всего файла; куски идут по
// нескольку разом; отмена мгновенна.
//
// Чего это стоит: три похода к твоему серверу вместо одного (начать —
// подписать куски — завершить) и обязанность прибирать за собой. Незавершённая
// многочастная заливка остаётся в бакете НЕВИДИМЫМ мусором и тарифицируется;
// поэтому при обрыве зовётся `abort`, а на стороне хранилища всё равно стоит
// включить правило «удалять брошенные через N дней».
//
// Ниже — только клиентская половина. Подписи и сборка — на твоём сервере, там
// же живут ключи.

export type MultipartHandshake = {
  /** идентификатор заливки от хранилища */
  uploadId: string
  /** ключ объекта */
  key: string
}

export type MultipartOptions = {
  /** начать: вернуть `uploadId` и ключ */
  begin: (file: File, prefix: string) => Promise<MultipartHandshake>
  /** подписать один кусок; номера с ЕДИНИЦЫ, так требует S3 */
  signPart: (h: MultipartHandshake, partNumber: number) => Promise<string>
  /** собрать объект из кусков */
  complete: (h: MultipartHandshake, parts: Array<UploadedPart>) => Promise<void>
  /** выбросить недособранное */
  abort: (h: MultipartHandshake) => Promise<void>

  /**
   * Размер куска, байт. По умолчанию 8 МиБ: у S3 минимум 5 МиБ на все куски,
   * кроме последнего, а мельче — это лишние подписи и лишние запросы.
   */
  partSize?: number
  /** сколько кусков слать разом; по умолчанию 3 */
  concurrency?: number
}

export type UploadedPart = {
  partNumber: number
  /** ETag куска — по нему хранилище собирает объект */
  etag: string
}

/**
 * Залить файл частями. Прогресс общий по файлу, а не по кускам: считаем
 * отданные байты каждого куска и делим на размер файла.
 */
export async function uploadMultipart(
  file: File,
  ctx: { prefix: string; onProgress: (fraction: number) => void; signal: AbortSignal },
  opts: MultipartOptions,
): Promise<{ key: string }> {
  const partSize = opts.partSize ?? 8 * 1024 * 1024
  const lanes = Math.max(1, opts.concurrency ?? 3)
  const total = Math.max(1, file.size)
  const count = Math.max(1, Math.ceil(file.size / partSize))

  const handshake = await opts.begin(file, ctx.prefix)
  // сколько байт отдано каждым куском: прогресс общий, а куски едут вразнобой
  const sent = new Array<number>(count).fill(0)
  const done: Array<UploadedPart> = []

  const report = () => {
    let acc = 0
    for (const n of sent) acc += n
    ctx.onProgress(Math.min(1, acc / total))
  }

  let next = 0
  let failed: unknown = null

  async function lane() {
    for (;;) {
      if (failed || ctx.signal.aborted) return
      const i = next++
      if (i >= count) return

      const from = i * partSize
      const chunk = file.slice(from, Math.min(file.size, from + partSize))
      const partNumber = i + 1
      try {
        const url = await opts.signPart(handshake, partNumber)
        const etag = await putPart(url, chunk, ctx.signal, (bytes) => {
          sent[i] = bytes
          report()
        })
        sent[i] = chunk.size
        report()
        done.push({ partNumber, etag })
      } catch (err) {
        failed = err
        return
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(lanes, count) }, lane))

  if (failed || ctx.signal.aborted) {
    // за собой прибираем ВСЕГДА: брошенные куски лежат в бакете невидимо и
    // стоят денег
    await opts.abort(handshake).catch(() => {})
    throw failed ?? new Error('отменено')
  }

  // S3 требует куски по возрастанию номера, а приезжали они вразнобой
  done.sort((a, b) => a.partNumber - b.partNumber)
  await opts.complete(handshake, done)
  ctx.onProgress(1)
  return { key: handshake.key }
}

/**
 * Один кусок. XHR, а не fetch, по той же причине, что и в `presigned.ts`: у
 * fetch нет прогресса отдачи.
 *
 * ETag хранилище возвращает заголовком; без него собрать объект нельзя, и это
 * самая частая причина «залилось, но не собралось»: прокси или CORS без
 * `Access-Control-Expose-Headers: ETag` его срезают.
 */
function putPart(
  url: string,
  chunk: Blob,
  signal: AbortSignal,
  onBytes: (bytes: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error('отменено'))
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url, true)

    const onAbort = () => xhr.abort()
    signal.addEventListener('abort', onAbort, { once: true })
    const off = () => signal.removeEventListener('abort', onAbort)

    xhr.upload.onprogress = (ev) => ev.lengthComputable && onBytes(ev.loaded)
    xhr.onload = () => {
      off()
      if (xhr.status < 200 || xhr.status >= 300) {
        return reject(new Error(`кусок не принят: ${xhr.status}`))
      }
      const etag = xhr.getResponseHeader('ETag')
      if (!etag) {
        return reject(
          new Error('хранилище не отдало ETag куска — проверь Access-Control-Expose-Headers'),
        )
      }
      resolve(etag.replaceAll('"', ''))
    }
    xhr.onerror = () => { off(); reject(new Error('сеть недоступна')) }
    xhr.onabort = () => { off(); reject(new Error('отменено')) }
    xhr.send(chunk)
  })
}

/** стоит ли лить частями: мелкие файлы этого не окупают */
export const shouldSplit = (file: File, partSize = 8 * 1024 * 1024) => file.size > partSize
