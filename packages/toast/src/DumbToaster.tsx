// Область, в которой видны сообщения. Рисует то, что лежит в шине.
//
// Живёт в TOP LAYER через Popover API (`popover="manual"`), а не в своём
// `position: fixed` с большим `z-index`. Разница видна ровно тогда, когда она
// нужна: сообщение об ошибке всплывает ПОВЕРХ открытого `<dialog>` — из
// модалки как раз чаще всего и приходят ошибки. Заодно снимается вечный спор
// за `z-index` с чужими шапками и меню.
//
// Стили структурные, инжектом; цвета — переменные с контрастными фолбэками:
// сообщение об ошибке обязано читаться в любой теме, а не сливаться с фоном.

// onMounted вместо onMount: в Solid 2 onMount не экспортируется (shared/solidCompat)
import { For, Show, createEffect, createSignal, onCleanup, type JSX } from 'solid-js'
import { injectStyle, onMounted } from '@solid-dumb-kit/shared'
import { toast as globalBus, type Toast, type ToastBus } from './toast'

export type DumbToasterProps = {
  /** своя шина; не задана — общая */
  bus?: ToastBus
  /** где показывать; по умолчанию снизу справа */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center'
  /** больше стольких сразу не показывать; по умолчанию 4 */
  max?: number
  /** своя плашка */
  children?: (t: Toast, dismiss: () => void) => JSX.Element
  class?: string
}

const STYLES = `
  /* popover по умолчанию сжимается в точку и стоит по центру — растягиваем на
     всё окно и делаем прозрачным для кликов, кроме самих плашек */
  .dumb-toaster { position: fixed; inset: 0; width: 100%; height: 100%;
                  margin: 0; padding: 16px; border: 0; background: none; overflow: visible;
                  display: flex; flex-direction: column; gap: 8px;
                  pointer-events: none }
  .dumb-toaster::backdrop { background: none }
  .dumb-toaster[data-at$="right"] { align-items: flex-end }
  .dumb-toaster[data-at$="left"] { align-items: flex-start }
  .dumb-toaster[data-at$="center"] { align-items: center }
  .dumb-toaster[data-at^="top"] { justify-content: flex-start }
  .dumb-toaster[data-at^="bottom"] { justify-content: flex-end; flex-direction: column-reverse }
  .dumb-toast { max-width: min(92vw, 420px) }

  .dumb-toast { pointer-events: auto; display: flex; align-items: center; gap: 10px;
                padding: 9px 12px; border-radius: 10px; font-size: 13px; line-height: 1.35;
                color: var(--dumb-toast-fg, #f8fafc);
                background: var(--dumb-toast-bg, #1e293b);
                box-shadow: 0 6px 20px rgb(0 0 0 / .18);
                animation: dumb-toast-in .16s ease-out }
  .dumb-toast[data-kind="success"] { background: var(--dumb-toast-ok, #15803d) }
  .dumb-toast[data-kind="error"] { background: var(--dumb-toast-bad, #b91c1c) }
  .dumb-toast-text { flex: 1; min-width: 0; overflow-wrap: anywhere }
  /* счётчик повторов: двадцать одинаковых ошибок — одна плашка с числом */
  .dumb-toast-count { flex: none; font-size: 11px; font-variant-numeric: tabular-nums;
                      padding: 1px 6px; border-radius: 999px; background: rgb(255 255 255 / .22) }
  .dumb-toast button { flex: none; font: inherit; color: inherit; cursor: pointer;
                       background: rgb(255 255 255 / .16); border: 0; border-radius: 6px;
                       padding: 3px 9px }
  .dumb-toast button:hover { background: rgb(255 255 255 / .28) }
  /* главное действие видно сразу, опасное — красным: по ним попадают наспех */
  .dumb-toast button[data-kind="primary"] { background: rgb(255 255 255 / .92);
                                            color: var(--dumb-toast-bg, #1e293b);
                                            font-weight: 600 }
  .dumb-toast button[data-kind="danger"] { background: var(--dumb-toast-bad, #b91c1c);
                                           color: #fff; font-weight: 600 }
  .dumb-toast button[data-kind="danger"]:hover { filter: brightness(1.12) }
  .dumb-toast-close { padding: 0 4px !important; background: none !important; opacity: .8 }

  /* плашка У КУРСОРА: тот же приём, что у контекстного меню — невидимый якорь
     в точке и привязка к нему, сторону выбирает браузер */
  .dumb-toast-anchor { position: fixed; width: 1px; height: 1px; pointer-events: none;
                       anchor-name: --dumb-toast-at }
  .dumb-toast-at { position: fixed; margin: 0; border: 0; padding: 9px 12px; overflow: visible;
                   max-width: min(92vw, 380px);
                   position-anchor: --dumb-toast-at;
                   top: anchor(--dumb-toast-at bottom);
                   left: anchor(--dumb-toast-at right);
                   position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline }
  .dumb-toast-at::backdrop { background: none }

  @keyframes dumb-toast-in { from { opacity: 0; transform: translateY(6px) } }
  /* системная настройка сильнее вкуса: въезд гасим */
  @media (prefers-reduced-motion: reduce) { .dumb-toast { animation: none } }
`

