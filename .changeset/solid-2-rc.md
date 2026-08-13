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

Solid 2 дошёл до release candidate: `peerDependencies` подняты с
`>=2.0.0-beta.30` до `>=2.0.0-rc.0` — `@solidjs/web@2.0.0-rc.0` требует
`solid-js ^2.0.0-rc.0`, и на бете связка больше не сходится.

Заодно починена скомпилированная ветка `dist/index.js`: сборка шла через
компилятор первой линии (`babel-preset-solid@1`), который генерировал импорты
из удалённой в Solid 2 сабпути `solid-js/web`. Компилятор запинен на
`babel-preset-solid@2.0.0-rc.0`, импорт теперь идёт из `@solidjs/web`.
