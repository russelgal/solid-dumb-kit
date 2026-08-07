// Просмотрщик: открыть картинку во весь экран, листать соседние, закрыть.
//
// Рисуется в top layer через нативный `<dialog>`, а не в своём `position: fixed`
// с `z-index: 99999`. Причина не в красоте: элемент в top layer стоит НАД всем,
// включая чужие модалки и `overflow: hidden` у предков, и получает
// блокировку фокуса и Esc от браузера даром.
//
// Масштаб и сдвиг — только `transform`: layout не трогаем вовсе, поэтому зум
// колесом идёт в кадре и на большой картинке.
//
// Соседние картинки грузятся заранее — одна вперёд и одна назад. Без этого
// каждое нажатие стрелки показывает пустоту на время загрузки, и просмотр
// превращается в ожидание.

import { For, Show, createMemo, createSignal, onCleanup, type JSX } from 'solid-js'
import { effect, injectStyle, resolveCloseSide, shouldAnimate, type CloseSideOption } from '@solid-dumb-kit/shared'

export type LightboxItem = {
  /** что показывать */
  url: string
  /** подпись под картинкой */
  title?: string
  /** мелкая версия: показывается, пока грузится большая */
  preview?: string
}

export type DumbLightboxProps = {
  items: Array<LightboxItem>
  /** что открыто; `null` — закрыт */
  index: () => number | null
  onIndexChange: (index: number | null) => void
  /** анимировать открытие; по умолчанию да, но не при prefers-reduced-motion */
  animate?: boolean
  /** свой низ: скачать, удалить, поделиться */
  actions?: (item: LightboxItem, index: number) => JSX.Element
  /** сторона крестика; по умолчанию по платформе: macOS слева, иначе справа */
  closeSide?: CloseSideOption
  class?: string
}

const STYLES = `
  /* Только структура и механика зума. Кнопки — daisyUI (btn) в разметке; над
     тёмной картинкой они идут в btn-neutral, чтобы читаться на любом фоне. */
  .dumb-lightbox { border: 0; padding: 0; max-width: 100vw; max-height: 100vh;
                   width: 100vw; height: 100vh; background: transparent; overflow: hidden }
  .dumb-lightbox::backdrop { background: rgb(0 0 0 / .82) }
  .dumb-lightbox-stage { position: absolute; inset: 0; display: grid; place-items: center;
                         overflow: hidden; touch-action: none; cursor: grab }
  .dumb-lightbox-stage[data-drag="1"] { cursor: grabbing }
  .dumb-lightbox-img { max-width: 92vw; max-height: 84vh; display: block;
                       will-change: transform; user-select: none; -webkit-user-drag: none }
  .dumb-lightbox[data-animate="1"] .dumb-lightbox-img { transition: transform .12s ease-out }
  .dumb-lightbox-stage[data-drag="1"] .dumb-lightbox-img { transition: none }

  /* панели поверх картинки: подложка-градиент, чтобы подписи читались */
  .dumb-lightbox-bar { position: absolute; left: 0; right: 0 }
  .dumb-lightbox-bar[data-at="top"] { top: 0;
    background: linear-gradient(rgb(0 0 0 / .55), transparent) }
  .dumb-lightbox-bar[data-at="bottom"] { bottom: 0;
    background: linear-gradient(transparent, rgb(0 0 0 / .55)) }
  .dumb-lightbox-nav { position: absolute; top: 50%; transform: translateY(-50%) }
  .dumb-lightbox-nav[data-side="prev"] { left: 12px }
  .dumb-lightbox-nav[data-side="next"] { right: 12px }
`

