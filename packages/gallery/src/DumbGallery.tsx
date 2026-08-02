// Галерея: выбрать файлы, посмотреть, переставить, залить.
//
// Состоит из готового: выбор и перетаскивание файлов в окно — примитив
// `@solid-primitives/upload`, перестановка — `DumbSortable` (указательный, то
// есть работает и пальцем), заливка — очередь из `uploadQueue` с транспортом,
// который даёшь ты.
//
// Три вещи, из которых складывается поведение:
//
// 1. КАРТИНКА ПОЯВЛЯЕТСЯ СРАЗУ. Выбранный файл показывается из `objectURL`, не
//    дожидаясь никакой заливки. Без транспорта галерея на этом и живёт —
//    получается локальный набор картинок, который никуда не уходит.
// 2. ЗАЛИВКА — ФОНОМ И ПООЧЕРЁДНО. Двадцать файлов не полетят двадцатью
//    запросами: очередь держит по нескольку, остальное ждёт и умеет отмениться.
// 3. ПОРЯДОК — ТВОИ ДАННЫЕ. Компонент ничего не хранит: каждое изменение
//    (добавили, переставили, удалили, долилось) он отдаёт в `setItems`.
//
// Ключей от хранилища галерея не видит и видеть не должна — см. `presigned.ts`.

import { Show, createMemo, createSignal, onCleanup, type JSX } from 'solid-js'
import { createDropzone, createFileUploader, type UploadFile } from '@solid-primitives/upload'
import { DumbSortable } from '@solid-dumb-kit/sortable'
import { injectStyle } from '@solid-dumb-kit/shared'
import { createUploadQueue, type Uploader } from './uploadQueue'

export type GalleryStatus =
  /** транспорта нет: файл живёт только в браузере */
  | 'local'
  /** поставлен в очередь, но ещё не поехал */
  | 'queued'
  | 'uploading'
  | 'done'
  | 'error'

export type GalleryItem = {
  id: string
  /** адрес, по которому картинка живёт «по-настоящему» (после заливки) */
  url: string
  /** `objectURL` выбранного файла: показывается, пока он есть */
  preview?: string
  name?: string
  size?: number
  status?: GalleryStatus
  /** 0…1, пока идёт заливка */
  progress?: number
  error?: string
  /** ключ в хранилище — приходит из транспорта */
  key?: string
}

export type DumbGalleryProps = {
  items: Array<GalleryItem>
  /** позвать с новым набором: добавили, переставили, удалили, долилось */
  setItems: (next: Array<GalleryItem>) => void

  /**
   * Чем заливать. Не задан — галерея локальная: файлы живут в браузере и
   * пропадут с перезагрузкой. Для S3-совместимого хранилища бери
   * `createPresignedUploader`.
   */
  upload?: Uploader
  /** сколько тянуть одновременно; по умолчанию 3 */
  concurrency?: number

  /** что пускать в выбор; по умолчанию `image/*` */
  accept?: string
  /** можно ли выбрать несколько разом; по умолчанию да */
  multiple?: boolean
  /** больше стольких не принимать; не задан — без предела */
  max?: number

  /** ширина плитки, css; по умолчанию `minmax(120px, 1fr)` */
  tile?: string
  /** правка: без неё нет ни выбора, ни перестановки, ни удаления */
  editable?: boolean
  /** анимировать перестановку; по умолчанию да, но не при prefers-reduced-motion */
  animate?: boolean

  /** клик по плитке — открыть просмотр, например */
  onOpen?: (item: GalleryItem, index: number) => void
  /** своя плитка целиком; не задана — рисуем свою */
  children?: (item: GalleryItem, index: () => number) => JSX.Element

  class?: string
  style?: JSX.CSSProperties
}

/**
 * Структурные стили: сетка, полоса прогресса, зона приёма. Кладутся в `<head>`
 * один раз на документ. Всё остальное оформление твоё.
 */
const CSS = `
          .dumb-gallery { display: grid; gap: 10px;
                          grid-template-columns: repeat(auto-fill, var(--dumb-gallery-tile)) }
          .dumb-gallery-tile { position: relative; overflow: hidden; aspect-ratio: 1;
                               border-radius: 10px; background: rgb(0 0 0 / .04) }
          .dumb-gallery-tile img { width: 100%; height: 100%; object-fit: cover; display: block }
          /* пока файл едет — приглушаем и показываем полосу */
          .dumb-gallery-tile[data-status="uploading"] img,
          .dumb-gallery-tile[data-status="queued"] img { opacity: .5 }
          /* ждущий в очереди отличается от идущего: полоса у него не движется */
          .dumb-gallery-tile[data-status="queued"] .dumb-gallery-bar > i { width: 0 !important }
          .dumb-gallery-tile[data-status="error"] { outline: 2px solid currentColor }
          .dumb-gallery-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 3px;
                              background: rgb(0 0 0 / .12) }
          .dumb-gallery-bar > i { display: block; height: 100%; background: currentColor;
                                  transition: width .12s linear }
          .dumb-gallery-drop { position: relative }
          .dumb-gallery-drop[data-over="1"]::after {
            content: ''; position: absolute; inset: -6px; border-radius: 12px;
            outline: 2px dashed currentColor; pointer-events: none }
        `

