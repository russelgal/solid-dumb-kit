// Шахматка: строки-ресурсы × колонки-сутки, полосы событий.
//
// Номера по дням, залы по часам, люди по сменам — одна и та же сетка.
//
// ПОЧЕМУ ЗДЕСЬ НЕТ НИ ОДНОГО ЗАМЕРА. Место полосы вычисляется из дат:
// `left = сутки_от_начала × ширина_колонки`. Ширина колонки задана пропом, а не
// измерена. Значит и во время драга считаются только числа — на шахматке в год
// шириной это разница между «едет» и «дёргается».
//
// Единственное чтение DOM за жест — координаты сетки, и то один раз на старте,
// через `IntersectionObserver` (его `boundingClientRect` считается вне главного
// потока). Дальше указатель переводится в сутки арифметикой.
//
// Драг и ресайз идут по СНАПУ в сутки: полоса прыгает по дням, а не ползёт за
// курсором попиксельно. Так и бронируют — в сутках, а не в пикселях.

import { For, Show, createMemo, createSignal, onCleanup, type JSX } from 'solid-js'
import { effect, injectStyle, onMounted, restoreTextSelection, suppressTextSelection } from '@solid-dumb-kit/shared'
import { Temporal } from './temporal'
import type { Span } from './timelineMath'
import {
  clampEdge, columns, confined, conflicts, floorsPerRow, fromX, headGroups, lengthOf,
  minLength, momentX, moveTo, rowBounds, snapEdge, snapOf, stackFloors, toMinutes, toMoment,
  toX, totalCols,
  type Moment, type RowRules, type Scale,
} from './scale'

/** управление сеткой снаружи */
export type TimelineApi = {
  /** подвести дату (или момент) к левому краю */
  scrollTo: (at: Moment) => void
  /** подвести «сейчас» — то, что передано в `now`, иначе текущее время */
  scrollToNow: () => void
  /** какой диапазон сейчас виден */
  visibleRange: () => { from: Moment; to: Moment }
}

export type TimelineRow = RowRules & {
  id: string
  title: JSX.Element
  /** группа, в которую строка попадёт: этаж, корпус, отдел */
  group?: string
  /**
   * Чем торгует эта строка: сутками (номер) или часами (баня, пейнтбол).
   *
   * В одной шахматке они уживаются, и это нормально: у гостиницы с банями
   * ресурсы разные, а сетка одна. От типа зависит, что получится при выделении
   * пустого места — сутки с 16:00 до 12:00 или интервал в часах.
   */
  unit?: 'day' | 'hour'
}

export type DumbTimelineProps<S extends Span = Span> = {
  rows: Array<TimelineRow>
  spans: Array<S>
  /**
   * Готовая шкала ЦЕЛИКОМ — например, из `SCALES`:
   * `scale={SCALES.hotel(start, 30)}`. Раньше пресет приходилось раскладывать
   * на восемь плоских пропсов, а `first`/`days`/`colW` передавать дважды —
   * рассинхрон был вопросом времени.
   *
   * Плоские пропсы (`from`, `days`, `stepMin`, …) работают ПОВЕРХ шкалы как
   * оверрайды: удобно взять пресет и подменить одно поле.
   */
  scale?: Partial<Scale>
  /** первый день сетки и сколько дней показывать; побеждают `scale` */
  from?: string
  days?: number

  /**
   * Единица сетки. Сутки — частный случай, поэтому отдельного «режима» нет:
   *
   * - гостиница: `stepMin: 1440`, `checkIn: 960`, `checkOut: 720`;
   * - баня: `stepMin: 120`, окно `10:00…24:00`, зазор 30 мин;
   * - беседка: `stepMin: 60`, окно `12:00…23:00`.
   *
   * Готовые наборы лежат в `SCALES`.
   */
  stepMin?: number
  /** рабочее окно дня в минутах от полуночи; вне окна сетки нет */
  dayStart?: number
  dayEnd?: number
  /**
   * Шаг перемещения, мин. Не задан — равен колонке. В бане сетка почасовая
   * (по ней читают время), а сеанс продаётся по два часа — вот это и есть
   * `snapMin: 120` при `stepMin: 60`.
   */
  snapMin?: number
  /**
   * Зазор между соседями, мин. После бани полчаса на уборку: время формально
   * свободно, а ставить туда нельзя.
   */
  gapMin?: number
  /** самая короткая бронь на всей сетке, мин; у строки бывает своя (`minMin` строки) */
  minMin?: number

  /**
   * Перенесли или растянули. Применяет изменение ПОТРЕБИТЕЛЬ — у кита нет
   * своего состояния: не записал новые даты в `spans` (например, сервер
   * отказал) — полоса сама вернётся на место, потому что позиция всегда
   * считается из `spans`.
   *
   * `kind` говорит, что это было: перенос или растяжение за какой край —
   * «перенесено» и «продлено» для бизнеса разные события.
   */
  onChange?: (
    next: S,
    prev: S,
    kind: 'move' | 'resize-from' | 'resize-to',
  ) => void | boolean | Promise<void | boolean>
  /**
   * Клик по полосе. Вторым аргументом — точка клика: по ней карточку ставят
   * РЯДОМ с бронью, а не по центру экрана. Модалка посреди шахматки закрывает
   * ровно ту бронь, о которой рассказывает.
   */
  onOpen?: (span: S, at: { x: number; y: number }) => void
  /** клик по пустой клетке — обычно «создать» */
  onEmptyClick?: (at: Moment, row: string) => void
  /**
   * Протянули по пустому месту — обычно «создать на этот период».
   *
   * `needsTime` — предупреждение: строка почасовая, а сетка суточная, и точное
   * время из такого жеста не вытащить (в колонку шириной в сутки не прицелиться
   * в 14:00). Отдаём границы суток и честно говорим, что время надо уточнить
   * отдельно — спросив, а не угадав.
   */
  onRangeSelect?: (range: { row: string; from: Moment; to: Moment; needsTime: boolean }) => void

  /** ширина суток, px; по умолчанию 34 */
  colW?: number
  /** высота строки, px; по умолчанию 34 */
  rowH?: number
  /** ширина колонки с названиями, px; по умолчанию 200 */
  headW?: number

  /**
   * Во что превращать дату БЕЗ времени: час заезда и час выезда, в минутах от
   * полуночи. В гостинице это 16:00 и 12:00 — тогда в день пересменки видно обе
   * брони и щель между ними, а не «занятый» день выезда.
   */
  checkIn?: number
  checkOut?: number

  /** подпись колонки; не задана — число месяца или время */
  dayLabel?: (at: Moment) => JSX.Element
  /** подпись группы в верхнем ряду шапки; не задана — месяц или дата */
  groupLabel?: (at: Moment, span: number) => JSX.Element
  /**
   * Строка сводки над сеткой: сколько свободно, выручка за день — что угодно.
   * В системах бронирования она первая, и смотрят на неё чаще, чем на сами
   * брони.
   */
  summary?: (at: Moment) => JSX.Element
  /** заголовок сводки в левой колонке */
  summaryTitle?: JSX.Element
  /** момент «сейчас» для вертикальной линии; не задан — линии нет */
  now?: Moment
  /** пометить колонку: выходной, праздник, нерабочий час */
  dayClass?: (at: Moment) => string | undefined
  /** содержимое полосы; не задано — просто подпись */
  children?: (span: S) => JSX.Element
  /** не двигать и не растягивать — вся сетка целиком */
  readonly?: boolean

  /**
   * Полоса, которую нельзя трогать, при том что остальные можно.
   *
   * Ради этого проп и появился: в шахматке рядом с бронями живут БЛОКИ —
   * ремонт, санитарный день, закрытие на профилактику. Они занимают место, но
   * не двигаются мышью и правятся в другом месте. Хранить их отдельным
   * массивом нельзя: они участвуют в проверке занятости наравне с бронями.
   */
  spanLocked?: (span: S) => boolean
  /**
   * Класс на полосу. Через него красят СТАТУС (черновик, подтверждена, заезд
   * состоялся, отменена), помечают найденное поиском и подсвечивают групповую
   * бронь — одна компания на нескольких объектах.
   *
   * Именно класс, а не цвет пропом: статусов у каждого свои, и перечислять их
   * в ките значит навязывать чужую предметную область.
   */
  spanClass?: (span: S) => string | undefined
  /** подсказка при наведении на полосу */
  spanTitle?: (span: S) => string | undefined

  /**
   * Строка, в которой ничего нельзя создавать: объект закрыт, снят с продажи,
   * на консервации. Показывать её всё равно надо — иначе непонятно, куда делся
   * номер, — но выделение по ней не начинается.
   */
  rowDisabled?: (row: TimelineRow) => boolean
  /** класс на строку целиком: приглушить закрытую, выделить свою */
  rowClass?: (row: TimelineRow) => string | undefined

  /** правый клик по полосе: своё меню вместо браузерного */
  onSpanContextMenu?: (span: S, ev: MouseEvent) => void
  /** правый клик по пустому месту */
  onEmptyContextMenu?: (at: Moment, row: string, ev: MouseEvent) => void

  /**
   * Видимый диапазон изменился (прокрутили или сменили `from`/`days`).
   *
   * Нужен для догрузки: шахматка на год — это тысячи броней, и тянуть их все
   * ради экрана в тридцать дней незачем. Зовётся не чаще кадра.
   */
  onVisibleRange?: (range: { from: Moment; to: Moment }) => void

  /**
   * Управление снаружи: `api.scrollTo(day)` — подвести дату к левому краю,
   * `api.scrollToNow()` — к текущему моменту.
   *
   * Страница ресепшена висит открытой сутками, и «сегодня» на ней уезжает;
   * кнопка «Сегодня» — первое, чего от такой сетки ждут.
   */
  ref?: (api: TimelineApi) => void
  /**
   * Показывать, ДОКУДА можно продлить: при наведении справа от полосы
   * проступает хвост до ближайшего соседа (с учётом зазора на уборку).
   *
   * По умолчанию ВЫКЛЮЧЕНО. На суточной сетке свободного места обычно недели, и
   * хвост на пол-экрана только мешает смотреть на брони. Включать имеет смысл
   * там, где место дорого и вопрос «дают ещё на час?» задают постоянно, — в
   * почасовых сетках.
   */
  showRoom?: boolean

  class?: string
  style?: JSX.CSSProperties
}

