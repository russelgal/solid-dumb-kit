/** Настройки локатора; у всех есть разумные значения. */
export interface LocatorOptions {
    /** Атрибут с местом в исходнике. По умолчанию `data-loc`. */
    attribute?: string;
    /** Адрес, открывающий файл. По умолчанию штатный эндпоинт Vite. */
    endpoint?: string;
    /** Где слушать клики. По умолчанию окно документа. */
    target?: EventTarget;
    /** Какая клавиша открывает редактор. По умолчанию alt. */
    key?: 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey';
}
/** Атрибут по умолчанию — тот же, что ставит плагин. */
export declare const LOC_ATTR = "data-loc";
/**
 * Ставит локатор и отдаёт функцию отписки.
 *
 * Слушатель висит НА ПЕРЕХВАТЕ: alt-клик обязан открыть редактор, а не
 * сработать кнопкой или ссылкой под курсором.
 */
export declare function createLocator(options?: LocatorOptions): () => void;
