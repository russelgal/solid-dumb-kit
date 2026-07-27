[English](../DumbTree.md) · **Русский**

# DumbTree

Сайдбар-**дерево** (иерархия по `parent`) **или плоский список**, с нечётким поиском, сортировкой по индексу/названию, сохранением раскрытых папок и опциональным drag-reorder (на [`createDumbSortable`](DumbSortable.md#примитив-createdumbsortable)).

```tsx
import { DumbTree } from 'solid-dumb-kit'
```

> **Про стили — прочитай сразу.** В отличие от остального кита, `DumbTree` — *styled-but-configurable*: он рендерит классы **Tailwind + daisyUI** (`btn`, `input`, `bg-base-100`, `text-primary`, …). В daisyUI-приложении он сразу выглядит как надо; в любом другом получишь неоформленную разметку. Остальные компоненты кита не зависят от чужого CSS — этот меняет независимость на готовый вид.

## Иконки обязательны

Кит **не несёт свой набор иконок**. Ты передаёшь классы, поэтому строки иконок живут в *твоих* исходниках и компилируются *твоим* Tailwind/iconify — без сканирования `node_modules`.

```tsx
<DumbTree
  nodes={cats()}
  title="Каталог"
  storageKey="cat"
  activeId={() => active()}
  onSelect={(id) => go(id)}
  icons={{
    folder: 'icon-[solar--folder-outline]',
    folderOpen: 'icon-[solar--folder-open-outline]',
    leaf: 'icon-[solar--file-outline]',
    expanded: 'icon-[solar--alt-arrow-down-outline]',
    collapsed: 'icon-[solar--alt-arrow-right-outline]',
    search: 'icon-[solar--magnifer-outline]',
    sortIndex: 'icon-[solar--sort-outline]',
    sortName: 'icon-[solar--text-outline]',
    dragHandle: 'icon-[solar--menu-dots-outline]',
  }}
/>
```

## Форма узла

```ts
type DumbTreeNode = {
  id: number | string
  parent: number | string   // id родителя
  title: string
  index?: number            // порядок среди соседей (для сортировки «по индексу»)
  meta?: string | null      // доп. строка для поиска/тултипа
}
```

Узлы приходят **плоским массивом**, иерархия выводится из `parent`. Корнем считается узел, чей `parent` указывает наружу набора (запасной вариант — первый узел).

Прикладные поля в кит не протекают — выражай их через `rowExtra` / `rowClass` / `titleClass` / `rowTitle`.

## Пропсы

| Проп | Тип | По умолчанию | Описание |
| --- | --- | --- | --- |
| `nodes` | `Array<T>` | — | Плоский массив узлов. `undefined` рисует спиннер загрузки. |
| `icons` | `DumbTreeIcons` | — (обязательный) | Классы иконок, см. выше. |
| `title` | `string` | — | Мелкий заголовок над сайдбаром. |
| `activeId` | `() => Id \| null \| undefined` | — | Реактивный аксессор выбранного id. |
| `onSelect` | `(id, node) => void` | — | Клик по строке. |
| `flat` | `boolean` | `false` | Плоский список вместо дерева (без вложенности и сворачивания). |
| `hideSearch` | `boolean` | `false` | Спрятать поле поиска. |
| `placeholder` | `string` | `labels.search` | Плейсхолдер поиска. |
| `match` | `(node, query) => boolean` | fuzzy | Свой матчер. По умолчанию — нечёткий по `title`, `meta` и `id`. |
| `hideSort` | `boolean` | `false` | Спрятать переключатель сортировки и держать строгий порядок по `index`. |
| `locale` | `string` | браузерная | Локаль для `localeCompare` при сортировке по названию. |
| `storageKey` | `string` | `'dumb-tree'` | Префикс ключа `localStorage` для раскрытых папок (`:expanded`) и режима сортировки (`:sort`). |
| `sortable` | `(from: number, to: number) => void` | — | Включает drag-reorder в режиме `flat`; индексы — в **отображаемом** порядке. |
| `rowExtra` | `(node) => JSX.Element` | — | Доп. контент справа в строке (бейджи, иконки статуса). |
| `rowClass` | `(node) => string \| undefined` | — | Доп. класс на строку-ссылку (например, `opacity-50` для скрытых). |
| `titleClass` | `(node) => string \| undefined` | — | Доп. класс на текст строки (например, `line-through`). |
| `rowTitle` | `(node) => string` | `title · meta · id N` | Свой тултип строки. |
| `class` | `string` | — | Доп. класс на корневой `<aside>`. |
| `labels` | `DumbTreeLabels` | русские | Подписи кнопок/плейсхолдера — `{ search, sortIndex, sortName }`. По умолчанию **русские** (`Поиск`, `Индекс`, `Название`). |

## Поиск

Матчинг нечёткий: подстрока **или** подпоследовательность, без учёта регистра, по `title`, `meta` и строковому `id`. Пока в поле есть запрос:

- в режиме дерева показывается каждое совпадение вместе с предками, и всё принудительно раскрыто (сохранённое состояние раскрытия при этом не меняется);
- drag-reorder отключается — отображаемый порядок больше не соответствует исходному.

## Сортировка

Два режима, переключаются в UI и сохраняются по `storageKey`:

- **по индексу** — `index` по возрастанию, при равенстве — по названию;
- **по названию** — `localeCompare(title)`, при равенстве — по `index`.

`hideSort` фиксирует режим на `index` и убирает переключатель.

## Drag-reorder

Передай `sortable` **и** `flat` — появятся ручки перетаскивания. Перестановка работает на `createDumbSortable`, поэтому наследует поведение без reflow, описанное в [DumbSortable](DumbSortable.md#почему-не-дёргается): позиции снимаются один раз через `IntersectionObserver`, движение — чистый `transform`.

```tsx
<DumbTree
  nodes={items()}
  flat
  icons={icons}
  sortable={(from, to) => {
    const next = items().slice()
    next.splice(to, 0, next.splice(from, 1)[0])
    setItems(next)
  }}
/>
```

Перестановка намеренно работает **только в плоском режиме**: в дереве отображаемые строки принадлежат разным родителям, и одной пары `from → to` для описания перемещения не хватает.

## Персистентность

Раскрытые папки и режим сортировки уходят в `localStorage` под `${storageKey}:expanded` и `${storageKey}:sort` (через `@solid-primitives/storage`). Задавай разный `storageKey` каждому экземпляру дерева, иначе два сайдбара будут делить одно состояние.
