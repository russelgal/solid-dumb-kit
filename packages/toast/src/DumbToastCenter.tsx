// Центр уведомлений — панель у края экрана, куда улетают погасшие плашки.
//
// ЗАЧЕМ. Тост живёт пять секунд, а прочитать его успевают не всегда: отошёл,
// переключил вкладку, смотрел в другую часть экрана. В macOS это решено
// центром уведомлений — всплывшее не пропадает, а складывается в список
// справа. Здесь так же: `DumbToaster` провожает плашку улётом к краю, а она
// оседает тут.
//
// ГДЕ ЖИВЁТ. Панель — в TOP LAYER через Popover API, как тостер и меню кита:
// поверх всего, включая открытый `<dialog>`, её не режет `overflow` предков и
// ей не нужен `z-index`. Но ТОЛЬКО пока она открыта — закрыли, и слой пуст.
//
// А вот колокольчик в top layer НЕ живёт, хотя соблазн был. Top layer — место
// для того, что открыли и закроют; кнопка же висит всё время работы
// приложения, и постоянный жилец там только мешает: в отладчике `#top-layer`
// вечно непустой, а перекрыть модалку кнопка всё равно не должна — пока окно
// открыто, клик туда уходить не обязан.
//
// БЕЗ ЗАМЕРОВ. Панель прижата к краю окна обычным `position: fixed`, выезд —
// `transform`. Ни одного `getBoundingClientRect`.

import { For, Show, createSignal, onCleanup, type JSX } from 'solid-js'
import { effect, injectStyle, onMounted, resolveCloseSide, shouldAnimate, type CloseSideOption } from '@solid-dumb-kit/shared'
import { toast as globalBus, type Toast, type ToastBus } from './toast'
import { ToastBody, ToastIcon } from './toastLook'

export type DumbToastCenterProps = {
  /** своя шина; не задана — общая */
  bus?: ToastBus
  /** у какого края; по умолчанию справа, как в macOS */
  side?: 'right' | 'left'
  /** заголовок панели */
  title?: string
  /** рисовать ли кнопку-колокольчик; не нужна — открывай `toast.showHistory()` */
  bell?: boolean
  /** анимировать выезд; не задано — да, но с оглядкой на prefers-reduced-motion */
  animate?: boolean
  /** сторона крестиков; по умолчанию по платформе: macOS слева, иначе справа */
  closeSide?: CloseSideOption
  /** своя строка истории */
  children?: (t: Toast, forget: () => void) => JSX.Element
  class?: string
}

