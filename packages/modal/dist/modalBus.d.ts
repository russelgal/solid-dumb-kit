/** кнопка окна: что написано и что вернётся в обещание */
export type ModalAction<T = unknown> = {
    label: string;
    value: T;
    /** выделить: главное действие или опасное */
    kind?: 'primary' | 'danger';
};
export type ModalAskOptions = {
    /** заголовок окна; не задан — окно без шапки */
    title?: string;
    /** ширина, css */
    width?: string;
    /**
     * Можно ли закрыть, не ответив (Esc, клик мимо, крестик). По умолчанию да, и
     * тогда обещание получает `dismiss`. Вопрос, у которого нет безопасного
     * умолчания, ставит `false` — и ответ придётся нажать.
     */
    dismissible?: boolean;
};
export type ModalQuestion = {
    id: number;
    title?: string;
    text: string;
    actions: Array<ModalAction>;
    width?: string;
    dismissible: boolean;
    /** что вернуть, если закрыли не ответив */
    dismiss: unknown;
    /** разрешить обещание — зовёт только шина */
    done: (value: unknown) => void;
};
export type ModalBus = {
    /** вопрос, который сейчас на экране; null — окон нет */
    current: () => ModalQuestion | null;
    /** сколько ещё ждёт своей очереди */
    pending: () => number;
    /**
     * Вопрос с произвольными кнопками. Возвращает `value` нажатой; закрыли не
     * ответив — `dismiss` (по умолчанию `undefined`).
     */
    ask: <T>(text: string, actions: Array<ModalAction<T>>, opts?: ModalAskOptions & {
        dismiss?: T;
    }) => Promise<T | undefined>;
    /** самый ходовой вопрос: да или нет. Закрыли не ответив — `false` */
    confirm: (text: string, opts?: ModalAskOptions & {
        yes?: string;
        no?: string;
        danger?: boolean;
    }) => Promise<boolean>;
    /** сообщение с одной кнопкой: прочитали и закрыли */
    alert: (text: string, opts?: ModalAskOptions & {
        ok?: string;
    }) => Promise<void>;
    /** ответить за текущее окно — зовёт компонент */
    answer: (id: number, value: unknown) => void;
    /** закрыть текущее окно ответом по умолчанию */
    dismiss: (id: number) => void;
    subscribe: (fn: () => void) => () => void;
};
export declare function createModalBus(): ModalBus;
/**
 * Общая шина на приложение: `modal.confirm(...)` зовётся откуда угодно, в том
 * числе из кода, который про разметку не знает. Отдельный экземпляр нужен редко
 * (тесты, две независимые области).
 */
export declare const modal: ModalBus;
