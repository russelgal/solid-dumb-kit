/** Настройки половины для сборщика. */
export interface LocatorPluginOptions {
    /** Атрибут с местом в исходнике. По умолчанию `data-loc`. */
    attribute?: string;
    /**
     * Точка входа, в которую вставить браузерную половину: путь от корня
     * проекта (`src/App.tsx`). Не задана — потребитель зовёт `createLocator()`
     * сам, и плагин в его код не лезет.
     */
    entry?: string;
    /**
     * Редактор для `launch-editor`, если тот не угадает его по запущенному
     * процессу (`webstorm`, `code`, `cursor`). Значение из окружения не
     * перебивается.
     */
    editor?: string;
    /** Какие файлы размечать. По умолчанию — свои `.tsx`, кроме тестов. */
    include?: (id: string) => boolean;
}
/** Минимум от Vite, который нужен пакету: тип плагина не импортируем. */
interface LocatorPlugin {
    name: string;
    apply: 'serve';
    enforce: 'pre';
    config(): void;
    configResolved(config: {
        root: string;
    }): void;
    transform(code: string, id: string, options?: {
        ssr?: boolean;
    }): string | null;
}
/**
 * Разметка одного файла. Атрибуты вставляются С КОНЦА, иначе каждая вставка
 * сбивала бы смещения следующих.
 */
export declare function markLocations(code: string, file: string, attribute?: string): string;
/**
 * Плагин Vite: размечает разметку и, если названа точка входа, вставляет в неё
 * браузерную половину.
 *
 * ⚠️ Ставить его надо ПЕРЕД плагином фреймворка (`enforce: 'pre'` это и
 * делает): тот сворачивает разметку в шаблоны, и после него вставлять атрибут
 * уже некуда.
 */
export declare function locator(options?: LocatorPluginOptions): LocatorPlugin;
export {};
