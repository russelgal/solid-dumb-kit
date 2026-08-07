/**
 * `createEffect(fn)` из Solid 1.
 *
 * В Solid 2 эффект стал ДВУХФАЗНЫМ: первая функция вычисляет и трекается,
 * вторая делает работу и не трекается. Одноаргументная форма там не просто
 * устарела — она падает с `MISSING_EFFECT_FN`, и вместе с ней валится вся
 * реактивность (`REACTIVITY_HALTED`).
 *
 * Здесь обе линии сведены к привычному одному колбэку: на Solid 2 работа
 * уезжает во вторую фазу, на Solid 1 всё как было. Нужна пара «следить за
 * этим — делать то» — бери `watch`, она выразительнее.
 */
export declare function effect(fn: () => void): void;
/** `solid.batch`, где он есть (Solid 1); в Solid 2 обновления батчатся сами */
export declare const batch: <T>(fn: () => T) => T;
/** `onMount` из Solid 1: эффект, выполненный один раз после монтирования */
export declare function onMounted(fn: () => void): void;
/**
 * `createEffect(on(dep, fn, { defer: true }))` из Solid 1: следим за ОДНИМ
 * источником, тело не трекается; `defer` пропускает первый прогон.
 */
export declare function watch<T>(dep: () => T, fn: (value: T, prev: T | undefined) => void, opts?: {
    defer?: boolean;
}): void;