export function DumbLightbox(props: DumbLightboxProps) {
  injectStyle('lightbox', STYLES)

  let dialog!: HTMLDialogElement
  const [zoom, setZoom] = createSignal(1)
  const [pan, setPan] = createSignal({ x: 0, y: 0 })
  const [dragging, setDragging] = createSignal(false)

  const at = () => props.index()
  const item = createMemo(() => {
    const i = at()
    return i === null ? null : props.items[i] ?? null
  })

  const go = (delta: number) => {
    const i = at()
    if (i === null || !props.items.length) return
    // по кругу: с последней вперёд — на первую, так листают везде
    const next = (i + delta + props.items.length) % props.items.length
    reset()
    props.onIndexChange(next)
  }

  const reset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const close = () => {
    reset()
    props.onIndexChange(null)
  }

  /** сторона крестика: проп, общая настройка приложения или платформа */
  const side = () => resolveCloseSide(props.closeSide)
  const closeButton = () => (
    <button type="button" class="btn btn-sm btn-circle btn-neutral" title="закрыть (Esc)" onClick={close}>
      ✕
    </button>
  )

  // диалог открывается и закрывается императивно — сигнал только источник правды
  effect(() => {
    const open = at() !== null
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  })

  /**
   * Соседние тянем заранее. `new Image()` — самый дешёвый способ: браузер
   * положит их в тот же кеш, откуда потом возьмёт `<img>`.
   */
  effect(() => {
    const i = at()
    if (i === null) return
    for (const d of [1, -1]) {
      const near = props.items[(i + d + props.items.length) % props.items.length]
      if (near?.url) new Image().src = near.url
    }
  })

  function onKey(ev: KeyboardEvent) {
    if (at() === null) return
    if (ev.key === 'ArrowRight') return void (ev.preventDefault(), go(1))
    if (ev.key === 'ArrowLeft') return void (ev.preventDefault(), go(-1))
    if (ev.key === '0') return reset()
    if (ev.key === '+' || ev.key === '=') return setZoom((z) => Math.min(8, z * 1.25))
    if (ev.key === '-') return setZoom((z) => Math.max(1, z / 1.25))
    // Esc закрывает сам `<dialog>`, но нам надо ещё и сбросить состояние
  }

  effect(() => {
    window.addEventListener('keydown', onKey)
    onCleanup(() => window.removeEventListener('keydown', onKey))
  })

  /** колесо — зум к курсору; страница под диалогом при этом не едет */
  function onWheel(ev: WheelEvent) {
    ev.preventDefault()
    const k = ev.deltaY < 0 ? 1.12 : 1 / 1.12
    setZoom((z) => {
      const next = Math.min(8, Math.max(1, z * k))
      if (next === 1) setPan({ x: 0, y: 0 })
      return next
    })
  }

  let from: { x: number; y: number; px: number; py: number } | null = null
  function onDown(ev: PointerEvent) {
    if (zoom() === 1) return                 // не увеличено — таскать нечего
    ;(ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId)
    from = { x: ev.clientX, y: ev.clientY, ...({ px: pan().x, py: pan().y }) }
    setDragging(true)
  }
  function onMove(ev: PointerEvent) {
    if (!from) return
    setPan({ x: from.px + (ev.clientX - from.x), y: from.py + (ev.clientY - from.y) })
  }
  function onUp() {
    from = null
    setDragging(false)
  }

  return (
    <dialog
      ref={dialog}
      class={`dumb-lightbox ${props.class ?? ''}`}
      data-animate={shouldAnimate(props.animate) ? '1' : undefined}
      // Esc и клик по подложке — оба закрывают, и оба должны сбросить состояние
      onClose={() => at() !== null && close()}
      onCancel={(ev) => {
        ev.preventDefault()
        close()
      }}
    >
      <Show when={item()}>
        {(cur) => (
          <>
            <div
              class="dumb-lightbox-stage"
              data-drag={dragging() ? '1' : undefined}
              onWheel={onWheel}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              // клик по пустому месту закрывает, по картинке — нет
              onClick={(ev) => ev.target === ev.currentTarget && close()}
            >
              <img
                class="dumb-lightbox-img"
                src={cur().url}
                alt={cur().title ?? ''}
                draggable={false}
                style={{
                  transform: `translate(${pan().x}px, ${pan().y}px) scale(${zoom()})`,
                }}
                onDblClick={() => (zoom() === 1 ? setZoom(2.5) : reset())}
              />
            </div>

            <div
              class="dumb-lightbox-bar flex items-center gap-3 p-3 text-sm text-white"
              data-at="top"
            >
              <Show when={side() === 'left'}>{closeButton()}</Show>
              <span class="dumb-lightbox-title min-w-0 flex-1 truncate">{cur().title}</span>
              <Show when={props.items.length > 1}>
                <span class="dumb-lightbox-count tabular-nums">
                  {(at() ?? 0) + 1} / {props.items.length}
                </span>
              </Show>
              <Show when={zoom() !== 1}>
                <button type="button" class="btn btn-sm btn-neutral" onClick={reset}>
                  1:1
                </button>
              </Show>
              <Show when={side() === 'right'}>{closeButton()}</Show>
            </div>

            <Show when={props.items.length > 1}>
              <button
                type="button"
                class="dumb-lightbox-nav btn btn-circle btn-neutral text-xl"
                data-side="prev"
                title="предыдущая (←)"
                onClick={() => go(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                class="dumb-lightbox-nav btn btn-circle btn-neutral text-xl"
                data-side="next"
                title="следующая (→)"
                onClick={() => go(1)}
              >
                ›
              </button>
            </Show>

            <Show when={props.actions}>
              <div
                class="dumb-lightbox-bar flex items-center justify-center gap-3 p-3 text-sm text-white"
                data-at="bottom"
              >
                {props.actions!(cur(), at() ?? 0)}
              </div>
            </Show>
          </>
        )}
      </Show>
    </dialog>
  )
}
