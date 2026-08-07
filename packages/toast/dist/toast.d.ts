export type ToastKind = 'info' | 'success' | 'error';
/** кнопка в плашке */
export type ToastAction = {
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
export type ToastAt = {
    x: number;
    y: number;
} | 'pointer';
export type Toast = {
    id: number;
    kind: ToastKind;
    text: string;
    /**
     * Жирная первая строка — как в системных уведомлениях: «что случилось» видно
     * раньше подробностей. Не задан — плашка в одну строку, как раньше.
     */
    title?: string;
    /**
     * Класс значка (iconify и любой другой): своих иконок кит не несёт. Не задан
     * — рисуется знак по виду сообщения.
     */
    icon?: string;
    /** когда появилось; по нему история пишет «5 мин назад» */
    time: number;
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
    /**
     * Уезжает ли плашка в историю, когда погаснет. У вопроса — нет: на него уже
     * ответили, и в списке прочитанного ему делать нечего.
     */
    archive: boolean;
    /**
     * Плашку закрыли — крестиком, кликом мимо, `clear()` или таймером. Зовётся и
     * после ответа кнопкой: у вопроса это удобно — обещание уже разрешено, и
     * второй вызов ничего не меняет, а вот отказ иначе было бы не поймать.
     */
    onDismiss?: () => void;
};
export type ToastOptions = {
    /** жирная первая строка */
    title?: string;
    /** класс значка; не задан — знак по виду сообщения */
    icon?: string;
    ttl?: number;
    at?: ToastAt;
    /** одна кнопка — частый случай, поэтому и короткая запись, и общая */
    action?: ToastAction;
    actions?: Array<ToastAction>;
    closable?: boolean;
    /** класть ли в историю; по умолчанию да */
    archive?: boolean;
    /** плашку закрыли, не нажав кнопку действия */
    onDismiss?: () => void;
};
export type ToastBus = {
    list: () => Array<Toast>;
    /**
     * Плашки, которые уже ушли из очереди, но ещё летят в историю. Держатся
     * ровно `leaveMs`, дальше исчезают сами. Нужны только тому, кто рисует:
     * убрать элемент из DOM мгновенно — значит не показать сам полёт.
     */
    leaving: () => Array<Toast>;
    /** прочитанное, свежее первым */
    history: () => Array<Toast>;
    /** сколько прилетело с тех пор, как историю открывали в последний раз */
    unread: () => number;
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
    /** убрать одну запись из истории */
    forget: (id: number) => void;
    /** очистить историю целиком */
    clearHistory: () => void;
    /** открыта ли панель истории — состояние общее, открыть её могут откуда угодно */
    historyOpen: () => boolean;
    showHistory: () => void;
    hideHistory: () => void;
    toggleHistory: () => void;
    /** остановить и возобновить таймеры: под курсором сообщение не уезжает */
    pause: () => void;
    resume: () => void;
    subscribe: (fn: () => void) => () => void;
};
export declare function createToastBus(defaults?: {
    ttl?: number;
    /** сколько записей держать в истории; дальше вытесняются старые */
    historyLimit?: number;
    /** сколько плашка летит в историю, мс; 0 — исчезает сразу */
    leaveMs?: number;
}): ToastBus;
/**
 * Общая шина на приложение. Отдельный экземпляр нужен редко (тесты, две
 * независимые области), поэтому по умолчанию — одна на всех.
 */
export declare const toast: ToastBus;
