---
'@solid-dumb-kit/shared': minor
'@solid-dumb-kit/sortable': patch
'@solid-dumb-kit/sortable-dnd': patch
'@solid-dumb-kit/grid': patch
'@solid-dumb-kit/grid-dnd': patch
'@solid-dumb-kit/selection': patch
'@solid-dumb-kit/board': patch
'@solid-dumb-kit/context-menu': patch
'@solid-dumb-kit/toast': patch
'@solid-dumb-kit/timeline': patch
'@solid-dumb-kit/table': patch
'@solid-dumb-kit/finder': patch
'@solid-dumb-kit/gallery': patch
'@solid-dumb-kit/date-range': patch
---

Три систематических бага под Solid 2, найденные зондом по витрине (headless-
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
