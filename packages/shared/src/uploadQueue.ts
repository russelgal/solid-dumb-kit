// Очередь заливки: без DOM и без фреймворка, поэтому проверяется тестами.
//
// Зачем очередь вообще. Кинуть двадцать файлов разом легко, но браузер держит
// к одному хосту около шести соединений: всё сверх просто встаёт в ожидание, а
// прогресс при этом бодро показывает двадцать полосок, из которых движется
// шесть. Хуже того, отменить «ждущую» заливку нечем — она ещё не началась.
// Поэтому запускаем по нескольку, остальные держим у себя и умеем выбросить их
// из очереди мгновенно.

/** чем заливаем: своё дело потребителя, галерея транспорт не выбирает */
export type Uploader = (
  file: File,
  ctx: {
    /** 0…1; зовётся часто, дёргать состояние на каждый вызов не стоит */
    onProgress: (fraction: number) => void
    /** отменили — брось запрос */
    signal: AbortSignal
  },
) => Promise<UploadResult>

export type UploadResult = {
  /** чем показывать картинку после заливки */
  url: string
  /** ключ в хранилище — если он нужен потребителю для удаления */
  key?: string
}

export type QueueEvents = {
  /**
   * Заливка ФАКТИЧЕСКИ началась, а не просто встала в очередь.
   *
   * Без этого события все поставленные файлы показывались бы «идущими», из
   * которых реально едет только часть, — то самое враньё, ради которого
   * очередь и заводилась.
   */
  onStart?: (id: string) => void
  onProgress?: (id: string, fraction: number) => void
  onDone?: (id: string, result: UploadResult) => void
  onError?: (id: string, message: string) => void
}

export type UploadQueue = {
  /** поставить файл в очередь; id — тот же, что у элемента галереи */
  add: (id: string, file: File) => void
  /** снять с очереди: ждущего выбросить, идущего прервать */
  cancel: (id: string) => void
  /** снять всё разом — на размонтировании */
  destroy: () => void
  /** сколько ещё не доехало: и в работе, и в ожидании */
  pending: () => number
}

export function createUploadQueue(
  upload: Uploader,
  events: QueueEvents = {},
  /** сколько тянуть одновременно; больше шести смысла не имеет */
  concurrency = 3,
): UploadQueue {
  const waiting: Array<{ id: string; file: File }> = []
  const running = new Map<string, AbortController>()
  let dead = false

  function pump() {
    while (!dead && running.size < concurrency && waiting.length) {
      const next = waiting.shift()!
      start(next.id, next.file)
    }
  }

  function start(id: string, file: File) {
    const ctrl = new AbortController()
    running.set(id, ctrl)
    events.onStart?.(id)

    upload(file, {
      signal: ctrl.signal,
      onProgress: (f) => {
        // прогресс отменённой заливки никого не интересует
        if (running.get(id) === ctrl) events.onProgress?.(id, clamp(f))
      },
    })
      .then((res) => {
        if (running.get(id) !== ctrl) return
        running.delete(id)
        events.onDone?.(id, res)
      })
      .catch((err: unknown) => {
        if (running.get(id) !== ctrl) return       // отменили — это не ошибка
        running.delete(id)
        events.onError?.(id, message(err))
      })
      .finally(pump)
  }

  return {
    add(id, file) {
      if (dead) return
      waiting.push({ id, file })
      pump()
    },
    cancel(id) {
      const i = waiting.findIndex((w) => w.id === id)
      if (i >= 0) { waiting.splice(i, 1); return }
      const ctrl = running.get(id)
      if (!ctrl) return
      running.delete(id)          // снимаем ДО abort: иначе catch сочтёт это ошибкой
      ctrl.abort()
      pump()
    },
    destroy() {
      dead = true
      waiting.length = 0
      for (const ctrl of running.values()) ctrl.abort()
      running.clear()
    },
    pending: () => waiting.length + running.size,
  }
}

const clamp = (f: number) => (f < 0 ? 0 : f > 1 ? 1 : f)

function message(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
