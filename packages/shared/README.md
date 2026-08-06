# @solid-dumb-kit/shared

FLIP, автопрокрутка, вьюпорт и правила жестов — база остальных пакетов

Часть [solid-dumb-kit](https://github.com/russelgal/solid-dumb-kit) — набора
компонентов для SolidJS, у которых за жест не бывает ни одного forced layout.

```bash
pnpm add @solid-dumb-kit/shared
```

Peer-зависимость: `solid-js@^1.8.0`.

Ставить отдельно обычно незачем: пакет приезжает внутри тех, кто на нём стоит.
Прямо он нужен, когда берут его примитивы — виртуализацию длинных списков,
очередь заливки, отмену действий.

## Документация

- Длинные списки (`createVirtualizer`, `createRowIndex`):
  [по-русски](https://github.com/russelgal/solid-dumb-kit/blob/main/docs/ru/Virtual.md) ·
  [in English](https://github.com/russelgal/solid-dumb-kit/blob/main/docs/Virtual.md)
- Перенос между компонентами (`GlobalDnd`):
  [по-русски](https://github.com/russelgal/solid-dumb-kit/blob/main/docs/ru/GlobalDnd.md) ·
  [in English](https://github.com/russelgal/solid-dumb-kit/blob/main/docs/GlobalDnd.md)

Живое демо со всеми компонентами: https://solid-dumb-kit.vercel.app/

## Лицензия

MIT
