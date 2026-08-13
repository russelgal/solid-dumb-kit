---
'@solid-dumb-kit/shared': minor
'@solid-dumb-kit/modal': patch
'@solid-dumb-kit/context-menu': patch
'@solid-dumb-kit/toast': patch
'@solid-dumb-kit/finder': patch
'@solid-dumb-kit/timeline': patch
'@solid-dumb-kit/lightbox': patch
'@solid-dumb-kit/board': patch
'@solid-dumb-kit/sortable-dnd': patch
'@solid-dumb-kit/selection': patch
'@solid-dumb-kit/tree': patch
'@solid-dumb-kit/date-range': patch
---

Слой совместимости с Solid 1 удалён: `shared` больше не отдаёт `effect`,
`batch`, `watch`, `onMounted` и `flushNow`. Кит живёт на второй линии и зовёт её
API напрямую — `createEffect(dep, fn, { defer })` и `flush()` из `solid-js`.

Обёртка `effect(fn)` была не просто лишней: она клала тело в фазу вычисления, а
та идёт до монтирования и запрещает запись в сигналы — на этом `DumbModal`
открывался белым экраном, а до него чинили `DumbTree`.

Заодно эффектов в ките стало вдвое меньше. Всё, что просто дожидалось
монтирования — наблюдатели, `showPopover`, слушатели окна, подписки на шину, —
переехало в колбэк-ref (`ref={(el) => …}`) или прямо в тело компонента. Эффект
остался там, где он и нужен: где следят за сигналом. Попутно вскрылось, что
панель контекстного меню вообще не снимала свою геометрию — наблюдатель вешался
на ещё пустой `ref`.