const STYLES = `
  /* Оформление — daisyUI: цвета берутся из токенов темы (--color-primary,
     --color-base-*, --color-error), кнопки и поля в разметке идут классами.
     Здесь остаётся механика шахматки: сетка фоном, липкие колонки, полосы на
     transform и штриховка закрытых часов — классом этого не выразить. */
  .dumb-tl { position: relative; overflow: auto; overscroll-behavior: contain;
             color: var(--dumb-tl-fg, var(--color-base-content, #0f172a)); user-select: none;
             --dumb-tl-line: rgb(0 0 0 / .12) }
  .dumb-tl-inner { position: relative; display: grid;
                   grid-template-columns: var(--dumb-tl-head) 1fr }

  /* Шапка и левая колонка липкие. Обе на sticky, а не на своих слоях с
     синхронной прокруткой: у sticky нет рассинхрона на инерции. */
  .dumb-tl-corner { position: sticky; top: 0; left: 0; z-index: 3;
                    display: flex; align-items: flex-end; padding: 0 8px 3px;
                    font-size: 11px; color: var(--dumb-tl-dim, var(--color-base-content, #475569));
                    background: var(--dumb-tl-bg, var(--color-base-100, #fff));
                    border-right: 1px solid var(--dumb-tl-line);
                    border-bottom: 1px solid var(--dumb-tl-line) }
  .dumb-tl-sum-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
  /* заголовок группы строк: этажи, корпуса, категории */
  .dumb-tl-grouprow { display: flex; align-items: center; gap: 4px; width: 100%;
                      padding: 0 6px; border: 0; border-bottom: 1px solid var(--dumb-tl-line);
                      font: inherit; font-size: 12px; font-weight: 600; text-align: left;
                      cursor: pointer; color: inherit;
                      background: var(--dumb-tl-group-bg, var(--color-base-200, rgb(0 0 0 / .04))) }
  /* без opacity: элемент управления обязан читаться сразу (правило контраста) */
  .dumb-tl-fold { font-size: 9px }
  /* «сейчас»: тонкая линия поверх сетки, но под полосами */
  .dumb-tl-now { position: absolute; top: 0; bottom: 0; width: 2px; z-index: 1;
                 background: var(--dumb-tl-now, var(--color-primary, #2563eb)); pointer-events: none }
  /* выделение пустого места протяжкой: рамка с подписью «сколько выбрано» */
  .dumb-tl-pick { position: absolute; z-index: 3; border-radius: 6px; pointer-events: none;
                  display: flex; align-items: center; justify-content: center;
                  font-size: 11px; font-weight: 600; color: var(--dumb-tl-span-bg, var(--color-primary, #2563eb));
                  border: 2px dashed var(--dumb-tl-span-bg, var(--color-primary, #2563eb));
                  background: color-mix(in srgb, var(--dumb-tl-span-bg, var(--color-primary, #2563eb)) 12%, transparent) }
  .dumb-tl-head { position: sticky; top: 0; z-index: 2;
                  background: var(--dumb-tl-bg, var(--color-base-100, #fff));
                  border-bottom: 1px solid var(--dumb-tl-line) }
  .dumb-tl-groups { display: grid; border-bottom: 1px solid var(--dumb-tl-line) }
  .dumb-tl-group { font-size: 12px; font-weight: 600; text-align: center; padding: 3px 0;
                   border-left: 1px solid var(--dumb-tl-line);
                   overflow: hidden; white-space: nowrap; text-transform: capitalize }
  .dumb-tl-days { display: grid; background: var(--dumb-tl-bg, var(--color-base-100, #fff)) }
  .dumb-tl-summary { border-top: 1px solid var(--dumb-tl-line);
                     font-variant-numeric: tabular-nums;
                     color: var(--dumb-tl-dim, var(--color-base-content, #475569)) }
  .dumb-tl-day { font-size: 11px; text-align: center; padding: 3px 0; line-height: 1.15;
                 border-left: 1px solid var(--dumb-tl-line) }
  /* день недели мельче числа: он подсказка, а не главное. Вторичность — размером
     и цветом не светлее var(--dumb-tl-dim), а не полупрозрачностью */
  .dumb-tl-wd { display: block; font-size: 9px; color: var(--dumb-tl-dim, var(--color-base-content, #475569)) }
  .dumb-tl-rows { position: sticky; left: 0; z-index: 2;
                  background: var(--dumb-tl-bg, var(--color-base-100, #fff));
                  border-right: 1px solid var(--dumb-tl-line) }
  .dumb-tl-row { display: flex; align-items: center; padding: 0 8px; font-size: 13px;
                 border-bottom: 1px solid var(--dumb-tl-line); overflow: hidden;
                 text-overflow: ellipsis; white-space: nowrap }

  /* Сетка нарисована ФОНОМ, а не сотнями узлов: год по дням — это 365 колонок,
     и каждая своим div'ом стоила бы дороже всего остального вместе взятого. */
  /* Вертикали — фоном: колонок сотни, и каждая своим узлом стоила бы дороже
     всего остального. Горизонтали — узлами: строк десятки, зато они РАЗНОЙ
     высоты (строка растёт под этажи), а фон с фиксированным шагом этого не
     умеет. */
  /* Два слоя вертикалей: тонкие — колонки (часы), жирнее — стык суток. На
     суточной сетке оба слоя совпадают и рисуются цветом обычной линии. */
  .dumb-tl-canvas { position: relative;
                    background-image:
                      repeating-linear-gradient(to right, var(--dumb-tl-dayline) 0 1px,
                        transparent 1px var(--dumb-tl-day-w)),
                      repeating-linear-gradient(to right, var(--dumb-tl-line) 0 1px,
                        transparent 1px var(--dumb-tl-col)) }
  /* тик часовой линейки: день широкий, час — двузначная насечка */
  .dumb-tl-hh { font-size: 9px; letter-spacing: -0.3px }
  .dumb-tl-hline { position: absolute; left: 0; right: 0; height: 1px;
                   background: var(--dumb-tl-line); pointer-events: none }

  .dumb-tl-span { position: absolute; box-sizing: border-box; display: flex; align-items: center;
                  gap: 4px; padding: 0 6px; border-radius: 6px; font-size: 12px;
                  line-height: 1.2; overflow: hidden; white-space: nowrap; cursor: grab;
                  background: var(--dumb-tl-span-bg, var(--color-primary, #2563eb)); color: #fff;
                  will-change: transform }
  .dumb-tl-span[data-drag="1"] { cursor: grabbing; opacity: .85; z-index: 4 }
  /* заблокированная полоса: блок, ремонт, санитарный день */
  .dumb-tl-span[data-locked="1"] { cursor: default }
  /* Закрытая строка: видна, но ничего не создать. Название приглушается
     ЦВЕТОМ — прозрачность .55 уводила его к 3.5:1, а по названию строку ищут
     глазами. Что строка нерабочая, видно и без этого: канва заштрихована. */
  .dumb-tl-row[data-off="1"] { color: var(--dumb-tl-dim, var(--color-base-content, #475569)) }
  /* нельзя сюда — видно сразу, а не после отпускания */
  .dumb-tl-span[data-bad="1"] { background: var(--dumb-tl-bad, var(--color-error, #b91c1c)) }
  .dumb-tl-grip { position: absolute; top: 0; bottom: 0; width: 7px; cursor: ew-resize }
  .dumb-tl-grip[data-edge="from"] { left: 0 }
  .dumb-tl-grip[data-edge="to"] { right: 0 }
  /* ручку видно сразу: полоска у края, а не прозрачная зона на угадай */
  .dumb-tl-span:hover .dumb-tl-grip::before {
    content: ''; position: absolute; top: 25%; bottom: 25%; width: 2px; border-radius: 2px;
    background: rgb(255 255 255 / .85) }
  .dumb-tl-grip[data-edge="from"]::before { left: 2px }
  .dumb-tl-grip[data-edge="to"]::before { right: 2px }

  /* Закрытые часы строки: штриховка. Банкетный зал открыт с 14:00, и часы до
     того — не «свободно», а «не существует»; глазу это надо показать до того,
     как он попробует туда что-то поставить. */
  .dumb-tl-closed { position: absolute; pointer-events: none;
                    background: repeating-linear-gradient(45deg,
                      transparent 0 4px, var(--dumb-tl-closed, var(--color-base-300, rgb(0 0 0 / .1))) 4px 8px) }
  /* Зазор после брони: уборка бани, перезарядка пейнтбола. Время формально
     свободно, а ставить туда нельзя — вот и видно, ПОЧЕМУ сосед не встык. */
  .dumb-tl-gap { position: absolute; pointer-events: none; border-radius: 0 4px 4px 0;
                 border-right: 1px dashed rgb(0 0 0 / .35);
                 background: repeating-linear-gradient(45deg,
                   transparent 0 3px, rgb(0 0 0 / .25) 3px 5px) }
  /* сколько ещё свободно справа: видно при наведении, тянуть не обязательно */
  .dumb-tl-room { position: absolute; border-radius: 0 6px 6px 0; pointer-events: none;
                  border: 1px dashed var(--dumb-tl-span-bg, var(--color-primary, #2563eb));
                  border-left: 0; opacity: .55;
                  background: repeating-linear-gradient(45deg,
                    transparent 0 5px, var(--dumb-tl-span-bg, var(--color-primary, #2563eb)) 5px 6px) }
  .dumb-tl-room > b { position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
                      font-size: 10px; font-weight: 600; white-space: nowrap;
                      color: var(--dumb-tl-fg, var(--color-base-content, #0f172a)) }
`

