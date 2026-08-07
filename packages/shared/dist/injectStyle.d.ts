/**
 * Вставить стили один раз на документ.
 *
 * @param id  ключ, он же `data-dumb-kit` у тега — по нему видно в инспекторе,
 *            кто это положил, и по нему же ищется уже вставленное
 * @param css  сами правила
 */
export declare function injectStyle(id: string, css: string): void;
