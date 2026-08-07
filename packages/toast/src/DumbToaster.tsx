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
import {
  createFlip,
  injectStyle,
  onMounted,
  resolveCloseSide,
  shouldAnimate,
  type CloseSideOption,
} from '@solid-dumb-kit/shared'
import { toast as globalBus, type Toast, type ToastBus } from './toast'
import { ToastBody, ToastIcon } from './toastLook'

export type DumbToasterProps = {
  /** своя шина; не задана — общая */
  bus?: ToastBus
  /** где показывать; по умолчанию снизу справа */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center'
  /**
   * Больше стольких сразу не показывать; по умолчанию 6. Остальные ждут в
   * очереди и всплывают по мере того, как гаснут предыдущие.
   */
  max?: number
  /**
   * С какой стороны крестик. По умолчанию решает платформа: в macOS слева, в
   * Windows и Linux справа.
   */
  closeSide?: CloseSideOption
  /**
   * Анимировать: въезд плашки, улёт в историю и доводку соседей на
   * освободившееся место. Не задано — да, но молча выключается при системном
   * prefers-reduced-motion.
   */
  animate?: boolean
  /** своя плашка */
  children?: (t: Toast, dismiss: () => void) => JSX.Element
  class?: string
}

/**
 * Просвет между плашками. Числом, а не только в CSS: на него же сдвигаются
 * соседи, когда одна из плашек уходит, — см. `settle` ниже.
 */
const GAP = 20

const STYLES = `
  /* Здесь ТОЛЬКО структура: popover по умолчанию сжимается в точку и стоит по
     центру — растягиваем на всё окно и делаем прозрачным для кликов, кроме
     самих плашек. Вид плашки — daisyUI (alert), см. разметку ниже. */
  .dumb-toaster { position: fixed; inset: 0; width: 100%; height: 100%;
                  margin: 0; padding: 16px; border: 0; background: none; overflow: visible;
                  display: flex; flex-direction: column; gap: ${GAP}px;
                  pointer-events: none }
  .dumb-toaster::backdrop { background: none }
  .dumb-toaster[data-at$="right"] { align-items: flex-end }
  .dumb-toaster[data-at$="left"] { align-items: flex-start }
  .dumb-toaster[data-at$="center"] { align-items: center }
  .dumb-toaster[data-at^="top"] { justify-content: flex-start }
  /* column-reverse переворачивает главную ось, поэтому к НИЖНЕМУ краю прижимает
     flex-start, а не flex-end: с flex-end стопка «снизу справа» висела вверху */
  .dumb-toaster[data-at^="bottom"] { justify-content: flex-start; flex-direction: column-reverse }

  /* Плашка ловит клики, хотя контейнер их пропускает насквозь. position и
     запас сверху — под крестик: он висит кружком НА УГЛУ карточки, наполовину
     снаружи, как в системных уведомлениях, и без запаса его срезал бы край
     контейнера. Вид карточки — daisyUI в разметке, см. toastLook.tsx. */
  .dumb-toast { pointer-events: auto; position: relative;
                /* ширина ОДНА на все плашки: разнокалиберная стопка выглядит
                   мусором, а системные уведомления как раз одинаковы. Плашка у
                   курсора ниже переопределяет — ей важнее не закрыть собой то,
                   про что спрашивают */
                width: min(92vw, 380px);
                /* свайп ведём сами, а вертикальную прокрутку страницы под
                   пальцем оставляем браузеру */
                touch-action: pan-y;
                /* Возврат недотянутой плашки на место. Переход висит ПОСТОЯННО
                   и выключается на время жеста: назначенный в одном кадре с
                   изменением transform он бы просто не запустился, и плашка
                   прыгнула бы обратно. */
                transition: transform .18s cubic-bezier(.2, .8, .2, 1), opacity .18s ease-out;
                animation: dumb-toast-in .16s ease-out }
  .dumb-toast[data-swipe="1"] { transition: none }
  /* Крестик — на углу карточки, чуть снаружи, и появляется при наведении, как в
     macOS: висящий кружок на каждой плашке в стопке из шести — это шесть лишних
     пятен.

     Правилу репы про невидимые ручки это не противоречит, потому что закрыть
     плашку есть чем и без него: мышью — наведение, пальцем — СВАЙП вбок (см.
     grab/drag/drop), клавиатурой — Tab, и тогда крестик проявляется по
     :focus-visible. Там, где наведения не бывает вовсе, он виден всегда. */
  .dumb-toast-close { position: absolute; top: -10px; z-index: 1; opacity: 0;
                      transition: opacity .12s ease-out }
  .dumb-toast-close[data-side="left"] { left: -10px }
  .dumb-toast-close[data-side="right"] { right: -10px }
  .dumb-toast:hover .dumb-toast-close,
  .dumb-toast:focus-within .dumb-toast-close,
  .dumb-toast-close:focus-visible { opacity: 1 }
  @media (hover: none) { .dumb-toast-close { opacity: 1 } }
  @media (prefers-reduced-motion: reduce) { .dumb-toast-close { transition: none } }

  /* УЛЁТ В ИСТОРИЮ. Погасшая плашка не исчезает на месте, а уезжает к краю, где
     живёт центр уведомлений, — видно, КУДА она делась и где её потом искать.
     Двигаем только transform и opacity: обе на compositor, layout не трогаем.
     Кликов улетающая плашка уже не ловит — по ней целятся мимо. */
  .dumb-toast-leave { pointer-events: none;
                      animation: dumb-toast-out .26s cubic-bezier(.4, 0, 1, 1) forwards }
  .dumb-toaster[data-fly="left"] .dumb-toast-leave { animation-name: dumb-toast-out-left }
  @keyframes dumb-toast-out { to { opacity: 0; transform: translateX(115%) scale(.86) } }
  @keyframes dumb-toast-out-left { to { opacity: 0; transform: translateX(-115%) scale(.86) } }

  /* плашка У КУРСОРА: тот же приём, что у контекстного меню — невидимый якорь
     в точке и привязка к нему, сторону выбирает браузер */
  .dumb-toast-anchor { position: fixed; width: 1px; height: 1px; pointer-events: none;
                       anchor-name: --dumb-toast-at }
  .dumb-toast-at { position: fixed; margin: 0; overflow: visible;
                   width: max-content; max-width: min(92vw, 380px);
                   /* UA даёт [popover] inset: 0; без сброса flip-inline у края
                      меняет наш anchor() местами с этим нулём, и плашка
                      прыгает к левому краю окна */
                   right: auto; bottom: auto;
                   position-anchor: --dumb-toast-at;
                   top: anchor(--dumb-toast-at bottom);
                   left: anchor(--dumb-toast-at right);
                   position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline }
  .dumb-toast-at::backdrop { background: none }

  @keyframes dumb-toast-in { from { opacity: 0; transform: translateY(6px) } }
  /* системная настройка сильнее вкуса: и въезд, и улёт гасим */
  @media (prefers-reduced-motion: reduce) {
    .dumb-toast { animation: none; transition: none }
    .dumb-toast-leave { display: none }
  }
`

