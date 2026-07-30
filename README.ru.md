[English](README.md) · **Русский**

# solid-dumb-kit

Небольшой набор **SolidJS**-примитивов почти без зависимостей: их легко вставить и полностью подчинить своим стилям — разметка твоя, кит берёт на себя поведение.

- **[SelectionArea](docs/ru/SelectionArea.md)** — выделение рамкой «как в Finder» по списку/сетке (`Shift`/`Cmd` — добавить). Без зависимостей и без reflow.
- **[ResizableGrid](docs/ru/ResizableGrid.md)** — панельная раскладка с тянущимися колонками/рядами, размеры сохраняются в `localStorage`.
- **[DumbSortable](docs/ru/DumbSortable.md)** — FLIP-перетаскивание для смены порядка (список **или** сетка) без зависимостей и без reflow во время драга. Есть декларативный компонент и низкоуровневый примитив `createDumbSortable`.
- **[DumbTree](docs/ru/DumbTree.md)** — сайдбар-дерево *или* плоский список с нечётким поиском, сортировкой, сохранением раскрытых папок и опциональным drag-reorder. Оформлен под Tailwind + daisyUI.
- **[DumbTable](docs/ru/DumbTable.md)** — таблица «принеси свои колонки»: сортировка (клиентская или серверная) на TanStack Table, перетаскивание строк, пагинация.
- **[DumbGridDnd](docs/ru/DumbGridDnd.md)** — та же сетка на **нативном HTML5 drag-and-drop**: какая сетка под указателем решает браузер, блок умеет уходить за пределы страницы через `dataTransfer`. Только десктоп — отдельный компонент, а не режим.
- **[DumbGrid](docs/ru/DumbGrid.md)** — дашборд-сетка: блоки размером в целое число колонок и строк, перетаскивание и ресайз кратно сетке, три режима раскладки (`flow` / `dense` / свободный `{x,y}`), видимая разметка сетки, персист раскладки. Ни одного замера элементов за жест.
- **[Утилиты](docs/ru/utils.md)** — хелперы без фреймворка: форматирование чисел/дат/размеров под `ru-RU`, слаги, извлечение картинок из ZIP, URL для imgproxy.
- **[Odata1C](docs/ru/Odata1C.md)** — клиент стандартного интерфейса OData 1С без привязки к фреймворку: Basic-авторизация, сборка запросов и обход капризов платформы. Работает и в браузере, и в Node.

**🔗 Живое демо:** https://russelgal.github.io/solid-dumb-kit/ · запускаемые исходники в [`examples/`](examples/).

Ветка `0.x` рассчитана на **SolidJS 1.x** (`peerDependencies: solid-js ^1.8.0`).

**📓 История изменений:** [CHANGELOG.md](CHANGELOG.md)

## Установка

**В npm пока не публиковали** — ставится прямо с GitHub. В репозитории лежат и `src/`, и собранный `dist/`, поэтому собирать у себя ничего не нужно:

```bash
pnpm add github:russelgal/solid-dumb-kit
# peer-зависимость:
pnpm add solid-js
```

Нужна воспроизводимая установка — прибей к тегу:

```bash
pnpm add github:russelgal/solid-dumb-kit#v0.3.0
```

## Быстрый старт

```tsx
import { SelectionArea, ResizableGrid, DumbSortable } from 'solid-dumb-kit'
```

Запускаемые примеры (по одному на компонент) лежат в [`examples/`](examples/).

## Экспорты

