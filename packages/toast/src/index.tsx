export { DumbToaster, type DumbToasterProps } from './DumbToaster'

/**
 * Центр уведомлений: погасшая плашка не пропадает, а оседает в панели у края
 * — как в macOS. Панель и её колокольчик живут в top layer (Popover API).
 */
export { DumbToastCenter, ago, type DumbToastCenterProps } from './DumbToastCenter'

/**
 * Шина сообщений: `toast.error(...)` зовётся откуда угодно, в том числе из
 * кода, который про разметку не знает. Компонент только рисует очередь.
 */
export { toast, createToastBus, type Toast, type ToastBus, type ToastKind, type ToastOptions } from './toast'
