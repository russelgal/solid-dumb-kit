# solid-dumb-kit — инструкции для Claude

Маленькая SolidJS UI-либа (SelectionArea, ResizableGrid, DumbSortable).

## ЦЕЛЬ №1: СУПЕР БЫСТРО И БЕЗ КОСЯКОВ
Две вещи неразделимы и важнее всего: (1) максимальная производительность (60fps, ноль reflow, на сотнях/тысячах элементов) и (2) корректность — никаких визуальных багов, дёрганья, съезда, выпадения, кривого порядка. Любая правка оценивается по этим двум критериям; если фикс убирает косяк, но добавляет reflow/тормоз — это НЕ решение, искать другое.

## ЖЕЛЕЗНОЕ ПРАВИЛО: НИКАКОГО REFLOW В ЛИБЕ

В коде библиотеки (`src/`) **ЗАПРЕЩЕНО** всё, что форсит layout/reflow на горячем пути (драг, скролл, покадрово, в циклах по элементам):

- **`getBoundingClientRect`** по элементам — НЕТ. Вообще не должно мелькать в `src/` (кроме, возможно, ОДНОГО замера контейнера-скроллера на самом старте, закэшированного — но лучше без него).
- `offsetTop/offsetLeft/offsetWidth/offsetHeight`, `clientWidth/clientHeight`, `scrollWidth/scrollHeight`, `getComputedStyle(...)` — НЕ читать в циклах/покадрово.
- Никаких «синхронно замерю один элемент, это дёшево» — это всё равно forced reflow. **Не предлагать и не писать такое.**

### Как правильно
- Позиции/размеры элементов снимаются **один раз** через **IntersectionObserver** (`entry.boundingClientRect` считается off-main-thread, без reflow). См. `snapshot()` в `src/Sortable/sortableCore.ts`.
- Движение — **только `transform`** (GPU/compositor), не трогаем layout-свойства.
- Геометрию скроллера (top/left/clientW/clientH/max) кэшировать **один раз на старте**; покадрово читать только `scrollTop`/`scrollLeft` (это не forced reflow).
- Стили без зависимости от Tailwind/чужого CSS — структурные стили инлайном или инжектом (компонент самодостаточный).

## Структура `src/`: папка на фичу + барр-файл
Раскладка как у Kobalte/Corvu: каждая фича — своя папка со всеми файлами (компонент, css, ядро, тесты) и локальным `index.ts`, который перечисляет её публичный API. Корневой `src/index.tsx` реэкспортит **только из папок** (`from './Sortable'`), а не из файлов напрямую — так внутренние файлы можно переименовывать, не трогая entry.

```
src/
  index.tsx            # публичный API либы (единственный entry для tsup)
  env.d.ts
  SelectionArea/       index.ts, SelectionArea.tsx, SelectionArea.css
  ResizableGrid/       index.ts, ResizableGrid.tsx
  Sortable/            index.ts, sortableCore.ts, DumbSortable.tsx
  DumbTree/            index.ts, DumbTree.tsx
  utils/               index.ts, fmt.ts, slug.ts, zip.ts, imgproxy.ts, __tests__/
```

- Имена папок — PascalCase, как экспортируемые компоненты (у Kobalte kebab, потому что там папка = публичный подпуть `@kobalte/core/accordion`; у нас подпутей нет).
- CSS живёт рядом со своим компонентом; tsup склеивает всё в `dist/index.css`.
- Кросс-фичевые импорты — через файл, не через барр (`../Sortable/sortableCore`), чтобы не ловить циклы барр↔барр.
- Демо алиасит `solid-dumb-kit/dist/index.css` на `../src/SelectionArea/SelectionArea.css` (`playground/vite.config.ts`) — при переезде css не забыть.

## Пакетный менеджер: ТОЛЬКО pnpm
`npm`/`yarn` в этой репе **запрещены** — лок-файл один: `pnpm-lock.yaml` (закоммичен). `package-lock.json`/`yarn.lock` в .gitignore.

```bash
pnpm install        # зависимости
pnpm build          # tsup → dist/ (dist закоммичен, ставится с GitHub)
pnpm dev            # tsup --watch
pnpm demo           # dev-сервер демо (playground/)
pnpm demo:build     # сборка демо → playground/dist
pnpm test           # vitest run (утилиты + смоук-монтирование всех примеров, happy-dom)
```

