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