const STYLES = `
  /* Панель. Здесь только структура и механика: вид — daisyUI в разметке.
     popover по умолчанию центрируется и сжимается по содержимому — растягиваем
     на всю высоту и прижимаем к краю. */
  .dumb-center { position: fixed; top: 0; bottom: 0; margin: 0; border: 0; padding: 0;
                 /* height, а не пара top/bottom: у popover от UA height: fit-content,
                    и при заданных top+bottom спор решается в пользу height —
                    панель съёживается по содержимому вместо полной высоты */
                 width: min(92vw, 380px); height: 100%; overflow: visible;
                 display: flex; flex-direction: column }
  /* Скрытый popover браузер прячет сам (display: none), но это UA-стиль, а наш
     display: flex — авторский: он перебивает по каскаду, и панель висела бы на
     экране с самой загрузки. Гасим явно. */
  .dumb-center:not(:popover-open) { display: none }
  .dumb-center[data-side="right"] { right: 0; left: auto }
  .dumb-center[data-side="left"] { left: 0; right: auto }
  .dumb-center::backdrop { background: none }
  /* выезд: только transform, layout не трогаем */
  .dumb-center[data-animate="1"] { animation: dumb-center-in .18s ease-out }
  .dumb-center[data-side="left"][data-animate="1"] { animation-name: dumb-center-in-left }
  @keyframes dumb-center-in { from { transform: translateX(100%) } }
  @keyframes dumb-center-in-left { from { transform: translateX(-100%) } }

  /* Список прокручивается, шапка стоит на месте. Отступы по бокам — под
     крестик: он висит НА УГЛУ карточки, наполовину снаружи, и без запаса его
     срезала бы прокручиваемая область. */
  .dumb-center-list { overflow-y: auto; overscroll-behavior: contain; flex: 1 }
  /* Крестик появляется по наведению — как во всплывающей плашке и как в macOS:
     полсотни кружков в списке истории были бы шумом. Где наведения не бывает
     (тач), он виден всегда; с клавиатуры проявляется по :focus-visible. */
  .dumb-center-forget { position: absolute; top: -8px; z-index: 1; opacity: 0;
                        transition: opacity .12s ease-out }
  .dumb-center-forget[data-side="left"] { left: -8px }
  .dumb-center-forget[data-side="right"] { right: -8px }
  .dumb-center-item:hover .dumb-center-forget,
  .dumb-center-item:focus-within .dumb-center-forget,
  .dumb-center-forget:focus-visible { opacity: 1 }
  @media (hover: none) { .dumb-center-forget { opacity: 1 } }
  @media (prefers-reduced-motion: reduce) { .dumb-center-forget { transition: none } }

  /* Колокольчик — ОБЫЧНЫЙ fixed-элемент, а НЕ popover.

     Соблазн был: в top layer он всегда поверх всего. Но top layer — это место
     для того, что открыли и закроют, а колокольчик висит всё время работы
     приложения, и постоянный жилец там мешает всем: любое окно, открытое
     позже, всё равно ляжет выше, зато сам он в отладчике вечно торчит в
     #top-layer, и понять, кто там лишний, становится нечем.

     Перекрывать модалку ему и не нужно: пока открыто окно, кнопка уведомлений
     — не то, куда должен уходить клик. z-index берётся переменной: у чужой
     шапки он может быть выше, и это дело потребителя. */
  .dumb-center-bell { position: fixed; top: 12px; z-index: var(--dumb-center-bell-z, 40) }
  .dumb-center-bell[data-side="right"] { right: 12px; left: auto }
  .dumb-center-bell[data-side="left"] { left: 12px; right: auto }
`

/**
 * «5 мин», «2 ч», «вчера». Считается от переданного «сейчас», а не от
 * `Date.now()` внутри: панель обновляет время раз в полминуты одним сигналом,
 * а не каждой строкой по своему таймеру.
 */
