// Файловый менеджер «как Finder»: папки, выделение рамкой, заливка броском,
// перенос перетаскиванием.
//
// Компонент НЕ ходит в хранилище сам и не знает, что там за ним. Всё общение —
// через `source` (см. `finderTypes.ts`): спросить содержимое папки, залить,
// удалить, перенести. Причина не в чистоте архитектуры, а в ключах: ключ от
// бакета — ключ ко всему бакету, в браузере ему не место, значит наружу всё
// равно ходим через свой сервер. А раз через сервер — хранилище за ним может
// быть любым.
//
// Из чего складывается поведение:
//
// 1. ВЫДЕЛЕНИЕ — `SelectionArea` кита: рамка тянется без единого замера
//    элемента (снимок через IntersectionObserver на старте жеста). Клик —
//    выбрать один, Shift/Cmd/Ctrl — добавить или снять.
// 2. ПЕРЕНОС — нативный HTML5 drag-and-drop: тащишь выделенное на папку (или
//    на крошку пути) и отпускаешь. Пальцем не работает — тачскрин нативного
//    драга не знает; для пальца есть кнопка «Перенести».
// 3. ЗАЛИВКА — очередь из `shared`: два-три файла разом, остальные ждут,
//    снятая заливка обрывает запрос. Бросок файлов прямо на папку кладёт их
//    внутрь неё, а не в текущую.
// 4. ДЕРЕВО ПАПОК слева — своё, разметка и стили тут же в файле. Пробовали
//    `DumbTree` кита: он размечен под Tailwind/daisyUI, и половина работы
//    уходила на гашение чужих отступов, прокруток и линий уровней.
//
// Reflow: ни одного замера. Позиции для рамки снимает `SelectionArea`, всё
// остальное — обычная разметка, которую мы не измеряем вовсе.

// batch и watch — из shared/solidCompat: в Solid 2 `batch` и `on` не экспортируются,
// а JSX кита компилируется у потребителя
import {
  For, Show, createEffect, createMemo, createSignal, onCleanup, untrack,
  type JSX,
} from 'solid-js'
import { createFileUploader, type UploadFile } from '@solid-primitives/upload'
import { SelectionArea } from '@solid-dumb-kit/selection'
import { ResizableGrid } from '@solid-dumb-kit/resizable-grid'
import {
  batch, createUploadQueue, createUndoStack, injectStyle, isMoveKey, moveIndex,
  moveSelection, readDropEntries, watch,
} from '@solid-dumb-kit/shared'
import { fmtSize, fmtDateTimeShort } from '@solid-dumb-kit/utils'
import {
  ICONS, canMove, crumbs, joinPrefix, kindOf, nameOf, parentOf, sortEntries,
  type FileKind, type SortKey,
} from './finderPath'
import type { FinderEntry, FinderSource } from './finderTypes'

export type FinderView = 'grid' | 'list'

export type DumbFinderProps = {
  /** чем говорить с хранилищем */
  source: FinderSource

  /** открытая папка; не задан — файндер водит себя сам, начиная с корня */
  path?: string
  onPathChange?: (prefix: string) => void

  /** выделенные ключи; не задан — держит у себя */
  selected?: Set<string>
  onSelectionChange?: (keys: Set<string>) => void

  /** плитками или списком; не задан — плитками, переключатель в тулбаре */
  view?: FinderView
  onViewChange?: (view: FinderView) => void

  /** что пускать в выбор файлов; по умолчанию всё */
  accept?: string
  /** сколько файлов тянуть одновременно; по умолчанию 3 */
  concurrency?: number
  /** как называется корень в крошках; по умолчанию «Всё» */
  rootLabel?: string
  /** ширина плитки, css-трек; по умолчанию `minmax(132px, 1fr)` */
  tile?: string
  /** высота области с файлами; по умолчанию `60vh` */
  height?: string
  /** дерево папок слева; по умолчанию есть */
  sidebar?: boolean
  /** ширина дерева, css; по умолчанию `265px` */
  sidebarWidth?: string
  /** ключ localStorage для раскрытых веток дерева; по умолчанию `dumb-finder` */
  treeKey?: string
  /**
   * Значки видов файлов — CSS-КЛАССЫ, а не разметка: свой набор (Solar,
   * Phosphor, Lucide) выбирает потребитель, и его же Tailwind/iconify собирает
   * из этих строк CSS. Не задан — рисуем эмодзи, чтобы пакет работал и без
   * иконочного набора вовсе.
   */
  icons?: Partial<
    Record<
      | FileKind
      | 'dir' | 'dirOpen'
      | 'twist'
      /* кнопки тулбара */
      | 'refresh' | 'viewGrid' | 'viewList' | 'mkdir' | 'upload' | 'remove' | 'undo',
      string
    >
  >
  /**
   * Правка. Без неё файндер только смотрит: ни заливки, ни удаления, ни
   * переноса — даже если `source` всё это умеет.
   */
  editable?: boolean

  /** двойной клик по файлу (по папке файндер ходит сам) */
  onOpen?: (entry: FinderEntry) => void
  /** сорвалось: не смогли перечислить, залить, удалить, перенести */
  onError?: (message: string) => void

  /** своя плитка целиком; не задана — рисуем свою */
  children?: (entry: FinderEntry, ctx: { selected: boolean; view: FinderView }) => JSX.Element

  class?: string
  style?: JSX.CSSProperties
}

/** заливка, ещё не доехавшая до хранилища: показывается плиткой-призраком */
type Pending = {
  id: string
  name: string
  /** куда льём: в свою папку призрак и показываем */
  prefix: string
  progress: number
  error?: string
}

/**
 * Структурные стили: сетка, список, полоса прогресса, подсветка цели переноса.
 * Кладутся в `<head>` один раз на документ.
 *
 * Цвета вынесены в переменные и по умолчанию КОНТРАСТНЫЕ. Подпись под плиткой
 * читают, ручку хватают — блёклым серым тут не место; перекрасить под тему
 * можно, но дефолт обязан читаться.
 */