export function DumbGallery(props: DumbGalleryProps) {
  injectStyle('gallery', CSS)

  const editable = () => props.editable !== false
  const accept = () => props.accept ?? 'image/*'
  const tile = () => props.tile ?? 'minmax(120px, 1fr)'

  const [dragOver, setDragOver] = createSignal(false)

  /** правим один элемент по id — всё остальное отдаём как было */
  const patch = (id: string, next: Partial<GalleryItem>) =>
    props.setItems(props.items.map((it) => (it.id === id ? { ...it, ...next } : it)))

  /**
   * Очередь создаётся ОДИН раз на компонент, а транспорт читается из пропа в
   * момент заливки: иначе смена `upload` посреди работы оборвала бы очередь.
   */
  const queue = createUploadQueue(
    (file, ctx) => {
      const up = props.upload
      if (!up) return Promise.reject(new Error('транспорт не задан'))
      return up(file, ctx)
    },
    {
      onStart: (id) => patch(id, { status: 'uploading' }),
      onProgress: (id, p) => patch(id, { progress: p }),
      onDone: (id, res) => {
        // локальный `objectURL` больше не нужен: показываем то, что в хранилище
        const was = props.items.find((it) => it.id === id)
        if (was?.preview) URL.revokeObjectURL(was.preview)
        patch(id, { status: 'done', progress: 1, url: res.url, key: res.key, preview: undefined })
      },
      onError: (id, err) => patch(id, { status: 'error', error: err }),
    },
    props.concurrency ?? 3,
  )
  onCleanup(() => queue.destroy())

  /** сколько ещё можно принять */
  const room = () => (props.max === undefined ? Infinity : props.max - props.items.length)

  function accepted(files: Array<UploadFile>) {
    if (!editable()) return
    const take = files.slice(0, Math.max(0, room()))
    if (!take.length) return

    const added: Array<GalleryItem> = take.map((f, i) => ({
      // время + индекс: у двух файлов, выбранных одним кликом, имена совпадают
      id: `g${Date.now().toString(36)}${i}`,
      url: f.source,
      preview: f.source,
      name: f.name,
      size: f.size,
      status: props.upload ? 'queued' : 'local',
      progress: props.upload ? 0 : undefined,
    }))
    props.setItems([...props.items, ...added])
    if (props.upload) added.forEach((it, i) => queue.add(it.id, take[i].file))
  }

  const picker = createFileUploader({ accept: accept(), multiple: props.multiple !== false })
  const dropzone = createDropzone({
    onDrop: (files) => { setDragOver(false); accepted(files) },
    // сеттеры возвращают значение, а примитив ждёт void — оборачиваем
    onDragOver: () => { setDragOver(true) },
    onDragLeave: () => { setDragOver(false) },
  })

  /** выбросить плитку: отменить заливку, отпустить `objectURL` */
  function remove(item: GalleryItem) {
    queue.cancel(item.id)
    if (item.preview) URL.revokeObjectURL(item.preview)
    props.setItems(props.items.filter((it) => it.id !== item.id))
  }

  // за собой прибираем: неотпущенный `objectURL` держит файл в памяти вкладки
  onCleanup(() => {
    for (const it of props.items) if (it.preview) URL.revokeObjectURL(it.preview)
  })

  const stats = createMemo(() => {
    let up = 0
    let bad = 0
    for (const it of props.items) {
      if (it.status === 'uploading' || it.status === 'queued') up++
      if (it.status === 'error') bad++
    }
    return { up, bad }
  })

  return (
    <div
      class={`dumb-gallery-drop ${props.class ?? ''}`}
      data-over={dragOver() && editable() ? '1' : undefined}
      ref={dropzone.setRef}
      style={props.style}
    >
      <div class="dumb-gallery" style={{ '--dumb-gallery-tile': tile() }}>
        <DumbSortable
          items={props.items}
          setItems={props.setItems}
          id={(it) => it.id}
          axis="grid"
          disabled={() => !editable()}
          animate={props.animate}
        >
          {(item, i) =>
            props.children?.(item, i) ?? (
              <figure
                class="dumb-gallery-tile"
                data-status={item.status ?? 'local'}
                title={item.error ?? item.name}
                onClick={() => props.onOpen?.(item, i())}
              >
                <img src={item.preview ?? item.url} alt={item.name ?? ''} draggable={false} />
                <Show when={editable()}>
                  {/* кнопка: жест с неё не начнётся — `DumbSortable` пропускает
                      интерактивные цели сам, отдельной метки не нужно */}
                  <button
                    type="button"
                    title="убрать"
                    onClick={(ev) => { ev.stopPropagation(); remove(item) }}
                  >
                    ✕
                  </button>
                </Show>
                <Show when={item.status === 'uploading' || item.status === 'queued'}>
                  <span class="dumb-gallery-bar">
                    <i style={{ width: `${Math.round((item.progress ?? 0) * 100)}%` }} />
                  </span>
                </Show>
              </figure>
            )
          }
        </DumbSortable>
      </div>

      <Show when={editable()}>
        <button type="button" onClick={() => picker.selectFiles(accepted)}>
          Выбрать файлы
        </button>
      </Show>
      <Show when={stats().up || stats().bad}>
        <span data-gallery-stats>
          {stats().up ? `заливается: ${stats().up}` : ''}
          {stats().bad ? ` · с ошибкой: ${stats().bad}` : ''}
        </span>
      </Show>
    </div>
  )
}
