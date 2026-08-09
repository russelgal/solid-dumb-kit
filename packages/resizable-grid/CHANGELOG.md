# @solid-dumb-kit/resizable-grid

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

### Patch Changes

- e9445fa: Разбор по итогам сквозного аудита

  `board`: соседи по киту убраны из `dependencies`. Они лежали там с протоколом
  `workspace:`, который при установке пакета подкаталогом git-репозитория не
  резолвится вовсе — pnpm падал с `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND`, npm с
  `EUNSUPPORTEDPROTOCOL`. Код соседей и так внутри бандла.

  `tree`: атрибуты строки (`aria-current`, `data-open`) снова следят за
  сигналами. Объект пропсов собирался один раз, и записанное в него значение
  оставалось навсегда: выбрали узел из кода — подсветка не переезжала, раскрыли
  ветку — стрелка не поворачивалась (её поворачивает CSS по `data-open`).

  `resizable-grid`: стили инжектятся общим `injectStyle` вместо самодельной
  вставки в `<head>` — заодно приехало обновление правил при HMR.

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