const STYLES = `
  /* Оформление — daisyUI: кнопки, поля и плашки берут классы в разметке, цвета
     идут из токенов темы (--color-base-*, --color-primary, --color-error).
     Здесь остаётся то, чего классом не выразить: сетка списка, ритм строк в
     1lh, полосы одним градиентом и рамки-цели переноса.

     Кегль ОДИН на весь компонент: от него едут и дерево слева, и строки
     списка, и подписи плиток. Дереву можно задать свой (--dumb-finder-tree-size),
     но по умолчанию оно берёт общий. */
  .dumb-finder { display: flex; flex-direction: column; min-height: 0;
                 font-size: var(--dumb-finder-size, 13px);
                 color: var(--dumb-finder-fg, var(--color-base-content, #0f172a)) }
  .dumb-finder-bar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
                     padding: 6px 2px }
  .dumb-finder-crumbs { min-width: 0; flex: 1 }
  .dumb-finder-crumbs ul { display: flex; align-items: center; flex-wrap: wrap;
                           list-style: none; margin: 0; padding: 0 }
  .dumb-finder-crumbs li { display: flex; align-items: center }
  /* разделитель гасится переменной: с готовыми крошками он уже свой */
  .dumb-finder-crumbs li + li::before { content: var(--dumb-finder-crumb-sep, '›');
                                        padding: 0 2px }
  .dumb-finder-crumb { padding: 2px 7px; border-radius: 6px; cursor: pointer;
                       border: 1px solid transparent; background: none; font: inherit;
                       color: inherit; white-space: nowrap }
  .dumb-finder-crumb:hover { background: var(--dumb-finder-hover, var(--color-base-200, rgb(0 0 0 / .06))) }
  .dumb-finder-crumb[aria-current="true"] { font-weight: 600 }
  /* цель переноса подсвечивается ярко: промахнуться мимо папки — обычное дело */
  .dumb-finder [data-drop="1"] { outline: 2px solid var(--dumb-finder-drop, var(--color-primary, #2563eb));
                                 outline-offset: 1px;
                                 background: var(--dumb-finder-drop-bg, color-mix(in oklch, var(--color-primary, #2563eb) 10%, transparent)) }
  /* значок и подпись в одну строку; голый значок — прячь подпись своим CSS */
  .dumb-finder-btn { display: inline-flex; align-items: center; gap: 5px }
  .dumb-finder-btn .dumb-finder-glyph { width: 15px; height: 15px; flex: none }

  /* дерево слева и файлы справа — один ряд, высота задаётся ему, а не им обоим */
  .dumb-finder-main { display: flex; min-height: 0; gap: 6px }
  /*
    Прокрутка тут РОВНО ОДНА — панели ResizableGrid. Ни сайдбар, ни само дерево
    не скроллятся: три вложенных скроллера дают две лишние полосы, одна из
    которых висит посреди пустого места.
  */
  /* clip, а не hidden: hidden по одной оси делает элемент скроллером и по
     второй — вернулась бы вторая вертикальная полоса. clip просто режет. */
  .dumb-finder-side { width: 100%; overflow-x: clip; overflow-y: visible;
                      padding: 2px 2px; box-sizing: border-box }
  /* поиск по папкам — строка, а не панель: он тут вспомогательный */
  .dumb-finder-tree > label { margin-bottom: 4px !important; height: 26px; min-height: 26px }
  .dumb-finder-side * { box-sizing: border-box }
  .dumb-finder-split { height: 100% }
  /* ── дерево папок ─────────────────────────────────────────────────────── */
  .dumb-finder-find { margin-bottom: 4px }
  /*
    Размер дерева задаётся ОДНИМ шрифтом: высота строки ниже привязана к 1lh,
    поэтому от кегля едет всё разом — и строки, и полосы, и отступы.
  */
  .dumb-finder-tree { list-style: none; margin: 0; padding: 0;
                      font-size: var(--dumb-finder-tree-size, 1em); line-height: 1.4;
    /*
      Полосатость — ОДНИМ градиентом на всё дерево, с шагом в строку (1lh), а не
      классом на каждую вторую строку. Иначе при раскрытии вложенных полосы
      считаются заново внутри каждого уровня и сбиваются с общего ритма.
      local — чтобы фон ехал вместе с прокруткой, а не стоял на месте.
    */
                      background-image: repeating-linear-gradient(to bottom,
                        transparent 0, transparent 1lh,
                        var(--dumb-finder-zebra, var(--color-base-200, rgb(0 0 0 / .035))) 1lh,
                        var(--dumb-finder-zebra, var(--color-base-200, rgb(0 0 0 / .035))) 2lh);
                      background-attachment: local }
  .dumb-finder-tree ul { list-style: none; margin: 0; padding-left: 1rem }
  /* строка ровно в одну строку текста: на этом держится ритм полос */
  .dumb-finder-node { display: flex; align-items: center; gap: 0; height: 1lh;
                      padding: 0 3px; border-radius: 3px; cursor: default }
  .dumb-finder-node:hover { background: var(--dumb-finder-hover, var(--color-base-200, rgb(0 0 0 / .06))) }
  .dumb-finder-node[data-here="1"] { font-weight: 500;
                                     color: var(--dumb-finder-drop, var(--color-primary, #2563eb));
                                     background: var(--dumb-finder-sel, color-mix(in oklch, var(--color-primary, #2563eb) 16%, transparent)) }
  .dumb-finder-node-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis;
                           white-space: nowrap; padding-left: 5px }
  /* значки в em, а не в px: размер дерева задаётся кеглем, и папка со стрелкой
     обязаны ехать следом, иначе на крупном дереве они остаются точками */
  .dumb-finder-node .dumb-finder-glyph { width: 1.15em; height: 1.15em; flex: none }
  .dumb-finder-node > .dumb-finder-twist { width: 1em; min-width: 1em; height: 1lh;
                                           display: grid; place-items: center }
  /* один значок на оба состояния: раскрытая ветка — тот же, повёрнутый */
  .dumb-finder-node > button.dumb-finder-twist > .dumb-finder-glyph {
    width: .8em; height: .8em; transition: transform .12s }
  .dumb-finder-node[data-open="1"] > button.dumb-finder-twist > .dumb-finder-glyph {
    transform: rotate(90deg) }
  /* вес прижат вправо и сжимаем: в узкой колонке лучше обрезать его,
     чем распирать дерево наружу */
  .dumb-finder-weight { flex: 0 1 auto; min-width: 0; margin-left: auto; padding-left: 6px;
                        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                        font-size: .82em; font-variant-numeric: tabular-nums;
                        color: var(--dumb-finder-dim, var(--color-base-content, #475569)) }
  /* ветка под курсором переноса: рамкой, как папка справа */
  .dumb-finder-node-drop { outline: 2px solid var(--dumb-finder-drop, var(--color-primary, #2563eb));
                           background: var(--dumb-finder-drop-bg, color-mix(in oklch, var(--color-primary, #2563eb) 10%, transparent)) }
  /* значки дерева: эмодзи через ::before — ни шрифта, ни спрайта не надо */
  .dumb-finder-i { display: inline-grid; place-items: center; font-size: 12px;
                   line-height: 1; font-style: normal }
  /* значок от потребителя: класс несёт саму картинку, размер задаём мы */
  .dumb-finder-glyph { display: block; width: 60%; height: 60%; margin: auto }
  .dumb-finder-view[data-view="list"] .dumb-finder-glyph { width: 18px; height: 18px }
  .dumb-finder-i-folder::before { content: '\\1F4C1' }
  .dumb-finder-i-folder-open::before { content: '\\1F4C2' }
  .dumb-finder-i-down::before { content: '\\25BE' }
  .dumb-finder-i-right::before { content: '\\25B8' }
  .dumb-finder-i-search::before { content: '\\1F50D' }
  .dumb-finder-i-sort::before { content: '\\2195' }
  .dumb-finder-i-grip::before { content: '\\2630' }

  .dumb-finder-body { flex: 1; min-width: 0; min-height: 0; overflow: auto;
                      overscroll-behavior: contain; padding: 4px; scrollbar-gutter: stable }
  .dumb-finder-view { min-height: 100%; outline: none }
  .dumb-finder-view:focus-visible { outline: 2px solid var(--dumb-finder-drop, var(--color-primary, #2563eb));
                                    outline-offset: -2px }
  .dumb-finder-view[data-view="grid"] .dumb-finder-items {
    display: grid; gap: 8px;
    grid-template-columns: repeat(auto-fill, var(--dumb-finder-tile, minmax(132px, 1fr))) }
  .dumb-finder-view[data-view="list"] .dumb-finder-items { display: flex; flex-direction: column }

  .dumb-finder-item { position: relative; cursor: default; border-radius: 8px;
                      border: 1px solid transparent; user-select: none }
  .dumb-finder-item[data-selected="1"] { background: var(--dumb-finder-sel, color-mix(in oklch, var(--color-primary, #2563eb) 16%, transparent));
                                         border-color: var(--dumb-finder-drop, var(--color-primary, #2563eb)) }
  .dumb-finder-item:hover { background: var(--dumb-finder-hover, var(--color-base-200, rgb(0 0 0 / .06))) }
  .dumb-finder-item[data-selected="1"]:hover { background: var(--dumb-finder-sel, color-mix(in oklch, var(--color-primary, #2563eb) 16%, transparent)) }

  /* плитка */
  .dumb-finder-view[data-view="grid"] .dumb-finder-item { padding: 6px; text-align: center }
  .dumb-finder-thumb { position: relative; aspect-ratio: 1; border-radius: 6px; overflow: hidden;
                       display: grid; place-items: center; font-size: 34px; line-height: 1;
                       background: var(--dumb-finder-thumb-bg, var(--color-base-200, rgb(0 0 0 / .05))) }
  .dumb-finder-thumb img { width: 100%; height: 100%; object-fit: cover; display: block }
  .dumb-finder-name { margin-top: 4px; font-size: .92em; line-height: 1.25;
                      overflow-wrap: anywhere;
                      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
                      overflow: hidden }
  .dumb-finder-meta { font-size: .85em; color: var(--dumb-finder-dim, var(--color-base-content, #475569)) }

  /* строка списка */
  .dumb-finder-view[data-view="list"] .dumb-finder-item {
    display: grid; grid-template-columns: auto 18px 22px 1fr 90px 130px 90px;
    align-items: center; gap: 6px; padding: 0 .6em; font-size: 1em; line-height: 1.4;
    /* строка списка ровно в одну строку текста — как строка дерева слева:
       кегль, межстрочный и высота у них обязаны совпадать до пикселя */
    height: 1lh }
  /* полосатость строк — как в Finder: глазу легче вести строку до правого края */
  .dumb-finder-view[data-view="list"] .dumb-finder-item:nth-child(even) {
    background: var(--dumb-finder-zebra, var(--color-base-200, rgb(0 0 0 / .035))) }
  .dumb-finder-view[data-view="list"] .dumb-finder-item[data-selected="1"]:nth-child(even) {
    background: var(--dumb-finder-sel, color-mix(in oklch, var(--color-primary, #2563eb) 16%, transparent)) }
  .dumb-finder-indent { display: block; height: 1px; flex: none }
  .dumb-finder-view[data-view="list"] .dumb-finder-thumb { aspect-ratio: auto; background: none;
    font-size: 1.1em; width: 1.25em; height: 1.25em }
  .dumb-finder-view[data-view="list"] .dumb-finder-name { margin: 0; font-size: 1em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block }
  .dumb-finder-head { display: grid; grid-template-columns: 18px 22px 1fr 90px 130px 90px; gap: 6px;
                      padding: 2px .6em; font-size: .92em; font-weight: 600;
                      color: var(--dumb-finder-dim, var(--color-base-content, #475569));
                      border-bottom: 1px solid var(--dumb-finder-line, var(--color-base-300, rgb(0 0 0 / .12))) }
  .dumb-finder-head button { font: inherit; color: inherit; background: none; border: 0;
                             padding: 0; cursor: pointer; text-align: left }

  /* заливка */
  .dumb-finder-item button.dumb-finder-twist > .dumb-finder-glyph { width: 10px; height: 10px;
                                                                    transition: transform .12s }
  .dumb-finder-item[data-open="1"] button.dumb-finder-twist > .dumb-finder-glyph {
    transform: rotate(90deg) }
  /* пока файл едет, строка помечается полосой прогресса, а не выцветанием */
  .dumb-finder-bar-progress { position: absolute; left: 6px; right: 6px; bottom: 4px; height: 3px;
                              border-radius: 2px; background: rgb(0 0 0 / .15) }
  .dumb-finder-bar-progress > i { display: block; height: 100%; border-radius: 2px;
                                  background: var(--dumb-finder-drop, var(--color-primary, #2563eb));
                                  transition: width .12s linear }
  .dumb-finder-item[data-failed="1"] { outline: 2px solid var(--dumb-finder-bad, var(--color-error, #b91c1c)) }

  /* статус, пустая папка и ошибка — daisyUI-классы в разметке */
  /* приём файлов из системы: рамка по всей области */
  .dumb-finder-view[data-files="1"] { outline: 2px dashed var(--dumb-finder-drop, var(--color-primary, #2563eb));
                                      outline-offset: -3px }
`

