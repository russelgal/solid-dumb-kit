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
'@solid-dumb-kit/tree': patch
---

Из `shared` убраны `effect` и `batch`.

`effect(fn)` сводил обе линии Solid к одному колбэку, но под Solid 2 клал тело
в фазу ВЫЧИСЛЕНИЯ: она идёт до монтирования (`ref` там ещё `undefined`) и
запрещает запись в сигналы. На этом `DumbModal` открывался белым экраном, а до
него чинили `DumbTree`. Замена: `watch(dep, fn)` — работа во второй фазе,
`onMounted(fn)` — разово после монтирования, а работа без зависимостей от
сигналов пишется прямо в теле компонента. `batch` в Solid 2 не нужен вовсе.

Заодно `watch`/`onMounted` перестали пропускать наружу возвращённое телом
значение: Solid 2 понимает его как cleanup и глушит реактивность на всём
остальном (`REACTIVITY_HALTED`).

Те же грабли вычищены по киту: контекстное меню (панель вообще не снимала свою
геометрию — наблюдатель вешался на пустой `ref`), тостер, файндер, таймлайн,
лайтбокс, доска, `DumbSortableDnd`.
