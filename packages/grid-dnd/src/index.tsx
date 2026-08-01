export {
  DumbGridDnd,
  type DumbGridDndProps,
  type DumbGridDndItem,
} from './DumbGridDnd'

// Типы размеров приходят из `@solid-dumb-kit/grid` — математика у сеток общая.
// Реэкспортим их здесь, иначе потребителю, который просто задаёт блокам ширину,
// пришлось бы ставить ещё и `grid` только ради одного типа.
export type { SpanValue, SpanPreset, GridSpan } from '@solid-dumb-kit/grid'

// Solid-обёртка (группа сеток)
export {
  createDumbGridDndGroup,
  type DumbGridDndGroupHandle,
  type DumbGridDndHandle,
  type DndActive,
} from './solid'

// Движок без привязки к фреймворку
export {
  createGridDndEngine,
  planDrop,
  dndSupported,
  DND_MIME,
  type DndEngine,
  type DndGroupOptions,
  type DndZoneOptions,
  type DndZoneEngine,
  type DndTransferSource,
  type DndTransferTarget,
} from './dndCore'