| Экспорт | Что это | Документация |
| --- | --- | --- |
| `SelectionArea` / `SelectionAreaProps` / `IntersectMode` | компонент | [docs/ru/SelectionArea.md](docs/ru/SelectionArea.md) |
| `ResizableGrid` / `ResizableGridProps` / `GridPanel` | компонент | [docs/ru/ResizableGrid.md](docs/ru/ResizableGrid.md) |
| `DumbSortable` / `DumbSortableProps` | компонент | [docs/ru/DumbSortable.md](docs/ru/DumbSortable.md) |
| `createSelectionArea` / `SelectionCoreOptions` | примитив | [docs/ru/SelectionArea.md](docs/ru/SelectionArea.md) |
| `createDumbSortable` / `DumbSortableHandle` / `DumbSortableOptions` | примитив | [docs/ru/DumbSortable.md#примитив-createdumbsortable](docs/ru/DumbSortable.md#примитив-createdumbsortable) |
| `DumbTree` / `DumbTreeProps` / `DumbTreeNode` / `DumbTreeIcons` / `DumbTreeLabels` | компонент | [docs/ru/DumbTree.md](docs/ru/DumbTree.md) |
| `DumbTable` / `DumbTableProps` / `DumbColumn` | компонент | [docs/ru/DumbTable.md](docs/ru/DumbTable.md) |
| `DumbPagination` / `DumbPaginationProps` / `buildPageNumbers` | компонент | [docs/ru/DumbTable.md#dumbpagination](docs/ru/DumbTable.md#dumbpagination) |
| `DumbGrid` / `DumbGridProps` / `DumbGridItem` / `DumbGridLayout` / `mergeLayout` | компонент | [docs/ru/DumbGrid.md](docs/ru/DumbGrid.md) |
| `DumbGridDnd` / `DumbGridDndProps` / `DumbGridDndItem` / `DumbGridDndLayout` / `mergeDndLayout` | компонент | [docs/ru/DumbGridDnd.md](docs/ru/DumbGridDnd.md) |
| `createDumbGridDndGroup` / `createGridDndEngine` / `dndSupported` / `DND_MIME` | примитив | [docs/ru/DumbGridDnd.md](docs/ru/DumbGridDnd.md) |
| `createDumbGrid` / `DumbGridHandle` / `createGridEngine` / `DumbGridOptions` / `DumbGridBlock` | примитив | [docs/ru/DumbGrid.md#примитив-createdumbgrid](docs/ru/DumbGrid.md#примитив-createdumbgrid) |
| `packFlow` / `cellRect` / `colWidth` / `spanSize` / `rowCount` / `insertIndex` / `moveDeltas` / `snapSpan` | математика сетки | [docs/ru/DumbGrid.md#движок-без-фреймворка](docs/ru/DumbGrid.md#движок-без-фреймворка) |
| `Rub0` / `Rub2` / `Rub4` / `Rub0R` / `RubR2` / `fmtNum` / `fmtPrice` | форматирование | [docs/ru/utils.md#числа](docs/ru/utils.md#числа) |
| `fmtDate` / `fmtDateTime` / `fmtDateTimeShort` / `fmtTime` / `fmtDateMonth` / `timeAgo` / `fmtSize` | форматирование | [docs/ru/utils.md#даты](docs/ru/utils.md#даты) |
| `genSlug` | утилита | [docs/ru/utils.md#genslug--слаги-для-url](docs/ru/utils.md#genslug--слаги-для-url) |
| `extractImagesFromZip` | утилита | [docs/ru/utils.md#extractimagesfromzip--картинки-из-zip](docs/ru/utils.md#extractimagesfromzip--картинки-из-zip) |
| `imgproxyUrl` / `configureImgproxy` / `ImgproxyOps` / `ImgproxyConfig` | утилита | [docs/ru/utils.md#imgproxyurl--сборка-url-для-imgproxy](docs/ru/utils.md#imgproxyurl--сборка-url-для-imgproxy) |
| `OdataClient` / `createOdataClient` / `OdataClientOptions` / `OdataListResponse` | клиент | [docs/ru/Odata1C.md](docs/ru/Odata1C.md) |
| `OdataError` / `odataString` / `toBase64` | клиент | [docs/ru/Odata1C.md#хелперы](docs/ru/Odata1C.md#хелперы) |

## CSS

- **SelectionArea** рисует рамку инлайном — импортировать нечего.
- **ResizableGrid** инжектит стили ручек в рантайме — импорт не нужен.
- **DumbSortable** обходится инлайновым `transform` — CSS не нужен вовсе.
- **DumbTable** инлайнит только структурные стили — цвета, рамки и ховеры задаются твоими `tableClass`/`headClass`/`rowClass`.
- **DumbTree** — исключение: он рендерит классы Tailwind + daisyUI, то есть рассчитывает на них в твоём приложении. Иконки передаются классами (своего набора кит не несёт).

## Зависимости

Единственная peer-зависимость — `solid-js ^1.8.0`. Рантайм-зависимости маленькие и точечные: `@solid-primitives/storage` + `valibot` (ResizableGrid, DumbTree, DumbGrid), `@tanstack/solid-table` (DumbTable), `slug` (`genSlug`) и `fflate` — причём последний за динамическим `import()`, поэтому грузится только при реальной распаковке ZIP. `Odata1C` не добавляет ничего — это голый `fetch`.

## Лицензия

MIT
