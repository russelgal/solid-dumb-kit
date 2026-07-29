export {
  SelectionArea,
  type SelectionAreaProps,
} from './SelectionArea'

// Solid-обёртка (публичный API)
export { createSelectionArea } from './solid'

// Движок без привязки к фреймворку
export {
  createSelectionEngine,
  type SelectionEngine,
  type SelectionCoreOptions,
} from './selectionCore'

export {
  areaFrom,
  clampPoint,
  hits,
  pickHits,
  resolveSelection,
  tapSelection,
  diffSelection,
  type Box,
  type Bounds,
  type IntersectMode,
} from './selectionMath'
