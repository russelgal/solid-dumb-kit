# @solid-dumb-kit/table

## 0.6.0

### Minor Changes

- 49e104b: Основная линия — SolidJS 2

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

- 49e104b: `DumbTable`: своя сортировка вместо TanStack

  `@tanstack/solid-table` выкинут — v8 тянет `solid-js/store`, которого во второй
  линии Solid нет, а в v9 API переписан целиком. У пакета не осталось ни одной
  рантайм-зависимости.

  Поведение прежнее: три состояния заголовка (`asc → desc → без сортировки`),
  числовые колонки начинают с `desc`, `sortDescFirst`, `noSortRemoval` и серверный
  режим через `onSort` работают как раньше. Сверх того сортировка стала
  стабильной (равные значения сохраняют исходный порядок), пустые значения всегда
  уходят в конец — в обе стороны, — а строки сравниваются с `numeric`, поэтому
  «файл2» идёт раньше «файл10».

  Значение для сортировки по-прежнему берётся из `row[key]` либо из пропа колонки
  `value`; `accessorFn` не было и не требуется.

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
  - @solid-dumb-kit/sortable@0.5.0
  - @solid-dumb-kit/shared@0.5.0