export function DumbTimeline<S extends Span>(props: DumbTimelineProps<S>) {
  injectStyle('timeline', STYLES)

  const colW = () => props.colW ?? props.scale?.colW ?? 34
  const rowH = () => props.rowH ?? 34
  const headW = () => props.headW ?? 200
  const rowIds = createMemo(() => props.rows.map((r) => r.id))

  /**
   * Одна шкала на всё: и разметка, и жест считают по ней. Источник — проп
   * `scale` (пресет целиком), поверх — плоские оверрайды.
   */
  const scale = createMemo<Scale>(() => {
    const first = props.from ?? props.scale?.first
    // мусорная дата иначе взорвётся глубоко в Temporal без внятного виновника
    if (!first) throw new Error('DumbTimeline: нужен проп `from` или `scale.first`')
    return {
      first,
      days: props.days ?? props.scale?.days ?? 30,
      colW: colW(),
      dayStart: props.dayStart ?? props.scale?.dayStart ?? 0,
      dayEnd: props.dayEnd ?? props.scale?.dayEnd ?? 1440,
      stepMin: props.stepMin ?? props.scale?.stepMin ?? 1440,
      snapMin: props.snapMin ?? props.scale?.snapMin,
      minMin: props.minMin ?? props.scale?.minMin,
      checkIn: props.checkIn ?? props.scale?.checkIn,
      checkOut: props.checkOut ?? props.scale?.checkOut,
    }
  })
  const cols = createMemo(() => columns(scale()))
  const groups = createMemo(() => headGroups(scale()))

  /** свёрнутые группы строк: по ним же считается, что вообще показывать */
  const [folded, setFolded] = createSignal<Set<string>>(new Set())
  const toggleGroup = (g: string) =>
    setFolded((was) => {
      const next = new Set(was)
      next.has(g) ? next.delete(g) : next.add(g)
      return next
    })
  /**
   * Строки в порядке показа, с врезанными заголовками групп. Свёрнутая группа
   * прячет свои строки, но сама остаётся — иначе развернуть её будет нечем.
   */
  const shownRows = createMemo(() => {
    const out: Array<{ kind: 'group'; id: string } | { kind: 'row'; row: TimelineRow }> = []
    let current: string | null = null
    for (const r of props.rows) {
      const g = r.group ?? null
      if (g !== current) {
        current = g
        if (g) out.push({ kind: 'group', id: g })
      }
      if (!g || !folded().has(g)) out.push({ kind: 'row', row: r })
    }
    return out
  })
  const rowMap = createMemo(() => new Map(props.rows.map((r) => [r.id, r])))

  /** полосы по id — для рендера с ключом по id, а не по ссылке */
  const spanById = createMemo(() => new Map(props.spans.map((s) => [s.id, s])))
  const spanIds = createMemo(() => props.spans.map((s) => s.id))

  /**
   * Правила строки: свой минимум, зазор, окно. Чего у строки нет — берётся у
   * сетки (`gapMin` остаётся общим дефолтом, как и было).
   *
   * Окно строки действует только на ПОЧАСОВОЙ сетке: там его видно (штриховка)
   * и в него можно прицелиться. На суточной сетке окно молча игнорируется —
   * иначе `confined` зажимал бы многодневную бронь в одни сутки.
   */
  const rulesOf = (rowId: string): RowRules => {
    const r = rowMap().get(rowId)
    // окно — свойство ПОЧАСОВОГО ресурса: у номера «работает с 14:00» не бывает
    const hourly = !dayGrid() && unitOf(rowId) === 'hour'
    return {
      minMin: r?.minMin,
      gapMin: r?.gapMin ?? props.gapMin,
      openMin: hourly ? r?.openMin : undefined,
      closeMin: hourly ? r?.closeMin : undefined,
    }
  }
  const gapOf = (rowId: string) => rulesOf(rowId).gapMin ?? 0

  /** чем торгует строка: сутками или часами */
  const unitOf = (rowId: string) => rowMap().get(rowId)?.unit ?? 'day'
  /** сетка суточная — колонка не мельче рабочего окна */
  const dayGrid = () => {
    const sc = scale()
    return sc.stepMin >= Math.max(1, sc.dayEnd - sc.dayStart)
  }
  /**
   * Можно ли растягивать эту полосу мышью.
   *
   * ПОЧАСОВОЙ ресурс на СУТОЧНОЙ сетке — нельзя: шаг ручки здесь сутки, и
   * двухчасовой пейнтбол одним движением превращается в двухнедельный. Точность
   * жеста просто не та; менять время у такой брони надо в форме, а не мышью.
   */
  const canResize = (rowId: string) => !(dayGrid() && unitOf(rowId) === 'hour')

  /**
   * Та же шкала, но с колонкой в СУТКИ. Пиксель на минуту у них общий
   * (`colW / stepMin` не меняется), поэтому нарисованное остаётся на месте —
   * меняется только крупность жеста.
   */
  const daily = createMemo(() => {
    const sc = scale()
    const win = Math.max(1, sc.dayEnd - sc.dayStart)
    // `snapMin` снимаем: получасовой шаг площадок к суткам отношения не имеет
    return { ...sc, stepMin: win, snapMin: undefined, colW: (sc.colW * win) / sc.stepMin }
  })

  /**
   * Шкала, по которой считается ЖЕСТ на этой строке.
   *
   * Сетка одна на всех, а торгуют строки по-разному, и шаг у них разный: баня
   * ходит получасом, номер — сутками. На почасовой сетке общий шаг превращал
   * перенос брони номера в «заезд 18:00, выезд 14:00» — время, которого в
   * гостинице не существует. Поэтому суточной строке отдаём суточную шкалу:
   * тогда снап, минимум (ночь, а не колонка) и отметки заезда-выезда считаются
   * теми же ветками, что и на суточной сетке, — второй реализации не нужно.
   */
  const scaleOf = (rowId: string) =>
    !dayGrid() && unitOf(rowId) === 'day' ? daily() : scale()

  /** свободно ли место с учётом зазора на уборку — у каждой строки он свой */
  const free = (next: S) =>
    !props.spans.some(
      (s) => s.id !== next.id && s.row === next.row && conflicts(next, s, scale(), gapOf(next.row)),
    )

  /**
   * Пристроить полосу так, чтобы она НЕ ЛЕЖАЛА НА СОСЕДЕ.
   *
   * Ищется в полёте, а не при отпускании: пока полоса рисуется поверх чужой
   * брони, глазу кажется, что так и будет — а потом она прыгает. Лучше пусть
   * прилипает к ближайшему свободному сразу, тогда видно ровно то, что
   * получится.
   *
   * `null` — рядом мест нет; тогда показываем последнее удачное, а не тащим
   * полосу сквозь чужие.
   */
  const settle = (want: S): S | null => {
    if (free(want)) return want
    // ищем свободное место шагом ЭТОЙ строки: номер переезжает на сутки, а не
    // на полчаса — иначе «ближайшее свободное» оказывается тем же днём в 16:30
    const sc = scaleOf(want.row)
    const step = snapOf(sc)
    const at = toMinutes(want.from, sc, 'from')
    for (let i = 1; i <= 24; i++) {
      for (const dir of [-1, 1]) {
        const min = at + i * dir * step
        if (min < 0) continue
        const test = { ...want, ...moveTo(want, min, sc, rulesOf(want.row)) } as S
        if (free(test)) return test
      }
    }
    return null
  }

  /**
   * Этажи: пересекающиеся полосы не лежат друг на друге.
   *
   * СТРОКА РАСТЁТ под число этажей, а не сплющивает полосы. Делить фиксированную
   * высоту поровну — плохая идея: четыре наложившиеся брони превращаются в
   * четыре полоски по шесть пикселей, в которых не прочитать ни имени, ни дат.
   * Лучше строка станет выше — вертикали на экране всё равно больше, чем
   * горизонтали.
   */
  const floors = createMemo(() => stackFloors(props.spans, scale(), gapOf))
  const perRow = createMemo(() => floorsPerRow(props.spans, floors()))
  const levelsOf = (row: string) => Math.max(1, perRow().get(row) ?? 1)

  /**
   * Высоты и начала ВСЕХ рядов, включая заголовки групп: они тоже занимают
   * место, и если их не учесть, полосы уедут вверх на высоту заголовков.
   */
  const rowGeom = createMemo(() => {
    const tops = new Map<string, number>()
    const heights: Array<number> = []
    /** начало каждого ряда; `offsets[i + 1]` — его низ, то есть линия под ним */
    const offsets: Array<number> = []
    const items = shownRows()
    let y = 0
    for (const it of items) {
      const h = it.kind === 'group' ? Math.round(rowH() * 0.72) : rowH() * levelsOf(it.row.id)
      if (it.kind === 'row') tops.set(it.row.id, y)
      offsets.push(y)
      heights.push(h)
      y += h
    }
    offsets.push(y)
    return { tops, heights, offsets, total: y, items }
  })
  /** номер строки по её id — чтобы не звать `indexOf` в горячем пути жеста */
  const rowOrder = createMemo(() => {
    const order = new Map<string, number>()
    props.rows.forEach((r, i) => order.set(r.id, i))
    return order
  })

  /**
   * Какая строка на этой высоте — строки разной высоты, да ещё и с группами.
   *
   * Бинарный поиск по накопленным высотам, а не проход по всем рядам: функция
   * зовётся НА КАЖДОЕ ДВИЖЕНИЕ УКАЗАТЕЛЯ во время драга, и на трёх сотнях
   * строк линейный перебор со вложенным `indexOf` стоил бы десятков тысяч
   * операций в кадр.
   */
  const rowAtY = (y: number): number => {
    const { items, offsets } = rowGeom()
    if (!items.length) return 0
    let lo = 0
    let hi = items.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (offsets[mid] <= y) lo = mid
      else hi = mid - 1
    }
    // попали в заголовок группы — берём ближайшую строку выше, а нет её, так
    // ниже: у заголовка своей брони не бывает
    for (let i = lo; i >= 0; i--) {
      const it = items[i]
      if (it.kind === 'row') return rowOrder().get(it.row.id) ?? 0
    }
    for (let i = lo + 1; i < items.length; i++) {
      const it = items[i]
      if (it.kind === 'row') return rowOrder().get(it.row.id) ?? 0
    }
    return 0
  }

  /**
   * Погасить клик, который браузер пришлёт следом за состоявшимся жестом.
   *
   * Убирать мусор обязан тот, кто его произвёл: это жест «лишний» клик
   * породил — он же его и снимает. Обработчик открытия при этом остаётся
   * чистым: клик есть клик, никаких проверок расстояний и флагов состояния.
   *
   * Перехват в ФАЗЕ ЗАХВАТА и `once`: клик надо снять до того, как он дойдёт
   * до полосы, и ровно один — следующий, настоящий, должен работать.
   */
  function swallowNextClick() {
    const kill = (e: MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
    }
    window.addEventListener('click', kill, { capture: true, once: true })
    // клика может и не быть (жест закончился вне окна) — не оставляем висеть
    setTimeout(() => window.removeEventListener('click', kill, true), 0)
  }

  /** что сейчас выделяют протяжкой по пустому месту */
  const [pick, setPick] = createSignal<{ row: string; a: number; b: number } | null>(null)

  let scrollRaf = 0
  onCleanup(() => scrollRaf && cancelAnimationFrame(scrollRaf))

  /** над какой полосой курсор — для подсказки о продлении */
  const [hovered, setHovered] = createSignal<string | null>(null)

  /**
   * Сколько ещё свободно справа от полосы: до заезда следующего, минус зазор.
   * `null` — продлевать некуда.
   */
  const roomOf = (span: S) => {
    if (props.readonly || !props.showRoom) return null
    const sc = scale()
    const end = toMinutes(span.to, sc, 'to')
    // Предел ищем той же функцией, что и ресайз: одна логика — один ответ.
    // Верхняя граница — КОНЕЦ СЕТКИ, а не бесконечность: за краем ничего не
    // нарисовано, и «+Infinity ч» в подсказке — не ответ на вопрос.
    const edge = totalCols(sc) * sc.stepMin
    const limit = clampEdge(span, 'to', edge, props.spans, sc, gapOf(span.row), rulesOf(span.row))
    if (limit === null || limit <= end) return null
    const minutes = limit - end
    return { x: toX(end, sc), w: toX(limit, sc) - toX(end, sc), minutes }
  }

  /** что тащим и куда получится; `null` — жеста нет */
  const [draft, setDraft] = createSignal<{ id: string; next: S; ok: boolean } | null>(null)

  let canvas!: HTMLDivElement
  let viewport: HTMLDivElement | undefined


  /**
   * Ширина вьюпорта — из `ResizeObserver`, а не `clientWidth` на каждый кадр:
   * чтение `clientWidth` в скролл-обработчике — это форс лэйаута по правилу
   * репы, а меняется ширина на порядки реже, чем прокрутка.
   */
  const [vpW, setVpW] = createSignal(0)

  /**
   * Что сейчас видно. `scrollLeft` — не forced layout; ширина — из кэша.
   * Левая колонка (`headW`) закрывает свои пиксели sticky-слоем, поэтому
   * `from` совпадает со `scrollLeft`, а вот справа её ширину надо ВЫЧЕСТЬ —
   * иначе диапазон стабильно завышен на несколько дней.
   */
  const visibleRange = () => {
    const sc = scale()
    const left = viewport?.scrollLeft ?? 0
    const width = Math.max(0, vpW() - headW())
    const edge = totalCols(sc) * sc.stepMin
    const clamp = (m: number) => Math.min(Math.max(0, m), edge)
    return {
      from: toMoment(clamp(fromX(left, sc, false)), sc),
      to: toMoment(clamp(fromX(left + width, sc, false)), sc, true),
    }
  }

  const api: TimelineApi = {
    scrollTo: (at) => {
      if (!viewport) return
      viewport.scrollLeft = momentX(at, scale(), 'from')
    },
    // «сейчас» — НАСТЕННОЕ время, как и все моменты кита. `toISOString` тут
    // была бы ошибкой: она отдаёт UTC, и вне нулевого пояса «Сегодня»
    // промахивалось бы на смещение зоны.
    scrollToNow: () =>
      api.scrollTo(props.now ?? Temporal.Now.plainDateTimeISO().toString().slice(0, 16)),
    visibleRange,
  }
  // onMounted, а не onMount: в Solid 2 onMount не экспортируется (shared/solidCompat)
  onMounted(() => {
    props.ref?.(api)
    if (!viewport) return
    const ro = new ResizeObserver((es) => setVpW(es[0]?.contentRect.width ?? 0))
    ro.observe(viewport)
    onCleanup(() => ro.disconnect())
  })
  // диапазон меняется не только прокруткой: сменили `from`/`days`/шаг или
  // ширину окна — потребителю нужен свежий диапазон для догрузки
  effect(() => {
    scale()
    if (vpW() > 0) props.onVisibleRange?.(visibleRange())
  })

  /**
   * Координаты сетки — снимаются ОДИН раз на старте жеста, без forced layout.
   * Вместе с ними запоминается скролл на момент снимка: прокрутка ВО ВРЕМЯ
   * жеста сдвигает канву, и без этой базы полоса уезжала бы мимо курсора.
   */
  let origin: { x: number; y: number; sl: number; st: number } | null = null

  /** client-координаты → координаты канвы; зовётся только после снимка */
  const toLocal = (cx: number, cy: number) => ({
    x: cx - origin!.x + ((viewport?.scrollLeft ?? 0) - origin!.sl),
    y: cy - origin!.y + ((viewport?.scrollTop ?? 0) - origin!.st),
  })

  /**
   * Активные жесты. Жест живёт на слушателях `window`, и у него три конца:
   * нормальный (`pointerup`), отменённый (`pointercancel` — браузер забрал
   * указатель под свой скролл/жест, или Esc) и внезапный — размонтирование
   * компонента посреди драга. Без реестра последние два оставляли бы висеть
   * слушатели и подавленное выделение текста.
   */
  const aborts = new Set<() => void>()
  onCleanup(() => {
    for (const abort of [...aborts]) abort()
  })

  function snapOrigin(then: () => void) {
    const io = new IntersectionObserver((entries) => {
      const r = entries[0]?.boundingClientRect
      if (r) {
        origin = {
          x: r.left,
          y: r.top,
          sl: viewport?.scrollLeft ?? 0,
          st: viewport?.scrollTop ?? 0,
        }
      }
      io.disconnect()
      then()
    })
    io.observe(canvas)
  }

  function startDrag(ev: PointerEvent, span: S, mode: 'move' | 'from' | 'to') {
    // ТОЛЬКО ЛЕВАЯ. Правая — это контекстное меню, средняя — прокрутка колесом;
    // тащить бронь ни та, ни другая не должны
    if (ev.button !== 0) return
    // и только ПЕРВЫЙ палец: второй, опущенный посреди драга, — это не второй
    // жест, а случайность, и перехватывать чужую бронь он не должен
    if (ev.isPrimary === false) return
    if (props.readonly || props.spanLocked?.(span)) return
    // ручек в разметке и так нет, но жест могут позвать и программно
    if (mode !== 'move' && !canResize(span.row)) return
    ev.preventDefault()
    ev.stopPropagation()
    const target = ev.currentTarget as HTMLElement
    target.setPointerCapture?.(ev.pointerId)
    suppressTextSelection()

    // где внутри полосы схватили: без этого она прыгает левым краем к курсору
    const grabbedAt = { x: ev.clientX, y: ev.clientY }
    const startSpan = span
    /**
     * Двигали ли указатель. Именно по этому и решается судьба клика, а НЕ по
     * тому, изменилась ли бронь: потащить и вернуть на место — это всё равно
     * жест, и карточке после него открываться незачем.
     */
    let moved = false

    const apply = (cx: number, cy: number) => {
      if (!origin) return
      const { x, y } = toLocal(cx, cy)
      let next: S
      if (mode === 'move') {
        const rows = rowIds()
        // строку берём ПО КООРДИНАТЕ, а не по сдвигу в строках: строки разной
        // высоты, и «сдвиг на две строки» ничего не значит
        const rowIdx = Math.max(0, Math.min(rows.length - 1, rowAtY(y)))
        // шаг — ЦЕЛЕВОЙ строки, как и правила: тащим в номер — едем сутками
        const sc = scaleOf(rows[rowIdx])
        // Сдвиг — в ШАГАХ ПЕРЕМЕЩЕНИЯ от точки захвата (не в колонках!): сетка
        // может быть мельче шага, как в бане — час против двухчасового сеанса.
        const step = snapOf(sc)
        const shiftedMin = ((cx - grabbedAt.x) / sc.colW) * sc.stepMin
        const startMin =
          toMinutes(startSpan.from, sc, 'from') + Math.round(shiftedMin / step) * step
        // правила — ЦЕЛЕВОЙ строки: перетащили в банкетный зал — жить по его
        // окну, а не по окну строки, откуда тащили
        const moved = moveTo(startSpan, Math.max(0, startMin), sc, rulesOf(rows[rowIdx]))
        const want = { ...startSpan, ...moved, row: rows[rowIdx] } as S
        // на занятое не кладём вовсе: прилипаем к ближайшему свободному
        const ok = settle(want)
        if (!ok) return                    // некуда — оставляем как было
        next = ok
      } else {
        // ресайз из строки не уходит — шкала своей строки
        const sc = scaleOf(startSpan.row)
        // Край встаёт на СВОЮ отметку: заезд в 16:00, выезд в 12:00. Обычный
        // снап в шаг положил бы его на полночь — полоса удлинялась бы на
        // полдня, и щель на пересменку пропадала.
        const want = snapEdge(x, sc, mode)
        // и УПИРАЕТСЯ в соседа, а не перепрыгивает его: тянут за край
        // намеренно, и полоса за чужой бронью — это уже не то, что растягивали
        const at = clampEdge(
          startSpan, mode, toMinutes(want, sc, mode), props.spans, sc,
          gapOf(startSpan.row), rulesOf(startSpan.row),
        )
        if (at === null) return          // упёрлись насмерть — оставляем как было
        next = mode === 'from'
          ? ({ ...startSpan, from: toMoment(at, sc) } as S)
          : ({ ...startSpan, to: toMoment(at, sc) } as S)
      }
      setDraft({ id: startSpan.id, next, ok: free(next) })
    }

    const onMove = (e: PointerEvent) => {
      if (Math.abs(e.clientX - grabbedAt.x) > 3 || Math.abs(e.clientY - grabbedAt.y) > 3) {
        moved = true
      }
      apply(e.clientX, e.clientY)
    }

    /**
     * Жест кончился (как угодно). IO-снимок мог ещё не приехать: его колбэк
     * обязан увидеть этот флаг и НЕ звать `apply` — иначе быстрый клик
     * оставлял бы призрачный `draft` без слушателей, снять который некому.
     */
    let dead = false
    const cleanup = () => {
      dead = true
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointermove', remember)
      restoreTextSelection()
      aborts.delete(abort)
    }

    /** жест НЕ состоялся: браузер забрал указатель, Esc или размонтирование */
    const abort = () => {
      cleanup()
      if (moved) swallowNextClick()
      setDraft(null)
      origin = null
    }
    const onCancel = () => abort()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') abort()
    }

    const onUp = () => {
      cleanup()
      // жест был — клик следом уже не наш, чем бы дело ни кончилось
      if (moved) swallowNextClick()
      const d = draft()
      setDraft(null)
      origin = null
      if (!d) return

      /**
       * Ничего не поменялось — выходим молча. Сравниваем МИНУТЫ по шкале, а не
       * строки: дата без времени и та же дата с часом заезда — один момент.
       */
      const sc0 = scale()
      const same =
        d.next.row === startSpan.row &&
        toMinutes(d.next.from, sc0, 'from') === toMinutes(startSpan.from, sc0, 'from') &&
        toMinutes(d.next.to, sc0, 'to') === toMinutes(startSpan.to, sc0, 'to')
      if (same) return

      // Место уже подобрано в полёте (`settle` для переноса, `clampEdge` для
      // ресайза), поэтому здесь остаётся только убедиться, что оно свободно.
      const landed: S | null = free(d.next) ? d.next : null
      if (!landed) return
      // применение — дело потребителя (см. док `onChange`); ждать ответа
      // компоненту незачем, у него нет своего состояния
      const kind = mode === 'move' ? 'move' : mode === 'from' ? 'resize-from' : 'resize-to'
      void props.onChange?.(landed, startSpan, kind)
    }

    /*
      Слушатели вешаем СРАЗУ, а координаты сетки досылаем, когда их посчитает
      IntersectionObserver.
      
      Раньше подписка ждала этого снимка — и быстрый клик (нажал-отпустил
      за один кадр) успевал пройти ДО неё: `pointerup` никто не слышал, жест
      оставался незакрытым, слушатели повисали на окне, а следующий клик
      съедался чужим обработчиком. Ловилось это только тем, что карточка
      переставала открываться со второго раза.
    */
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey)
    aborts.add(abort)
    let last = { x: ev.clientX, y: ev.clientY }
    const remember = (e: PointerEvent) => { last = { x: e.clientX, y: e.clientY } }
    window.addEventListener('pointermove', remember)
    snapOrigin(() => {
      window.removeEventListener('pointermove', remember)
      if (dead) return
      apply(last.x, last.y)
    })
  }

  /** полоса с учётом того, что её сейчас тащат */
  const shownSpan = (s: S): S => {
    const d = draft()
    return d && d.id === s.id ? d.next : s
  }

  return (
    <div
      ref={viewport}
      class={`dumb-tl ${props.class ?? ''}`}
      onScroll={() => {
        if (!props.onVisibleRange) return
        // не чаще кадра: прокрутка приходит десятками событий подряд
        if (scrollRaf) return
        scrollRaf = requestAnimationFrame(() => {
          scrollRaf = 0
          props.onVisibleRange!(visibleRange())
        })
      }}
      style={{
        '--dumb-tl-head': `${headW()}px`,
        '--dumb-tl-col': `${colW()}px`,
        '--dumb-tl-row-h': `${rowH()}px`,
        // ширина СУТОК в пикселях — для жирной линии на стыке дней
        '--dumb-tl-day-w': `${(Math.max(1, scale().dayEnd - scale().dayStart) / scale().stepMin) * colW()}px`,
        '--dumb-tl-dayline': dayGrid() ? 'var(--dumb-tl-line)' : 'rgb(0 0 0 / .3)',
        ...props.style,
      }}
    >
      <div class="dumb-tl-inner">
        <div class="dumb-tl-corner">
          <Show when={props.summary}>
            <div class="dumb-tl-sum-title">{props.summaryTitle ?? 'Свободно'}</div>
          </Show>
        </div>

        {/*
          Шапка в ДВА ряда. Верхний слит по месяцам (на суточной сетке) или по
          дням (на часовой): без него на часовой шкале не понять, какой сейчас
          день, а на месячной — какой месяц.
        */}
        <div class="dumb-tl-head">
          <div
            class="dumb-tl-groups"
            style={{ 'grid-template-columns': groups().map((g) => `${g.span * colW()}px`).join(' ') }}
          >
            <For each={groups()}>
              {(g) => (
                <div class="dumb-tl-group">
                  {props.groupLabel?.(g.at, g.span) ?? defaultGroupLabel(g.at, scale())}
                </div>
              )}
            </For>
          </div>

          <div
            class="dumb-tl-days"
            style={{ 'grid-template-columns': `repeat(${totalCols(scale())}, ${colW()}px)` }}
          >
            <For each={cols()}>
              {(at) => (
                <div class={`dumb-tl-day ${props.dayClass?.(at) ?? ''}`}>
                  {props.dayLabel?.(at) ?? defaultDayLabel(at, scale())}
                </div>
              )}
            </For>
          </div>

          <Show when={props.summary}>
            <div
              class="dumb-tl-days dumb-tl-summary"
              style={{ 'grid-template-columns': `repeat(${totalCols(scale())}, ${colW()}px)` }}
            >
              <For each={cols()}>
                {(at) => <div class="dumb-tl-day">{props.summary!(at)}</div>}
              </For>
            </div>
          </Show>
        </div>

        <div class="dumb-tl-rows">
          <For each={rowGeom().items}>
            {(it, i) => (
              <Show
                when={it.kind === 'row'}
                fallback={
                  // заголовок группы: щелчок сворачивает — этажей и корпусов
                  // бывает много, и без сворачивания сетка не читается
                  <button
                    type="button"
                    class="dumb-tl-grouprow"
                    style={{ height: `${rowGeom().heights[i()]}px` }}
                    onClick={() => toggleGroup((it as { id: string }).id)}
                  >
                    <span class="dumb-tl-fold">
                      {folded().has((it as { id: string }).id) ? '▸' : '▾'}
                    </span>
                    {(it as { id: string }).id}
                  </button>
                }
              >
                <div
                  class={`dumb-tl-row ${props.rowClass?.((it as { row: TimelineRow }).row) ?? ''}`}
                  data-off={
                    props.rowDisabled?.((it as { row: TimelineRow }).row) ? '1' : undefined
                  }
                  style={{ height: `${rowGeom().heights[i()]}px` }}
                >
                  {(it as { row: TimelineRow }).row.title}
                </div>
              </Show>
            )}
          </For>
        </div>

        <div
          ref={canvas}
          class="dumb-tl-canvas"
          style={{
            width: `${totalCols(scale()) * colW()}px`,
            height: `${rowGeom().total}px`,
          }}
          onPointerDown={(ev) => {
            // выделяем только по ПУСТОМУ месту левой кнопкой: правая — меню
            if (ev.button !== 0) return
            // второй палец посреди жеста выделение не начинает
            if (ev.isPrimary === false) return
            if (!props.onRangeSelect || ev.target !== ev.currentTarget) return
            const sc = scale()
            const gridEdge = totalCols(sc) * sc.stepMin
            const startClient = { x: ev.clientX, y: ev.clientY }
            let last = { ...startClient }
            /** жест успел кончиться раньше, чем IO отдал координаты канвы */
            let upX: number | null = null

            /**
             * Минимум выделения: шаг перемещения, но не короче минимума
             * строки. Не `stepMin`: картинг торгует получасами при часовой
             * колонке, а баня — двухчасовыми сеансами, и рамка обязана сразу
             * показывать, что на самом деле будет продано.
             */
            const minPick = (rowId: string) =>
              Math.max(snapOf(sc), minLength(sc, rulesOf(rowId)))

            // Координаты канвы приедут из IntersectionObserver — как в
            // startDrag: слушатели вешаются сразу, рамка появляется со снимком.
            const begin = () => {
              if (!origin) return
              const { x, y } = toLocal(startClient.x, startClient.y)
              const row = props.rows[rowAtY(y)]
              if (!row || props.rowDisabled?.(row)) return
              const a = Math.min(Math.max(0, fromX(x, sc)), gridEdge)
              setPick({ row: row.id, a, b: Math.min(a + minPick(row.id), gridEdge) })
            }

            const update = (cx: number) => {
              if (!origin) return
              const at = Math.min(Math.max(0, fromX(toLocal(cx, 0).x, sc)), gridEdge)
              setPick((was) => {
                if (!was) return was
                // вправо — сразу не короче минимума; ВЛЕВО тянуть тоже можно,
                // минимум добьём на отпускании
                const b = at >= was.a
                  ? Math.max(at, Math.min(was.a + minPick(was.row), gridEdge))
                  : at
                return { ...was, b }
              })
            }

            const finish = (endX: number) => {
              const p = pick()
              setPick(null)
              if (!p) return

              // Не тянули, а щёлкнули — это `onEmptyClick`, не наше дело.
              // Порог в полклетки: дрожание руки не должно создавать бронь.
              if (Math.abs(endX - startClient.x) < sc.colW / 2) return
              // тянули — значит клик следом уже не нужен, иначе поверх
              // сработает ещё и `onEmptyClick`
              swallowNextClick()

              let [a, b] = [Math.min(p.a, p.b), Math.max(p.a, p.b)]
              b = Math.min(b, gridEdge)               // за краем сетки не продаём
              const rules = rulesOf(p.row)
              const rowGap = gapOf(p.row)
              // Своё окно строки: банкетный зал раньше 14:00 не продаётся,
              // и выделение просто обрезается по открытию и закрытию.
              if (confined(sc, rules)) {
                // всё выделение живёт в сутках НАЧАЛА: окно через полночь не
                // перепрыгивает, штриховка внутри брони не бывает
                const rb = rowBounds(a, sc, rules)
                a = Math.max(a, rb.start)
                b = Math.min(b, rb.end)
              }
              // Обрезаем выделение по соседям: создать бронь поверх чужой
              // нельзя ни при каких обстоятельствах, и узнать об этом лучше до
              // того, как откроется форма.
              for (const o of props.spans) {
                if (o.row !== p.row) continue
                const oa = toMinutes(o.from, sc, 'from')
                const ob = toMinutes(o.to, sc, 'to')
                if (oa >= b || ob <= a) continue
                if (oa >= a) b = Math.min(b, oa - rowGap)
                else a = Math.max(a, ob + rowGap)
              }
              // Короче минимума не продаём — ПОДТЯГИВАЕМ до него: выделил бане
              // час — получит два, таков прейскурант. А вот если подтянутый
              // конец налез на соседа, закрытие или край сетки — места нет.
              const need = minLength(sc, rules)
              if (b - a < need) {
                b = a + need
                if (b > gridEdge) return
                if (confined(sc, rules) && b > rowBounds(a, sc, rules).end) return
                const clash = props.spans.some((o) => {
                  if (o.row !== p.row) return false
                  const oa = toMinutes(o.from, sc, 'from')
                  const ob = toMinutes(o.to, sc, 'to')
                  return a < ob + rowGap && oa < b + rowGap
                })
                if (clash) return
              }
              if (b <= a) return                      // всё занято — молча выходим
              const hourly = unitOf(p.row) === 'hour'
              props.onRangeSelect!({
                row: p.row,
                // Суточной строке отдаём ДАТЫ БЕЗ ВРЕМЕНИ: час заезда и выезда
                // подставит сама шкала (16:00 → 12:00). Написать сюда полночь
                // значило бы соврать на полсуток с каждого края.
                from: dayGrid() && !hourly ? toMoment(a, sc).slice(0, 10) : toMoment(a, sc),
                to: dayGrid() && !hourly ? toMoment(b, sc).slice(0, 10) : toMoment(b, sc, true),
                needsTime: hourly && dayGrid(),
              })
            }

            const move = (e: PointerEvent) => {
              last = { x: e.clientX, y: e.clientY }
              update(e.clientX)
            }
            const cleanup = () => {
              window.removeEventListener('pointermove', move)
              window.removeEventListener('pointerup', up)
              window.removeEventListener('pointercancel', cancel)
              window.removeEventListener('keydown', key)
              aborts.delete(cancel)
            }
            /** выделение НЕ состоялось: указатель забрали, Esc, размонтирование */
            let dead = false
            const cancel = () => {
              cleanup()
              dead = true     // запоздалый IO-колбэк не должен воскресить рамку
              upX = null
              setPick(null)
            }
            const key = (e: KeyboardEvent) => {
              if (e.key === 'Escape') cancel()
            }
            const up = (e: PointerEvent) => {
              cleanup()
              // рамки ещё нет — жест был быстрее снимка; доделает IO-колбэк
              if (!pick()) {
                upX = e.clientX
                return
              }
              finish(e.clientX)
            }
            window.addEventListener('pointermove', move)
            window.addEventListener('pointerup', up)
            window.addEventListener('pointercancel', cancel)
            window.addEventListener('keydown', key)
            aborts.add(cancel)
            snapOrigin(() => {
              if (dead) return
              begin()
              if (upX !== null) {
                update(upX)
                finish(upX)
              } else {
                update(last.x)
              }
            })
          }}
          onContextMenu={(ev) => {
            if (!props.onEmptyContextMenu || ev.target !== ev.currentTarget) return
            // preventDefault — синхронно, а клетку считаем после IO-снимка:
            // замер канвы через getBoundingClientRect запрещён правилом репы
            ev.preventDefault()
            const cx = ev.clientX
            const cy = ev.clientY
            const sc = scale()
            snapOrigin(() => {
              if (!origin) return
              const { x, y } = toLocal(cx, cy)
              const at = toMoment(Math.max(0, fromX(x, sc)), sc)
              props.onEmptyContextMenu!(at, rowIds()[rowAtY(y)], ev)
            })
          }}
          onClick={(ev) => {
            if (!props.onEmptyClick || ev.target !== ev.currentTarget) return
            // клик по пустому месту: клетка считается из координат клика,
            // геометрия канвы — из IO-снимка (кадр задержки клику не мешает)
            const cx = ev.clientX
            const cy = ev.clientY
            const sc = scale()
            snapOrigin(() => {
              if (!origin) return
              const { x, y } = toLocal(cx, cy)
              props.onEmptyClick!(toMoment(Math.max(0, fromX(x, sc)), sc), rowIds()[rowAtY(y)])
            })
          }}
        >
          {/*
            Линия под каждым рядом. Её место — накопленная высота
            (`offsets[i + 1]`), а не сумма среза высот: ряды разной высоты, и
            пересчёт суммы для каждой линии стоил бы квадрата от числа строк —
            на десятке строк незаметно, на сотнях уже нет.
          */}
          <For each={rowGeom().items}>
            {(_, i) => (
              <div class="dumb-tl-hline" style={{ top: `${rowGeom().offsets[i() + 1]}px` }} />
            )}
          </For>
          {/*
            Закрытые часы строк со СВОИМ окном (банкетный зал с 14:00): по два
            прямоугольника штриховки на день. Только на почасовой сетке — в
            колонке шириной в сутки полоска в пару часов не читается.
          */}
          <Show when={!dayGrid()}>
            <For each={props.rows}>
              {(row) => {
                const sc = () => scale()
                const win = () => Math.max(1, sc().dayEnd - sc().dayStart)
                const openW = () =>
                  toX(Math.min(Math.max((row.openMin ?? sc().dayStart) - sc().dayStart, 0), win()), sc())
                const closeAt = () =>
                  toX(Math.min(Math.max((row.closeMin ?? sc().dayEnd) - sc().dayStart, 0), win()), sc())
                const top = () => rowGeom().tops.get(row.id)
                const height = () => rowH() * levelsOf(row.id)
                return (
                  <Show when={(row.openMin != null || row.closeMin != null) && top() != null}>
                    <For each={Array.from({ length: scale().days }, (_, d) => d)}>
                      {(d) => (
                        <>
                          <Show when={openW() > 0}>
                            <div
                              class="dumb-tl-closed"
                              style={{
                                transform: `translate(${toX(d * win(), sc())}px, ${top()}px)`,
                                width: `${openW()}px`,
                                height: `${height()}px`,
                                top: '0',
                                left: '0',
                              }}
                            />
                          </Show>
                          <Show when={closeAt() < toX(win(), sc())}>
                            <div
                              class="dumb-tl-closed"
                              style={{
                                transform: `translate(${toX(d * win(), sc()) + closeAt()}px, ${top()}px)`,
                                width: `${toX(win(), sc()) - closeAt()}px`,
                                height: `${height()}px`,
                                top: '0',
                                left: '0',
                              }}
                            />
                          </Show>
                        </>
                      )}
                    </For>
                  </Show>
                )
              }}
            </For>
          </Show>
          <Show when={pick()}>
            {(p) => {
              const sc = () => scale()
              const x = () => toX(Math.min(p().a, p().b), sc())
              const w = () => toX(Math.abs(p().b - p().a), sc())
              const top = () => rowGeom().tops.get(p().row) ?? 0
              const hrs = () => Math.abs(p().b - p().a)
              return (
                <div
                  class="dumb-tl-pick"
                  style={{
                    transform: `translate(${x()}px, ${top() + 3}px)`,
                    width: `${w()}px`,
                    height: `${rowH() - 6}px`,
                  }}
                >
                  {fmtRoom(hrs(), scale())}
                </div>
              )
            }}
          </Show>
          {/* линия «сейчас»: в шахматке по ней читают, что уже прошло */}
          <Show when={props.now}>
            <div class="dumb-tl-now" style={{ left: `${momentX(props.now!, scale(), 'from')}px` }} />
          </Show>
          {/*
            Ключ — `id`, а не ссылка. Ответ сервера — всегда новый массив
            новых объектов, и рендер по ссылкам пересоздавал бы ВСЕ полосы на
            каждую догрузку через `onVisibleRange`. `For` по массиву id
            (строки сверяются по значению) оставляет DOM живым, а содержимое
            полосы тянется реактивно из карты.
          */}
          <For each={spanIds()}>
            {(id) => {
              const span = () => spanById().get(id)!
              const view = () => shownSpan(span())
              const box = () => {
                const sc = scale()
                const x = momentX(view().from, sc, 'from')
                const w = Math.max(momentX(view().to, sc, 'to') - x, sc.colW * 0.4)
                return { x, w, y: rowGeom().tops.get(view().row) ?? 0 }
              }
              const dragging = () => draft()?.id === id
              const floor = () => floors().get(id) ?? 0
              const room = () => (hovered() === id ? roomOf(view()) : null)
              /**
               * Хвост-зазор строки, В КОТОРОЙ полоса сейчас: тащат в пейнтбол —
               * хвост вырастает до часа ещё в полёте. Обрезается по закрытию
               * строки и краю сетки: за ними зазор бессмыслен, а вылезший за
               * канву хвост добавлял бы фантомную прокрутку.
               */
              const tailW = () => {
                if (dayGrid()) return 0
                const g = gapOf(view().row)
                if (g <= 0) return 0
                const sc = scale()
                const end = toMinutes(view().to, sc, 'to')
                const rules = rulesOf(view().row)
                const wall = Math.min(
                  confined(sc, rules) ? rowBounds(Math.max(0, end - 1), sc, rules).end : Infinity,
                  totalCols(sc) * sc.stepMin,
                )
                return Math.max(0, toX(Math.min(end + g, wall), sc) - toX(end, sc))
              }
              return (
                <>
                <Show when={tailW() > 0}>
                  <div
                    class="dumb-tl-gap"
                    title={`зазор ${gapOf(view().row)} мин`}
                    style={{
                      transform: `translate(${box().x + box().w}px, ${box().y + floor() * rowH()}px)`,
                      width: `${tailW()}px`,
                      height: `${rowH() - 6}px`,
                      top: '3px',
                      left: '0',
                    }}
                  />
                </Show>
                <Show when={room()}>
                  {(r) => (
                    <div
                      class="dumb-tl-room"
                      style={{
                        transform: `translate(${r().x}px, ${box().y + floor() * rowH()}px)`,
                        width: `${r().w}px`,
                        height: `${rowH() - 6}px`,
                        top: '3px',
                        left: '0',
                      }}
                    >
                      <b>+{fmtRoom(r().minutes, scale())}</b>
                    </div>
                  )}
                </Show>
                <div
                  class={`dumb-tl-span ${props.spanClass?.(span()) ?? ''}`}
                  title={props.spanTitle?.(span())}
                  data-locked={props.spanLocked?.(span()) ? '1' : undefined}
                  onContextMenu={(ev) => {
                    if (!props.onSpanContextMenu) return
                    ev.preventDefault()
                    ev.stopPropagation()
                    props.onSpanContextMenu(span(), ev)
                  }}
                  data-drag={dragging() ? '1' : undefined}
                  data-bad={dragging() && !draft()!.ok ? '1' : undefined}
                  style={{
                    // место — transform, а не left/top: layout не трогается
                    // этаж — свой ряд внутри выросшей строки, высота у всех одна
                    transform: `translate(${box().x}px, ${box().y + floor() * rowH()}px)`,
                    width: `${box().w}px`,
                    height: `${rowH() - 6}px`,
                    top: '3px',
                    left: '0',
                  }}
                  onPointerDown={(ev) => startDrag(ev, span(), 'move')}
                  onPointerEnter={() => setHovered(id)}
                  onPointerLeave={() => setHovered((was) => (was === id ? null : was))}
                  onClick={(ev) => props.onOpen?.(span(), { x: ev.clientX, y: ev.clientY })}
                >
                  {props.children?.(span()) ?? id}
                  <Show when={!props.readonly && !props.spanLocked?.(span()) && canResize(view().row)}>
                    {/* Клик по ручке не открывает карточку — даже если её просто
                        нажали и отпустили, не сдвинув. За ручку берутся, чтобы
                        менять даты, и всплывшее поверх окно тут только мешает. */}
                    <span
                      class="dumb-tl-grip"
                      data-edge="from"
                      onPointerDown={(ev) => startDrag(ev, span(), 'from')}
                      onClick={(ev) => ev.stopPropagation()}
                    />
                    <span
                      class="dumb-tl-grip"
                      data-edge="to"
                      onPointerDown={(ev) => startDrag(ev, span(), 'to')}
                      onClick={(ev) => ev.stopPropagation()}
                    />
                  </Show>
                </div>
                </>
              )
            }}
          </For>
        </div>
      </div>
    </div>
  )
}

