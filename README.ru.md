[English](README.md) · **Русский**

# solid-dumb-kit

Небольшой набор **SolidJS**-примитивов почти без зависимостей: их легко вставить и полностью подчинить своим стилям — разметка твоя, кит берёт на себя поведение.

- **[SelectionArea](docs/ru/SelectionArea.md)** — выделение рамкой «как в Finder» по списку/сетке (`Shift`/`Cmd` — добавить). Без зависимостей и без reflow.
- **[ResizableGrid](docs/ru/ResizableGrid.md)** — панельная раскладка с тянущимися колонками/рядами, размеры сохраняются в `localStorage`.
- **[DumbSortable](docs/ru/DumbSortable.md)** — FLIP-перетаскивание для смены порядка (список **или** сетка) без зависимостей и без reflow во время драга. Есть декларативный компонент и низкоуровневый примитив `createDumbSortable`.
- **[DumbTree](docs/ru/DumbTree.md)** — сайдбар-дерево *или* плоский список с нечётким поиском, сортировкой, сохранением раскрытых папок и опциональным drag-reorder. Оформлен под Tailwind + daisyUI.
- **[DumbTable](docs/ru/DumbTable.md)** — таблица «принеси свои колонки»: сортировка (клиентская или серверная) на TanStack Table, перетаскивание строк, пагинация.
- **[DumbGallery](docs/ru/DumbGallery.md)** — галерея картинок: выбрать или бросить в окно, посмотреть, переставить, залить. Заливка идёт очередью и отменяется; ключей от хранилища галерея не видит — только подписанную ссылку от твоего сервера.
- **[DumbBoard](docs/ru/DumbBoard.md)** — доска секций: блоки переносятся между секциями, сами секции переставляются и меняют размер. Внутри секции DOM не трогается — двигается только CSS `order`, а переезды доигрывает FLIP.
- **[DumbGrid](docs/ru/DumbGrid.md)** — дашборд-сетка: блоки размером в целое число колонок и строк, перетаскивание и ресайз кратно сетке, три режима раскладки (`flow` / `dense` / свободный `{x,y}`), видимая разметка сетки, персист раскладки. Ни одного замера элементов за жест.
- **[Утилиты](docs/ru/utils.md)** — хелперы без фреймворка: форматирование чисел/дат/размеров под `ru-RU`, слаги, извлечение картинок из ZIP, URL для imgproxy.
- **[DumbFinder](docs/ru/DumbFinder.md)** — файловый менеджер по чужому хранилищу: папки, выделение рамкой, заливка броском, перенос перетаскиванием. Про S3 ничего не знает — говорит с адаптером `source`, за которым может стоять что угодно.
- **[DumbTimeline](docs/ru/DumbTimeline.md)** — шахматка: строки-ресурсы × колонки-время. Сутки, часы и дневная аренда на одной сетке; за жест ни одного замера, а наложение соседей невозможно по устройству.
- **[DumbDateRange](docs/ru/DumbDateRange.md)** — календарь на день или период, занятость видна до клика. Дата — строка, поэтому часовые пояса не сдвигают ночь.
- **[DumbModal](docs/ru/DumbModal.md)** · **[DumbLightbox](docs/ru/DumbLightbox.md)** · **[DumbContextMenu](docs/ru/DumbContextMenu.md)** · **[DumbToast](docs/ru/DumbToast.md)** — семейство top layer: нативный `<dialog>` и Popover API с anchor positioning, поэтому никто не спорит за `z-index`.
- **[DumbPropsTable](docs/ru/DumbPropsTable.md)** — отладочная таблица пропсов: имя, тип и значение, включая функции и `undefined`, — то есть ровно то, что `JSON.stringify` молча выбрасывает.
- **[Длинные списки](docs/ru/Virtual.md)** — `createVirtualizer`: окно списка считается арифметикой по заявленному размеру строки, элементы не измеряются ни разу. Рядом `createRowIndex` — сортировка и фильтр миллиона строк в воркере, порциями и с отменой устаревшего запроса.
- **[Odata1C](docs/ru/Odata1C.md)** — клиент стандартного интерфейса OData 1С без привязки к фреймворку: Basic-авторизация, сборка запросов и обход капризов платформы. Работает и в браузере, и в Node.