- `pnpm-workspace.yaml` — только для `onlyBuiltDependencies: [esbuild]` (pnpm 10 блокирует postinstall-скрипты; без esbuild сборка падает). Воркспейсов нет, пакет один.
- `@solid-primitives/storage` **запинен на 4.3.4** (без `^`): в 4.4.0 сломана инференция типов `makePersisted` — dts-сборка `ResizableGrid` падает. Апать только вместе с проверкой `pnpm build`.
- Рантайм-зависимости утилит: `slug` (статический импорт — `genSlug` синхронный) и `fflate` (**динамический** `import()` внутри `extractImagesFromZip`, грузится только при фактической распаковке — не тащить его в top-level).
- `@types/node` **не ставим**: `process.env` в `src/` читается через каст `globalThis`, иначе dts-сборка требует типы Node.
- В `tsup.config.ts` **нельзя** вызывать `preset.writePackageJson()`. `tsup-preset-solid` поднимает два инстанса tsup параллельно, и запись `package.json` на лету ловится вторым инстансом в момент усечения файла: он не видит `dependencies`, external становится пустым и **все зависимости инлайнятся в бандл** (`index.js` раздувается втрое, появляется чанк `dist/browser/*` из fflate). Симптом плавающий — сборка «через раз». Поля `exports` в `package.json` и так уже верные; пресет только печатает их справочно.
- Перед коммитом `dist/` сверяйся с `git status dist` — тишина означает, что сборка воспроизвелась байт в байт.

## Донорская репа (источник для переноса)
`/Volumes/sites/_shops/_pioneer/packages/solid-dumb-kit` — **старая/внутренняя** версия кита внутри монорепы `_pioneer`. Читать оттуда можно свободно, **править — нельзя** (только читаем и переносим сюда по кусочкам, по явной просьбе).

Что там есть сверх текущей репы:
- Компоненты: `Lightbox` + `lightbox-api`/`lightbox-types`/`lightbox.css`, `ContextMenu`, `toast`, `Img`, `MediaGallery`, `UniversalTree`, `S3Dashboard`, `UserManager`
- Sortable-семейство на `@dnd-kit/solid`: `SortableList`, `SortableTable`, `SortableGrid` (здесь заменено на свой `sortableCore` + `DumbSortable`)
- ~~Утилиты `fmt`/`slug`/`zip`/`imgproxy`~~ — **перенесены** 27.07.2026 в `src/utils/` вместе с тестами

Правила переноса:
1. Код из донора **не копировать as-is** — он писался под монорепу: там Tailwind-классы и доменные хардкоды (`_pioneer`-specific env, бакеты, названия). Структурные стили — инлайном, доменные значения — через конфиг-функцию с фолбэком на env (пример: `configureImgproxy()` в `src/utils/imgproxy.ts`).
2. Любой перенос проходит проверку «ЖЕЛЕЗНОЕ ПРАВИЛО: никакого reflow». Замеры layout в доноре: `ResizableGrid.tsx`, `ContextMenu.tsx` — переписывать под IntersectionObserver + transform.
   Tailwind-классы в разметке: `SelectionArea`, `ResizableGrid`, `ContextMenu`, `UniversalTree`, `MediaGallery`, `S3Dashboard`, `UserManager` — заменять на инлайн/инжект стили.
3. Донор — на TS-конфиге монорепы; после переноса обязательно `pnpm build` (dts тоже собирается).

## Примеры и тесты
- `examples/*.example.tsx` — по одному на компонент, импортируют пакет **по имени** (`solid-dumb-kit`); в playground и vitest имя заворачивается алиасом на `src/`. Каждый пример подключён вкладкой в `playground/src/main.tsx` — добавил пример, добавь вкладку.
- `examples/__tests__/examples.test.tsx` — смоук: каждый пример монтируется в DOM и проверяется, что он что-то отрисовал. Ловит рассинхрон примеров с API кита.
- `vitest.setup.ts` подкладывает in-memory `localStorage`: happy-dom 20 отдаёт `globalThis.localStorage` **без** `getItem`/`setItem`, и `makePersisted` (ResizableGrid, DumbTree) падает. Если тест на компоненте с персистом внезапно валится с `storage.getItem is not a function` — смотри туда.
- `DumbTree` в примере оформлен CSS-шимом (~60 строк, подделывает нужные daisyUI-классы) и эмодзи-иконками — чтобы витрина оставалась самодостаточной.

## Версии: линия 0.x — под Solid 1
`0.1.0` и вся ветка `0.x` — для **SolidJS 1.x**. `peerDependencies.solid-js` = `^1.8.0` (именно каретка, не `>=1.8.0` — чтобы Solid 2 не подхватился молча и не сломался в рантайме у потребителя).

Когда выйдет Solid 2 — линии разводим (ветка `solid-1` для поддержки 0.x либо мажорка `1.0.0` под Solid 2); до этого момента поднимаем только minor/patch внутри `0.x`.

## Документация: две языковые версии, зеркально
`docs/*.md` — английский, `docs/ru/*.md` — русский; в корне `README.md` и `README.ru.md`. У каждого файла в первой строке переключатель языка.

**Правишь доку — правь обе версии в одном коммите.** Структура разделов зеркальная (одинаковый набор заголовков), чтобы расхождение было видно глазами и `grep -c '^#'`. Ссылки между русскими доками ведут на русские якоря (кириллица в якорях работает: `#почему-не-дёргается`).

## Прочее
- Деплой/пуш на git — **только по явной просьбе**. По умолчанию правим локально.
- Демо: `playground/` (Vite) → GitHub Pages через Actions (`.github/workflows/pages.yml`, pnpm + `--frozen-lockfile`).
