export {
  DumbGridDnd,
  type DumbGridDndProps,
  type DumbGridDndItem,
} from './DumbGridDnd'

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