**🔗 Живое демо:** https://russelgal.github.io/solid-dumb-kit/ · запускаемые исходники в [`examples/`](examples/).

Ветка `0.x` рассчитана на **SolidJS 1.x** (`peerDependencies: solid-js ^1.8.0`).

**📓 История изменений:** [CHANGELOG.md](CHANGELOG.md)

**🤖 Агентам:** [MCP-сервер кита](mcp/README.ru.md) — пакеты, пропсы, примеры и правила репы без вычитывания исходников; зависимостей нет.

**🧭 Разборы:** [Что выяснилось на практике](docs/ru/Findings.md) — проверенные утверждения с тем, как именно проверялось · [Сквозной DnD](docs/ru/GlobalDnd.md) — как перетаскивать между разнородными штуками (предложение, не реализовано)

## Установка

Кит разбит на пакеты — по одному на компонент, у каждого своя версия и свой тег. Ставь только те, что нужны: `@solid-dumb-kit/table` не потянет за собой `@tanstack/solid-table` в проект, которому нужна одна сортировка списка, а DnD-пакеты не тянут вообще ничего — они на голых событиях браузера.

**В npm пока не публикуем** — пакеты ставятся прямо с GitHub, подкаталогом репозитория:

```bash
pnpm add "github:russelgal/solid-dumb-kit#path:/packages/table"
# peer-зависимость:
pnpm add solid-js
```

Хвост `#path:/packages/<имя>` — единственное, что нужно: он выбирает пакет. Версию прибивать не обязательно, pnpm пишет в лок-файл конкретный коммит, так что установка воспроизводима. Собранный `dist/` лежит в репозитории, поэтому собирать у себя ничего не нужно.

Обновляются пакеты **по отдельности** — ради этого разбивка и делалась:

```bash
pnpm up @solid-dumb-kit/table
```

Нужна жёсткая привязка к версии — добавь тег; они короткие, по имени папки:

```bash
pnpm add "github:russelgal/solid-dumb-kit#table@0.5.0&path:/packages/table"
```

Внутренние связи между пакетами вкомпилированы в сборку, а не объявлены зависимостями: `workspace:`-ссылки при git-установке не резолвятся. Цена — от 0.1 до 5 КБ gzip на пакет, и она честно окупается тем, что ставить можно по одному.

Пакеты делятся по тому, **чем ведётся жест**. Это главное разделение в ките: указательные события и нативный drag-and-drop — две несмешиваемые реализации, и половина компонентов существует в обеих.

**Указатель** — работает пальцем, зону под курсором считаем сами:

| пакет | что внутри | тянет за собой |
| --- | --- | --- |
| `@solid-dumb-kit/sortable` | `DumbSortable`, `createSortableGroup` — список, сетка, перенос между колонками | — |
| `@solid-dumb-kit/selection` | `SelectionArea` — выделение рамкой | — |
| `@solid-dumb-kit/grid` | `DumbGrid` — дашборд-сетка, вложенность, перенос между сетками | `@solid-primitives/storage`, `valibot` |
| `@solid-dumb-kit/resizable-grid` | `ResizableGrid` — панели с ресайзом | `@solid-primitives/storage`, `valibot` |

**Нативный DnD** — зону решает браузер, тач не поддерживается:

| пакет | что внутри | тянет за собой |
| --- | --- | --- |
| `@solid-dumb-kit/sortable-dnd` | `DumbSortableDnd` — список и сетка плиток | — |
| `@solid-dumb-kit/grid-dnd` | `DumbGridDnd` — сетка, две доски, перенос между ними | — |
| `@solid-dumb-kit/gallery` | `DumbGallery` — картинки: выбор, порядок, заливка очередью | `@solid-primitives/upload` |
| `@solid-dumb-kit/board` | `DumbBoard` — секции с блоками, перенос между секциями, ресайз секций | — |

**Данные и утилиты** — жест тут не главное:

