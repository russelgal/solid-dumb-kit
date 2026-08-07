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