export function DumbToaster(props: DumbToasterProps) {
  injectStyle('toast', STYLES)

  const bus = () => props.bus ?? globalBus
  // сигнал-«будильник»: шина живёт вне реактивности, и перерисовку надо
  // запрашивать руками. `equals: false` — чтобы срабатывало и на то же число
  const [tick, bump] = createSignal(0, { equals: false })

  let box!: HTMLDivElement

  onMounted(() => {
    // шина живёт вне реактивности — подписка и есть мост
    const off = bus().subscribe(() => bump(0))
    onCleanup(() => {
      off()
      if (box?.matches(':popover-open')) box.hidePopover()
    })
  })

  /**
   * В top layer поднимаемся ТОЛЬКО когда есть что показать — и заново на каждое
   * новое сообщение.
   *
   * Причина не в чистоте DOM (хотя пустой слой на весь экран в отладчике
   * мозолит глаза), а в порядке: top layer — это стек, и кто вошёл позже, тот
   * выше. Висящий с самой загрузки тостер оказывается НИЖЕ модалки, открытой
   * потом, — то есть ровно там, где он не нужен: ошибки чаще всего и прилетают
   * из модалок. Перевсплытие ставит его обратно наверх.
   */
  let was = 0
  createEffect(() => {
    const n = shown().length
    if (!n) {
      if (box?.matches(':popover-open')) box.hidePopover()
    } else if (n !== was) {
      if (box?.matches(':popover-open')) box.hidePopover()
      box?.showPopover?.()
    }
    was = n
  })

  const shown = () => {
    tick()                                   // подписка на «будильник»
    const all = bus().list()
    const max = props.max ?? 4
    // показываем последние: свежее важнее, а очередь всё равно рассосётся
    return all.length > max ? all.slice(-max) : all
  }

  /** плашки у курсора идут ОТДЕЛЬНО от стопки: у каждой своё место */
  const stacked = () => shown().filter((t) => !t.at)
  const anchored = () => shown().filter((t) => t.at)

  /**
   * Где сейчас указатель. Нужен для `at: 'pointer'`; координаты события — не
   * раскладка элементов, читать их можно сколько угодно.
   */
  const [pointer, setPointer] = createSignal({ x: 0, y: 0 })
  onMounted(() => {
    const track = (ev: PointerEvent) => setPointer({ x: ev.clientX, y: ev.clientY })
    window.addEventListener('pointermove', track, { passive: true })
    window.addEventListener('pointerdown', track, { passive: true })
    onCleanup(() => {
      window.removeEventListener('pointermove', track)
      window.removeEventListener('pointerdown', track)
    })
  })
  const spotOf = (t: Toast) => (t.at === 'pointer' ? pointer() : (t.at as { x: number; y: number }))

  return (
    <div
      ref={box}
      popover="manual"
      class={`dumb-toaster ${props.class ?? ''}`}
      data-at={props.position ?? 'bottom-right'}
      // курсор на плашке — таймеры стоят: текст не уезжает из-под чтения
      onMouseEnter={() => bus().pause()}
      onMouseLeave={() => bus().resume()}
    >
      <For each={stacked()}>
        {(t) =>
          props.children?.(t, () => bus().dismiss(t.id)) ?? (
            <div class="dumb-toast" data-kind={t.kind} role={t.kind === 'error' ? 'alert' : 'status'}>
              <span class="dumb-toast-text">{t.text}</span>
              <Show when={t.count > 1}>
                <span class="dumb-toast-count">{t.count}</span>
              </Show>
              <For each={t.actions ?? []}>
                {(a) => (
                  <button
                    type="button"
                    data-kind={a.kind}
                    onClick={() => {
                      a.run?.()
                      if (!a.keepOpen) bus().dismiss(t.id)
                    }}
                  >
                    {a.label}
                  </button>
                )}
              </For>
              {/* у вопроса крестика нет: закрыть, не ответив, — это неявный
                  ответ, и какой именно, никто не знает */}
              <Show when={t.closable}>
                <button
                  type="button"
                  class="dumb-toast-close"
                  title="закрыть"
                  onClick={() => bus().dismiss(t.id)}
                >
                  ✕
                </button>
              </Show>
            </div>
          )
        }
      </For>
      <For each={anchored()}>{(t) => <AtToast t={t} />}</For>
    </div>
  )

  function AtToast(p: { t: Toast }) {
    let el!: HTMLDivElement
    // popover открываем ПОСЛЕ вставки: на элементе не в документе метод бросает
    onMounted(() => {
      queueMicrotask(() => el?.showPopover?.())
      onCleanup(() => {
        if (el?.matches(':popover-open')) el.hidePopover()
      })
    })
    const spot = spotOf(p.t)
    return (
      <>
        <div class="dumb-toast-anchor" style={{ left: `${spot.x}px`, top: `${spot.y}px` }} />
        <div
          ref={el}
          popover="manual"
          class="dumb-toast dumb-toast-at"
          data-kind={p.t.kind}
          role={p.t.kind === 'error' ? 'alert' : 'status'}
        >
          <span class="dumb-toast-text">{p.t.text}</span>
          <For each={p.t.actions ?? []}>
            {(a) => (
              <button
                type="button"
                data-kind={a.kind}
                onClick={() => {
                  a.run?.()
                  if (!a.keepOpen) bus().dismiss(p.t.id)
                }}
              >
                {a.label}
              </button>
            )}
          </For>
          <Show when={p.t.closable}>
            <button type="button" class="dumb-toast-close" onClick={() => bus().dismiss(p.t.id)}>
              ✕
            </button>
          </Show>
        </div>
      </>
    )
  }
}
