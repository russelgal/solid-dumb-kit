---
'@solid-dumb-kit/utils': patch
'@solid-dumb-kit/timeline': patch
'@solid-dumb-kit/grid': patch
'@solid-dumb-kit/resizable-grid': patch
---

Обновлены рантайм-зависимости: `slug` 11 → 12, `temporal-polyfill` 1.0.3 →
1.0.4, `valibot` 1.2 → 1.4.2. Вывод `genSlug` не изменился — таблица кириллицы
у `slug` та же, тесты транслитерации прошли без правок; в двенадцатой версии
починена только замена символов при пустом `replacement`, которым кит не
пользуется.
