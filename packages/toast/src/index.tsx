export { DumbToaster, type DumbToasterProps } from './DumbToaster'

/**
 * Шина сообщений: `toast.error(...)` зовётся откуда угодно, в том числе из
 * кода, который про разметку не знает. Компонент только рисует очередь.
 */
export { toast, createToastBus, type Toast, type ToastBus, type ToastKind, type ToastOptions } from './toast'
