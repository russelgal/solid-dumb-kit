// Общий слой кита: то, на чём стоят все остальные пакеты.
//
// Раньше это была внутренность одной репы, и наружу торчали только `createFlip`
// с `createAutoScroller`. Теперь пакеты разъехались, и всё, что нужно им друг от
// друга, обязано быть публичным — иначе `@solid-dumb-kit/grid` не возьмёт
// `shouldAnimate`, не подглядывая в чужие файлы. Поэтому здесь выложено всё
// содержимое, а не выборка.
//
// Пакет самодостаточный: ни одной внешней зависимости, только браузерные API.

/** Анимации: анимировать или молча выключиться при prefers-reduced-motion. */
export { prefersReducedMotion, shouldAnimate } from './motion'

/**
 * Сторона кнопки закрытия: в macOS слева, в Windows/Linux справа. Кит смотрит
 * на платформу сам; перебивается пропом компонента или общей настройкой.
 */
export {
  configureCloseSide,
  isApplePlatform,
  resolveCloseSide,
  type CloseSide,
  type CloseSideOption,
} from './closeSide'

// совместимость Solid 1 ↔ Solid 2: пропавшие в Solid 2 API берём только отсюда
export { batch, onMounted, watch } from './solidCompat'

/** Разовый инжект стилей в `<head>` — переживает размонтирование компонента. */
export { injectStyle } from './injectStyle'

/**
 * Неизменный порядок рендера: показ идёт через CSS `order`, а разметка не
 * шевелится. Порядок — по появлению, а не по id: сортировка по id стабильна, но
 * читать разметку после неё нельзя (`r10` раньше `r2`).
 */
export { createStableOrder, type StableOrder } from './stableOrder'

/** FLIP: элементу говорят, куда отъехать, — он доезжает `transform`ом. */
export { createFlip, type Flip } from './flip'

/** Автопрокрутка во время перетаскивания: в кадре не читает ничего. */
export { createAutoScroller, type AutoScroller } from './autoScroll'

/**
 * Вьюпорт и скроллеры. `measure` — единственное синхронное чтение геометрии, и
 * делается оно один раз на старте жеста; `scrollOf`/`viewOrigin` покадрово
 * читают только `scrollTop`/`scrollLeft`, а это не forced reflow.
 */
export {
  type ViewGeom,
  EDGE,
  MAX_SPEED,
  ACCEL,
  scrollParent,
  measure,
  scrollOf,
  doScroll,
  viewOrigin,
  autoScrollSpeed,
} from './viewport'

/**
 * Подавление выделения текста на время жеста. Через эти функции, а не
 * `body.style.userSelect` напрямую: Safari смотрит на `-webkit-user-select`, и к
 * моменту старта жеста браузер уже успевает что-то выделить.
 */
export { suppressTextSelection, restoreTextSelection } from './textSelection'

/**
 * Когда жест вообще начинается: интерактивные цели пропускаем, долгое нажатие и
 * порог сдвига считаем здесь же.
 */
export {
  NO_DRAG,
  LONGPRESS,
  MOVE_TOL,
  targetIsInteractive,
  focusInside,
  createPressGate,
  type PressGate,
  type PressGateOptions,
} from './gesture'

/**
 * Очередь заливки: без DOM и без фреймворка. Живёт здесь, а не в галерее,
 * потому что заливают файлы и другие пакеты (`finder`), а к плиткам очередь
 * не привязана ничем.
 */
export {
  createUploadQueue,
  type UploadQueue,
  type Uploader,
  type UploadResult,
  type QueueEvents,
} from './uploadQueue'

/**
 * Заливка по подписанной ссылке — то, чем это делается с S3-совместимым
 * хранилищем. Ключей от бакета браузер не видит: их место на сервере.
 */
export {
  createPresignedUploader,
  putWithProgress,
  type Presigned,
  type PresignedOptions,
} from './presigned'

/**
 * Виртуализация без единого замера элемента: размер строки заявлен, окно
 * считается арифметикой, из DOM берётся только `scrollTop` и (через
 * `ResizeObserver`) высота скроллера.
 */
export {
  createVirtualizer,
  scrollOffsetFor,
  MAX_SCROLL_HEIGHT,
  type Virtual,
  type VirtualOptions,
  type VirtualRange,
} from './virtual'

/**
 * Порядок строк для длинных списков: сортировка и фильтр считаются в воркере и
 * ПРЕРЫВАЮТСЯ на полуслове, когда пришёл запрос посвежее. Наружу отдаётся
 * `Uint32Array` номеров строк — сами данные никто не двигает.
 */
export {
  createRowIndex,
  type RowIndex,
  type RowIndexOptions,
  type RowIndexResult,
  type RowIndexProgress,
  type RowColumn,
  type RowQuery,
  type SortDir,
} from './rowIndex'

/**
 * Бросок ПАПКИ, а не только файлов: `dataTransfer.files` плоский, дерево лежит
 * в `webkitGetAsEntry()`, и забрать его надо синхронно, до первого `await`.
 */
export { readDropEntries, hasDirectories, type DroppedFile } from './dropEntries'

/**
 * Отмена действия. Стек хранит пары «сделать/отменить», а не снимки состояния:
 * шаг, который отменить нельзя (удаление без корзины), помечается честно.
 */
export {
  createUndoStack,
  type UndoStack,
  type UndoStep,
  type UndoOptions,
} from './undo'

/** Клавиатура по списку и сетке: куда уводит стрелка и что становится выделено. */
export { moveIndex, moveSelection, isMoveKey, type MoveArgs, type MoveKey } from './roving'

/** Правка подписи на месте: Enter сохраняет, Esc забывает, ошибка не съедает набранное. */
export { createInlineEdit, type InlineEdit, type InlineEditOptions } from './inlineEdit'

/**
 * Заливка большого файла частями: обрыв стоит одного куска, а не всего файла.
 * Подписи и сборка — на твоём сервере.
 */
export {
  uploadMultipart,
  shouldSplit,
  type MultipartOptions,
  type MultipartHandshake,
  type UploadedPart,
} from './multipart'
