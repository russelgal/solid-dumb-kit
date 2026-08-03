import { JSX } from 'solid-js';

type ToastKind = 'info' | 'success' | 'error';
/** кнопка в плашке */
type ToastAction = {
    label: string;
    run?: () => void;
    /** выделить: главное действие или опасное */
    kind?: 'primary' | 'danger';
    /** не закрывать плашку после нажатия; по умолчанию закрывает */
    keepOpen?: boolean;
};
/**
 * Где показать плашку. `pointer` — там, где сейчас указатель: вопрос про
 * конкретную строку удобнее читать рядом с ней, а не в углу экрана, куда ещё
 * надо перевести взгляд.
 */
type ToastAt = {
    x: number;
    y: number;
} | 'pointer';
type Toast = {
    id: number;
    kind: ToastKind;
    text: string;
    /** сколько раз это же сообщение повторилось */
    count: number;
    /** кнопки рядом с текстом */
    actions?: Array<ToastAction>;
    /** у курсора или в своей точке; не задано — в общей стопке */
    at?: ToastAt;
    /** сколько держать, мс; 0 — до закрытия руками */
    ttl: number;
    /**
     * Показывать ли крестик. У ВОПРОСА его нет: закрыть плашку, не ответив, —
     * это неявный ответ, а какой именно, никто не знает. Отвечают кнопками.
     */
    closable: boolean;
};
type ToastOptions = {
    ttl?: number;
    at?: ToastAt;
    /** одна кнопка — частый случай, поэтому и короткая запись, и общая */
    action?: ToastAction;
    actions?: Array<ToastAction>;
    closable?: boolean;
};
type ToastBus = {
    list: () => Array<Toast>;
    info: (text: string, opts?: ToastOptions) => number;
    success: (text: string, opts?: ToastOptions) => number;
    error: (text: string, opts?: ToastOptions) => number;
    /**
     * Плашка-ВОПРОС: не гаснет сама, крестика нет, закрывается только ответом.
     * Неблокирующая замена `confirm()`: тот останавливает вкладку целиком —
     * вместе с идущей заливкой, — и написать в нём, что именно случится, нельзя.
     */
    ask: (text: string, actions: Array<ToastAction>, opts?: ToastOptions) => number;
    /** самый ходовой вопрос: да или нет. `true` — нажали подтверждение */
    confirm: (text: string, opts?: {
        yes?: string;
        no?: string;
        danger?: boolean;
        at?: ToastAt;
    }) => Promise<boolean>;
    dismiss: (id: number) => void;
    clear: () => void;
    /** остановить и возобновить таймеры: под курсором сообщение не уезжает */
    pause: () => void;
    resume: () => void;
    subscribe: (fn: () => void) => () => void;
};
declare function createToastBus(defaults?: {
    ttl?: number;
}): ToastBus;
/**
 * Общая шина на приложение. Отдельный экземпляр нужен редко (тесты, две
 * независимые области), поэтому по умолчанию — одна на всех.
 */
declare const toast: ToastBus;

type DumbToasterProps = {
    /** своя шина; не задана — общая */
    bus?: ToastBus;
    /** где показывать; по умолчанию снизу справа */
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
    /** больше стольких сразу не показывать; по умолчанию 4 */
    max?: number;
    /** своя плашка */
    children?: (t: Toast, dismiss: () => void) => JSX.Element;
    class?: string;
};
declare function DumbToaster(props: DumbToasterProps): JSX.Element;

export { DumbToaster, type DumbToasterProps, type Toast, type ToastBus, type ToastKind, type ToastOptions, createToastBus, toast };