const MONTHS_RU = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
]
const WD_RU = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

/** верхний ряд шапки: месяц на суточной сетке, дата на часовой */
function defaultGroupLabel(at: Moment, s: Scale): string {
  const d = new Date(`${at.slice(0, 10)}T00:00:00Z`)
  if (s.stepMin >= Math.max(1, s.dayEnd - s.dayStart)) {
    return `${MONTHS_RU[d.getUTCMonth()]} ${d.getUTCFullYear()}`
  }
  return `${d.getUTCDate()} ${MONTHS_RU[d.getUTCMonth()].slice(0, 3)}, ${WD_RU[d.getUTCDay()]}`
}

/** нижний ряд: число с днём недели или часовая линейка */
function defaultDayLabel(at: Moment, s: Scale): JSX.Element {
  if (s.stepMin < Math.max(1, s.dayEnd - s.dayStart)) {
    // Тонкая часовая ЛИНЕЙКА, как в настоящих шахматках: узкая колонка-час с
    // двузначным тиком «00…23», день над ней — широкой полосой. Не «10:00» на
    // колонку: такая подпись требует широких колонок, день расползается на
    // пол-экрана, и неделя целиком в экран уже не влезает.
    if (at.slice(14, 16) !== '00') return ''
    return <span class="dumb-tl-hh">{at.slice(11, 13)}</span>
  }
  const d = new Date(`${at.slice(0, 10)}T00:00:00Z`)
  return (
    <>
      {d.getUTCDate()}
      <span class="dumb-tl-wd">{WD_RU[d.getUTCDay()]}</span>
    </>
  )
}

/** «+2 ч» или «+3 сут» — подпись к свободному хвосту */
function fmtRoom(minutes: number, s: Scale): string {
  if (s.stepMin >= 1440) {
    const win = Math.max(1, s.dayEnd - s.dayStart)
    return `${Math.round((minutes / win) * 10) / 10} сут`
  }
  const h = minutes / 60
  return h >= 1 ? `${Math.round(h * 10) / 10} ч` : `${Math.round(minutes)} мин`
}

export { lengthOf, toMinutes, toMoment }
