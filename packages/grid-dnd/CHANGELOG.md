# @solid-dumb-kit/grid-dnd

## 0.6.0

### Minor Changes

- Убран `@atlaskit/pragmatic-drag-and-drop` — оба движка теперь на голых событиях
  браузера. Платили за него зря: хиттест всё равно делает браузер, а из его услуг
  оставалась нормализация `dragenter`/`dragleave` да «honey pot» под чужой баг с
  залипшим `:hover`. За это — 6.9 КБ gzip и CJS-хвост `bind-event-listener`,
  который у потребителя дважды ронял дев («does not provide an export named
  'bind'»).

  Слушателей теперь четыре на контейнер, а не по четыре на элемент: события
  всплывают, и `ev.target.closest` скажет, кто под курсором. На трёхстах строках
  это 4 записи в таблице слушателей вместо 1200.

  Зависимостей у обоих пакетов больше нет вовсе. Из `optimizeDeps.include` у
  потребителя записи про `pragmatic` и `bind-event-listener` можно убрать.

## 0.5.1

### Patch Changes

- `grid-dnd` реэкспортит типы размеров (`SpanValue`, `SpanPreset`, `GridSpan`).
  Они приходят из `@solid-dumb-kit/grid` — математика у сеток общая, — и без
  реэкспорта потребителю, который просто задаёт блокам ширину, пришлось бы ставить
  ещё и `grid` только ради одного типа.

## 0.5.0

### Minor Changes

- 9ee1f5f: Кит разъехался на пакеты — по одному на компонент, у каждого своя версия и свои
  зависимости. Ставится только то, что нужно: `@solid-dumb-kit/table` больше не
  тянет за собой `@atlaskit/pragmatic-drag-and-drop`, а `@solid-dumb-kit/sortable`
  не тянет вообще ничего.

  Ломающее: единого пакета `solid-dumb-kit` больше нет, импорты меняются на
  конкретные пакеты (`import { DumbTable } from '@solid-dumb-kit/table'`).
  `@solid-dumb-kit/shared` теперь выкладывает наружу всё содержимое — `shouldAnimate`,
  `measure`, `scrollParent`, `createPressGate` и прочее: пакеты стоят на нём и
  подглядывать в чужие файлы больше не могут.

### Patch Changes

- Updated dependencies [9ee1f5f]
  - @solid-dumb-kit/shared@0.5.0
  - @solid-dumb-kit/grid@0.5.0
