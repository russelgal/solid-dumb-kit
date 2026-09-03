# @solid-dumb-kit/sortable

## 0.7.0

### Minor Changes

- c0b547a: Старт жеста можно отдавать из JSX: `ref={s.row(id)} onPointerDown={s.press(id)}`
  у `sortable` (плюс `pressHandle`, а у списков группы — `card(id)` + `press(id)`),
  `ref={g.block(id)} onPointerDown={g.press(id)}` у `grid` (плюс `pressResize`).
  
  `pointerdown` из JSX Solid делегирует, поэтому на всю таблицу висит один
  слушатель на документ вместо слушателя на каждой строке. Старый самодостаточный
  `bind(id)` остаётся — движки зовут и вне Solid, там JSX взять неоткуда.
  `DumbTable` переведён на новую пару.
- 693ebcc: Solid 2 дошёл до release candidate: `peerDependencies` подняты с
  `>=2.0.0-beta.30` до `>=2.0.0-rc.0` — `@solidjs/web@2.0.0-rc.0` требует
  `solid-js ^2.0.0-rc.0`, и на бете связка больше не сходится.
  
  Заодно починена скомпилированная ветка `dist/index.js`: сборка шла через
  компилятор первой линии (`babel-preset-solid@1`), который генерировал импорты
  из удалённой в Solid 2 сабпути `solid-js/web`. Компилятор запинен на
  `babel-preset-solid@2.0.0-rc.2`, импорт теперь идёт из `@solidjs/web`.

### Patch Changes

- 2383418: Три систематических бага под Solid 2, найденные зондом по витрине (headless-
  Chrome по всем маршрутам, теперь ноль предупреждений Solid):
  
  1. **Утечка отписок.** Колбэк-ref в Solid 2 вызывается без owner'а — `onCleanup`
     внутри ref-обёрток `solid.ts` не срабатывал никогда, движки и наблюдатели
     переживали компонент. Все обёртки переведены на новый `ownedRef` из `shared`
     (публичный экспорт: снимает owner в точке создания колбэка).
  2. **Накопление слушателей.** Тело эффекта — тоже не owned-scope: слушатели окна
     у `DumbPopover` и interval у `DumbToastCenter` копились на каждое открытие.
     Уборка — возвратом cleanup-функции из тела.
  3. **Шум strict-режима.** Разовые чтения сигналов вне tracking scope обёрнуты
     `untrack`; опции движков стали геттерами и теперь видят смену пропа
     (`animate` у `DumbGrid` раньше замораживался при создании).

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
