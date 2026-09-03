# @solid-dumb-kit/utils

## 0.5.1

### Patch Changes

- 305126b: Обновлены рантайм-зависимости: `slug` 11 → 12, `temporal-polyfill` 1.0.3 →
  1.0.4, `valibot` 1.2 → 1.4.2. Вывод `genSlug` не изменился — таблица кириллицы
  у `slug` та же, тесты транслитерации прошли без правок; в двенадцатой версии
  починена только замена символов при пустом `replacement`, которым кит не
  пользуется.

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
