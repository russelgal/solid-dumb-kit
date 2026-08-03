import { describe, it, expect, vi } from 'vitest'
import { createUploadQueue, type Uploader } from '../src/uploadQueue'

const file = (name = 'a.png') => new File(['x'], name, { type: 'image/png' })

/**
 * Дать промисам доиграть. Одного `await` мало: у очереди цепочка
 * `then → catch → finally`, и подхват следующего файла живёт в самом конце.
 */
const flush = () => new Promise((r) => setTimeout(r, 0))

/** транспорт, которым управляем вручную: держим и отпускаем по одной заливке */
function manual() {
  const open = new Map<string, {
    resolve: (u: { url: string; key?: string }) => void
    reject: (e: Error) => void
    progress: (f: number) => void
    aborted: () => boolean
  }>()
  const uploader: Uploader = (f, ctx) =>
    new Promise((resolve, reject) => {
      open.set(f.name, {
        resolve, reject,
        progress: ctx.onProgress,
        aborted: () => ctx.signal.aborted,
      })
    })
  return { uploader, open }
}

describe('createUploadQueue', () => {
  it('держит не больше заданного одновременно, остальное ждёт', async () => {
    const { uploader, open } = manual()
    const q = createUploadQueue(uploader, {}, 2)
    for (const n of ['a', 'b', 'c', 'd']) q.add(n, file(n))

    expect(open.size).toBe(2)          // в работе двое
    expect(q.pending()).toBe(4)        // но не доехали все четыре

    open.get('a')!.resolve({ url: '/a' })
    await flush()
    expect(open.size).toBe(3)          // освободилось место — подтянулся третий
    expect(q.pending()).toBe(3)
  })

  it('прогресс и результат приходят с тем же id, что дали на входе', async () => {
    const { uploader, open } = manual()
    const onProgress = vi.fn()
    const onDone = vi.fn()
    const q = createUploadQueue(uploader, { onProgress, onDone })
    q.add('элемент-1', file('a'))

    open.get('a')!.progress(0.5)
    expect(onProgress).toHaveBeenCalledWith('элемент-1', 0.5)

    open.get('a')!.resolve({ url: '/готово', key: 'k1' })
    await flush()
    expect(onDone).toHaveBeenCalledWith('элемент-1', { url: '/готово', key: 'k1' })
  })

  it('прогресс зажимается в 0…1: транспорт может соврать', () => {
    const { uploader, open } = manual()
    const onProgress = vi.fn()
    const q = createUploadQueue(uploader, { onProgress })
    q.add('i', file('a'))
    open.get('a')!.progress(-3)
    open.get('a')!.progress(42)
    expect(onProgress).toHaveBeenNthCalledWith(1, 'i', 0)
    expect(onProgress).toHaveBeenNthCalledWith(2, 'i', 1)
  })

  it('ошибка транспорта доезжает сообщением, а не объектом', async () => {
    const { uploader, open } = manual()
    const onError = vi.fn()
    const q = createUploadQueue(uploader, { onError })
    q.add('i', file('a'))
    open.get('a')!.reject(new Error('хранилище ответило 403'))
    await flush()
    expect(onError).toHaveBeenCalledWith('i', 'хранилище ответило 403')
  })

  it('отмена ждущего просто выкидывает его из очереди', () => {
    const { uploader, open } = manual()
    const q = createUploadQueue(uploader, {}, 1)
    q.add('a', file('a'))
    q.add('b', file('b'))
    expect(q.pending()).toBe(2)

    q.cancel('b')                      // b ещё не начинался
    expect(q.pending()).toBe(1)
    expect(open.has('b')).toBe(false)
  })

  it('отмена идущего прерывает запрос и НЕ считается ошибкой', async () => {
    const { uploader, open } = manual()
    const onError = vi.fn()
    const onDone = vi.fn()
    const q = createUploadQueue(uploader, { onError, onDone })
    q.add('i', file('a'))

    q.cancel('i')
    expect(open.get('a')!.aborted()).toBe(true)

    // транспорт всё равно доиграет обещание — это не должно ничего разбудить
    open.get('a')!.reject(new Error('отменено'))
    await flush()
    expect(onError).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
    expect(q.pending()).toBe(0)
  })

  it('после отмены подтягивается следующий из очереди', async () => {
    const { uploader, open } = manual()
    const q = createUploadQueue(uploader, {}, 1)
    q.add('a', file('a'))
    q.add('b', file('b'))
    expect(open.has('b')).toBe(false)

    q.cancel('a')
    expect(open.has('b')).toBe(true)
  })

  it('destroy обрывает всё и больше ничего не принимает', () => {
    const { uploader, open } = manual()
    const q = createUploadQueue(uploader, {}, 2)
    q.add('a', file('a'))
    q.add('b', file('b'))
    q.add('c', file('c'))

    q.destroy()
    expect(open.get('a')!.aborted()).toBe(true)
    expect(q.pending()).toBe(0)

    q.add('d', file('d'))
    expect(q.pending()).toBe(0)
  })
})
