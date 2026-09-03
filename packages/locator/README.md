# @solid-dumb-kit/locator

Alt-клик по элементу открывает его разметку в редакторе

Часть [solid-dumb-kit](https://github.com/russelgal/solid-dumb-kit) — набора
компонентов для SolidJS, у которых за жест не бывает ни одного forced layout.

```bash
pnpm add -D @solid-dumb-kit/locator
```

Solid не нужен: пакет без фреймворка. Тянет за собой: `@babel/parser`.

Половина для сборщика (плагин Vite) живёт подпутём `@solid-dumb-kit/locator/vite`,
браузерная — в корне пакета. Открывает файл сам дев-сервер Vite своим штатным
`/__open-in-editor`, поэтому работает всё это только в разработке.

## Документация

- по-русски: [docs/ru/Locator.md](https://github.com/russelgal/solid-dumb-kit/blob/main/docs/ru/Locator.md)
- in English: [docs/Locator.md](https://github.com/russelgal/solid-dumb-kit/blob/main/docs/Locator.md)

Живое демо со всеми компонентами: https://solid-dumb-kit.vercel.app/

## Лицензия

MIT