/**
 * Карточка уведомления — стекло со скруглением, как в macOS. Цвет вида несёт
 * значок, а не вся плашка: залитая красным полоса перекрикивает соседние
 * сообщения и в стопке из пяти читается хуже, чем один красный значок.
 */
const cardClass =
  'card flex-row items-start gap-3 rounded-2xl border border-base-300 bg-base-100/80 p-3 shadow-lg backdrop-blur-xl'

/** класс кнопки внутри плашки: главное действие заметно, опасное красное */
const actionClass = (kind?: string) =>
  kind === 'primary' ? 'btn btn-sm' : kind === 'danger' ? 'btn btn-sm btn-error' : 'btn btn-sm btn-ghost'

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
    // летящие считаем наравне с живыми: иначе слой погаснет ровно в тот кадр,
    // когда должен показать полёт последней плашки
    const n = shown().length + flying().length
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
    const max = props.max ?? 6
    // показываем последние: свежее важнее, а очередь всё равно рассосётся
    return all.length > max ? all.slice(-max) : all
  }

  /**
   * Погасшие, но ещё летящие в историю. Они уже не в очереди и через `leaveMs`
   * исчезают сами.
   */
  const flying = () => {
    tick()
    return bus().leaving().filter((t) => !t.at)
  }

  /**
   * Стопка целиком: живые плашки и улетающие ВПЕРЕМЕШКУ, по порядку появления
   * (`id` растёт монотонно).
   *
   * Улетающая обязана остаться НА СВОЁМ МЕСТЕ. Когда она рисовалась отдельным
   * блоком, уход плашки из середины стопки перекладывал весь список: она
   * прыгала к краю, а соседи — следом за ней. Это и было то самое дёрганье;
   * анимация улёта тут ни при чём.
   */
  const rows = () =>
    [...stacked(), ...flying()].sort((a, b) => a.id - b.id)
  const isLeaving = (t: Toast) => flying().some((x) => x.id === t.id)

  /** плашки у курсора идут ОТДЕЛЬНО от стопки: у каждой своё место */
  const stacked = () => shown().filter((t) => !t.at)
  const anchored = () => shown().filter((t) => t.at)

  /** в какую сторону улетать: к своему краю, там же висит центр уведомлений */
  const fly = () => ((props.position ?? 'bottom-right').endsWith('left') ? 'left' : 'right')

  /**
   * ДОВОДКА СОСЕДЕЙ. Плашка исчезла — её место схлопывается мгновенно, и вся
   * стопка прыгает. Лечится классическим FLIP: соседи стартуют со старого места
   * и доезжают до нового `transform`-ом (`createFlip`, Web Animations).
   *
   * Насколько ехать, знаем БЕЗ ЗАМЕРА В МОМЕНТ УХОДА: высота каждой плашки
   * снимается заранее, при её появлении, через IntersectionObserver — его
   * `boundingClientRect` браузер считает сам, вне главного потока. Синхронный
   * `getBoundingClientRect` тут был бы forced layout ровно в кадре, где и так
   * идут две анимации.
   */
  const flip = createFlip(shouldAnimate(props.animate))
  /** id → элемент плашки, живёт ровно пока она в DOM */
  const els = new Map<number, HTMLElement>()
  /** id → высота, снятая наблюдателем при появлении */
  const heights = new Map<number, number>()

  const sizer = typeof IntersectionObserver === 'undefined'
    ? null
    : new IntersectionObserver((entries) => {
        for (const e of entries) {
          const id = Number((e.target as HTMLElement).dataset.toastId)
          const h = e.boundingClientRect.height
          // до показа popover высоты нет — такую порцию пропускаем
          if (id && h) heights.set(id, h)
        }
      })
  onCleanup(() => sizer?.disconnect())

  const hold = (id: number, el: HTMLElement) => {
    els.set(id, el)
    sizer?.observe(el)
    onCleanup(() => {
      els.delete(id)
      sizer?.unobserve(el)
    })
  }

  /**
   * Кто где стоял в прошлый раз — в порядке DOM. Улетающие идут первыми, они и
   * лежат с того края, к которому прижата стопка.
   */
  let prevRows: Array<Toast> = []
  createEffect(() => {
    const now = rows()
    const alive = new Set(now.map((t) => t.id))
    // сколько места освободилось ВЫШЕ по стопке — накапливаем, идя по прошлому
    // порядку: каждой уцелевшей плашке достаётся сумма ушедших перед ней
    let freed = 0
    const moved: Array<[number, number]> = []
    for (const t of prevRows) {
      if (!alive.has(t.id)) {
        freed += (heights.get(t.id) ?? 0) + GAP
        heights.delete(t.id)
      } else if (freed) {
        moved.push([t.id, freed])
      }
    }
    prevRows = now
    if (!moved.length) return
    // Знак: снизу стопка растёт вверх, значит соседи съезжают ВНИЗ, и стартовать
    // им надо с точки выше новой — то есть с отрицательного смещения.
    const dir = (props.position ?? 'bottom-right').startsWith('bottom') ? -1 : 1
    for (const [id, dy] of moved) {
      const el = els.get(id)
      if (el) flip.nudge(el, 0, dir * dy)
    }
  })

  /**
   * СВАЙП — смахнуть плашку вбок. Пальцем это единственный способ её закрыть:
   * крестик появляется по наведению, а наведения на тач-устройствах нет.
   * Мышью работает так же — привычка из телефонов давно общая.
   *
   * Ни одного замера: тянем `transform`, порог считаем по пройденному
   * расстоянию (координаты события — не раскладка элементов). Отпустили за
   * порогом — зовём `dismiss`, а inline-трансформ НЕ снимаем: у анимации улёта
   * задан только кадр `to`, начальный браузер берёт из текущего стиля, и
   * плашка продолжит движение ровно оттуда, где её отпустили.
   */
  const SWIPE_START = 6                      // пока не сдвинулись на столько — это клик
  const SWIPE_DROP = 72                      // дальше этого — закрываем
  const SWIPE_FADE = 240                     // на таком удалении плашка почти прозрачна

  /** какую плашку тянут и насколько; null — жеста нет */
  const [swipe, setSwipe] = createSignal<{ id: number; from: number; dx: number } | null>(null)

  /** насколько сдвинута ЭТА плашка; до порога — ноль, чтобы клик не дрожал */
  const shift = (t: Toast) => {
    const s = swipe()
    if (!s || s.id !== t.id || Math.abs(s.dx) < SWIPE_START) return 0
    return s.dx
  }
  const dragging = (t: Toast) => {
    const s = swipe()
    return !!s && s.id === t.id
  }

  const grab = (t: Toast, ev: PointerEvent) => {
    if (ev.button !== 0) return
    // кнопки внутри плашки жест не начинают: по ним целятся, а не тянут
    if ((ev.target as HTMLElement).closest('button')) return
    // единственный императивный вызов, и он не про подписку: без захвата
    // указателя события перестают приходить, едва палец сойдёт с плашки
    ;(ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId)
    bus().pause()                            // под пальцем сообщение не уезжает
    setSwipe({ id: t.id, from: ev.clientX, dx: 0 })
  }

  const drag = (t: Toast, ev: PointerEvent) => {
    const s = swipe()
    if (!s || s.id !== t.id) return
    setSwipe({ ...s, dx: ev.clientX - s.from })
  }

  const drop = (t: Toast) => {
    const s = swipe()
    if (!s || s.id !== t.id) return
    bus().resume()
    if (Math.abs(s.dx) > SWIPE_DROP) {
      // Сдвиг НЕ сбрасываем: у анимации улёта задан только кадр `to`, начальный
      // браузер берёт из текущего стиля — плашка продолжит движение ровно
      // оттуда, где её отпустили, вместо прыжка в исходную точку.
      bus().dismiss(t.id)
      return
    }
    // не дотянули — плашка едет обратно сама: сдвиг стал нулём, а переход на
    // неё уже навешен стилями (во время жеста он выключен атрибутом)
    setSwipe(null)
  }

  /** сторона крестика: проп, общая настройка приложения или платформа */
  const side = () => resolveCloseSide(props.closeSide)
  const closeButton = (t: Toast) => (
    <button
      type="button"
      class="dumb-toast-close btn btn-xs btn-circle btn-neutral shadow"
      data-side={side()}
      title="закрыть"
      onClick={() => bus().dismiss(t.id)}
    >
      ✕
    </button>
  )

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
      data-fly={fly()}
      // курсор на плашке — таймеры стоят: текст не уезжает из-под чтения
      onMouseEnter={() => bus().pause()}
      onMouseLeave={() => bus().resume()}
    >
      <For each={rows()}>
        {(t) =>
          props.children?.(t, () => bus().dismiss(t.id)) ?? (
            <div
              ref={(el) => hold(t.id, el)}
              class={`dumb-toast ${cardClass} ${isLeaving(t) ? 'dumb-toast-leave' : ''}`}
              data-toast-id={t.id}
              data-kind={t.kind}
              aria-hidden={isLeaving(t) ? 'true' : undefined}
              role={t.kind === 'error' ? 'alert' : 'status'}
              // Свайп — обычными обработчиками JSX: указатель захвачен на
              // pointerdown, поэтому move и up приходят сюда же, даже когда
              // палец ушёл с плашки. Вешать/снимать слушатели руками не нужно.
              // Улетающую тянуть уже некуда: она закрыта и просто доигрывает.
              onPointerDown={(ev) => !isLeaving(t) && grab(t, ev)}
              onPointerMove={(ev) => drag(t, ev)}
              onPointerUp={() => drop(t)}
              onPointerCancel={() => drop(t)}
              style={{
                transform: shift(t) ? `translateX(${shift(t)}px)` : undefined,
                opacity: shift(t)
                  ? String(Math.max(0.15, 1 - Math.abs(shift(t)) / SWIPE_FADE))
                  : undefined,
              }}
              data-swipe={dragging(t) ? '1' : undefined}
            >
              {/* у вопроса крестика нет: закрыть, не ответив, — это неявный
                  ответ, и какой именно, никто не знает. У улетающей его тоже
                  нет: она уже закрыта */}
              <Show when={t.closable && !isLeaving(t)}>{closeButton(t)}</Show>
              <ToastIcon t={t} />
              <ToastBody t={t} />
              <For each={t.actions ?? []}>
                {(a) => (
                  <button
                    type="button"
                    class={actionClass(a.kind)}
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

      /**
       * Клик мимо и Esc закрывают — как у любого всплывающего окна. Для вопроса
       * это отказ: шина зовёт `onDismiss`, и `confirm` разрешается в `false`.
       *
       * popover="manual" световой отбой не делает сам (и хорошо: закрывать
       * стопку сообщений случайным кликом никто не просил) — вешаем свой, но
       * только на плашку У КУРСОРА, которая и ведёт себя как окно.
       */
      const away = (ev: PointerEvent) => {
        if (!el?.contains(ev.target as Node)) bus().dismiss(p.t.id)
      }
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key !== 'Escape') return
        ev.preventDefault()
        bus().dismiss(p.t.id)
      }
      window.addEventListener('pointerdown', away, true)
      window.addEventListener('keydown', onKey)

      onCleanup(() => {
        window.removeEventListener('pointerdown', away, true)
        window.removeEventListener('keydown', onKey)
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
          class={`dumb-toast dumb-toast-at ${cardClass}`}
          data-kind={p.t.kind}
          role={p.t.kind === 'error' ? 'alert' : 'status'}
        >
          <Show when={p.t.closable}>{closeButton(p.t)}</Show>
          <ToastIcon t={p.t} />
          <ToastBody t={p.t} />
          <For each={p.t.actions ?? []}>
            {(a) => (
              <button
                type="button"
                class={actionClass(a.kind)}
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
        </div>
      </>
    )
  }
}
