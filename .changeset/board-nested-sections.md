---
'@solid-dumb-kit/board': minor
---

Секции хранят свои блоки, размер блока — в ячейках сетки

**Ломающая правка.** Было два массива — секции отдельно, блоки отдельно, плюс
функция «в какой секции блок». Стало один: `sections[i].items`. Пропы `items` и
`section` убраны, добавлен `setSections` — доска собирает новую раскладку сама и
отдаёт её на каждом шаге жеста, как `DumbSortableDnd` отдаёт `setItems`.
`onMove`/`onSectionMove`/`onSectionResize` остались уведомлениями.

```diff
-<DumbBoard sections={sections()} items={widgets()} section={(w) => where()[w.id]} …>
+<DumbBoard sections={sections()} setSections={setSections} …>
```

Блоки теперь бывают разной ширины (`blockSpan` — колонки зоны) и высоты —
подробности размеров в правке про сетку ячеек.

Заодно исправлено: замер после дропа снимался, пока блоки ещё доигрывали FLIP, а
`boundingClientRect` учитывает transform — начало координат зоны уезжало, и
следующий жест стартовал блоки не оттуда, где они на самом деле.
