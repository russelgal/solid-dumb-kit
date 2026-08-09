---
'@solid-dumb-kit/board': minor
'@solid-dumb-kit/context-menu': minor
'@solid-dumb-kit/date-range': minor
'@solid-dumb-kit/finder': minor
'@solid-dumb-kit/gallery': minor
'@solid-dumb-kit/grid': minor
'@solid-dumb-kit/grid-dnd': minor
'@solid-dumb-kit/lightbox': minor
'@solid-dumb-kit/modal': minor
'@solid-dumb-kit/props-table': minor
'@solid-dumb-kit/resizable-grid': minor
'@solid-dumb-kit/selection': minor
'@solid-dumb-kit/shared': minor
'@solid-dumb-kit/sortable': minor
'@solid-dumb-kit/sortable-dnd': minor
'@solid-dumb-kit/table': minor
'@solid-dumb-kit/timeline': minor
'@solid-dumb-kit/toast': minor
'@solid-dumb-kit/tree': minor
'@solid-dumb-kit/user-manager': minor
---

Основная линия — SolidJS 2

`peerDependencies` пакетов теперь `solid-js >=2.0.0-beta.30` и `@solidjs/web`:
на первой линии Solid пакеты больше не ставятся. Рендерер во второй линии живёт
в отдельном пакете — сабпутя `solid-js/web` нет вовсе, — а обновления флашатся
микротаском, поэтому чтение DOM сразу после действия видит старое состояние.

Всё специфичное для фреймворка собрано в одном слое (`@solid-dumb-kit/shared`:
`effect`, `watch`, `onMounted`, `batch`, `flushNow`), и слой работает на обеих
линиях — вернуть сборку под Solid 1 недорого. Движки жестов (`sortableCore`,
`selectionCore`, `gridCore`, `sortDndCore`) от фреймворка не зависели и не
изменились вовсе.

`@solid-primitives/storage` и `@solid-primitives/upload` выкинуты: первый под
Solid 2 молча не восстанавливал сохранённое, второй ломался дважды подряд.
Замены свои — `createPersisted` и `createFilePicker` в `shared`. Пакеты
`finder`, `gallery`, `grid` и `resizable-grid` больше их не тянут.
