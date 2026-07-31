---
'@solid-dumb-kit/resizable-grid': minor
'@solid-dumb-kit/sortable-dnd': minor
'@solid-dumb-kit/grid-dnd': minor
'@solid-dumb-kit/selection': minor
'@solid-dumb-kit/odata-1c': minor
'@solid-dumb-kit/sortable': minor
'@solid-dumb-kit/shared': minor
'@solid-dumb-kit/table': minor
'@solid-dumb-kit/utils': minor
'@solid-dumb-kit/grid': minor
'@solid-dumb-kit/tree': minor
---

Кит разъехался на пакеты — по одному на компонент, у каждого своя версия и свои
зависимости. Ставится только то, что нужно: `@solid-dumb-kit/table` больше не
тянет за собой `@atlaskit/pragmatic-drag-and-drop`, а `@solid-dumb-kit/sortable`
не тянет вообще ничего.

Ломающее: единого пакета `solid-dumb-kit` больше нет, импорты меняются на
конкретные пакеты (`import { DumbTable } from '@solid-dumb-kit/table'`).
`@solid-dumb-kit/shared` теперь выкладывает наружу всё содержимое — `shouldAnimate`,
`measure`, `scrollParent`, `createPressGate` и прочее: пакеты стоят на нём и
подглядывать в чужие файлы больше не могут.