export function DumbFinder(props: DumbFinderProps) {
  injectStyle('finder', STYLES)

  const editable = () => props.editable !== false

  /* ─── где мы и что выделено ─────────────────────────────────────────────── */

  const [ownPath, setOwnPath] = createSignal('')
  const path = () => props.path ?? ownPath()
  const goto = (next: string) => {
    batch(() => {
      setOwnPath(next)
      setSelection(new Set())
      setCursor(-1)
      setAnchor(-1)
      props.onPathChange?.(next)
      props.onSelectionChange?.(new Set())
    })
  }

  const [ownSel, setOwnSel] = createSignal<Set<string>>(new Set())
  const selected = () => props.selected ?? ownSel()
  const setSelection = (next: Set<string>) => {
    setOwnSel(next)
    props.onSelectionChange?.(next)
  }

  const [ownView, setOwnView] = createSignal<FinderView>('grid')
  const view = () => props.view ?? ownView()
  const setView = (next: FinderView) => {
    setOwnView(next)
    props.onViewChange?.(next)
  }

  const [sort, setSort] = createSignal<{ key: SortKey; desc: boolean }>({ key: 'name', desc: false })
  const flipSort = (key: SortKey) =>
    setSort((was) => ({ key, desc: was.key === key ? !was.desc : false }))

  /* ─── содержимое папки ──────────────────────────────────────────────────── */

  const [entries, setEntries] = createSignal<Array<FinderEntry>>([])
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  /**
   * Перечисление отменяемое, и это не украшательство: щёлкая по папкам быстрее,
   * чем отвечает хранилище, легко получить ответ на ПОЗАПРОШЛЫЙ запрос — и он
   * ляжет поверх правильного. Прошлый запрос обрываем всегда.
   */
  let listing: AbortController | null = null
  async function reload(prefix = untrack(path)) {
    listing?.abort()
    const ctrl = new AbortController()
    listing = ctrl
    setLoading(true)
    try {
      const got = await props.source.list(prefix, { signal: ctrl.signal })
      if (ctrl.signal.aborted) return
      batch(() => {
        setEntries(got)
        setError(null)
      })
    } catch (err) {
      if (ctrl.signal.aborted) return
      setEntries([])
      fail(err)
    } finally {
      if (listing === ctrl) {
        listing = null
        setLoading(false)
      }
    }
  }
  watch(path, (p) => void reload(p))
  onCleanup(() => listing?.abort())

  function fail(err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    setError(msg)
    props.onError?.(msg)
  }

  const shown = createMemo(() => sortEntries(entries(), sort().key, sort().desc))
  // вид сменился — число колонок другое
  watch(view, () => queueMicrotask(measureCols), { defer: true })
  const byKey = createMemo(() => new Map(shown().map((e) => [e.key, e])))
  const picked = createMemo(() => [...selected()].filter((k) => byKey().has(k)))

  /* ─── дерево папок слева ────────────────────────────────────────────────── */

  /**
   * Дети каждой известной папки. Спрашиваются ЛЕНИВО: бакет может быть на
   * миллион ключей, и обходить его целиком ради дерева никто не станет.
   *
   * Грузим по двум понятным поводам: дорога от корня до текущей папки и ОДИН
   * уровень вперёд. Уровень вперёд нужен не ради содержимого, а ради стрелки:
   * без него ветка с детьми выглядит листом.
   */
  const [tree, setTree] = createSignal<Record<string, Array<FinderEntry>>>({})
  const inflight = new Set<string>()

  /** сбросить кэш дерева: нужные ветки перечитаются эффектами ниже */
  const bumpTree = () => {
    setTree({})
    setWhole(null)
  }

  async function ensure(prefix: string) {
    if (inflight.has(prefix) || prefix in untrack(tree)) return
    inflight.add(prefix)
    try {
      const got = await props.source.list(prefix, { signal: new AbortController().signal })
      setTree((was) => ({ ...was, [prefix]: got.filter((e) => e.dir) }))
    } catch {
      // молча: дерево — навигация, а не результат. Ошибку покажет список, когда
      // в эту папку зайдут
      setTree((was) => ({ ...was, [prefix]: [] }))
    } finally {
      inflight.delete(prefix)
    }
  }

  /** всё дерево разом, когда хранилище так умеет */
  const [whole, setWhole] = createSignal<Array<FinderEntry> | null>(null)
  let wholeFlight = false
  async function loadWhole() {
    if (wholeFlight || !props.source.tree) return
    wholeFlight = true
    try {
      setWhole(await props.source.tree({ signal: new AbortController().signal }))
    } catch (err) {
      setWhole([])
      fail(err)
    } finally {
      wholeFlight = false
    }
  }

  createEffect(() => {
    if (props.sidebar === false) return
    // умеет отдать всё разом — берём всё разом и по веткам не ходим вовсе
    if (props.source.tree) {
      if (whole() === null) void loadWhole()
      return
    }
    tree()                                   // перечитываем и после сброса кэша
    const here = path()
    for (const c of crumbs(here)) void ensure(c.prefix)
    const kids = untrack(tree)[here] ?? []
    // прогрев на уровень вперёд, но не любой ценой: в папке на двести подпапок
    // это двести запросов, а стрелки там всё равно никто не считает
    if (kids.length <= 24) for (const k of kids) void ensure(k.key)
  })

  /**
   * Вес папки. Плоский листинг его не даёт и дать не может: в S3 папка — это
   * просто общий префикс, и её размер надо сложить по всему, что под ней. Даёт
   * его `source.tree`, поэтому без него у папок вес не показывается вовсе —
   * лучше пусто, чем цифра, которая врёт.
   */
  const weights = createMemo(() => {
    const m = new Map<string, { size?: number; count?: number }>()
    for (const e of whole() ?? []) m.set(e.key, { size: e.size, count: e.count })
    return m
  })
  const weightOf = (e: FinderEntry) => (e.dir ? weights().get(e.key) : undefined)

  /* ─── раскрытие папок прямо в списке ────────────────────────────────────── */

  /**
   * Как в настоящем Finder: в списке папка раскрывается треугольником, а её
   * содержимое встаёт следующими строками с отступом. Своё содержимое каждой
   * раскрытой папки — отдельно от `entries()`: там лежит только текущий уровень.
   *
   * В плитках раскрытия нет — его нет и в Finder: там двойной клик и внутрь.
   */
  const [openRows, setOpenRows] = createSignal<Set<string>>(new Set())
  const [sub, setSub] = createSignal<Record<string, Array<FinderEntry>>>({})
  const subFlight = new Set<string>()

  async function ensureSub(prefix: string) {
    if (subFlight.has(prefix) || prefix in untrack(sub)) return
    subFlight.add(prefix)
    try {
      const got = await props.source.list(prefix, { signal: new AbortController().signal })
      setSub((was) => ({ ...was, [prefix]: got }))
    } catch (err) {
      setSub((was) => ({ ...was, [prefix]: [] }))
      fail(err)
    } finally {
      subFlight.delete(prefix)
    }
  }

  const toggleRow = (key: string) =>
    batch(() => {
      setOpenRows((was) => {
        const next = new Set(was)
        next.has(key) ? next.delete(key) : next.add(key)
        return next
      })
      void ensureSub(key)
    })

  // ушли в другую папку — раскрытое здесь больше не про что
  watch(path, () => batch(() => { setOpenRows(new Set<string>()); setSub({}) }), { defer: true })
  // содержимое перечитали — раскрытые ветки тоже
  createEffect(() => {
    const cache = sub()
    for (const k of openRows()) if (!(k in cache)) void ensureSub(k)
  })

  /**
   * Плоский список строк с уровнем вложенности: раскрытая папка вставляет своё
   * содержимое сразу за собой. Отступ рисуется по `depth`, порядок внутри
   * каждого уровня — свой, тот же `sortEntries`.
   */
  const rows = createMemo<Array<{ e: FinderEntry; depth: number }>>(() => {
    if (view() !== 'list') return shown().map((e) => ({ e, depth: 0 }))
    const out: Array<{ e: FinderEntry; depth: number }> = []
    const walk = (list: Array<FinderEntry>, depth: number) => {
      for (const e of sortEntries(list, sort().key, sort().desc)) {
        out.push({ e, depth })
        if (e.dir && openRows().has(e.key)) walk(sub()[e.key] ?? [], depth + 1)
      }
    }
    walk(entries(), 0)
    return out
  })

  /* ─── заливка ───────────────────────────────────────────────────────────── */

  const [pending, setPending] = createSignal<Array<Pending>>([])
  const patchPending = (id: string, next: Partial<Pending>) =>
    setPending((was) => was.map((p) => (p.id === id ? { ...p, ...next } : p)))

  /**
   * Куда льётся каждый файл. Очередь про папки не знает и в транспорт отдаёт
   * только сам `File` — поэтому папку помним по нему же. `WeakMap`, а не
   * `Map` по id: id в транспорт тоже не приходит, а за выброшенным файлом
   * запись подчистится сама.
   */
  const dest = new WeakMap<File, string>()

  const queue = createUploadQueue(
    (file, ctx) => {
      const up = props.source.upload
      if (!up) return Promise.reject(new Error('заливка не настроена'))
      const to = dest.get(file) ?? untrack(path)
      return up(file, { prefix: to, onProgress: ctx.onProgress, signal: ctx.signal }).then(() => ({
        // очереди нужен `url`, а файндеру он не нужен: список всё равно
        // перечитывается — хранилище отдаст и размер, и дату, и адрес
        url: '',
      }))
    },
    {
      onProgress: (id, f) => patchPending(id, { progress: f }),
      onDone: (id) => {
        setPending((was) => was.filter((p) => p.id !== id))
        // перечитываем, когда очередь опустела: дёргать список на каждый файл
        // из двадцати — двадцать лишних запросов и двадцать перерисовок
        if (!queue.pending()) void reload()
      },
      onError: (id, msg) => {
        patchPending(id, { error: msg })
        props.onError?.(msg)
        if (!queue.pending()) void reload()
      },
    },
    props.concurrency ?? 3,
  )
  onCleanup(() => queue.destroy())

  function enqueue(files: Array<{ name: string; file: File }>, prefix: string) {
    if (!editable() || !props.source.upload || !files.length) return
    const added: Array<Pending> = files.map((f, i) => ({
      id: `u${Date.now().toString(36)}${i}`,
      name: f.name,
      prefix,
      progress: 0,
    }))
    setPending((was) => [...was, ...added])
    added.forEach((p, i) => {
      dest.set(files[i].file, prefix)
      queue.add(p.id, files[i].file)
    })
  }

  const picker = createFileUploader({ accept: props.accept ?? '*', multiple: true })
  const pickFiles = () =>
    picker.selectFiles((files: Array<UploadFile>) =>
      enqueue(files.map((f) => ({ name: f.name, file: f.file })), untrack(path)),
    )

  /** призраки только для текущей папки: залитое в соседнюю тут не при чём */
  const ghosts = createMemo(() => pending().filter((p) => p.prefix === path()))

  /* ─── перенос перетаскиванием ───────────────────────────────────────────── */

  /**
   * Что тащим. Живёт в сигнале, а не только в `dataTransfer`: читать оттуда во
   * время `dragover` браузер не даёт (данные видны лишь на `drop`), а решать,
   * подсвечивать ли папку, надо именно на пролёте.
   */
  const [dragging, setDragging] = createSignal<Array<string>>([])
  const [dropAt, setDropAt] = createSignal<string | null>(null)
  const [overFiles, setOverFiles] = createSignal(false)

  const canMoveTo = (to: string) =>
    !!props.source.move && editable() && dragging().length > 0 &&
    dragging().every((k) => canMove(k, to))

  function startDrag(ev: DragEvent, entry: FinderEntry) {
    if (!props.source.move || !editable()) return
    // тащим выделенное, если схватили одно из выделенного; иначе — только его
    const keys = selected().has(entry.key) ? picked() : [entry.key]
    setDragging(keys)
    ev.dataTransfer?.setData('text/plain', keys.join('\n'))
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
  }

  async function drop(to: string, ev: DragEvent) {
    ev.preventDefault()
    setDropAt(null)
    setOverFiles(false)

    // Файлы разбираем через `readDropEntries`: `dataTransfer.files` плоский, и
    // брошенная папка в нём либо теряется, либо приезжает пустышкой. Забрать
    // записи надо СИНХРОННО — внутри и сделано.
    if (ev.dataTransfer?.types?.includes('Files')) {
      const dropped = await readDropEntries(ev.dataTransfer)
      if (dropped.length) {
        // путь внутри брошенной папки сохраняем: `фото/2026/море.jpg` ляжет
        // в подпапки, а не свалится одной кучей
        for (const d of dropped) {
          const sub = d.path.slice(0, d.path.length - d.file.name.length)
          enqueue([{ name: d.file.name, file: d.file }], `${to}${sub}`)
        }
        return
      }
    }

    const keys = dragging().filter((k) => canMove(k, to))
    setDragging([])
    if (!keys.length || !props.source.move) return
    const back = new Map(keys.map((k) => [k, parentOf(k)]))
    try {
      await props.source.move(keys, to)
      undoStack.push({
        label: `перенос ${keys.length} шт.`,
        // назад по одному: у каждого ключа свой прежний родитель
        undo: async () => {
          for (const [key, home] of back) {
            const moved = `${to}${nameOf(key)}${key.endsWith('/') ? '/' : ''}`
            await props.source.move!([moved], home)
          }
          bumpTree()
          setSub({})
          await reload()
        },
      })
      setSelection(new Set())
      bumpTree()
      setSub({})
      await reload()
    } catch (err) {
      fail(err)
    }
  }

  /** файлы системы отличаем от своих плиток по `types`: у файлов там `Files` */
  const hasFiles = (ev: DragEvent) => !!ev.dataTransfer?.types?.includes('Files')

  function over(to: string, ev: DragEvent) {
    const files = hasFiles(ev)
    if (files ? !(editable() && props.source.upload) : !canMoveTo(to)) return
    ev.preventDefault()
    ev.stopPropagation()
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = files ? 'copy' : 'move'
    setDropAt(to)
  }

  /* ─── отмена ────────────────────────────────────────────────────────────── */

  /**
   * Стек отмены. Перенос откатывается обратным переносом, создание папки — её
   * удалением. Удаление НЕ откатывается: корзины у хранилища нет, и делать вид,
   * что вернём, — обманывать.
   */
  const [undoTick, bumpUndo] = createSignal(0, { equals: false })
  const undoStack = createUndoStack({
    onChange: () => bumpUndo(0),
    onError: (err) => fail(err),
  })
  const canUndo = () => {
    undoTick()
    return undoStack.canUndo()
  }
  const undoLabel = () => {
    undoTick()
    return undoStack.peekUndo()?.label ?? ''
  }

  /* ─── удаление, папка, переименование ───────────────────────────────────── */

  const [busy, setBusy] = createSignal(false)
  /**
   * Спрашиваем ПРЯМО В ТУЛБАРЕ, а не через `confirm()`: тот блокирует вкладку
   * целиком (заливка в это время стоит), выглядит чужим и на нём нельзя
   * написать, что именно удаляется.
   */
  const [confirming, setConfirming] = createSignal(false)
  const [asking, setAsking] = createSignal<null | { kind: 'mkdir'; value: string }>(null)
  const closeAsk = () => {
    setConfirming(false)
    setAsking(null)
  }

  async function run(job: () => Promise<unknown>) {
    setBusy(true)
    try {
      await job()
      // папка появилась, переехала или исчезла — дерево и раскрытые строки
      // обязаны это увидеть
      bumpTree()
      setSub({})
      await reload()
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
      closeAsk()
    }
  }

  const doRemove = () => {
    const keys = picked()
    if (!keys.length || !props.source.remove) return
    void run(async () => {
      await props.source.remove!(keys)
      // без отмены: корзины у хранилища нет, и врать кнопкой не будем
      undoStack.push({ label: `удаление ${keys.length} шт.`, undo: null })
      setSelection(new Set())
    })
  }

  const doMkdir = (name: string) => {
    // слэши по краям режем: `/фото/` и `фото` — одна и та же папка, а вот
    // слэш ВНУТРИ имени осмысленный, им создают сразу вложенную
    const clean = name.trim().replace(/^\/+|\/+$/g, '')
    if (!clean || !props.source.mkdir) return closeAsk()
    const made = `${joinPrefix(path(), clean)}/`
    void run(async () => {
      await props.source.mkdir!(made)
      if (props.source.remove) {
        undoStack.push({
          label: `папка «${clean}»`,
          undo: async () => {
            await props.source.remove!([made])
            bumpTree()
            await reload()
          },
        })
      }
    })
  }

  const doAsk = () => {
    const a = asking()
    if (a) doMkdir(a.value)
  }

  /* ─── клавиши ───────────────────────────────────────────────────────────── */

  /**
   * Курсор клавиатуры и якорь диапазона. Отдельно от выделения: Ctrl+стрелка
   * двигает курсор, ничего не выделяя, а Shift растягивает ОТ ЯКОРЯ, который
   * при этом не уползает.
   */
  const [cursor, setCursor] = createSignal(-1)
  const [anchor, setAnchor] = createSignal(-1)

  /** сколько плиток в ряду — для стрелок вверх/вниз в сетке */
  const [cols, setCols] = createSignal(1)
  let itemsBox: HTMLDivElement | undefined
  const measureCols = () => {
    // читаем не элементы, а вычисленный шаблон сетки: количество треков в
    // `grid-template-columns` браузер уже посчитал, это не forced layout
    if (!itemsBox) return
    const t = getComputedStyle(itemsBox).gridTemplateColumns
    setCols(view() === 'list' ? 1 : Math.max(1, t.split(' ').filter(Boolean).length))
  }

  function onKey(ev: KeyboardEvent) {
    // стрелки: курсор ходит, выделение следует за ним по правилам модификаторов
    if (isMoveKey(ev.key)) {
      const list = rows().map((r) => r.e.key)
      const next = moveIndex(ev.key, {
        from: cursor(),
        count: list.length,
        columns: cols(),
        page: 6,
      })
      if (next === null) return
      ev.preventDefault()
      const res = moveSelection({
        keys: list,
        anchor: anchor(),
        next,
        current: selected(),
        shift: ev.shiftKey,
        ctrl: ev.metaKey || ev.ctrlKey,
      })
      batch(() => {
        setCursor(next)
        setAnchor(res.anchor)
        setSelection(res.selected)
      })
      // Строка под курсором должна остаться видимой. Ищем по ПОРЯДКУ, а не по
      // селектору с ключом: ключ — это путь, в нём бывает что угодно, и его
      // пришлось бы прогонять через `CSS.escape` на каждое нажатие стрелки.
      const el = itemsBox?.children[next] as HTMLElement | undefined
      el?.scrollIntoView({ block: 'nearest' })
      return
    }
    if (ev.key === 'Escape') return setSelection(new Set())
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'a') {
      ev.preventDefault()
      return setSelection(new Set(shown().map((e) => e.key)))
    }
    if (ev.key === 'Backspace' && path()) {
      ev.preventDefault()
      return goto(parentOf(path()))
    }
    if (ev.key === 'Delete' && picked().length && props.source.remove && canWrite()) {
      ev.preventDefault()
      return setConfirming(true)
    }
    if (ev.key === 'Enter') {
      const one = byKey().get(picked()[0])
      if (one) open(one)
    }
  }

  const open = (entry: FinderEntry) => (entry.dir ? goto(entry.key) : props.onOpen?.(entry))

  /* ─── разметка ──────────────────────────────────────────────────────────── */

  const totals = createMemo(() => {
    let dirs = 0
    let files = 0
    let size = 0
    for (const e of entries()) {
      if (e.dir) dirs++
      else {
        files++
        size += e.size ?? 0
      }
    }
    return { dirs, files, size }
  })

  const canWrite = () => editable() && !busy()

  /**
   * Раскрытые ветки. Помним между заходами — иначе каждый раз разворачивай
   * дерево заново. Хранилище может быть недоступно (приватный режим, SSR),
   * поэтому обе операции под try.
   */
  const memKey = () => `${props.treeKey ?? 'dumb-finder'}:opened`
  const [opened, setOpened] = createSignal<Set<string>>(
    (() => {
      try {
        return new Set<string>(JSON.parse(localStorage.getItem(memKey()) ?? '[]'))
      } catch {
        return new Set<string>()
      }
    })(),
  )
  const toggleNode = (key: string) =>
    setOpened((was) => {
      const next = new Set(was)
      next.has(key) ? next.delete(key) : next.add(key)
      try {
        localStorage.setItem(memKey(), JSON.stringify([...next]))
      } catch {
        /* не сохранилось — не беда, это удобство, а не данные */
      }
      return next
    })

  /** фильтр по имени папки: показываем совпавшие и дорогу к ним */
  const [find, setFind] = createSignal('')
  const matched = createMemo(() => {
    const q = find().trim().toLowerCase()
    if (!q) return null
    const keep = new Set<string>()
    for (const key of kidsOf().keys()) {
      for (const k of kidsOf().get(key) ?? []) {
        if (!k.name.toLowerCase().includes(q)) continue
        let cur = k.key
        while (cur) { keep.add(cur); cur = parentOf(cur) }
      }
    }
    return keep
  })

  /** дети каждой папки — одной картой, из чего бы дерево ни собралось */
  const kidsOf = createMemo(() => {
    const m = new Map<string, Array<FinderEntry>>()
    const put = (parent: string, e: FinderEntry) => {
      const a = m.get(parent) ?? []
      if (!a.some((x) => x.key === e.key)) a.push(e)
      m.set(parent, a)
    }
    const all = whole()
    if (all) {
      for (const e of all) {
        const key = e.key.endsWith('/') ? e.key : `${e.key}/`
        put(parentOf(key), { ...e, key, name: nameOf(key) })
      }
    } else {
      for (const [prefix, kids] of Object.entries(tree())) for (const k of kids) put(prefix, k)
    }
    for (const a of m.values()) a.sort((x, y) => x.name.localeCompare(y.name, undefined, { numeric: true }))
    return m
  })

  /**
   * Ветка дерева. Рекурсивная и совсем простая: строка — это `li`, вложенные —
   * такой же `ul` внутри. Отступ уровня даёт сам вложенный список, поэтому
   * ничего считать не надо.
   */
  function Branch(p: { prefix: string; depth: number }): JSX.Element {
    const kids = () => {
      const all = kidsOf().get(p.prefix) ?? []
      const keep = matched()
      return keep ? all.filter((k) => keep.has(k.key)) : all
    }
    return (
      <For each={kids()}>
        {(e) => {
          const open = () => opened().has(e.key) || !!matched()
          const w = () => weights().get(e.key)
          return (
            <li>
              <div
                class="dumb-finder-node"
                data-here={path() === e.key ? '1' : undefined}
                data-open={open() ? '1' : undefined}
                data-drop={dropAt() === e.key && path() !== e.key ? '1' : undefined}
                title={e.name}
                onClick={() => goto(e.key)}
                onDragOver={(ev) => over(e.key, ev)}
                onDragLeave={() => setDropAt(null)}
                onDrop={(ev) => {
                  ev.stopPropagation()
                  void drop(e.key, ev)
                }}
              >
                {/* нет детей — распорка той же ширины, иначе имена скачут */}
                <Show
                  when={(kidsOf().get(e.key)?.length ?? 0) > 0}
                  fallback={<span class="dumb-finder-twist" />}
                >
                  <button
                    type="button"
                    class="dumb-finder-twist"
                    data-no-select
                    title={open() ? 'свернуть' : 'развернуть'}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      toggleNode(e.key)
                    }}
                  >
                    {/* значок ОДИН, раскрытие — поворотом: так он не прыгает
                        между двумя разными глифами и анимируется даром */}
                    <Show when={props.icons?.twist} fallback={open() ? '▾' : '▸'}>
                      <span class={`dumb-finder-glyph ${props.icons!.twist}`} />
                    </Show>
                  </button>
                </Show>
                <Glyph entry={e} open={open()} />
                <span class="dumb-finder-node-name">{e.name}</span>
                <Show when={w()?.size !== undefined}>
                  <span class="dumb-finder-weight">
                    {w()!.count ?? 0} · {fmtSize(w()!.size!)}
                  </span>
                </Show>
              </div>
              <Show when={open()}>
                <ul>
                  <Branch prefix={e.key} depth={p.depth + 1} />
                </ul>
              </Show>
            </li>
          )
        }}
      </For>
    )
  }

  /** панели ресайзимой раскладки: render prop, как их просит ResizableGrid */
  /**
   * Дерево папок. Своя разметка, а не DumbTree: там она размечена классами
   * Tailwind/daisyUI, и половина возни уходила на то, чтобы гасить чужие
   * отступы, прокрутки и «рельсы» уровней. Здесь ul/li свои, стили рядом, в
   * одном CSS этого же файла — править нечего в трёх местах.
   */
  const SIDE = () => (
    <nav class="dumb-finder-side">
      <input
        class="dumb-finder-find input input-xs w-full"
        placeholder="папка"
        value={find()}
        onInput={(ev) => setFind(ev.currentTarget.value)}
      />
      <ul class="dumb-finder-tree">
        <Branch prefix="" depth={0} />
      </ul>
    </nav>
  )

  const FILES = () => (
<SelectionArea
          selectables=".dumb-finder-item"
          selected={selected}
          onChange={setSelection}
          class="dumb-finder-body"
          style={{ height: '100%' }}
          // жест не начинаем с уже выделенной плитки: с неё начинается ПЕРЕНОС, а
          // движок выделения на `pointercancel` (его шлёт браузер, начиная драг)
          // счёл бы это кликом и схлопнул выделение до одной
          onBeforeStart={(ev) => {
            const el = (ev.target as HTMLElement | null)?.closest('.dumb-finder-item')
            const key = el?.getAttribute('data-key')
            return !(key && selected().has(key))
          }}
        >
          {/* тот же div несёт клавиши, приём файлов и дроп «в текущую папку» */}
          <div
            class="dumb-finder-view"
            tabindex={0}
            data-view={view()}
            data-files={overFiles() ? '1' : undefined}
            onKeyDown={onKey}
            onDragOver={(ev) => {
              if (hasFiles(ev)) {
                if (!(editable() && props.source.upload)) return
                ev.preventDefault()
                setOverFiles(true)
              } else if (canMoveTo(path())) {
                ev.preventDefault()
                setDropAt(path())
              }
            }}
            onDragLeave={(ev) => {
              if (ev.relatedTarget) return
              setOverFiles(false)
              setDropAt(null)
            }}
            onDrop={(ev) => void drop(path(), ev)}
          >
            <Show when={view() === 'list'}>
              <div class="dumb-finder-head">
                <span />
                <span />
                <button type="button" onClick={() => flipSort('name')}>
                  Имя {mark(sort(), 'name')}
                </button>
                <button type="button" onClick={() => flipSort('size')}>
                  Размер {mark(sort(), 'size')}
                </button>
                <button type="button" onClick={() => flipSort('modified')}>
                  Изменён {mark(sort(), 'modified')}
                </button>
                <span>Вид</span>
              </div>
            </Show>
  
            <div
            class="dumb-finder-items"
            ref={(el) => {
              itemsBox = el
              queueMicrotask(measureCols)
            }}
          >
              <For each={rows()}>
                {(row) => {
                  const entry = row.e
                  return (
                  <div
                    class="dumb-finder-item"
                    data-key={entry.key}
                    data-selected={selected().has(entry.key) ? '1' : undefined}
                    data-dir={entry.dir ? '1' : undefined}
                  data-open={openRows().has(entry.key) ? '1' : undefined}
                    data-drop={entry.dir && dropAt() === entry.key ? '1' : undefined}
                    draggable={canWrite() && !!props.source.move}
                    title={entry.name}
                    onDblClick={() => open(entry)}
                    onDragStart={(ev) => startDrag(ev, entry)}
                    onDragEnd={() => {
                      setDragging([])
                      setDropAt(null)
                    }}
                    onDragOver={(ev) => entry.dir && over(entry.key, ev)}
                    onDragLeave={() => entry.dir && setDropAt(null)}
                    onDrop={(ev) => {
                      if (!entry.dir) return
                      ev.stopPropagation()
                      void drop(entry.key, ev)
                    }}
                  >
                    {props.children?.(entry, { selected: selected().has(entry.key), view: view() }) ?? (
                      <>
                        <Show when={view() === 'list'}>
                          {/* отступ уровня — отдельной распоркой, а не padding'ом
                              строки: иначе подсветка выделения обрезается по нему */}
                          <span
                            class="dumb-finder-indent"
                            style={{ width: `${row.depth * 15}px` }}
                          />
                          <Show
                            when={entry.dir}
                            fallback={<span class="dumb-finder-twist" />}
                          >
                            <button
                              type="button"
                              class="dumb-finder-twist"
                              data-no-select
                              data-no-drag
                              draggable={false}
                              title={openRows().has(entry.key) ? 'свернуть' : 'развернуть'}
                              onClick={(ev) => {
                                ev.stopPropagation()
                                toggleRow(entry.key)
                              }}
                            >
                              <Show
                                when={props.icons?.twist}
                                fallback={openRows().has(entry.key) ? '▾' : '▸'}
                              >
                                <span class={`dumb-finder-glyph ${props.icons!.twist}`} />
                              </Show>
                            </button>
                          </Show>
                        </Show>
                        <div class="dumb-finder-thumb">
                          <Show
                            when={!entry.dir && entry.url && kindOf(entry.name) === 'image'}
                            fallback={<Glyph entry={entry} open={openRows().has(entry.key)} />}
                          >
                            {/* грузим лениво: в папке на триста картинок иначе
                                триста запросов разом */}
                            <img src={entry.url} alt="" loading="lazy" draggable={false} />
                          </Show>
                        </div>
                        <div class="dumb-finder-name">{entry.name}</div>
                        <Show when={view() === 'list'}>
                          <div class="dumb-finder-meta">
                            {entry.dir
                              ? weightOf(entry)?.size !== undefined
                                ? fmtSize(weightOf(entry)!.size!)
                                : ''
                              : fmtSize(entry.size ?? 0)}
                          </div>
                          <div class="dumb-finder-meta">
                            {entry.modified ? fmtDateTimeShort(entry.modified) : ''}
                          </div>
                          <div class="dumb-finder-meta">
                            {entry.dir && weightOf(entry)?.count !== undefined
                              ? `${weightOf(entry)!.count} файл.`
                              : kindLabel(entry)}
                          </div>
                        </Show>
                        <Show when={view() === 'grid' && !entry.dir && entry.size !== undefined}>
                          <div class="dumb-finder-meta">{fmtSize(entry.size!)}</div>
                        </Show>
                        <Show when={view() === 'grid' && entry.dir && weightOf(entry)?.size !== undefined}>
                          <div class="dumb-finder-meta">
                            {fmtSize(weightOf(entry)!.size!)}
                            {weightOf(entry)!.count ? ` · ${weightOf(entry)!.count}` : ''}
                          </div>
                        </Show>
                      </>
                    )}
                  </div>
                  )
                }}
              </For>
  
              {/* призраки заливки идут последними: их ещё нет в хранилище */}
              <For each={ghosts()}>
                {(p) => (
                  <div class="dumb-finder-item" data-pending="1" data-failed={p.error ? '1' : undefined}>
                    <div class="dumb-finder-thumb">⬆</div>
                    <div class="dumb-finder-name">{p.name}</div>
                    <div class="dumb-finder-meta">
                      {p.error ?? `${Math.round(p.progress * 100)}%`}
                    </div>
                    <Show when={!p.error}>
                      <span class="dumb-finder-bar-progress">
                        <i style={{ width: `${Math.round(p.progress * 100)}%` }} />
                      </span>
                    </Show>
                  </div>
                )}
              </For>
            </div>
  
            <Show when={!shown().length && !ghosts().length && !loading()}>
              <div class="dumb-finder-empty p-6 text-center">
                {editable() && props.source.upload ? 'Пусто. Брось сюда файлы.' : 'Пусто.'}
              </div>
            </Show>
          </div>
  </SelectionArea>
  )

  /**
   * Кнопка тулбара: значок И подпись, а не одна иконка.
   *
   * «Удалить 3» несёт число, которого голая корзина не скажет, а иконка без
   * подписи в чужой теме легко ужимается до невидимой точки — по этим кнопкам
   * ещё и попадать надо. Нужен голый значок — потребитель прячет подпись своим
   * CSS, разметка это позволяет.
   */
  function BarButton(p: { icon?: string; onClick: () => void; children: JSX.Element }) {
    return (
      <button type="button" class="dumb-finder-btn btn btn-xs btn-ghost" onClick={p.onClick}>
        <Show when={p.icon}>
          <span class={`dumb-finder-glyph ${p.icon}`} />
        </Show>
        <span>{p.children}</span>
      </button>
    )
  }

  /** чем рисовать значок: классом от потребителя или эмодзи */
  function Glyph(p: { entry: FinderEntry; open?: boolean }) {
    const kind = (): FileKind | 'dir' | 'dirOpen' =>
      p.entry.dir ? (p.open ? 'dirOpen' : 'dir') : kindOf(p.entry.name)
    const cls = () => {
      const set = props.icons
      if (!set) return undefined
      // у закрытой папки берём её же значок, если открытой не дали
      return set[kind()] ?? (kind() === 'dirOpen' ? set.dir : undefined)
    }
    return (
      <Show
        when={cls()}
        fallback={p.entry.dir ? (p.open ? '\u{1F4C2}' : ICONS.dir) : ICONS[kindOf(p.entry.name)]}
      >
        <span class={`dumb-finder-glyph ${cls()}`} />
      </Show>
    )
  }

  return (
    <div class={`dumb-finder ${props.class ?? ''}`} style={props.style}>
      <div class="dumb-finder-bar">
        {/*
          Разметка крошек — `nav > ul > li`, ровно та, которую ждут готовые
          хлебные крошки (у daisyUI это класс `breadcrumbs`). Свой разделитель
          рисуем через переменную, чтобы при таком классе его можно было
          погасить (`--dumb-finder-crumb-sep: none`) и не получить два подряд.
        */}
        <nav class="dumb-finder-crumbs">
          <ul>
            <For each={crumbs(path(), props.rootLabel ?? 'Всё')}>
              {(c) => (
                <li>
                <button
                  type="button"
                  class="dumb-finder-crumb"
                  aria-current={c.prefix === path()}
                  data-drop={dropAt() === c.prefix && c.prefix !== path() ? '1' : undefined}
                  onClick={() => goto(c.prefix)}
                  onDragOver={(ev) => c.prefix !== path() && over(c.prefix, ev)}
                  onDragLeave={() => setDropAt(null)}
                  onDrop={(ev) => void drop(c.prefix, ev)}
                >
                  {c.name}
                </button>
                </li>
              )}
            </For>
          </ul>
        </nav>

        {/* словами, а не значками: значок в чужой теме легко ужимается до
            невидимой точки, а по этим кнопкам ещё и попадать надо */}
        <BarButton icon={props.icons?.refresh} onClick={() => { bumpTree(); void reload() }}>
          Обновить
        </BarButton>
        <BarButton
          icon={view() === 'grid' ? props.icons?.viewList : props.icons?.viewGrid}
          onClick={() => setView(view() === 'grid' ? 'list' : 'grid')}
        >
          {view() === 'grid' ? 'Списком' : 'Плитками'}
        </BarButton>

        <Show when={canWrite() && props.source.mkdir}>
          <BarButton icon={props.icons?.mkdir} onClick={() => setAsking({ kind: 'mkdir', value: '' })}>
            Новая папка
          </BarButton>
        </Show>
        <Show when={canWrite() && props.source.upload}>
          <BarButton icon={props.icons?.upload} onClick={pickFiles}>
            Залить
          </BarButton>
        </Show>
        <Show when={canWrite() && canUndo()}>
          <BarButton icon={props.icons?.undo} onClick={() => void undoStack.undo()}>
            Отменить: {undoLabel()}
          </BarButton>
        </Show>
        <Show when={canWrite() && props.source.remove && picked().length > 0}>
          <BarButton icon={props.icons?.remove} onClick={() => setConfirming(true)}>
            Удалить {picked().length}
          </BarButton>
        </Show>
      </div>

      {/* строка вопроса: подтверждение и ввод имени живут здесь, а не в `confirm()` */}
      <Show when={confirming() && picked().length}>
        <div class="dumb-finder-bar">
          <span class="dumb-finder-err text-error">
            Удалить безвозвратно: {picked().map(nameOf).join(', ')}
          </span>
          <button type="button" onClick={doRemove}>
            Да, удалить
          </button>
          <button type="button" onClick={closeAsk}>
            Отмена
          </button>
        </div>
      </Show>
      <Show when={asking()}>
        {(a) => (
          <div class="dumb-finder-bar">
            <input
              autofocus
              placeholder="имя папки"
              value={a().value}
              onInput={(ev) => setAsking({ kind: 'mkdir', value: ev.currentTarget.value })}
              onKeyDown={(ev) => {
                if (ev.key === 'Escape') closeAsk()
                if (ev.key === 'Enter') doAsk()
              }}
            />
            <button type="button" onClick={doAsk}>
              Готово
            </button>
            <button type="button" onClick={closeAsk}>
              Отмена
            </button>
          </div>
        )}
      </Show>

      <Show when={error()}>
        <div class="dumb-finder-err alert alert-error py-1 text-sm">{error()}</div>
      </Show>

      {/*
        Границу «дерево | файлы» тянут мышью — это `ResizableGrid` кита, а не
        своя ручка: он уже умеет и минимумы, и запоминание размеров. Без дерева
        ресайзить нечего, поэтому вторая ветка — просто файлы во всю ширину.
      */}
      <div class="dumb-finder-main" style={{ height: props.height ?? '60vh' }}>
        <Show
          when={props.sidebar !== false}
          fallback={FILES()}
        >
          <ResizableGrid
            class="dumb-finder-split"
            storageKey={`${props.treeKey ?? 'dumb-finder'}:split`}
            cols={[
              { id: 'tree', content: SIDE, min: 170, initial: 1 },
              { id: 'files', content: FILES, min: 320, initial: 3.2 },
            ]}
          />
        </Show>
      </div>

      <div class="dumb-finder-status px-1.5 py-1 text-sm">
        <Show when={loading()} fallback={
          <>
            папок: {totals().dirs} · файлов: {totals().files} · {fmtSize(totals().size)}
            <Show when={picked().length}>{` · выделено: ${picked().length}`}</Show>
            {/* счётчик берём из СИГНАЛА, а не из `queue.pending()`: тот
                обычная функция, и строка бы застыла на первом значении */}
            <Show when={pending().length}>{` · заливается: ${pending().length}`}</Show>
          </>
        }>
          читаю…
        </Show>
      </div>
    </div>
  )
}

/** человеческое имя вида файла — колонка «Вид», как в Finder */
const KIND_LABEL: Record<string, string> = {
  image: 'Картинка',
  video: 'Видео',
  audio: 'Звук',
  pdf: 'PDF',
  archive: 'Архив',
  text: 'Текст',
  file: 'Файл',
}
const kindLabel = (e: FinderEntry) => (e.dir ? 'Папка' : KIND_LABEL[kindOf(e.name)])

/** стрелка у заголовка колонки, по которой сейчас сортируем */
const mark = (s: { key: SortKey; desc: boolean }, key: SortKey) =>
  s.key === key ? (s.desc ? '↓' : '↑') : ''
