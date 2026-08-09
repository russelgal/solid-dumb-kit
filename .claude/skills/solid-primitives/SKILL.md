---
name: solid-primitives
description: Как проверить и взять готовый примитив из Solid Primitives вместо своего — витрина, две линии версий под Solid 1 и Solid 2, проверка на reflow и на сабпуть solid-js/web. Использовать, когда нужен жест, наблюдатель, дебаунс, медиа-запрос, буфер обмена, горячие клавиши или хранилище.
---

# Solid Primitives: сначала смотрим туда, потом пишем своё

Прежде чем писать очередной примитив — жест, наблюдатель, дебаунс, медиа-запрос,
буфер обмена, горячие клавиши, хранилище — **проверь, нет ли готового** у
[Solid Primitives](https://primitives2.solidjs.community/?path=/docs/inputs-gestures--docs)
(это витрина линии под Solid 2; старая — `primitives.solidjs.community`). Своё
пишем, только когда готовое не подходит, и тогда в комментарии — чем именно.

Что уже стоит и чем стоит пользоваться дальше: `@solid-primitives/storage`
(`makePersisted`), `event-listener` (`makeEventListener` — снимает подписку сам,
в компоненте не остаётся ручных `addEventListener`), `resize-observer`,
`intersection-observer`, `media` (`createMediaQuery`), `scheduled`
(`debounce`/`throttle`), `keyboard`.

**Проверка перед тем, как взять:**
1. **Железное правило про reflow сильнее удобства.** Примитив, который читает
   layout на горячем пути, не берём, даже если он официальный. Уже проверено:
   у `@solid-primitives/gestures` директива **`pan` зовёт
   `getBoundingClientRect()` на КАЖДЫЙ `pointermove`** — это ровно то, из-за чего
   выкинули `@viselect/vanilla` и запретили `@dnd-kit`. Не брать.
   Соседняя `swipe` reflow не делает, но отдаёт только свершившийся факт
   (направление на `pointerup`, и лишь если уложились в `timeframe`, по
   умолчанию 300 мс) — для жеста, где элемент едет за пальцем и возвращается,
   если не дотянули, её не хватает. Свайп плашки в `DumbToaster` поэтому свой.
2. **Две линии версий, и обе мимо, если примитив трогает `solid-js/web`.**
   Стабильные `1.x`/`2.x` — под Solid 1, `3.0.0-next.*` — под Solid 2 beta
   (`peerDependencies`: `solid-js ^2.0.0-beta`, `@solidjs/web`). Кит на линии
   `0.x` живёт с Solid 1 — значит стабильная; но потребитель может быть на
   Solid 2 (bluefable), а правило про пропавшие экспорты действует и на
   **зависимости**: их `dist` линкуется в ту же сборку.
   Так отпал `@solid-primitives/event-listener`: в `2.4.6` внутри
   `import { isServer } from "solid-js/web"` — сабпуть, которого в Solid 2 нет,
   а в `3.0.0-next.2` он уже чистый, но требует Solid 2. Одной версии на обе
   линии нет, поэтому оконные подписки в ките пока свои — `onMounted` +
   `onCleanup` даёт ровно то же, что `makeEventListener`.
   Проверка одной командой:
   `npm pack <пакет> && tar -xzf *.tgz && grep -r "solid-js/web" package/dist`.
3. Зависимость идёт в `dependencies` пакета (не `devDependencies`: это не сосед
   по воркспейсу), и её вес — повод подумать, не проще ли пятнадцать строк своих.

Ни MCP-сервера, ни `llms.txt` у сайта примитивов нет (проверено: SPA отдаёт
`index.html` на любой путь, включая `/mcp` и `/.well-known/mcp.json`). Смотреть
API — либо витрину, либо исходники в `solidjs-community/solid-primitives`, либо
`npm pack` нужной версии и `dist/*.js` глазами: так и нашёлся `getBoundingClientRect` в `pan`.