export function ago(time: number, now: number): string {
  const sec = Math.max(0, Math.round((now - time) / 1000))
  if (sec < 45) return 'только что'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} мин`
  const hour = Math.round(min / 60)
  if (hour < 24) return `${hour} ч`
  const day = Math.round(hour / 24)
  return day === 1 ? 'вчера' : `${day} дн`
}

export function DumbToastCenter(props: DumbToastCenterProps) {
  injectStyle('toast-center', STYLES)

  const bus = () => props.bus ?? globalBus
  // шина живёт вне реактивности — «будильник» и есть мост до разметки
  const [tick, bump] = createSignal(0, { equals: false })
  const [now, setNow] = createSignal(Date.now())

  let panel!: HTMLDivElement
  let bell!: HTMLDivElement

  const side = () => props.side ?? 'right'
  /** сторона крестиков: проп, общая настройка приложения или платформа */
  const closeAt = () => resolveCloseSide(props.closeSide)
  const open = () => (tick(), bus().historyOpen())
  const items = () => (tick(), bus().history())
  const unread = () => (tick(), bus().unread())

  onMounted(() => {
    const off = bus().subscribe(() => bump(0))
    // Esc закрывает — панель popover="manual", световой отбой браузер не делает
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && bus().historyOpen()) {
        ev.preventDefault()
        bus().hideHistory()
      }
    }
    // клик мимо панели и мимо колокольчика тоже закрывает
    const away = (ev: PointerEvent) => {
      if (!bus().historyOpen()) return
      const t = ev.target as Node
      if (panel?.contains(t) || bell?.contains(t)) return
      bus().hideHistory()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', away, true)
    onCleanup(() => {
      off()
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', away, true)
      if (panel?.matches(':popover-open')) panel.hidePopover()
    })
  })

  /**
   * Пока панель открыта, «5 мин» должно становиться «6 мин» само. Полминуты —
   * шаг, при котором подпись не врёт и таймер не будит вкладку зря; закрытая
   * панель не тикает вовсе.
   */
  effect(() => {
    if (!open()) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 30_000)
    onCleanup(() => clearInterval(id))
  })

  effect(() => {
    const show = open()
    queueMicrotask(() => {
      if (!panel) return
      if (show && !panel.matches(':popover-open')) panel.showPopover?.()
      if (!show && panel.matches(':popover-open')) panel.hidePopover()
    })
  })

  // Кнопки живут функциями: каждая рисуется в одном из двух мест разметки —
  // слева или справа, — и копировать её вёрстку ради этого незачем.
  const closeButton = () => (
    <button
      type="button"
      class="btn btn-sm btn-ghost btn-circle"
      aria-label="закрыть"
      onClick={() => bus().hideHistory()}
    >
      ✕
    </button>
  )
  const forgetButton = (t: Toast) => (
    <button
      type="button"
      class="dumb-center-forget btn btn-xs btn-circle btn-neutral shadow"
      data-side={closeAt()}
      aria-label="убрать"
      onClick={() => bus().forget(t.id)}
    >
      ✕
    </button>
  )

  return (
    <>
      {/* при открытой панели колокольчик убираем: она стоит ровно на его месте,
          а закрыть её есть чем — крестиком, Esc и кликом мимо */}
      <Show when={props.bell !== false && !open()}>
        <div ref={bell} class="dumb-center-bell" data-side={side()}>
          <button
            type="button"
            class="btn btn-circle btn-neutral shadow-lg"
            aria-label={`Уведомления${unread() ? `: непрочитанных ${unread()}` : ''}`}
            aria-expanded={open()}
            onClick={() => bus().toggleHistory()}
          >
            {/* Своих иконок кит не несёт — рисуем колокол текстом. Нужна
                иконка набора — потребитель кладёт свою кнопку и зовёт
                toast.toggleHistory(), а колокольчик выключает пропом. */}
            <span class="text-lg leading-none" aria-hidden="true">
              🔔
            </span>
            <Show when={unread() > 0}>
              <span class="badge badge-sm badge-error absolute -right-1 -top-1 tabular-nums">
                {unread()}
              </span>
            </Show>
          </button>
        </div>
      </Show>

      <div
        ref={panel}
        popover="manual"
        class={`dumb-center bg-base-100 border-base-300 shadow-2xl ${
          side() === 'right' ? 'border-l' : 'border-r'
        } ${props.class ?? ''}`}
        data-side={side()}
        data-animate={shouldAnimate(props.animate) ? '1' : '0'}
        role="region"
        aria-label={props.title ?? 'Уведомления'}
      >
        <div class="flex items-center gap-2 border-b border-base-300 p-3">
          <Show when={closeAt() === 'left'}>{closeButton()}</Show>
          <h2 class="flex-1 font-semibold">{props.title ?? 'Уведомления'}</h2>
          <Show when={items().length > 0}>
            {/* очистили — читать больше нечего, поэтому панель сразу уходит:
                смотреть на пустой список никто не просил */}
            <button
              type="button"
              class="btn btn-sm btn-ghost"
              onClick={() => {
                bus().clearHistory()
                bus().hideHistory()
              }}
            >
              Очистить
            </button>
          </Show>
          <Show when={closeAt() === 'right'}>{closeButton()}</Show>
        </div>

        {/* px-4 и gap-3, а не p-3: крестик висит на углу карточки, наполовину
            снаружи, и в тесном списке его срезала бы прокручиваемая область, а
            соседняя карточка — накрыла бы */}
        <ul class="dumb-center-list flex flex-col gap-3 px-4 py-3">
          <Show
            when={items().length > 0}
            fallback={
              <li class="py-8 text-center text-sm text-base-content opacity-90">
                Пока ничего не приходило
              </li>
            }
          >
            <For each={items()}>
              {(t) =>
                props.children?.(t, () => bus().forget(t.id)) ?? (
                  <li
                    class="dumb-center-item card relative flex-row items-start gap-3 rounded-2xl border border-base-300 bg-base-100/80 p-3 shadow backdrop-blur-xl"
                    data-kind={t.kind}
                  >
                    {forgetButton(t)}
                    <ToastIcon t={t} size="sm" />
                    <ToastBody t={t} />
                    {/* время читаемое, а не серое по серому: правило контраста
                        кита запрещает text-base-content/60 и подобное */}
                    <span class="shrink-0 text-xs opacity-90 tabular-nums">{ago(t.time, now())}</span>
                  </li>
                )
              }
            </For>
          </Show>
        </ul>
      </div>
    </>
  )
}