| пакет | что внутри | тянет за собой |
| --- | --- | --- |
| `@solid-dumb-kit/table` | `DumbTable`, `DumbPagination` | `@tanstack/solid-table` |
| `@solid-dumb-kit/tree` | `DumbTree` — дерево и плоский список | `@solid-primitives/storage` |
| `@solid-dumb-kit/timeline` | `DumbTimeline` — шахматка: сутки, часы, дневная аренда | — |
| `@solid-dumb-kit/date-range` | `DumbDateRange` — календарь на день или период | — |
| `@solid-dumb-kit/modal` | `DumbModal` — нативный `<dialog>` в top layer | — |
| `@solid-dumb-kit/lightbox` | `DumbLightbox` — просмотрщик картинок | — |
| `@solid-dumb-kit/context-menu` | `DumbContextMenu`, `DumbPopover` — правый клик и карточки у точки | — |
| `@solid-dumb-kit/toast` | `DumbToaster`, `toast` — сообщения и вопросы | — |
| `@solid-dumb-kit/finder` | `DumbFinder` — файлы в хранилище: папки, выделение, заливка, перенос | `@solid-primitives/upload` |
| `@solid-dumb-kit/odata-1c` | клиент OData 1С — без Solid | — |
| `@solid-dumb-kit/utils` | формат, slug, zip, imgproxy | `fflate`, `slug` |

**Основание** — на нём стоят остальные, ставится сам как зависимость:

| пакет | что внутри | тянет за собой |
| --- | --- | --- |
| `@solid-dumb-kit/shared` | FLIP, автопрокрутка, вьюпорт, правила жестов | — |

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
| `createDumbGrid` / `DumbGridHandle` / `createGridEngine` / `DumbGridOptions` / `DumbGridBlock` | примитив | [docs/ru/DumbGrid.md#примитив-createdumbgrid](docs/ru/DumbGrid.md#примитив-createdumbgrid) |
| `packFlow` / `cellRect` / `colWidth` / `spanSize` / `rowCount` / `insertIndex` / `moveDeltas` / `snapSpan` | математика сетки | [docs/ru/DumbGrid.md#движок-без-фреймворка](docs/ru/DumbGrid.md#движок-без-фреймворка) |
| `Rub0` / `Rub2` / `Rub4` / `Rub0R` / `RubR2` / `fmtNum` / `fmtPrice` | форматирование | [docs/ru/utils.md#числа](docs/ru/utils.md#числа) |
| `fmtDate` / `fmtDateTime` / `fmtDateTimeShort` / `fmtTime` / `fmtDateMonth` / `timeAgo` / `fmtSize` | форматирование | [docs/ru/utils.md#даты](docs/ru/utils.md#даты) |
| `genSlug` | утилита | [docs/ru/utils.md#genslug--слаги-для-url](docs/ru/utils.md#genslug--слаги-для-url) |
| `extractImagesFromZip` | утилита | [docs/ru/utils.md#extractimagesfromzip--картинки-из-zip](docs/ru/utils.md#extractimagesfromzip--картинки-из-zip) |
| `imgproxyUrl` / `configureImgproxy` / `ImgproxyOps` / `ImgproxyConfig` | утилита | [docs/ru/utils.md#imgproxyurl--сборка-url-для-imgproxy](docs/ru/utils.md#imgproxyurl--сборка-url-для-imgproxy) |
| `DumbPropsTable` / `DumbPropsTableProps` / `dumpProps` / `describe` / `DumpRow` | компонент | [docs/ru/DumbPropsTable.md](docs/ru/DumbPropsTable.md) |
| `createVirtualizer` / `scrollOffsetFor` / `VirtualOptions` / `VirtualRange` / `MAX_SCROLL_HEIGHT` | примитив | [docs/ru/Virtual.md](docs/ru/Virtual.md) |
| `createRowIndex` / `RowIndexOptions` / `RowIndexResult` / `RowColumn` / `RowQuery` | примитив | [docs/ru/Virtual.md#createrowindex--сортировка-и-фильтр-вне-главного-потока](docs/ru/Virtual.md#createrowindex--сортировка-и-фильтр-вне-главного-потока) |
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
