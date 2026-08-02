// Заливка по подписанной ссылке — то, чем это делается с S3-совместимым
// хранилищем (Garage в том числе).
//
// ПОЧЕМУ ИМЕННО ТАК, А НЕ КЛИЕНТОМ S3 В БРАУЗЕРЕ. Ключи доступа к бакету —
// ключи ко всему бакету: удалить, перезаписать, вычитать чужое. В браузере они
// не живут ни в каком виде: ни в переменных сборки, ни «только на время». Их
// место на сервере, а браузеру достаётся ссылка, подписанная на один объект и
// на несколько минут. Поэтому галерея ничего не знает ни про бакет, ни про
// регион — она спрашивает у тебя ссылку и кладёт файл по ней.
//
// ПОЧЕМУ XHR, А НЕ FETCH. У `fetch` нет прогресса отдачи: `ReadableStream` в
// теле запроса поддерживают не все, и даже там, где поддерживают, требуется
// HTTP/2 и `duplex: 'half'`. `XMLHttpRequest.upload.onprogress` работает
// везде и ровно для этого и существует.

import type { Uploader, UploadResult } from './uploadQueue'

/** Что должен вернуть твой сервер на просьбу подписать */
export type Presigned = {
  /** куда класть — подписанная ссылка */
  url: string
  /** каким методом; по умолчанию PUT */
  method?: 'PUT' | 'POST'
  /** заголовки, вошедшие в подпись: их обязательно повторить один в один */
  headers?: Record<string, string>
  /** ключ объекта в бакете — вернётся потребителю как есть */
  key?: string
  /** по какому адресу файл будет виден потом; не задан — берём `url` без query */
  publicUrl?: string
}

export type PresignedOptions = {
  /**
   * Спросить у своего сервера подпись. Единственное место, где галерея ходит
   * наружу за чем-то, кроме самого файла.
   */
  sign: (file: File) => Promise<Presigned>
}

/**
 * Транспорт для `DumbGallery`: спрашивает подпись, кладёт файл по ней,
 * отдаёт публичный адрес.
 */
export function createPresignedUploader(opts: PresignedOptions): Uploader {
  return (file, ctx) =>
    opts.sign(file).then((p) => putWithProgress(file, p, ctx))
}

function putWithProgress(
  file: File,
  p: Presigned,
  ctx: { onProgress: (f: number) => void; signal: AbortSignal },
): Promise<UploadResult> {
  return new Promise<UploadResult>((resolve, reject) => {
    if (ctx.signal.aborted) return reject(new Error('отменено'))

    const xhr = new XMLHttpRequest()
    xhr.open(p.method ?? 'PUT', p.url, true)
    for (const [k, v] of Object.entries(p.headers ?? {})) xhr.setRequestHeader(k, v)

    const onAbort = () => xhr.abort()
    ctx.signal.addEventListener('abort', onAbort, { once: true })
    const done = () => ctx.signal.removeEventListener('abort', onAbort)

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) ctx.onProgress(ev.loaded / ev.total)
    }
    xhr.onload = () => {
      done()
      if (xhr.status >= 200 && xhr.status < 300) {
        ctx.onProgress(1)
        resolve({ url: p.publicUrl ?? stripQuery(p.url), key: p.key })
      } else {
        // тело ответа S3 — это XML с внятной причиной; в сообщение его целиком
        // тащить незачем, но код без него бесполезен
        reject(new Error(`хранилище ответило ${xhr.status}${reason(xhr.responseText)}`))
      }
    }
    xhr.onerror = () => { done(); reject(new Error('сеть недоступна')) }
    xhr.onabort = () => { done(); reject(new Error('отменено')) }

    xhr.send(file)
  })
}

/** подписанная ссылка несёт подпись в query — показывать её потом незачем */
const stripQuery = (url: string) => url.split('?')[0]

/** вытащить <Message> из XML-ответа S3, если он там есть */
function reason(body: string | null): string {
  const m = body && /<Message>([^<]+)<\/Message>/.exec(body)
  return m ? `: ${m[1]}` : ''
}
