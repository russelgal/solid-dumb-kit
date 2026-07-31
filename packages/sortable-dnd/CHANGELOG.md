# @solid-dumb-kit/sortable-dnd

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
